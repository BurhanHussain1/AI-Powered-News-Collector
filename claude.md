# FeedDigest — Project Documentation

## Project Overview

A personal AI news digest system that automatically collects articles from RSS feeds, GitHub
releases, and HuggingFace — processes them through the **OpenAI API** for summarization and
importance scoring — stores results in SQLite — and serves a **Next.js + FastAPI** dashboard
with user accounts, favourites, personalized interest filtering, a live front-page carousel,
and PDF export for digests, individual sections, and favourites.

**Backend:** Python 3.11+, FastAPI, SQLite (two databases), OpenAI SDK, bcrypt, python-jose, fpdf2
**Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
**Auth:** Stateless JWT via HTTP-only cookies, email OTP signup verification
**Run mode:** Local machine — backend on port 5000, frontend on port 3000

---

## Project Structure

```
News Collector/
├── claude.md                         # this file
├── .env                              # secrets — never commit
├── .gitignore
├── requirements.txt
├── config.py                         # all RSS sources, domains, sections, constants
├── database.py                       # SQLite schema + all DB operations (digest.db + users.db)
├── collector.py                      # fetches RSS feeds, GitHub releases, HuggingFace models
├── processor.py                      # sends batches to OpenAI, parses + writes results back
├── main.py                           # FastAPI app — all API routes + PDF generators
├── run.py                            # entry point: --web, --collect, --process, --all
├── digest.db                         # articles + digests (auto-created)
├── users.db                          # users + favourites (auto-created)
├── digests/                          # saved markdown digest files per day
└── frontend/
    ├── app/
    │   ├── layout.tsx                # root layout — includes AvatarPreloader
    │   ├── page.tsx                  # homepage — digest + front-page carousel + interest filter
    │   ├── login/page.tsx            # login form
    │   ├── signup/page.tsx           # 3-step signup: avatar → details → email OTP
    │   ├── profile/page.tsx          # user profile — name, avatar, interests
    │   ├── favorites/page.tsx        # saved favourites grid + Download PDF button
    │   ├── archive/page.tsx          # past digests list
    │   ├── digest/[date]/page.tsx    # view a specific past digest (matches homepage layout)
    │   ├── admin/page.tsx            # admin panel — user list
    │   └── domain/[domainId]/
    │       ├── page.tsx              # domain overview — all sections for that domain
    │       └── section/[sectionId]/
    │           └── page.tsx          # individual section page with ⬇ Download PDF button
    ├── components/
    │   ├── Masthead.tsx              # sticky nav — profile dropdown (Favourites, Interests, Sign Out)
    │   ├── FrontPageCarousel.tsx     # infinite auto-scroll carousel for top stories
    │   ├── ArticleCard.tsx           # article card with ♥ favourite toggle
    │   ├── HeroStory.tsx             # large hero article card with ♥ favourite toggle
    │   ├── SecurityAlerts.tsx        # red security alert section with ♥ favourite toggle
    │   ├── SectionBlock.tsx          # topic section grid with favourite support + ⬇ PDF button
    │   ├── DomainNav.tsx             # horizontal domain navigation bar
    │   ├── SectionSidebar.tsx        # sidebar for domain pages
    │   └── AvatarPreloader.tsx       # preloads DiceBear avatar images at boot
    ├── lib/
    │   ├── api.ts                    # all frontend API client functions
    │   ├── types.ts                  # TypeScript type definitions
    │   └── avatars.ts                # DiceBear avatar config + URL helpers
    └── middleware.ts                 # JWT cookie check — redirects unauthenticated users
```

---

## Databases

### digest.db (article content)
Managed by `database.py` via `get_conn()`.

**articles table**
```sql
CREATE TABLE IF NOT EXISTS articles (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    url              TEXT UNIQUE NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT,
    source_name      TEXT,
    category         TEXT,
    published_at     TEXT,
    fetched_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    processed        INTEGER DEFAULT 0,
    importance_score INTEGER,
    summary          TEXT,
    tags             TEXT,
    is_security_alert INTEGER DEFAULT 0
)
```

