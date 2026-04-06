import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone

import feedparser
import requests
from dotenv import load_dotenv

load_dotenv()

from config import RSS_FEEDS, GITHUB_REPOS, SECURITY_KEYWORDS, COLLECTOR_WORKERS, MAX_ARTICLE_AGE_DAYS
from database import init_db, is_seen, insert_article, flag_security_alert

# Read enrichment flag once at startup — no overhead during collection
ENRICH_ENABLED = os.getenv("ENRICH_CONTENT", "false").strip().lower() == "true"

# ── Logging ───────────────────────────────────────────────────────────────────
_print_lock = threading.Lock()

def _log(msg: str):
    with _print_lock:
        print(msg)

# ── Content enrichment config ─────────────────────────────────────────────────
# Only enrich articles whose RSS description is shorter than this
ENRICH_THRESHOLD = 200      # chars — below this we try to fetch more content
JINA_MAX_CHARS   = 1500     # max chars to keep from Jina response
DDG_MAX_CHARS    = 500      # max chars to keep from DuckDuckGo

# Limit concurrent Jina requests to stay within their free-tier rate limit
_jina_semaphore = threading.Semaphore(8)


# ── Enrichment helpers ────────────────────────────────────────────────────────

def _enrich_via_jina(url: str) -> str:
    """
    Fetch full article content using Jina Reader (r.jina.ai).
    Free, no API key. Returns clean text, capped at JINA_MAX_CHARS.
    """
    with _jina_semaphore:
        try:
            resp = requests.get(
                f"https://r.jina.ai/{url}",
                headers={"Accept": "text/plain", "X-Return-Format": "text"},
                timeout=10,
            )
            if resp.status_code != 200:
                return ""
            raw = resp.text.strip()

            # Jina prepends metadata headers (Title:, URL Source:, Published Time:, etc.)
            # Skip them — find where the real content begins (first non-header paragraph)
            lines = raw.splitlines()
            content_start = 0
            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped and not any(stripped.startswith(h) for h in (
                    "Title:", "URL Source:", "URL:", "Published", "Description:", "Author:"
                )):
                    content_start = i
                    break

            content = "\n".join(lines[content_start:]).strip()
            return content[:JINA_MAX_CHARS] if content else ""
        except Exception:
            return ""


def _enrich_via_ddg(title: str) -> str:
    """
    Fetch a knowledge snippet from DuckDuckGo Instant Answer API.
    Free, no API key. Good for CVEs, named models, company names.
    """
    try:
        resp = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": title, "format": "json", "no_html": "1", "skip_disambig": "1"},
            timeout=6,
        )
        if resp.status_code != 200:
            return ""
        data = resp.json()

        # Abstract is a short Wikipedia-style paragraph — best quality
        abstract = (data.get("AbstractText") or "").strip()
        if abstract:
            return abstract[:DDG_MAX_CHARS]

        # Fall back to related topic snippets
        snippets = []
        for topic in data.get("RelatedTopics", [])[:2]:
            if isinstance(topic, dict) and topic.get("Text"):
                snippets.append(topic["Text"])
        return " ".join(snippets)[:DDG_MAX_CHARS]
    except Exception:
        return ""


def _enrich_description(url: str, title: str, description: str) -> str:
    """
    Enrich a thin description before storing in DB.
    Only runs when ENRICH_CONTENT=true in .env.

    Strategy:
      1. Flag off or description already long enough → return as-is.
      2. Try Jina Reader on the article URL (full article content).
      3. If Jina fails → try DuckDuckGo on the article title (knowledge snippet).
      4. If both fail → return original thin description.
    """
    if not ENRICH_ENABLED:
        return description

    if len(description) >= ENRICH_THRESHOLD:
        return description

    enriched = _enrich_via_jina(url)
    if enriched:
        _log(f"[collector] ✓ Jina enriched: {title[:70]}")
        return enriched

    enriched = _enrich_via_ddg(title)
    if enriched:
        _log(f"[collector] ✓ DDG enriched: {title[:70]}")
        return enriched

    return description  # thin but nothing better available


# ── Age filtering ─────────────────────────────────────────────────────────────

_CUTOFF_FORMATS = [
    "%a, %d %b %Y %H:%M:%S %z",
    "%a, %d %b %Y %H:%M:%S %Z",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%d",
]

def _is_too_old(published_at: str) -> bool:
    """Return True if the article is older than MAX_ARTICLE_AGE_DAYS."""
    if not published_at:
        return False   # no date → keep it (can't tell)
    for fmt in _CUTOFF_FORMATS:
        try:
            dt = datetime.strptime(published_at.strip(), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_ARTICLE_AGE_DAYS)
            return dt < cutoff
        except ValueError:
            continue
    return False   # unrecognised format → keep it


# ── Security flagging ─────────────────────────────────────────────────────────

def _check_security(url: str, title: str, description: str, category: str = None) -> bool:
    if category == "ai_research":
        return False
    text = ((title or "") + " " + (description or "")).lower()
    for kw in SECURITY_KEYWORDS:
        if kw.lower() in text:
            flag_security_alert(url)
            _log(f"[collector] SECURITY ALERT detected: {title}")
            return True
    return False


