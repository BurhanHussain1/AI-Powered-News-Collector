# ── Build stage ──────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# System deps (gcc needed for some pip packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source
COPY . .

# Persistent data directory — Fly.io volume will be mounted here
RUN mkdir -p /app/data

EXPOSE 5000

# Init DB then start uvicorn (no --reload in production)
CMD ["sh", "-c", "python -c 'from database import init_db; init_db()' && uvicorn main:app --host 0.0.0.0 --port 5000 --workers 1"]
