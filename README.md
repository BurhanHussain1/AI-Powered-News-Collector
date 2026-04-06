# FeedDigest

A self-hosted AI news aggregator that collects articles from 24 sources (RSS, GitHub, HuggingFace), scores and summarizes them with GPT-4o, and delivers a daily digest. Built with FastAPI, Next.js, and SQLite. Features JWT auth, OTP signup, favorites, and an admin pipeline dashboard.

---

## Screenshots

![FeedDigest UI](ui.png)

---

## Features

- 📰 **24 news sources** — RSS feeds, GitHub releases, HuggingFace models
- 🤖 **AI-powered processing** — GPT-4o scores (1–5), summarizes, and tags every article
- 🔒 **Security alerts** — auto-detects CVEs, breaches, and exploits
- 👤 **Auth system** — JWT login, OTP email verification on signup
- ❤️ **Favorites** — save and revisit articles
- 🎯 **Interest filtering** — personalize your feed by topic
- 📄 **PDF export** — download any digest as a PDF
- 🛠 **Admin panel** — trigger the pipeline, manage digests
- 🌗 **Dark mode** — system-aware with manual toggle

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| Database | SQLite (`digest.db` + `users.db`) |
| AI | OpenAI GPT-4o |
| Auth | JWT (httpOnly cookie) + bcrypt |
| PDF | fpdf2 |
| Avatars | DiceBear v9 |

---

## Project Structure

```
feeddigest/
├── main.py              # FastAPI backend — all API routes
├── collector.py         # RSS + GitHub + HuggingFace collection
├── processor.py         # OpenAI batch processing
├── digest_builder.py    # Markdown digest generator
├── database.py          # SQLite data layer
├── config.py            # RSS feeds, domains, sections config
├── scheduler.py         # Manual pipeline runner
├── run.py               # Single entry point
├── requirements.txt
├── Dockerfile           # For Fly.io deployment
├── fly.toml             # Fly.io config
└── frontend/            # Next.js app
    ├── app/             # Pages (App Router)
    ├── components/      # UI components
    └── lib/             # API client, types, avatars
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/feeddigest.git
cd feeddigest
```

### 2. Set up the backend

```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
IS_PRODUCTION=false

OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o

JWT_SECRET_KEY=your-random-secret-key

ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password

# SMTP for OTP emails (leave blank to print OTP to console)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

ENRICH_CONTENT=false

# Production only
BACKEND_URL=https://your-api.fly.dev
FRONTEND_URL=https://your-app.vercel.app
```

### 4. Run the backend

```bash
# Full pipeline + start API server
python run.py

# API server only (no pipeline)
python run.py --web

# Pipeline only (no server)
python run.py --collect
```

Backend runs at **http://localhost:5000**  
Swagger UI at **http://localhost:5000/docs**

### 5. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## Pipeline

The collect → process → build pipeline can be triggered:

- **Manually** via `python scheduler.py`
- **Via CLI** via `python run.py --collect`
- **Via Admin Panel** at `/admin` in the web UI
- **Automatically** via GitHub Actions cron (see deployment guide)

```
collector.py     →    processor.py     →    digest_builder.py
RSS + GitHub          OpenAI GPT-4o         Markdown + SQLite
HuggingFace           score + summary        record saved
```

---

## Deployment (Free)

| Service | Component |
|---|---|
| [Fly.io](https://fly.io) | FastAPI backend + SQLite (persistent volume) |
| [Vercel](https://vercel.com) | Next.js frontend |
| [Resend](https://resend.com) | OTP emails (100/day free) |

### Deploy backend to Fly.io

```bash
fly auth login
fly launch
fly volumes create feeddigest_data --size 1
fly secrets set IS_PRODUCTION=true \
  OPENAI_API_KEY=sk-... \
  JWT_SECRET_KEY=... \
  ADMIN_PASSWORD=... \
  BACKEND_URL=https://your-api.fly.dev \
  FRONTEND_URL=https://your-app.vercel.app
fly deploy
```

### Deploy frontend to Vercel

```bash
cd frontend
vercel
```

Set `IS_PRODUCTION=true` and `BACKEND_URL=https://your-api.fly.dev` in Vercel environment variables.

### Redeploy after changes

```bash
# Backend
fly deploy

# Frontend — auto-deploys on git push if connected to GitHub
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `IS_PRODUCTION` | Yes | `true` for production, `false` for local |
| `OPENAI_API_KEY` | Yes | Your OpenAI API key |
| `OPENAI_MODEL` | No | Default: `gpt-4o` |
| `JWT_SECRET_KEY` | Yes | Random secret for signing JWTs |
| `ADMIN_USERNAME` | No | Default: `admin` |
| `ADMIN_PASSWORD` | Yes | Admin account password |
| `SMTP_HOST` | No | SMTP server (blank = console fallback) |
| `SMTP_PORT` | No | Default: `587` |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password / API key |
| `SMTP_FROM` | No | From email address |
| `ENRICH_CONTENT` | No | `true` to enrich via Jina + DuckDuckGo |
| `BACKEND_URL` | Prod | Fly.io backend URL |
| `FRONTEND_URL` | Prod | Vercel frontend URL (for CORS) |

---

## License

MIT
