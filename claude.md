# FeedDigest — Project Documentation

## Project Overview

A personal AI news digest system that automatically collects articles from RSS feeds, GitHub
releases, and HuggingFace — processes them through the **OpenAI API** for summarization and
importance scoring — stores results in SQLite — and serves a **Next.js + FastAPI** dashboard
with user accounts, favourites, personalized interest filtering, and a live front-page carousel.

**Backend:** Python 3.11+, FastAPI, SQLite (two databases), OpenAI SDK, bcrypt, python-jose
**Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
**Auth:** Stateless JWT via HTTP-only cookies, email OTP signup verification
**Run mode:** Local machine — backend on port 5000, frontend on port 3000

---

## Project Structure

```
News Collector/
├── CLAUDE.md                         # this file
├── .env                              # secrets — never commit
├── .gitignore
├── requirements.txt
├── config.py                         # all RSS sources, domains, sections, constants
├── database.py                       # SQLite schema + all DB operations (digest.db + users.db)
├── collector.py                      # fetches RSS feeds, GitHub releases, HuggingFace models
├── processor.py                      # sends batches to OpenAI, parses + writes results back
├── main.py                           # FastAPI app — all API routes
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
    │   ├── favorites/page.tsx        # saved favourites grid
    │   ├── archive/page.tsx          # past digests list
    │   ├── digest/[date]/page.tsx    # view a specific past digest
    │   ├── admin/page.tsx            # admin panel — user list
    │   └── domain/[domainId]/        # domain + section detail pages
    ├── components/
    │   ├── Masthead.tsx              # sticky nav — profile dropdown (Favourites, Interests, Sign Out)
    │   ├── FrontPageCarousel.tsx     # infinite auto-scroll carousel for top stories
    │   ├── ArticleCard.tsx           # article card with ♥ favourite toggle
    │   ├── HeroStory.tsx             # large hero article card with ♥ favourite toggle
    │   ├── SecurityAlerts.tsx        # red security alert section with ♥ favourite toggle
    │   ├── SectionBlock.tsx          # topic section grid with favourite support
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
    interests     TEXT DEFAULT '',           -- comma-separated category IDs
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
| GET | `/api/today` | Today's digest data (top stories, sections, security alerts) |
| GET | `/api/digest/{date}` | Specific date digest |
| GET | `/api/domains` | All domain + section config |
| GET | `/api/refresh` | Trigger full pipeline run (collect → process → build) |

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
| POST   | `/api/favorites/{article_id}` | Save article to favourites |
| DELETE | `/api/favorites/{article_id}` | Remove article from favourites |

### Admin endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users (admin only) |

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

**Section order:**
1. Edition bar (date + article count)
2. **Front Page carousel** — top 5 stories, infinite auto-scroll, hover to pause
3. Security Alerts (red section, only shown if alerts exist)
4. Interest filter banner (only if user has interests set)
5. Topic section blocks (filtered by user interests if set)

### Interest filtering
- User sets interests on the profile page (comma-separated category IDs, e.g. `ai_research,security`)
- Homepage filters visible sections to only those matching the user's interests
- If no interests set → all sections shown

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

---

## Processor — OpenAI (processor.py)

### Model
```python
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
```
Default is `gpt-4o`, but `.env` sets it to `gpt-4o-mini` to control cost.

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
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Content enrichment (set false to skip full-text fetch)
ENRICH_CONTENT=true

# Admin account (seeded into users.db on first startup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_strong_password

# JWT signing secret (generate with: python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=your_hex_secret

# SMTP for OTP emails (leave SMTP_HOST empty → OTP printed to console instead)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   # 16-char Gmail App Password
SMTP_FROM=The FeedDigest <you@gmail.com>
```

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
- **Error handling** — every external HTTP call wrapped in try/except with 10s timeout; failures are logged and skipped, never crash the run
- **OTP store** is in-memory (`_otp_store` dict in `main.py`) — lost on server restart (acceptable for local use)