# ── Per-source workers (run in parallel) ─────────────────────────────────────

def _fetch_one_rss(feed_cfg: dict) -> tuple[str, int, str | None]:
    url         = feed_cfg["url"]
    category    = feed_cfg["category"]
    source_name = feed_cfg["source_name"]
    new_count   = 0
    try:
        feed = feedparser.parse(url)
        for entry in feed.entries[:20]:           # cap: never backfill more than 20 per source
            article_url = entry.get("link", "")
            if not article_url or is_seen(article_url):
                continue
            published_at = entry.get("published", "")
            if _is_too_old(published_at):         # skip articles older than MAX_ARTICLE_AGE_DAYS
                continue
            title       = entry.get("title", "No title")
            description = (entry.get("summary") or entry.get("description") or "")[:3000]

            # Enrich thin descriptions before storing
            description = _enrich_description(article_url, title, description)

            insert_article(article_url, title, description, source_name, category, published_at)
            _check_security(article_url, title, description, category)
            new_count += 1
        return source_name, new_count, None
    except Exception as e:
        return source_name, 0, str(e)


def _fetch_one_github(repo_cfg: dict) -> tuple[str, int, str | None]:
    owner       = repo_cfg["owner"]
    repo        = repo_cfg["repo"]
    category    = repo_cfg["category"]
    source_name = f"{owner}/{repo}"
    new_count   = 0
    try:
        api_url = f"https://api.github.com/repos/{owner}/{repo}/releases?per_page=5"
        resp = requests.get(api_url, timeout=10)
        resp.raise_for_status()
        for release in resp.json():
            article_url = release.get("html_url", "")
            if not article_url or is_seen(article_url):
                continue
            title       = release.get("name") or release.get("tag_name", "Release")
            description = (release.get("body") or "")[:3000]

            # GitHub release notes are usually detailed — only enrich if truly empty
            description = _enrich_description(article_url, title, description)

            published_at = release.get("published_at", "")
            insert_article(article_url, title, description, source_name, category, published_at)
            _check_security(article_url, title, description, category)
            new_count += 1
        return source_name, new_count, None
    except Exception as e:
        return source_name, 0, str(e)


# ── Collection functions ──────────────────────────────────────────────────────

def collect_rss_feeds():
    _log("[collector] Collecting RSS feeds in parallel...")
    total_new = 0
    with ThreadPoolExecutor(max_workers=COLLECTOR_WORKERS) as executor:
        futures = {executor.submit(_fetch_one_rss, cfg): cfg for cfg in RSS_FEEDS}
        for future in as_completed(futures):
            source_name, new_count, error = future.result()
            if error:
                _log(f"[collector] ERROR fetching {source_name}: {error}")
            else:
                _log(f"[collector] {source_name}: {new_count} new articles")
                total_new += new_count
    _log(f"[collector] RSS total new: {total_new}")
    return total_new


def collect_github_releases():
    _log("[collector] Collecting GitHub releases in parallel...")
    total_new = 0
    with ThreadPoolExecutor(max_workers=min(COLLECTOR_WORKERS, len(GITHUB_REPOS))) as executor:
        futures = {executor.submit(_fetch_one_github, cfg): cfg for cfg in GITHUB_REPOS}
        for future in as_completed(futures):
            source_name, new_count, error = future.result()
            if error:
                _log(f"[collector] ERROR fetching {source_name}: {error}")
            else:
                _log(f"[collector] {source_name}: {new_count} new releases")
                total_new += new_count
    _log(f"[collector] GitHub total new: {total_new}")
    return total_new


def collect_huggingface_models():
    _log("[collector] Collecting HuggingFace models...")
    try:
        resp = requests.get(
            "https://huggingface.co/api/models?sort=lastModified&limit=20&full=false",
            timeout=10,
        )
        resp.raise_for_status()
        new_count = 0
        for model in resp.json():
            model_id = model.get("modelId") or model.get("id", "")
            if not model_id:
                continue
            article_url  = f"https://huggingface.co/{model_id}"
            if is_seen(article_url):
                continue
            published_at = model.get("lastModified", "")
            # HF model cards have no description in the API — enrich via Jina
            description  = _enrich_description(article_url, model_id, "")
            insert_article(article_url, model_id, description, "HuggingFace", "ai_models", published_at)
            new_count += 1
        _log(f"[collector] HuggingFace: {new_count} new models")
    except Exception as e:
        _log(f"[collector] ERROR fetching HuggingFace models: {e}")


def run_collection():
    start = datetime.now()
    enrich_status = "ON (Jina + DuckDuckGo)" if ENRICH_ENABLED else "OFF"
    _log(f"[collector] Starting collection run at {start} (parallel, {COLLECTOR_WORKERS} workers | enrichment: {enrich_status})")
    with ThreadPoolExecutor(max_workers=3) as top:
        f_rss = top.submit(collect_rss_feeds)
        f_gh  = top.submit(collect_github_releases)
        f_hf  = top.submit(collect_huggingface_models)
        f_rss.result()
        f_gh.result()
        f_hf.result()
    elapsed = (datetime.now() - start).total_seconds()
    _log(f"[collector] Collection complete in {elapsed:.1f}s")


if __name__ == "__main__":
    init_db()
    run_collection()
