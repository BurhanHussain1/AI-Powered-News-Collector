# FeedDigest — Redeployment Cheatsheet

## After any code change

### 1 — Push to GitHub
```powershell
git add .
git commit -m "describe your change"
git push
```
**Frontend** redeploys on Vercel **automatically** after every push. Nothing else needed.

---

### 2 — Redeploy backend (only if you changed backend code)
```powershell
fly deploy --app feeddigest-api
```
> Takes ~2 minutes. Only needed when you change `.py` files, `requirements.txt`, or `Dockerfile`.

---

## Update a secret / environment variable

### Backend (Fly.io)
```powershell
fly secrets set VARIABLE_NAME=new_value --app feeddigest-api
fly deploy --app feeddigest-api
```

### Frontend (Vercel)
Vercel dashboard → Project → **Settings** → **Environment Variables** → edit the value → **Save** → go to **Deployments** → **Redeploy**.

---

## Check backend is running
```powershell
curl https://feeddigest-api.fly.dev/api/auth/me
# Expected: {"detail":"Not authenticated"}
```

---

## View live backend logs
```powershell
fly logs --app feeddigest-api
```

---

## Trigger pipeline manually (from terminal)
```powershell
curl -X POST https://feeddigest-api.fly.dev/api/refresh
```
Or just use the **▶ Run Pipeline & Make Digest** button on `/admin`.

---

## Quick reference

| What changed | What to do |
|---|---|
| Frontend code (`.tsx`, `.ts`, `.css`) | Just `git push` — Vercel auto-deploys |
| Backend code (`.py`) | `git push` + `fly deploy` |
| `requirements.txt` | `git push` + `fly deploy` |
| Backend secret/env var | `fly secrets set` + `fly deploy` |
| Frontend env var | Update in Vercel dashboard + Redeploy |
