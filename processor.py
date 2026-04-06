import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from openai import OpenAI
from dotenv import load_dotenv

from config import BATCH_SIZE, PROCESSOR_WORKERS
from database import get_unprocessed, update_processed

load_dotenv()

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

_print_lock = threading.Lock()


def _log(msg: str):
    with _print_lock:
        print(msg)


PROMPT_TEMPLATE = """You are a tech news analyst writing for software engineers who are smart but busy.

Analyze the articles below and return a JSON object with a "results" array.
Respond with ONLY a valid JSON object — no markdown, no backticks, no extra text.

Rules for writing summaries:
- Use short, clear sentences. Prefer simple words over complex ones.
- Still be technical — include model names, version numbers, CVE IDs, benchmark scores, funding amounts if present.
- Do not use jargon like "leverages", "cutting-edge", "robust", "unveils", "delves into". Write like a smart colleague explaining something quickly.
- If the content is too thin to summarise properly, write: "Limited detail in source — [one sentence of what is known]."
- 2 sentences max.

For each article in "results" provide:
- id: the article id (integer, as given)
- importance_score: integer 1-5
    5 = major model release, critical security breach, or breakthrough research
    4 = notable framework update, significant company news, or solid research paper
    3 = useful tool, relevant business news, or good tutorial
    2 = minor update or opinion with some value
    1 = marketing content, vague opinion, or no new information
- summary: 5-6 sentences if the source has enough detail. If content is thin, write as many clear sentences as the data supports (minimum 1). Cover: what happened, why it matters, key numbers/names, and any practical implication for an AI engineer.
- tags: array of 1-3 tags from: [model-release, architecture-paper, framework-update, security-alert, funding, acquisition, tool-release, tutorial, research, company-news, agentic-ai, benchmark]
- is_security_alert: 1 if it involves a breach, CVE, vulnerability, exploit, or data leak — else 0

Articles:
{articles_json}"""


def _extract_json(text: str) -> str:
    """Strip markdown code fences and whitespace."""
    if not text:
        return ""
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _call_openai(client: OpenAI, articles_batch: list) -> str | None:
    articles_json = json.dumps(
        [
            {
                "id": a["id"],
                "title": a["title"],
                "description": (a["description"] or "")[:3000],
                "source_name": a["source_name"] or "",
                "category": a["category"] or "",
            }
            for a in articles_batch
        ],
        ensure_ascii=False,
    )
    prompt = PROMPT_TEMPLATE.format(articles_json=articles_json)

    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                max_tokens=8192,
                response_format={"type": "json_object"},
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.choices[0].message.content or ""
            if response.choices[0].finish_reason == "length":
                _log(f"[processor] WARNING: response truncated — consider reducing BATCH_SIZE")
            return content
        except Exception as e:
            _log(f"[processor] OpenAI API error (attempt {attempt + 1}): {e}")
            if attempt == 0:
                time.sleep(30)
            else:
                return None
    return None


def _parse_and_save(response_text: str, articles_batch: list) -> int:
    cleaned = _extract_json(response_text)
    if not cleaned:
        _log(f"[processor] Empty API response — marking batch as failed")
        for article in articles_batch:
            update_processed(article["id"], 1, "", "", 0)
        return 0

    try:
        data = json.loads(cleaned)
        results = data.get("results", data.get("articles", [])) if isinstance(data, dict) else data

        saved = 0
        processed_ids = set()
        for item in results:
            article_id = item.get("id")
            if article_id is None:
                continue
            importance_score = max(1, min(5, int(item.get("importance_score", 1))))
            summary = str(item.get("summary", "")).strip()
            tags = item.get("tags", [])
            tags_str = ",".join(tags) if isinstance(tags, list) else str(tags)
            is_security_alert = int(item.get("is_security_alert", 0))
            update_processed(article_id, importance_score, summary, tags_str, is_security_alert)
            processed_ids.add(article_id)
            saved += 1

        for article in articles_batch:
            if article["id"] not in processed_ids:
                update_processed(article["id"], 1, "", "", 0)

        return saved

    except (json.JSONDecodeError, ValueError) as e:
        _log(f"[processor] JSON parse error: {e} | first 300 chars: {cleaned[:300]}")
        for article in articles_batch:
            update_processed(article["id"], 1, "", "", 0)
        return 0


def _process_batch(client: OpenAI, batch: list, batch_num: int, total: int) -> int:
    """Process one batch. Called in parallel from a thread pool."""
    response_text = _call_openai(client, batch)
    if response_text is None:
        _log(f"[processor] Batch {batch_num}/{total} — API failure, marking {len(batch)} as skipped")
        for article in batch:
            update_processed(article["id"], 1, "", "", 0)
        return 0
    saved = _parse_and_save(response_text, batch)
    _log(f"[processor] Batch {batch_num}/{total} — {saved}/{len(batch)} articles saved")
    return saved


def run_processing():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_key_here":
        _log("[processor] ERROR: OPENAI_API_KEY not set in .env")
        return

    client = OpenAI(api_key=api_key)

    start = datetime.now()
    _log("[processor] Starting processing run")
    articles = get_unprocessed(limit=500)
    if not articles:
        _log("[processor] No unprocessed articles found")
        return

    batches = [articles[i: i + BATCH_SIZE] for i in range(0, len(articles), BATCH_SIZE)]
    total_batches = len(batches)

    _log(
        f"[processor] {len(articles)} articles → {total_batches} batches "
        f"| model: {MODEL} | workers: {PROCESSOR_WORKERS} | batch_size: {BATCH_SIZE}"
    )

    total_saved = 0
    with ThreadPoolExecutor(max_workers=PROCESSOR_WORKERS) as executor:
        futures = {
            executor.submit(_process_batch, client, batch, i + 1, total_batches): i
            for i, batch in enumerate(batches)
        }
        for future in as_completed(futures):
            total_saved += future.result()

    elapsed = (datetime.now() - start).total_seconds()
    _log(
        f"[processor] Done — {total_saved}/{len(articles)} articles summarised "
        f"in {elapsed:.1f}s ({elapsed / total_batches:.1f}s avg/batch)"
    )


if __name__ == "__main__":
    run_processing()
