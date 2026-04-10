"""
main.py — FastAPI backend for the FeedDigest system.

Architecture:
  Next.js frontend (port 3000)
      ↕  HTTP / cookie
  FastAPI backend (port 5000)   ← you are here
      ↕
  SQLite + collector / processor / digest_builder

Auth: stateless JWT stored in an httpOnly cookie (`access_token`).
      A second non-httpOnly cookie (`digest_auth`) lets the Next.js
      middleware gate pages without reading the JWT itself.
"""

import io
import os
import secrets
import smtplib
import time
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from threading import Lock, Thread

from fastapi import FastAPI, Request, HTTPException, Depends, Cookie
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from dotenv import load_dotenv

import bcrypt as _bcrypt

from config import MIN_IMPORTANCE_SCORE, DOMAINS, SECTIONS
from database import (
    get_all_digests, get_todays_articles, get_articles_for_date, get_articles_by_categories,
    delete_digest, init_db, seed_admin,
    create_user, get_user_by_username, get_user_by_email,
    username_exists, email_exists, update_user_profile, get_user_by_id,
    get_all_users, get_user_favorite_ids, add_favorite, remove_favorite,
    get_articles_by_ids,
)

# ── Password hashing (bcrypt 5.x API) ─────────────────────────────────────────
def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# ── OTP store (in-memory, single process) ─────────────────────────────────────
# Stores pending registrations keyed by normalised email address.
# Each record expires after OTP_TTL_SECONDS and is deleted on first use.
OTP_TTL_SECONDS = 600      # 10 minutes
OTP_MAX_ATTEMPTS = 5

_otp_store: dict[str, dict] = {}
_otp_lock  = Lock()

# ── Pipeline status (in-memory, single process) ───────────────────────────────
_pipeline_lock   = Lock()
_pipeline_status = {"running": False, "last_result": None, "last_run": None}


