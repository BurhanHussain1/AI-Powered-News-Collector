# FeedDigest

A self-hosted AI news aggregator that collects articles from 24 sources, scores and summarizes them with GPT-4o mini, and delivers a clean daily digest — personalized to your interests.

---

![FeedDigest UI](ui.png)

---

## What is FeedDigest?

FeedDigest monitors 24 news sources across AI research, model releases, security, business, and technology — every 6 hours. Each article is automatically scored for importance and summarized by GPT-4o mini, so you only read what actually matters.

---

## Features

- 📰 **24 curated sources** — RSS feeds from ArXiv, TechCrunch, Wired, Krebs on Security, HuggingFace, and more — plus GitHub releases and HuggingFace model updates
- 🤖 **AI-powered summaries** — GPT-4o mini scores every article 1–5 for importance and writes a concise technical summary
- 🔒 **Security alerts** — automatically flags CVEs, data breaches, ransomware, and active exploits at the top of every digest
- 🎯 **Personalized feed** — set your interests and the homepage filters to only show topics you care about
- ❤️ **Favorites** — bookmark articles to read later, with a dedicated favourites page
- 📄 **PDF export** — download any day's full digest, any individual section, or your entire favourites list as a formatted PDF
- 🌗 **Dark / light mode** — system-aware with manual toggle; warm parchment light theme and deep dark theme
- 👤 **Secure accounts** — email-verified signup with OTP, JWT authentication

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| Database | SQLite |
| AI | OpenAI GPT-4o mini |
| Auth | JWT (httpOnly cookie) + bcrypt + OTP email |
| PDF | fpdf2 |
| Avatars | DiceBear v9 |

---

## News Sources

| Category | Sources |
|---|---|
| AI Research | ArXiv (cs.AI, cs.LG, cs.CL), Papers With Code, Google AI Blog |
| AI Models | HuggingFace Blog, HuggingFace model releases |
| Agentic AI | LangChain, LlamaIndex, Simon Willison, Towards Data Science |
| Company News | OpenAI, Anthropic, Google DeepMind, Mistral, Meta AI, Microsoft AI |
| Tech & Tools | Dev.to, The New Stack, InfoQ, GitHub releases |
| Business | TechCrunch, VentureBeat, Wired, MIT Tech Review, Ars Technica, The Verge |
| Security | Krebs on Security, The Hacker News, Bleeping Computer, CISA Alerts, Dark Reading |

---

## How It Works

```
Every 6 hours
      ↓
Collect articles from 24 sources (RSS + GitHub + HuggingFace)
      ↓
GPT-4o mini scores (1–5) + summarizes + tags each article
      ↓
Digest published to the web UI
      ↓
You read only what matters
```

---

## License

MIT