**digests table**
```sql
CREATE TABLE IF NOT EXISTS digests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT UNIQUE NOT NULL,
    filepath   TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

### users.db (user accounts + favourites)
Managed by `database.py` via `get_user_conn()`. Kept separate from digest data.

**users table**
```sql
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'user',       -- 'admin' or 'user'
    name          TEXT DEFAULT '',
    avatar        TEXT DEFAULT 'Neural',     -- DiceBear avatar ID
    interests     TEXT DEFAULT '',           -- comma-separated section IDs e.g. "new-models,research"
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    is_active     INTEGER DEFAULT 1
)
```

**favorites table**
```sql
CREATE TABLE IF NOT EXISTS favorites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    saved_at   TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, article_id)
)
```

---

## Backend — FastAPI (main.py)

### Environment & startup guards
- `IS_PRODUCTION=true/false` controls database paths, Swagger UI visibility, and CORS origins
- `JWT_SECRET_KEY` is **required** — app raises `ValueError` and refuses to start if missing or set to the placeholder value
- `ADMIN_PASSWORD` is **required** — same guard as above
- Swagger UI (`/docs`) and ReDoc (`/redoc`) are set to `None` (disabled) when `IS_PRODUCTION=true`

### Authentication
- Stateless JWT stored in two HTTP-only cookies: `access_token` (FastAPI reads) and `digest_auth` (Next.js middleware reads for presence check)
- Passwords hashed with `bcrypt` directly (not passlib — incompatible with bcrypt 5.x)
- Admin user seeded from `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) on startup via `INSERT OR IGNORE`
- Token contains: `sub` (username), `user_id`, `role`, `avatar`

### Auth endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/send-otp` | Validate signup data, store in-memory OTP (10-min TTL), send email |
| POST | `/api/auth/verify-otp` | Verify 6-digit OTP, create user account, issue JWT |
| POST | `/api/auth/resend-otp` | Regenerate OTP, reset TTL, resend email |
| POST | `/api/auth/login` | Authenticate, issue JWT |
| POST | `/api/auth/logout` | Clear JWT cookies |
| GET  | `/api/auth/me` | Return current user profile |

### Digest endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/digest/today` | Today's digest data (top stories, sections, security alerts) |
| GET | `/api/digest/{date}` | Specific date digest |
| GET | `/api/digest/{date}/pdf` | Download a specific date's digest as PDF |
| GET | `/api/domains` | All domain + section config |
| GET | `/api/refresh` | Trigger full pipeline run (collect → process → build) |

### Domain & section endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/domain/{domain_id}` | Domain metadata + section list |
| GET | `/api/domain/{domain_id}/section/{section_id}` | Section metadata + today's articles |
| GET | `/api/section/{section_id}/pdf` | Download today's articles for a section as PDF |

### Profile endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Current user's profile |
| PUT | `/api/profile` | Update name, avatar, interests |

### Favourites endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/favorites` | All saved articles (full objects) for current user |
| GET    | `/api/favorites/ids` | Just the article IDs — lightweight call for homepage |
| GET    | `/api/favorites/pdf` | Download all saved favourites as a PDF |
| POST   | `/api/favorites/{article_id}` | Save article to favourites |
| DELETE | `/api/favorites/{article_id}` | Remove article from favourites |

### Admin endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users (admin only) |

### PDF generation (main.py)

Three PDF generators share the same safe rendering pattern:

```python
PW = pdf.w - pdf.l_margin - pdf.r_margin  # explicit 170 mm — never use width=0

def mc(h, text):
    pdf.set_x(pdf.l_margin)   # always reset X before multi_cell
    pdf.multi_cell(PW, h, text)
```

Using `width=0` in `multi_cell` causes `"Not enough horizontal space"` errors when the X
cursor drifts after cell operations. Always pass `PW` explicitly and call `set_x(l_margin)` first.

**`_pdf_text(text, limit=0)`** — sanitises all text before passing to fpdf2:
- Replaces common Unicode punctuation (smart quotes, em-dash, ellipsis, NBSP) with ASCII equivalents
- Encodes to Latin-1, replacing any unsupported character with `?`
- Breaks tokens longer than 60 characters (e.g. URLs) so `multi_cell` can wrap them

**`_generate_pdf(date_str)`** — full day's digest PDF grouped by section

**`_generate_favorites_pdf(user_id)`** — all of a user's saved articles grouped by section

**`_generate_section_pdf(section_id)`** — today's articles for a single section

### Top stories / Front Page logic
```python
top_stories = sorted(articles, key=lambda a: a["importance_score"], reverse=True)[:5]
```
The **5 highest-scored articles** from today appear in the Front Page carousel. No manual tagging needed — importance scores are set automatically by GPT-4o-mini during processing.

---

## Frontend — Next.js 14

### Authentication flow
- `middleware.ts` checks for `digest_auth` cookie on every route
- Unauthenticated → redirect to `/login`
- Authenticated on `/login` or `/signup` → redirect to `/`