def _run_pipeline_bg(username: str) -> None:
    from collector import run_collection
    from processor import run_processing
    from digest_builder import build_digest
    try:
        print(f"[api] Pipeline started by {username}")
        run_collection()
        run_processing()
        build_digest()
        result = "ok"
        print("[api] Pipeline complete")
    except Exception as exc:
        result = f"error: {exc}"
        print(f"[api] Pipeline error: {exc}")
    with _pipeline_lock:
        _pipeline_status["running"]     = False
        _pipeline_status["last_result"] = result
        _pipeline_status["last_run"]    = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _make_otp() -> str:
    """Cryptographically-random 6-digit code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _otp_mask_email(email: str) -> str:
    """b*****@gmail.com — shows first char + domain for UX confirmation."""
    local, domain = email.rsplit("@", 1)
    return local[0] + "*" * max(1, len(local) - 1) + "@" + domain


def _otp_store_pending(email: str, otp: str, pending: dict) -> None:
    with _otp_lock:
        _otp_store[email] = {
            "otp":        otp,
            "expires_at": time.monotonic() + OTP_TTL_SECONDS,
            "attempts":   0,
            "pending":    pending,      # full registration payload
        }


def _otp_verify(email: str, code: str) -> tuple[bool, str, dict | None]:
    """Returns (ok, error_message, pending_data)."""
    with _otp_lock:
        rec = _otp_store.get(email)
        if not rec:
            return False, "No verification code found. Please request a new one.", None
        if time.monotonic() > rec["expires_at"]:
            _otp_store.pop(email, None)
            return False, "Code has expired. Please request a new one.", None
        rec["attempts"] += 1
        if rec["attempts"] > OTP_MAX_ATTEMPTS:
            _otp_store.pop(email, None)
            return False, "Too many attempts. Please request a new code.", None
        if rec["otp"] != code.strip():
            remaining = OTP_MAX_ATTEMPTS - rec["attempts"]
            return False, f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} left.", None
        pending = rec["pending"]
        _otp_store.pop(email, None)   # single-use
        return True, "", pending


# ── Email sender ──────────────────────────────────────────────────────────────
def _send_otp_email(to_email: str, otp: str, username: str = "") -> None:
    """
    Send a verification email via SMTP.
    Falls back to printing the OTP to the console if SMTP is not configured —
    useful for local development without email credentials.
    """
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASS", "").strip()
    smtp_from = os.getenv("SMTP_FROM", smtp_user).strip()

    if not smtp_host or not smtp_user or not smtp_pass:
        # Dev fallback — print to console so signup can still be tested
        print(f"\n{'='*50}")
        print(f"[EMAIL FALLBACK — SMTP not configured]")
        print(f"  To:   {to_email}")
        print(f"  OTP:  {otp}")
        print(f"{'='*50}\n")
        return

    greeting = f"Hi {username}," if username else "Hello,"

    html = f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a24;border:1px solid #2a2a3a;border-radius:16px;overflow:hidden;max-width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">The FeedDigest</p>
          <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">Email Verification</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;font-size:15px;color:#c8c6c0;">{greeting}</p>
          <p style="margin:0 0 28px;font-size:15px;color:#c8c6c0;line-height:1.6;">
            Here is your one-time verification code. It expires in <strong style="color:#fff;">10 minutes</strong>.
          </p>

          <!-- OTP box -->
          <div style="text-align:center;margin:0 0 28px;">
            <span style="display:inline-block;background:#0d0d12;border:2px solid #2563eb;border-radius:12px;padding:20px 40px;font-size:38px;font-weight:800;letter-spacing:14px;color:#ffffff;font-family:'Courier New',monospace;">
              {otp}
            </span>
          </div>

          <p style="margin:0;font-size:13px;color:#5e5c58;line-height:1.6;">
            If you did not request this code, you can safely ignore this email.
            Never share this code with anyone.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2a3a;text-align:center;">
          <p style="margin:0;font-size:12px;color:#3e3c38;">The FeedDigest · Local Intelligence Feed</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"{greeting}\n\n"
        f"Your FeedDigest verification code is:\n\n"
        f"  {otp}\n\n"
        f"This code expires in 10 minutes.\n"
        f"Do not share it with anyone."
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your verification code: {otp}"
    msg["From"]    = smtp_from
    msg["To"]      = to_email
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as srv:
        srv.ehlo()
        srv.starttls()
        srv.login(smtp_user, smtp_pass)
        srv.sendmail(smtp_from, to_email, msg.as_string())
    print(f"[api] OTP email sent to {to_email}")

load_dotenv()

# ── JWT config ────────────────────────────────────────────────────

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is not set in .env — refusing to start without a secret key.")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def _create_token(username: str, role: str, user_id: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": username, "role": role, "uid": user_id, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# ── App & middleware ──────────────────────────────────────────────

IS_PRODUCTION = os.getenv("IS_PRODUCTION", "false").strip().lower() == "true"

app = FastAPI(
    title="FeedDigest API",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
)

_FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip()
_ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]
if _FRONTEND_URL:
    _ALLOWED_ORIGINS.append(_FRONTEND_URL)   # e.g. https://feeddigest.vercel.app

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    content_length = request.headers.get("content-length")
    extra = f"  body={content_length}B" if content_length else ""
    print(f"[api] --> {request.method} {request.url.path}{extra}")

    response = await call_next(request)

    duration_ms = int((time.time() - start) * 1000)
    print(
        f"[api] <-- {request.method} {request.url.path}  "
        f"status={response.status_code}  time={duration_ms}ms"
    )
    return response


@app.on_event("startup")
async def on_startup():
    init_db()
    # Seed admin from env — idempotent (INSERT OR IGNORE)
    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD")
    if not admin_pass:
        raise RuntimeError("ADMIN_PASSWORD is not set in .env — refusing to seed admin without a password.")
    seed_admin(admin_user, hash_password(admin_pass))
    print(f"[api] FastAPI started — database ready | admin seeded as '{admin_user}'")


# ── Auth dependencies ─────────────────────────────────────────────

def get_current_user(access_token: str = Cookie(default=None)) -> dict:
    """Read and validate the JWT from the httpOnly cookie."""
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = _decode_token(access_token)
        return {
            "id":       payload.get("uid"),
            "username": payload["sub"],
            "role":     payload["role"],
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Auth cookie helpers ───────────────────────────────────────────

def _set_auth_cookies(response: JSONResponse, token: str) -> None:
    """Set the JWT cookie (httpOnly) and the presence cookie for Next.js middleware."""
    response.set_cookie(
        "access_token", token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=TOKEN_EXPIRE_HOURS * 3600,
    )
    # Non-httpOnly so Next.js middleware can read it
    response.set_cookie(
        "digest_auth", "1",
        httponly=False,
        samesite="lax",
        path="/",
        max_age=TOKEN_EXPIRE_HOURS * 3600,
    )


def _clear_auth_cookies(response: JSONResponse) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("digest_auth", path="/")


# ── Digest data builder ───────────────────────────────────────────

def _build_digest_data(date_str: str) -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if date_str == today:
        articles = get_todays_articles(min_importance=MIN_IMPORTANCE_SCORE)
    else:
        articles = get_articles_for_date(date_str, min_importance=MIN_IMPORTANCE_SCORE)

    security_alerts = [a for a in articles if a.get("is_security_alert")]
    top_stories = sorted(
        articles, key=lambda a: a.get("importance_score", 0), reverse=True
    )[:5]

    sections_data = []
    for section in SECTIONS:
        if section["id"] == "ai-security":
            continue
        cats = section["categories"]
        section_articles = [a for a in articles if a.get("category") in cats]
        if not section_articles:
            continue
        sections_data.append({**section, "articles": section_articles})

    return {
        "date": date_str,
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "total_count": len(articles),
        "security_alerts": security_alerts,
        "top_stories": top_stories,
        "sections": sections_data,
        "has_content": len(articles) > 0,
    }


# ── PDF generator ─────────────────────────────────────────────────

def _pdf_text(text: str, limit: int = 0) -> str:
    """
    Sanitize text for fpdf2 Helvetica (Latin-1 only).
    - Replaces unsupported Unicode chars with '?'
    - Breaks long words/URLs so multi_cell never runs out of horizontal space
    - Optionally truncates to `limit` chars
    """
    if not text:
        return ""
    if limit:
        text = text[:limit]
    # Replace common Unicode punctuation with ASCII equivalents
    replacements = {
        "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
        "\u2013": "-", "\u2014": "-", "\u2026": "...", "\u00a0": " ",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    # Encode to Latin-1, replacing anything that can't be represented
    text = text.encode("latin-1", errors="replace").decode("latin-1")
    # Break any single token longer than 60 chars (e.g. URLs) so multi_cell can wrap
    words = text.split()
    broken = []
    for w in words:
        while len(w) > 60:
            broken.append(w[:60])
            w = w[60:]
        broken.append(w)
    return " ".join(broken)


def _generate_pdf(date_str: str) -> bytes:
    from fpdf import FPDF

    articles = get_todays_articles(min_importance=MIN_IMPORTANCE_SCORE)
    pdf = FPDF()
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    # Pre-compute usable page width (A4 = 210 mm, margins 20 each side → 170 mm)
    # Using an explicit width prevents "Not enough horizontal space" errors when
    # the X cursor drifts after cell/multi_cell operations.
    PW = pdf.w - pdf.l_margin - pdf.r_margin  # 170 mm

    def mc(h: float, text: str) -> None:
        """multi_cell wrapper: resets X to left margin before every call."""
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(PW, h, text)

    pdf.set_font("Helvetica", "B", 28)
    pdf.set_x(pdf.l_margin)
    pdf.cell(PW, 12, "The FeedDigest", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_x(pdf.l_margin)
    pdf.cell(PW, 8, date_str, new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_x(pdf.l_margin)
    pdf.cell(
        PW, 6,
        "Your daily briefing on artificial intelligence, technology & security",
        new_x="LMARGIN", new_y="NEXT", align="C",
    )
    pdf.ln(4)
    pdf.set_draw_color(26, 16, 8)
    pdf.set_line_width(0.8)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(6)

    security = [a for a in articles if a.get("is_security_alert")]
    if security:
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_fill_color(139, 0, 0)
        pdf.set_text_color(255, 255, 255)
        pdf.set_x(pdf.l_margin)
        pdf.cell(PW, 8, "  SECURITY ALERTS", new_x="LMARGIN", new_y="NEXT", fill=True)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)
        for a in security:
            pdf.set_font("Helvetica", "B", 10)
            mc(6, _pdf_text(a.get("title", ""), 90))
            pdf.set_font("Helvetica", "", 9)
            summary = _pdf_text(a.get("summary", ""), 300)
            if summary:
                mc(5, summary)
            pdf.set_font("Helvetica", "I", 8)
            pdf.set_x(pdf.l_margin)
            pdf.cell(PW, 5, _pdf_text(a.get("source_name", "")), new_x="LMARGIN", new_y="NEXT")
            pdf.ln(3)
        pdf.ln(2)

    for section in SECTIONS:
        cats = section["categories"]
        section_articles = [a for a in articles if a.get("category") in cats]
        if not section_articles:
            continue
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_fill_color(240, 240, 240)
        pdf.set_x(pdf.l_margin)
        pdf.cell(PW, 7, f"  {_pdf_text(section['label'].upper())}", new_x="LMARGIN", new_y="NEXT", fill=True)
        pdf.ln(2)
        for a in section_articles:
            if pdf.get_y() > 260:
                pdf.add_page()
            pdf.set_font("Helvetica", "B", 10)
            mc(6, _pdf_text(a.get("title", ""), 90))
            pdf.set_font("Helvetica", "", 9)
            summary = _pdf_text(a.get("summary", ""), 300)
            if summary:
                mc(5, summary)
            pdf.set_font("Helvetica", "I", 8)
            score_stars = "*" * a.get("importance_score", 0)
            source = f"{_pdf_text(a.get('source_name', ''))}  |  Score: {score_stars}"
            pdf.set_x(pdf.l_margin)
            pdf.cell(PW, 5, source, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(3)
        pdf.ln(2)

    return bytes(pdf.output())


def _generate_favorites_pdf(user_id: int) -> bytes:
    """Build a PDF of a user's saved favourites, grouped by section."""
    from fpdf import FPDF
    from datetime import date as _date

    ids      = get_user_favorite_ids(user_id)
    articles = get_articles_by_ids(ids)

    pdf = FPDF()
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    PW = pdf.w - pdf.l_margin - pdf.r_margin  # 170 mm

    def mc(h: float, text: str) -> None:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(PW, h, text)

    # ── Cover ──────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_x(pdf.l_margin)
    pdf.cell(PW, 12, "My Favourites", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_x(pdf.l_margin)
    pdf.cell(PW, 7, f"Generated on {_date.today().strftime('%B %d, %Y')}", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_font("Helvetica", "I", 9)
    pdf.set_x(pdf.l_margin)
    count_label = f"{len(articles)} saved article{'s' if len(articles) != 1 else ''}"
    pdf.cell(PW, 6, count_label, new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.ln(4)
    pdf.set_draw_color(239, 68, 68)
    pdf.set_line_width(0.8)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(6)

    if not articles:
        pdf.set_font("Helvetica", "I", 11)
        pdf.set_x(pdf.l_margin)
        pdf.cell(PW, 10, "No favourites saved yet.", new_x="LMARGIN", new_y="NEXT", align="C")
        return bytes(pdf.output())

    # ── Group by section, preserving SECTIONS order ────────────────
    def _render_article(a: dict) -> None:
        if pdf.get_y() > 260:
            pdf.add_page()
        pdf.set_font("Helvetica", "B", 10)
        mc(6, _pdf_text(a.get("title", ""), 90))
        pdf.set_font("Helvetica", "", 9)
        summary = _pdf_text(a.get("summary", ""), 300)
        if summary:
            mc(5, summary)
        pdf.set_font("Helvetica", "I", 8)
        pub = a.get("published_at", "") or ""
        source_line = _pdf_text(a.get("source_name", ""))
        if pub:
            source_line += f"  |  {pub[:10]}"
        pdf.set_x(pdf.l_margin)
        pdf.cell(PW, 5, source_line, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    rendered_ids: set = set()

    for section in SECTIONS:
        cats = section["categories"]
        section_arts = [a for a in articles if a.get("category") in cats]
        if not section_arts:
            continue
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_fill_color(240, 240, 240)
        pdf.set_draw_color(200, 200, 200)
        pdf.set_x(pdf.l_margin)
        pdf.cell(PW, 7, f"  {_pdf_text(section['label'].upper())}", new_x="LMARGIN", new_y="NEXT", fill=True)
        pdf.ln(2)
        for a in section_arts:
            _render_article(a)
            rendered_ids.add(a["id"])
        pdf.ln(2)

    # ── Anything not matched by a section ─────────────────────────
    ungrouped = [a for a in articles if a["id"] not in rendered_ids]
    if ungrouped:
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_fill_color(240, 240, 240)
        pdf.set_x(pdf.l_margin)
        pdf.cell(PW, 7, "  OTHER", new_x="LMARGIN", new_y="NEXT", fill=True)
        pdf.ln(2)
        for a in ungrouped:
            _render_article(a)

    return bytes(pdf.output())


def _generate_section_pdf(section_id: str) -> bytes:
    """Build a PDF containing all of today's articles for a single section."""
    from fpdf import FPDF
    from datetime import date as _date

    # Locate section metadata across all domains
    section = next(
        (s for d in DOMAINS for s in d["sections"] if s["id"] == section_id),
        None,
    )
    if not section:
        raise ValueError(f"Section not found: {section_id}")

    articles = get_articles_by_categories(
        section["categories"], min_importance=MIN_IMPORTANCE_SCORE
    )

    pdf = FPDF()
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    PW = pdf.w - pdf.l_margin - pdf.r_margin  # 170 mm

    def mc(h: float, text: str) -> None:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(PW, h, text)

    # ── Cover ──────────────────────────────────────────────────────
    icon  = section.get("icon", "")
    label = _pdf_text(f"{icon}  {section['label']}" if icon else section["label"])

    pdf.set_font("Helvetica", "B", 24)
    pdf.set_x(pdf.l_margin)
    pdf.cell(PW, 12, label, new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_x(pdf.l_margin)
    pdf.cell(PW, 7, f"Generated on {_date.today().strftime('%B %d, %Y')}", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_font("Helvetica", "I", 9)
    pdf.set_x(pdf.l_margin)
    count_label = f"{len(articles)} article{'s' if len(articles) != 1 else ''} from the last 24 hours"
    pdf.cell(PW, 6, count_label, new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.ln(4)
    pdf.set_draw_color(26, 16, 8)
    pdf.set_line_width(0.8)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(6)

    if not articles:
        pdf.set_font("Helvetica", "I", 11)
        pdf.set_x(pdf.l_margin)
        pdf.cell(PW, 10, "No articles in this section today.", new_x="LMARGIN", new_y="NEXT", align="C")
        return bytes(pdf.output())

    # ── Article list ───────────────────────────────────────────────
    for a in articles:
        if pdf.get_y() > 260:
            pdf.add_page()
        pdf.set_font("Helvetica", "B", 10)
        mc(6, _pdf_text(a.get("title", ""), 90))
        pdf.set_font("Helvetica", "", 9)
        summary = _pdf_text(a.get("summary", ""), 300)
        if summary:
            mc(5, summary)
        pdf.set_font("Helvetica", "I", 8)
        pub         = (a.get("published_at") or "")[:10]
        score_stars = "*" * a.get("importance_score", 0)
        source_line = _pdf_text(a.get("source_name", ""))
        if pub:
            source_line += f"  |  {pub}"
        source_line += f"  |  {score_stars}"
        pdf.set_x(pdf.l_margin)
        pdf.cell(PW, 5, source_line, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    return bytes(pdf.output())


# ── Auth routes ───────────────────────────────────────────────────

@app.post("/api/auth/send-otp")
async def send_otp(request: Request):
    """
    Step 1 of signup — validate fields, then send a 6-digit OTP to the email.
    All registration data is stored in-memory until the OTP is verified.
    """
    data     = await request.json()
    username = (data.get("username") or "").strip()
    email    = (data.get("email")    or "").strip().lower()
    password = (data.get("password") or "")
    name     = (data.get("name")     or "").strip()
    avatar   = (data.get("avatar")   or "Neural").strip() or "Neural"

    # Field validation
    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if not password or len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    # Uniqueness checks (before sending any email)
    if username_exists(username):
        raise HTTPException(status_code=409, detail="Username already taken.")
    if email_exists(email):
        raise HTTPException(status_code=409, detail="Email already registered.")

    otp = _make_otp()
    _otp_store_pending(email, otp, {
        "username":      username,
        "email":         email,
        "password_hash": hash_password(password),   # never store plaintext
        "name":          name,
        "avatar":        avatar,
    })

    try:
        _send_otp_email(email, otp, name or username)
    except Exception as exc:
        print(f"[api] Failed to send OTP email to {email}: {exc}")
        raise HTTPException(status_code=500, detail="Could not send verification email. Check SMTP settings in .env.")

    return {
        "ok":          True,
        "masked_email": _otp_mask_email(email),
        "expires_in":   OTP_TTL_SECONDS,
    }


@app.post("/api/auth/verify-otp")
async def verify_otp(request: Request):
    """
    Step 2 of signup — verify OTP, create account, return JWT cookie.
    """
    data  = await request.json()
    email = (data.get("email") or "").strip().lower()
    code  = (data.get("otp")   or "").strip()

    if not email or not code:
        raise HTTPException(status_code=400, detail="Email and OTP are required.")

    ok, error, pending = _otp_verify(email, code)
    if not ok:
        raise HTTPException(status_code=400, detail=error)

    # Re-check uniqueness (rare race condition guard)
    if username_exists(pending["username"]):
        raise HTTPException(status_code=409, detail="Username was taken while you were verifying. Please sign up again.")
    if email_exists(email):
        raise HTTPException(status_code=409, detail="Email was registered while you were verifying. Please log in.")

    user_id = create_user(
        pending["username"],
        pending["email"],
        pending["password_hash"],
        pending["name"],
        pending["avatar"],
    )
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create account.")

    token    = _create_token(pending["username"], "user", user_id)
    response = JSONResponse({"ok": True, "role": "user"})
    _set_auth_cookies(response, token)
    print(f"[api] New verified user registered: {pending['username']} ({email})")
    return response


@app.post("/api/auth/resend-otp")
async def resend_otp(request: Request):
    """Re-send an OTP for an existing pending registration (rate-limited by TTL)."""
    data  = await request.json()
    email = (data.get("email") or "").strip().lower()

    with _otp_lock:
        rec = _otp_store.get(email)

    if not rec:
        raise HTTPException(status_code=400, detail="No pending signup found. Please start signup again.")

    # Generate a fresh OTP and reset TTL
    otp     = _make_otp()
    pending = rec["pending"]
    _otp_store_pending(email, otp, pending)

    try:
        _send_otp_email(email, otp, pending.get("name") or pending.get("username", ""))
    except Exception as exc:
        print(f"[api] Failed to resend OTP to {email}: {exc}")
        raise HTTPException(status_code=500, detail="Could not resend email. Check SMTP settings.")

    return {"ok": True, "masked_email": _otp_mask_email(email), "expires_in": OTP_TTL_SECONDS}


@app.post("/api/auth/login")
async def login(request: Request):
    data     = await request.json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "")

    user = get_user_by_username(username)
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="Account is disabled.")

    token    = _create_token(username, user["role"], user["id"])
    response = JSONResponse({"ok": True, "role": user["role"]})
    _set_auth_cookies(response, token)
    return response


@app.post("/api/auth/logout")
async def logout():
    response = JSONResponse({"ok": True})
    _clear_auth_cookies(response)
    return response


@app.get("/api/auth/me")
async def me(user: dict = Depends(get_current_user)):
    profile = get_user_by_id(user["id"]) if user.get("id") else None
    return {
        "authenticated": True,
        "id":        user["id"],
        "username":  user["username"],
        "role":      user["role"],
        "name":      profile.get("name", "")      if profile else "",
        "email":     profile.get("email", "")     if profile else "",
        "interests": profile.get("interests", "") if profile else "",
        "avatar":    profile.get("avatar", "🤖")  if profile else "🤖",
    }


# ── Profile routes ────────────────────────────────────────────────────────────

@app.get("/api/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    profile = get_user_by_id(user["id"])
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return {
        "id":        profile["id"],
        "username":  profile["username"],
        "email":     profile["email"],
        "name":      profile.get("name", ""),
        "role":      profile["role"],
        "avatar":    profile.get("avatar", "🤖"),
        "interests": profile.get("interests", ""),
        "created_at": profile.get("created_at", ""),
    }


@app.put("/api/profile")
async def update_profile(request: Request, user: dict = Depends(get_current_user)):
    data      = await request.json()
    name      = (data.get("name")      or "").strip()
    interests = (data.get("interests") or "").strip()
    avatar    = (data.get("avatar")    or "").strip()
    update_user_profile(user["id"], name, interests, avatar)
    return {"ok": True}


# ── Admin — user management ───────────────────────────────────────────────────

@app.get("/api/admin/users")
async def admin_list_users(user: dict = Depends(get_admin_user)):
    return get_all_users()


# ── Favorites ─────────────────────────────────────────────────────────────────

@app.get("/api/favorites")
async def list_favorites(user: dict = Depends(get_current_user)):
    """Return full article objects for the current user's favorites."""
    ids      = get_user_favorite_ids(user["id"])
    articles = get_articles_by_ids(ids)
    return {"ok": True, "articles": articles, "ids": ids}


@app.get("/api/favorites/ids")
async def list_favorite_ids(user: dict = Depends(get_current_user)):
    """Return just the article IDs — lightweight call for the homepage."""
    return {"ids": get_user_favorite_ids(user["id"])}


@app.post("/api/favorites/{article_id}")
async def save_favorite(article_id: int, user: dict = Depends(get_current_user)):
    ok = add_favorite(user["id"], article_id)
    return {"ok": ok, "article_id": article_id, "action": "added"}


@app.delete("/api/favorites/{article_id}")
async def unsave_favorite(article_id: int, user: dict = Depends(get_current_user)):
    ok = remove_favorite(user["id"], article_id)
    return {"ok": ok, "article_id": article_id, "action": "removed"}


@app.get("/api/favorites/pdf")
async def favorites_pdf(user: dict = Depends(get_current_user)):
    """Download the current user's saved favourites as a PDF."""
    try:
        pdf_bytes = _generate_favorites_pdf(user["id"])
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=my-favourites.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Domain & section routes ───────────────────────────────────────

@app.get("/api/domains")
def api_domains(user: dict = Depends(get_current_user)):
    # Must include sections — page.tsx iterates d.sections to build the section layout
    return [
        {
            "id": d["id"],
            "label": d["label"],
            "color": d["color"],
            "icon": d["icon"],
            "sections": [
                {
                    "id": s["id"],
                    "label": s["label"],
                    "color": s["color"],
                    "border": s["border"],
                    "bg": s["bg"],
                    "icon": s["icon"],
                }
                for s in d["sections"]
            ],
        }
        for d in DOMAINS
    ]


@app.get("/api/domain/{domain_id}")
def api_domain(domain_id: str, user: dict = Depends(get_current_user)):
    domain = next((d for d in DOMAINS if d["id"] == domain_id), None)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    return {
        "id": domain["id"],
        "label": domain["label"],
        "color": domain["color"],
        "sections": [
            {
                "id": s["id"], "label": s["label"], "color": s["color"],
                "border": s["border"], "bg": s["bg"], "icon": s["icon"],
            }
            for s in domain["sections"]
        ],
    }


@app.get("/api/domain/{domain_id}/section/{section_id}")
def api_section(
    domain_id: str, section_id: str, user: dict = Depends(get_current_user)
):
    domain = next((d for d in DOMAINS if d["id"] == domain_id), None)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    section = next((s for s in domain["sections"] if s["id"] == section_id), None)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    articles = get_articles_by_categories(
        section["categories"], min_importance=MIN_IMPORTANCE_SCORE
    )
    return {
        "section": {
            "id": section["id"], "label": section["label"],
            "color": section["color"], "border": section["border"],
            "bg": section["bg"], "icon": section["icon"],
        },
        "domain": {"id": domain["id"], "label": domain["label"]},
        "articles": articles,
        "total": len(articles),
    }


@app.get("/api/section/{section_id}/pdf")
def api_section_pdf(section_id: str, user: dict = Depends(get_current_user)):
    """Download today's articles for a single section as a PDF."""
    try:
        pdf_bytes = _generate_section_pdf(section_id)
        filename  = f"section-{section_id}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Digest routes ─────────────────────────────────────────────────

@app.get("/api/digest/today")
def api_today(user: dict = Depends(get_current_user)):
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return _build_digest_data(date_str)


@app.get("/api/digest/{date_str}/pdf")
def api_digest_pdf(date_str: str, user: dict = Depends(get_current_user)):
    try:
        pdf_bytes = _generate_pdf(date_str)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=ai-digest-{date_str}.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/digest/{date_str}")
def api_digest(date_str: str, user: dict = Depends(get_current_user)):
    return _build_digest_data(date_str)


@app.get("/api/digests")
def api_digests(user: dict = Depends(get_current_user)):
    return get_all_digests()


# ── Refresh (admin only) ──────────────────────────────────────────

@app.post("/api/refresh")
def api_refresh(user: dict = Depends(get_admin_user)):
    with _pipeline_lock:
        if _pipeline_status["running"]:
            raise HTTPException(status_code=409, detail="Pipeline is already running")
        _pipeline_status["running"]     = True
        _pipeline_status["last_result"] = None
    Thread(target=_run_pipeline_bg, args=(user["username"],), daemon=True).start()
    return {"ok": True, "status": "started"}


@app.get("/api/refresh/status")
def api_refresh_status(user: dict = Depends(get_admin_user)):
    with _pipeline_lock:
        return dict(_pipeline_status)


# ── Admin routes ──────────────────────────────────────────────────

@app.get("/api/admin/digests")
def admin_digests(user: dict = Depends(get_admin_user)):
    return get_all_digests()


@app.delete("/api/admin/digest/{digest_id}")
def admin_delete_digest(digest_id: int, user: dict = Depends(get_admin_user)):
    ok = delete_digest(digest_id)
    if ok:
        print(f"[api] Digest {digest_id} deleted by admin: {user['username']}")
    return {"ok": ok}
