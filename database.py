import os
import sqlite3
from datetime import datetime, timedelta, timezone

# Set IS_PRODUCTION=true in Fly.io secrets for production deployment.
# Leave unset or set to false for local development.
IS_PRODUCTION = os.getenv("IS_PRODUCTION", "false").strip().lower() == "true"

DATA_DIR       = "/app/data" if IS_PRODUCTION else "."
DIGEST_DB_PATH = os.path.join(DATA_DIR, "digest.db")
USERS_DB_PATH  = os.path.join(DATA_DIR, "users.db")


def get_conn():
    """Connection to digest.db — articles & digests."""
    return sqlite3.connect(DIGEST_DB_PATH, timeout=30, check_same_thread=False)


def get_user_conn():
    """Connection to users.db — user accounts only."""
    conn = sqlite3.connect(USERS_DB_PATH, timeout=30, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_users_db():
    """Create users.db schema. Called on every startup — safe to re-run."""
    conn = get_user_conn()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT UNIQUE NOT NULL,
            email         TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            role          TEXT DEFAULT 'user',
            name          TEXT DEFAULT '',
            avatar        TEXT DEFAULT 'Neural',
            interests     TEXT DEFAULT '',
            created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
            is_active     INTEGER DEFAULT 1
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            article_id INTEGER NOT NULL,
            saved_at   TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, article_id)
        )
    """)
    # Migrations for existing users.db files that predate new columns
    for migration in [
        "ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT 'Neural'",
    ]:
        try:
            c.execute(migration)
        except Exception:
            pass
    conn.commit()
    conn.close()


# ── Favorites ─────────────────────────────────────────────────────────────────

def get_user_favorite_ids(user_id: int) -> list[int]:
    """Return article IDs favorited by the user, most recently saved first."""
    conn = get_user_conn()
    c = conn.cursor()
    c.execute(
        "SELECT article_id FROM favorites WHERE user_id = ? ORDER BY saved_at DESC",
        (user_id,),
    )
    ids = [row[0] for row in c.fetchall()]
    conn.close()
    return ids


def add_favorite(user_id: int, article_id: int) -> bool:
    conn = get_user_conn()
    c = conn.cursor()
    try:
        c.execute(
            "INSERT OR IGNORE INTO favorites (user_id, article_id) VALUES (?, ?)",
            (user_id, article_id),
        )
        conn.commit()
        return c.rowcount > 0
    except Exception as e:
        print(f"[database] add_favorite error: {e}")
        return False
    finally:
        conn.close()


def remove_favorite(user_id: int, article_id: int) -> bool:
    conn = get_user_conn()
    c = conn.cursor()
    try:
        c.execute(
            "DELETE FROM favorites WHERE user_id = ? AND article_id = ?",
            (user_id, article_id),
        )
        conn.commit()
        return c.rowcount > 0
    except Exception as e:
        print(f"[database] remove_favorite error: {e}")
        return False
    finally:
        conn.close()


def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA synchronous=NORMAL")
    c.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            source_name TEXT,
            category TEXT,
            published_at TEXT,
            fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
            processed INTEGER DEFAULT 0,
            importance_score INTEGER,
            summary TEXT,
            tags TEXT,
            is_security_alert INTEGER DEFAULT 0
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS digests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE NOT NULL,
            filepath TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    try:
        c.execute("ALTER TABLE digests ADD COLUMN is_deleted INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass  # column already exists
    conn.close()
    init_users_db()
    print("[database] digest.db + users.db ready")


def is_seen(url):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT 1 FROM articles WHERE url = ?", (url,))
    result = c.fetchone()
    conn.close()
    return result is not None


def insert_article(url, title, description, source_name, category, published_at):
    conn = get_conn()
    c = conn.cursor()
    try:
        c.execute(
            """
            INSERT OR IGNORE INTO articles (url, title, description, source_name, category, published_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (url, title, description, source_name, category, published_at),
        )
        conn.commit()
        return c.lastrowid
    except Exception as e:
        print(f"[database] insert_article error: {e}")
        return None
    finally:
        conn.close()


def flag_security_alert(url):
    conn = get_conn()
    c = conn.cursor()
    try:
        c.execute("UPDATE articles SET is_security_alert = 1 WHERE url = ?", (url,))
        conn.commit()
    except Exception as e:
        print(f"[database] flag_security_alert error: {e}")
    finally:
        conn.close()


def get_unprocessed(limit=50):
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    # Only process articles fetched within MAX_ARTICLE_AGE_DAYS — skip stale backfill
    from config import MAX_ARTICLE_AGE_DAYS
    c.execute(
        """SELECT * FROM articles
           WHERE processed = 0
             AND fetched_at >= datetime('now', ?)
           ORDER BY fetched_at DESC
           LIMIT ?""",
        (f"-{MAX_ARTICLE_AGE_DAYS} days", limit),
    )
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def update_processed(article_id, importance_score, summary, tags, is_security_alert):
    conn = get_conn()
    c = conn.cursor()
    try:
        c.execute(
            """
            UPDATE articles
            SET processed = 1,
                importance_score = ?,
                summary = ?,
                tags = ?,
                is_security_alert = ?
            WHERE id = ?
            """,
            (importance_score, summary, tags, is_security_alert, article_id),
        )
        conn.commit()
    except Exception as e:
        print(f"[database] update_processed error: {e}")
    finally:
        conn.close()


