# FeedDigest — Deployment Guide

## Architecture

| Component | Platform | URL |
|---|---|---|
| **Backend (FastAPI)** | [Fly.io](https://fly.io) | `https://feeddigest-api.fly.dev` |
| **Frontend (Next.js)** | [Vercel](https://vercel.com) | `https://your-app.vercel.app` |
| **Database (SQLite)** | Fly.io persistent volume | `/app/data/` inside the container |
| **Pipeline trigger** | Admin panel (`/admin`) | Manual — run by admin daily |

---

## Environment Variables

### Backend — set as Fly.io secrets

| Variable | Description | Required |
|---|---|---|
| `IS_PRODUCTION` | Set to `true` on Fly.io | ✅ |
| `OPENAI_API_KEY` | Your OpenAI API key | ✅ |
| `OPENAI_MODEL` | Model name — use `gpt-4o-mini` | ✅ |
| `JWT_SECRET_KEY` | Long random hex string for signing JWTs — generate with `python -c "import secrets; print(secrets.token_hex(32))"` | ✅ |
| `ADMIN_USERNAME` | Admin account username | ✅ |
| `ADMIN_PASSWORD` | Admin account password | ✅ |
| `ENRICH_CONTENT` | `false` (keeps pipeline fast and cost-effective) | ✅ |
| `FRONTEND_URL` | Your Vercel URL e.g. `https://feeddigest.vercel.app` — needed for CORS | ✅ |
| `SMTP_HOST` | SMTP server e.g. `smtp.gmail.com` — leave empty to print OTP to logs | ❌ optional |
| `SMTP_PORT` | SMTP port e.g. `587` | ❌ optional |
| `SMTP_USER` | SMTP email address | ❌ optional |
| `SMTP_PASS` | SMTP password / App Password | ❌ optional |
| `SMTP_FROM` | Sender name e.g. `FeedDigest <you@gmail.com>` | ❌ optional |

### Frontend — set as Vercel environment variables

| Variable | Value | Description |
|---|---|---|
| `IS_PRODUCTION` | `true` | Switches API URLs and disables Swagger |
| `BACKEND_URL` | `https://feeddigest-api.fly.dev` | Backend API base URL for server-side fetches |

---

## First-Time Deployment

### Prerequisites
- [Fly.io account](https://fly.io) — free, credit card required for verification (not charged)
- [Vercel account](https://vercel.com) — free, sign in with GitHub
- Code pushed to a GitHub repository

---

### Step 1 — Install Fly CLI

```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```
Restart PowerShell after install, verify with `fly version`.

---

### Step 2 — Log in to Fly.io

```powershell
fly auth login
```
Opens browser — sign in to your Fly.io account.

---

### Step 3 — Create the Fly app

```powershell
fly apps create feeddigest-api
```

---

### Step 4 — Create the persistent volume

SQLite databases are stored here permanently across deploys and restarts.

```powershell
fly volumes create feeddigest_data --size 1 --region lhr --app feeddigest-api
```

> Change `lhr` to your nearest region:
> - `iad` — US East (Virginia)
> - `ord` — US Central (Chicago)
> - `lhr` — Europe (London)
> - `sin` — Asia (Singapore)
> - `syd` — Australia (Sydney)

When prompted **"Do you still want to use the volumes feature?"** — type `y` and Enter.

---

### Step 5 — Set backend secrets

Run each line separately in PowerShell:

```powershell
fly secrets set IS_PRODUCTION=true --app feeddigest-api
fly secrets set OPENAI_API_KEY=your_openai_key_here --app feeddigest-api
fly secrets set OPENAI_MODEL=gpt-4o-mini --app feeddigest-api
fly secrets set JWT_SECRET_KEY=your_generated_hex_secret --app feeddigest-api
fly secrets set ADMIN_USERNAME=your_admin_username --app feeddigest-api
fly secrets set ADMIN_PASSWORD=your_strong_password --app feeddigest-api
fly secrets set ENRICH_CONTENT=false --app feeddigest-api
fly secrets set FRONTEND_URL=https://PLACEHOLDER.vercel.app --app feeddigest-api
```

> To generate a strong JWT secret:
> ```powershell
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

---

### Step 6 — Deploy the backend

```powershell
fly deploy --app feeddigest-api
```

First deploy takes ~4 minutes (builds Docker image). When complete your backend is live at:
```
https://feeddigest-api.fly.dev
```

Test it:
```powershell
curl https://feeddigest-api.fly.dev/api/auth/me
```
Expected response: `{"detail":"Not authenticated"}` ✅

---

### Step 7 — Deploy the frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Add environment variables:
   - `IS_PRODUCTION` = `true`
   - `BACKEND_URL` = `https://feeddigest-api.fly.dev`
4. Click **Deploy**

When complete, copy your Vercel URL (e.g. `https://feeddigest.vercel.app`)

---

### Step 8 — Update backend CORS with real Vercel URL

```powershell
fly secrets set FRONTEND_URL=https://feeddigest.vercel.app --app feeddigest-api
fly deploy --app feeddigest-api
```

---

### Step 9 — Run the first pipeline

The database is empty on first deploy. Log in as admin, go to `/admin`, and click **▶ Run Pipeline & Make Digest**.

Or from terminal:
```powershell
curl -X POST https://feeddigest-api.fly.dev/api/refresh
```

Wait 2–5 minutes — your digest will be populated with articles.

---

## Daily Usage

The pipeline is **manually triggered by the admin**:

1. Go to your site → click your avatar → open the dropdown → **Admin** (or navigate to `/admin`)
2. Click **▶ Run Pipeline & Make Digest**
3. Wait ~2 minutes — today's digest is live

---

## Custom Domain (Optional)

### Add to Vercel (frontend)
1. Vercel project → **Settings** → **Domains** → type your domain → **Add**
2. Add the DNS records Vercel shows you at your domain registrar

### Add to Fly.io (backend API)
```powershell
fly certs add api.yourdomain.com --app feeddigest-api
```
Then add the DNS record Fly.io shows you at your domain registrar.

---

## Useful Commands

```powershell
fly logs --app feeddigest-api           # live backend logs
fly status --app feeddigest-api         # machine health
fly secrets list --app feeddigest-api   # list secret names (values hidden)
fly ssh console --app feeddigest-api    # SSH into the container
```
