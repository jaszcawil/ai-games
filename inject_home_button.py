#!/usr/bin/env python3
"""Inject a floating 'Home' button + safe-area CSS into each game's index.html.
Idempotent: skips a file if the marker is already present.

You normally don't need to run this by hand any more -- `serve.py` (the local dev
server) injects the button live, on the fly, without ever touching the files on disk.
This script is still useful for a one-time pass before a static deploy or a Capacitor
build, where there's no dev server around to do it live."""
import sys, pathlib
from aigames_common import MARKER, inject_home_button

def inject(path: pathlib.Path):
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        print(f"skip (already injected): {path}")
        return False
    path.write_text(inject_home_button(text), encoding="utf-8")
    print(f"injected: {path}")
    return True

def main():
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    files = sorted(root.glob("games/*/index.html"))
    if not files:
        print("no game index.html files found under", root)
        sys.exit(1)
    for f in files:
        inject(f)

if __name__ == "__main__":
    main()
