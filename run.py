"""
run.py — Single entry point for the FeedDigest system.

Usage:
    python run.py            # full pipeline + start FastAPI server
    python run.py --collect  # collect + process + build digest only (no server)
    python run.py --web      # start FastAPI server only (no pipeline)
"""

import sys

from database import init_db
from collector import run_collection
from processor import run_processing
from digest_builder import build_digest


def run_pipeline():
    print("\n[run] ── Starting full pipeline ──")
    run_collection()
    run_processing()
    build_digest()
    print("[run] ── Pipeline complete ──\n")


def start_server():
    import uvicorn
    print("[run] Starting API server at http://localhost:5000")
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)


if __name__ == "__main__":
    init_db()

    args = sys.argv[1:]

    if "--collect" in args:
        run_pipeline()

    elif "--web" in args:
        start_server()

    else:
        run_pipeline()
        print("[run] Launching API server...")
        start_server()
