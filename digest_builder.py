import os
from datetime import datetime, timezone

from config import MIN_IMPORTANCE_SCORE, DIGEST_OUTPUT_DIR
from database import get_todays_articles, save_digest_record


def _format_article_block(article):
    title = article.get("title", "Untitled")
    source = article.get("source_name", "")
    published = article.get("published_at", "")
    summary = article.get("summary", "")
    tags = article.get("tags", "")
    url = article.get("url", "")
    lines = [
        f"### {title}",
        f"*{source} · {published}*",
        summary,
        f"Tags: {tags}",
        f"[Read more]({url})",
        "",
    ]
    return "\n".join(lines)


def build_digest(date_str=None):
    if date_str is None:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    articles = get_todays_articles(min_importance=MIN_IMPORTANCE_SCORE)

    os.makedirs(DIGEST_OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(DIGEST_OUTPUT_DIR, f"digest_{date_str}.md")

    if not articles:
        content = f"# FeedDigest — {date_str}\n*Generated at {now_str}*\n\nNo significant news today.\n"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        save_digest_record(date_str, filepath)
        print(f"[digest_builder] No articles — wrote empty digest to {filepath}")
        return filepath

    total_count = len(articles)

    # Security alerts
    security_articles = [a for a in articles if a.get("is_security_alert")]

    # Top 5 by importance
    top5 = sorted(articles, key=lambda a: a.get("importance_score", 0), reverse=True)[:5]

    # By category
    ai_research = [a for a in articles if a.get("category") == "ai_research"]
    agentic = [a for a in articles if a.get("category") in ("agentic_ai", "company_blogs")]
    tech_stack = [a for a in articles if a.get("category") == "tech_stack"]
    business = [a for a in articles if a.get("category") == "business_news"]

    # Quick links: exactly at floor score, capped at 10
    quick_links = [a for a in articles if a.get("importance_score") == MIN_IMPORTANCE_SCORE][:10]

    lines = [
        f"# FeedDigest — {date_str}",
        f"*Generated at {now_str} | {total_count} articles collected | {total_count} shown*",
        "",
        "---",
        "",
    ]

    # Security alerts section
    if security_articles:
        lines += ["## Security Alerts", ""]
        for a in security_articles:
            lines += [
                f"- **{a.get('title', 'Untitled')}** — {a.get('source_name', '')}",
                f"  {a.get('summary', '')}",
                f"  [Read more]({a.get('url', '')})",
                "",
            ]
        lines += ["---", ""]

    # Top 5 must-reads
    lines += ["## Top 5 Must-Reads", ""]
    for i, a in enumerate(top5, 1):
        category = a.get("category", "")
        lines += [
            f"{i}. **{a.get('title', 'Untitled')}** `{category}` — {a.get('source_name', '')}",
            f"   {a.get('summary', '')}",
            f"   [Read more]({a.get('url', '')})",
            "",
        ]
    lines += ["---", ""]

    # New models & research
    if ai_research:
        lines += ["## New Models & Research", ""]
        for a in ai_research:
            lines.append(_format_article_block(a))
        lines += ["---", ""]

    # Agentic AI & frameworks
    if agentic:
        lines += ["## Agentic AI & Frameworks", ""]
        for a in agentic:
            lines.append(_format_article_block(a))
        lines += ["---", ""]

    # Tech stack & tools
    if tech_stack:
        lines += ["## Tech Stack & Tools", ""]
        for a in tech_stack:
            lines.append(_format_article_block(a))
        lines += ["---", ""]

    # Business & company news
    if business:
        lines += ["## Business & Company News", ""]
        for a in business:
            lines.append(_format_article_block(a))
        lines += ["---", ""]

    # Quick links
    if quick_links:
        lines += ["## Quick Links", ""]
        for a in quick_links:
            lines.append(f"- [{a.get('title', 'Untitled')}]({a.get('url', '')}) — {a.get('source_name', '')}")
        lines.append("")

    content = "\n".join(lines)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    save_digest_record(date_str, filepath)
    print(f"[digest_builder] Digest written to {filepath} ({total_count} articles)")
    return filepath


if __name__ == "__main__":
    from database import init_db
    init_db()
    path = build_digest()
    print(f"[digest_builder] Done: {path}")
