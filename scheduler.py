"""
Manual pipeline runner — run this once to collect, process, and build a digest.
Auto-scheduling is disabled. Use the Admin Portal to trigger the pipeline instead.

Usage:
    python scheduler.py
"""

from collector import run_collection
from database import init_db
from digest_builder import build_digest
from processor import run_processing


def full_run():
    run_collection()
    run_processing()
    build_digest()
    print("[scheduler] Run complete")


if __name__ == "__main__":
    init_db()
    full_run()
