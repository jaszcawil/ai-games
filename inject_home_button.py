#!/usr/bin/env python3
"""Inject a floating 'Home' button + safe-area CSS into each game's index.html.
Idempotent: skips a file if the marker is already present.

You normally don't need to run this by hand any more -- `serve.py` (the local dev
server) injects the button live, on the fly, without ever touching the files on disk.
This script is still useful for a one-time pass before a static deploy or a Capacitor
build, where there's no dev server around to do it live."""
import sys, pathlib
from aigames_common import ensure_home_button

def inject(path: pathlib.Path, games_root: pathlib.Path):
    # depth = how many folders between games_root's parent and this file's folder:
    # games/<slug>/index.html -> depth 2, games/<slug>/<version>/index.html -> depth 3
    depth = len(path.relative_to(games_root.parent).parts) - 1
    changed = ensure_home_button(str(path), depth=depth)
    print(("injected/fixed: " if changed else "already ok: ") + str(path))
    return changed

def main():
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    games_root = root / "games"
    files = sorted(games_root.glob("*/index.html")) + sorted(games_root.glob("*/*/index.html"))
    if not files:
        print("no game index.html files found under", root)
        sys.exit(1)
    for f in files:
        inject(f, games_root)

if __name__ == "__main__":
    main()
