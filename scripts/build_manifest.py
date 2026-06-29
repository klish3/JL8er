#!/usr/bin/env python3
"""
Build a static manifest of every JL8 comic and its panel images by probing
the original image host (limbero.org). The JL8 webcomic is complete, so this
snapshot is stable. Re-run to refresh if new pages ever appear.

Output: comics.json (repo root)
  {
    "generated": "<iso date>",
    "count": <int>,
    "comics": [
      { "id": 1, "title": "#1", "panels": ["1.jpeg"] },
      { "id": 200, "title": "#200", "panels": ["200_1.jpeg", ...] },
      { "id": 270, "title": "#270", "chapters": [["270_1_1.jpeg", ...], ...],
        "panels": [ ...flattened... ] }
    ]
  }
"""
import concurrent.futures as cf
import json
import os
import sys
import urllib.request

BASE = "https://limbero.org/jl8/comics/"
MAX_ID = 270
MAX_PANELS = 60       # generous upper bound for panels in one page/chapter
MAX_CHAPTERS = 40     # generous upper bound for chapters in a chaptered comic
GAP_TOLERANCE = 4     # stop after this many consecutive missing indices

_session_opener = urllib.request.build_opener()


def exists(name: str) -> bool:
    """HEAD request; True if the image is present (HTTP 200)."""
    url = BASE + name
    req = urllib.request.Request(url, method="HEAD")
    try:
        with _session_opener.open(req, timeout=20) as r:
            return r.status == 200
    except Exception:
        return False


def collect_series(prefix: str) -> list[str]:
    """Collect '<prefix>_<n>.jpeg' for n=1.. tolerating gaps."""
    found = []
    missing_streak = 0
    n = 1
    while n <= MAX_PANELS and missing_streak < GAP_TOLERANCE:
        name = f"{prefix}_{n}.jpeg"
        if exists(name):
            found.append(name)
            missing_streak = 0
        else:
            missing_streak += 1
        n += 1
    return found


def resolve(cid: int) -> dict:
    """Resolve one comic id into its ordered list of panel image filenames."""
    # Form 1: single image  N.jpeg
    if exists(f"{cid}.jpeg"):
        return {"id": cid, "title": f"#{cid}", "panels": [f"{cid}.jpeg"]}

    # Form 2: multi-panel single page  N_1.jpeg, N_2.jpeg, ...
    if exists(f"{cid}_1.jpeg"):
        panels = collect_series(str(cid))
        return {"id": cid, "title": f"#{cid}", "panels": panels}

    # Form 3: chaptered comic  N_C_P.jpeg
    if exists(f"{cid}_1_1.jpeg"):
        chapters = []
        flat = []
        missing_streak = 0
        c = 1
        while c <= MAX_CHAPTERS and missing_streak < 2:
            if exists(f"{cid}_{c}_1.jpeg"):
                ch = collect_series(f"{cid}_{c}")
                chapters.append(ch)
                flat.extend(ch)
                missing_streak = 0
            else:
                missing_streak += 1
            c += 1
        return {"id": cid, "title": f"#{cid}", "chapters": chapters, "panels": flat}

    return {"id": cid, "title": f"#{cid}", "panels": [], "missing": True}


def main():
    ids = list(range(1, MAX_ID + 1))
    results = {}
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        futs = {ex.submit(resolve, cid): cid for cid in ids}
        done = 0
        for fut in cf.as_completed(futs):
            cid = futs[fut]
            results[cid] = fut.result()
            done += 1
            if done % 20 == 0 or done == len(ids):
                print(f"  resolved {done}/{len(ids)}", file=sys.stderr)

    comics = [results[c] for c in ids]
    missing = [c["id"] for c in comics if c.get("missing")]
    if missing:
        print(f"WARNING: no images found for: {missing}", file=sys.stderr)

    out = {
        "base": "https://limbero.org/jl8/comics/",
        "count": len(comics),
        "comics": comics,
    }
    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, "..", "comics.json")
    with open(dest, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    total_panels = sum(len(c["panels"]) for c in comics)
    print(f"Wrote {dest}: {len(comics)} comics, {total_panels} panels", file=sys.stderr)


if __name__ == "__main__":
    main()