### Signup flow (3 steps)
1. **Avatar selection** — 4×5 grid of DiceBear `bottts-neutral` character avatars
2. **Account details** — username, email, display name, password
3. **Email OTP** — 6-digit code input with auto-focus, paste support, resend timer (60s cooldown)

### Homepage (`app/page.tsx`)
Server component. Fetches in parallel:
- `getToday()` — digest data
- `getDomains()` — section config
- `getMe()` — current user
- `getFavoriteIds()` — user's saved article IDs (for pre-rendering heart states)

**Section render order:**
1. Edition bar (date + article count)
2. **Front Page carousel** — top 5 stories, infinite auto-scroll, hover to pause
3. Security Alerts (only shown if alerts exist AND `ai-security` is in user's interests, or no interests set)
4. Interest filter banner (only if user has interests set)
5. Topic section blocks (filtered by user interests if set)

### Interest filtering
- User sets interests on the profile page — stored as comma-separated **section IDs** (e.g. `new-models,research,ai-security`)
- Interest option IDs in `profile/page.tsx` must match the section IDs defined in `config.py` exactly
- Homepage filters visible sections to only those matching the user's interests
- `SecurityAlerts` is shown only if no filter is active OR `ai-security` is in the selected interests
- If no interests set → all sections and security alerts shown

### Archive digest page (`app/digest/[date]/page.tsx`)
Server component. Matches the homepage layout exactly:
- Fetches digest, domains, auth, and `getFavoriteIds()` in parallel
- Renders `FrontPageCarousel` for top stories
- Renders `SecurityAlerts` (if any)
- Renders `SectionBlock` for each section
- Heart buttons are functional (favoritedIds passed to all components)

### Front Page Carousel (`FrontPageCarousel.tsx`)
- Articles tripled in DOM for seamless infinite loop
- CSS `marquee-track` animation (defined in `globals.css`)
- Speed: `Math.max(12, stories.length * 4)` seconds
- Hover over any card → `animationPlayState: paused` on the whole track
- Mouse leave → resumes automatically

### Favourites (`♥` heart icon)
- Every `ArticleCard`, `HeroStory`, and `SecurityAlerts` card has a heart button
- Click toggles `POST /api/favorites/{id}` or `DELETE /api/favorites/{id}`
- Optimistic UI — state updates instantly, API call happens in background
- Pre-rendered as filled/unfilled based on `favoritedIds` from server fetch

### Favourites page (`app/favorites/page.tsx`)
Client component. Shows all saved articles in a grid.
- **Download PDF** button appears in the header when at least one article is saved
- Uses `downloadFavoritesPdf()` from `lib/api.ts` — fetches `/api/favorites/pdf` with `credentials: "include"`, creates a Blob URL, triggers browser download
- Shows a spinner while generating, and an inline error message if the request fails

### Section PDF download
- `SectionBlock.tsx` has an **⬇ PDF** link in its header (between the count badge and the divider)
- Individual section pages (`domain/[domainId]/section/[sectionId]/page.tsx`) have a full **⬇ Download PDF** button in the section header
- Both link to `/api/section/{section_id}/pdf` — a plain `<a href>` (server components); browser sends auth cookies automatically

### Profile dropdown (Masthead)
Clicking avatar/name opens dropdown with:
- User info header (avatar + name + role)
- **♥ Favourites** → `/favorites`
- **🎯 Interests** → `/profile`
- **→ Sign Out**

### Avatar system
- Provider: [DiceBear v9](https://api.dicebear.com) — `bottts-neutral` style
- 20 pre-defined avatars with AI/tech themed names (Neural, Cipher, Axiom, etc.)
- URLs generated via `getAvatarUrl(avatarId)` in `lib/avatars.ts`
- Preloaded at boot via `AvatarPreloader.tsx` (uses `new window.Image()`)
- Configured in `next.config.mjs`: `images.remotePatterns` allows `api.dicebear.com`

### Theme system (`app/globals.css`)
Two themes via CSS custom properties. Dark mode activated by `html.dark` class.

**Light mode (warm parchment)**
| Token | Value | Purpose |
|---|---|---|
| `--bg` | `#e8e2d8` | Page canvas — warm parchment |
| `--surface` | `#f5f1eb` | Cards and panels — warm near-white |
| `--surface-raised` | `#ddd8ce` | Tag pills, button fills, insets |
| `--border` | `#b8b2a7` | Visible warm gray card borders |
| `--border-bright` | `#928d83` | Emphasis borders, hover states |

**Dark mode** (`html.dark`)
| Token | Value | Purpose |
|---|---|---|
| `--bg` | `#0d0d12` | Near-black blue-tinted canvas |
| `--surface` | `#14141c` | Dark card surface |
| `--border` | `#2a2a38` | Subtle dark border |
| `--border-bright` | `#38384a` | Slightly brighter dark border |

Light-mode specific component overrides (`.security-alert-card`, `.hero-card`) are defined
separately from dark-mode overrides so each theme can tune its own look.

---

## Processor — OpenAI (processor.py)

### Model
```python
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
```

### Importance scoring (set by GPT)
| Score | Meaning |
|-------|---------|
| 5 | Major model release, critical security breach, breakthrough research paper |
| 4 | Significant framework update, notable company news, strong research |
| 3 | Useful tool/update, relevant business news, good tutorial |
| 2 | Minor update, opinion piece |
| 1 | Marketing fluff, vague opinion, no new information |

Articles scoring below `MIN_IMPORTANCE_SCORE` (3) are excluded from the digest.

### Content enrichment
Controlled by `ENRICH_CONTENT=true` in `.env`. When enabled, fetches full article text via
Jina Reader (`https://r.jina.ai/{url}`) with DuckDuckGo as fallback before sending to OpenAI.

---

## .env Reference

```env
# ── Environment flag ──────────────────────────────────────────────────────────
# false = local development  |  true = production (set via: fly secrets set IS_PRODUCTION=true)
IS_PRODUCTION=false

# ── OpenAI ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# ── Content enrichment (set false to skip full-text fetch) ───────────────────
ENRICH_CONTENT=false

# ── Admin account (seeded into users.db on first startup) ───────────────────
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_strong_password          # REQUIRED — app won't start without it

# ── JWT signing secret ───────────────────────────────────────────────────────
# Generate: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=your_hex_secret               # REQUIRED — app won't start without it

# ── SMTP for OTP emails ──────────────────────────────────────────────────────
# Leave SMTP_HOST empty → OTP is printed to the terminal instead
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx               # 16-char Gmail App Password
SMTP_FROM=The FeedDigest <you@gmail.com>

# ── Production only (ignored when IS_PRODUCTION=false) ──────────────────────
BACKEND_URL=https://your-api.fly.dev
FRONTEND_URL=https://your-app.vercel.app
```

### How IS_PRODUCTION affects the app
| Setting | `IS_PRODUCTION=false` (local) | `IS_PRODUCTION=true` (production) |
|---|---|---|
| Database path | `./digest.db`, `./users.db` | `/app/data/digest.db`, `/app/data/users.db` |
| Swagger UI `/docs` | Enabled | Disabled |
| ReDoc `/redoc` | Enabled | Disabled |
| Backend URL (Next.js) | `http://localhost:5000` | Value of `BACKEND_URL` env var |
| CORS origins | `localhost:3000`, `localhost:3001` | Above + value of `FRONTEND_URL` env var |

---

## Running the App

```bash
# Backend
python run.py --web           # start FastAPI on port 5000

# Pipeline
python run.py --collect       # fetch new articles from all sources
python run.py --process       # send unprocessed articles to OpenAI
python run.py --all           # collect + process + build digest

# Frontend
cd frontend && npm run dev    # Next.js dev server on port 3000
```

---

## Key Implementation Rules

- **No ORM** — raw `sqlite3` from Python stdlib only
- **No async/await** in Python pipeline — synchronous only
- **No passlib** — use `bcrypt` directly (passlib 1.7.4 incompatible with bcrypt 5.x)
- **Two databases** — `digest.db` for content, `users.db` for user/auth data
- **All logs** use `[module_name] message` format via `print()`
- **JWT** is stateless — no server-side sessions
- **OTP store** is in-memory (`_otp_store` dict in `main.py`) — lost on server restart (acceptable for local use)
- **PDF rendering** — always pass explicit `PW` width to `multi_cell`; always call `set_x(l_margin)` before `multi_cell`; always sanitise text through `_pdf_text()` before passing to fpdf2. Never use `width=0`.
- **Interest IDs** — interest option IDs in `profile/page.tsx` must match section IDs in `config.py` exactly (e.g. `new-models`, `research`, `ai-security`) — not category IDs
- **Error handling** — every external HTTP call wrapped in try/except with 10s timeout; failures are logged and skipped, never crash the run