def get_todays_articles(min_importance=3):
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
    c.execute(
        """
        SELECT * FROM articles
        WHERE fetched_at >= ?
          AND processed = 1
          AND importance_score >= ?
        ORDER BY importance_score DESC
        """,
        (since, min_importance),
    )
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def save_digest_record(date, filepath):
    conn = get_conn()
    c = conn.cursor()
    try:
        c.execute(
            "INSERT OR REPLACE INTO digests (date, filepath) VALUES (?, ?)",
            (date, filepath),
        )
        conn.commit()
    except Exception as e:
        print(f"[database] save_digest_record error: {e}")
    finally:
        conn.close()


def get_all_digests():
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM digests WHERE is_deleted = 0 ORDER BY date DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_all_digests_admin():
    """Return all digests including deleted ones — admin only."""
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM digests ORDER BY date DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def delete_digest(digest_id):
    """Hard-delete a digest — permanently removed from the database."""
    conn = get_conn()
    c = conn.cursor()
    try:
        c.execute("DELETE FROM digests WHERE id = ?", (digest_id,))
        conn.commit()
        return c.rowcount > 0
    except Exception as e:
        print(f"[database] delete_digest error: {e}")
        return False
    finally:
        conn.close()


def get_articles_by_categories(categories, min_importance=3, hours=24):
    """Return processed articles for given categories within the last N hours."""
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")
    placeholders = ",".join("?" * len(categories))
    c.execute(
        f"""
        SELECT * FROM articles
        WHERE fetched_at >= ?
          AND processed = 1
          AND importance_score >= ?
          AND category IN ({placeholders})
        ORDER BY importance_score DESC
        """,
        (since, min_importance, *categories),
    )
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_digest_by_id(digest_id):
    """Return a single digest record by ID."""
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM digests WHERE id = ?", (digest_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


# ── User management ───────────────────────────────────────────────────────────

def create_user(username: str, email: str, password_hash: str, name: str = "", avatar: str = "Neural") -> int | None:
    conn = get_user_conn()
    c = conn.cursor()
    try:
        c.execute(
            "INSERT INTO users (username, email, password_hash, name, avatar) VALUES (?, ?, ?, ?, ?)",
            (username, email.lower().strip(), password_hash, name, avatar),
        )
        conn.commit()
        return c.lastrowid
    except Exception as e:
        print(f"[database] create_user error: {e}")
        return None
    finally:
        conn.close()


def seed_admin(username: str, password_hash: str) -> None:
    """Insert admin user into users.db on startup if not already present."""
    conn = get_user_conn()
    c = conn.cursor()
    try:
        c.execute(
            """INSERT OR IGNORE INTO users (username, email, password_hash, role, name)
               VALUES (?, ?, ?, 'admin', 'Administrator')""",
            (username, f"{username}@admin.local", password_hash),
        )
        conn.commit()
    except Exception as e:
        print(f"[database] seed_admin error: {e}")
    finally:
        conn.close()


def get_user_by_username(username: str) -> dict | None:
    conn = get_user_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username = ? AND is_active = 1", (username,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_email(email: str) -> dict | None:
    conn = get_user_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE email = ? AND is_active = 1", (email.lower().strip(),))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def username_exists(username: str) -> bool:
    conn = get_user_conn()
    c = conn.cursor()
    c.execute("SELECT 1 FROM users WHERE username = ?", (username,))
    result = c.fetchone()
    conn.close()
    return result is not None


def email_exists(email: str) -> bool:
    conn = get_user_conn()
    c = conn.cursor()
    c.execute("SELECT 1 FROM users WHERE email = ?", (email.lower().strip(),))
    result = c.fetchone()
    conn.close()
    return result is not None


def update_user_profile(user_id: int, name: str, interests: str, avatar: str = "") -> None:
    conn = get_user_conn()
    c = conn.cursor()
    try:
        if avatar:
            c.execute(
                "UPDATE users SET name = ?, interests = ?, avatar = ? WHERE id = ?",
                (name, interests, avatar, user_id),
            )
        else:
            c.execute(
                "UPDATE users SET name = ?, interests = ? WHERE id = ?",
                (name, interests, user_id),
            )
        conn.commit()
    except Exception as e:
        print(f"[database] update_user_profile error: {e}")
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> dict | None:
    conn = get_user_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        "SELECT id, username, email, role, name, avatar, interests, created_at FROM users WHERE id = ?",
        (user_id,),
    )
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_users() -> list:
    conn = get_user_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        "SELECT id, username, email, role, name, avatar, interests, created_at, is_active FROM users ORDER BY created_at DESC"
    )
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_articles_by_ids(article_ids: list[int]) -> list[dict]:
    """Fetch full article rows from digest.db for given IDs (preserves order)."""
    if not article_ids:
        return []
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    placeholders = ",".join("?" * len(article_ids))
    c.execute(f"SELECT * FROM articles WHERE id IN ({placeholders})", article_ids)
    rows = {r["id"]: dict(r) for r in c.fetchall()}
    conn.close()
    return [rows[aid] for aid in article_ids if aid in rows]


if __name__ == "__main__":
    init_db()
    print("[database] digest.db initialized successfully")
