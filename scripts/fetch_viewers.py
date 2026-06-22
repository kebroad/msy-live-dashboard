#!/usr/bin/env python3
"""Fetch the current concurrent viewer count for a single YouTube live stream
and append a sample to data/viewers.csv.

Each row is: unix_timestamp,concurrent_viewers
If the stream is offline or the count is hidden, viewers is left blank so the
dashboard can render a gap rather than a fake zero.
"""

import csv
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API_URL = "https://www.googleapis.com/youtube/v3/videos"
DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "viewers.csv"
HEADER = ["timestamp", "viewers"]


def fetch_concurrent_viewers(video_id: str, api_key: str) -> str | None:
    """Return the concurrent viewer count as a string, or None if unavailable."""
    query = urllib.parse.urlencode(
        {
            "part": "liveStreamingDetails",
            "id": video_id,
            "fields": "items/liveStreamingDetails/concurrentViewers",
            "key": api_key,
        }
    )
    url = f"{API_URL}?{query}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})

    import json

    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    items = data.get("items", [])
    if not items:
        return None
    details = items[0].get("liveStreamingDetails", {})
    return details.get("concurrentViewers")


def append_sample(timestamp: int, viewers: str | None) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    new_file = not DATA_FILE.exists() or DATA_FILE.stat().st_size == 0
    with DATA_FILE.open("a", newline="") as f:
        writer = csv.writer(f)
        if new_file:
            writer.writerow(HEADER)
        writer.writerow([timestamp, viewers if viewers is not None else ""])


def main() -> int:
    api_key = os.environ.get("YOUTUBE_API_KEY")
    video_id = os.environ.get("VIDEO_ID", "MH0_mPt-VXE")

    if not api_key:
        print("ERROR: YOUTUBE_API_KEY environment variable is not set.", file=sys.stderr)
        return 1

    timestamp = int(time.time())
    try:
        viewers = fetch_concurrent_viewers(video_id, api_key)
    except Exception as exc:  # noqa: BLE001 - log and record a gap, never crash the job
        print(f"WARN: fetch failed: {exc}", file=sys.stderr)
        viewers = None

    append_sample(timestamp, viewers)
    print(f"{timestamp},{viewers if viewers is not None else '(unavailable)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
