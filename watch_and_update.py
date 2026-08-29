#!/usr/bin/env python3
"""Keeps AI Games in sync automatically, with NO server and NO browser involved.

    python3 watch_and_update.py

Leave this running in the background (or double-click "Start Auto-Update.bat" on
Windows, which does the same thing). While it's running:

  - Every couple of seconds, it checks your games/ folder.
  - If you've added or removed a game folder, it rewrites games.json AND the
    game list embedded directly inside index.html to match.
  - Any game that doesn't have the floating Home button yet gets it added and
    saved into that game's own index.html.

Because the list lives inside index.html itself (not fetched from anywhere),
you can keep opening index.html the normal way -- double-click it, or however
you already do -- with no server, no localhost address, nothing to remember.
Just make sure this script is running in the background whenever you're adding
games, and refresh the page (or reopen it) after you drop a new folder in.

Press Ctrl+C to stop.
"""
import os
import sys
import time

from aigames_common import sync_all

ROOT = os.path.dirname(os.path.abspath(__file__))
POLL_SECONDS = 2


def main():
    print("AI Games auto-updater running.")
    print(f"Watching: {os.path.join(ROOT, 'games')}")
    print("Add or remove a game folder any time -- this will pick it up within a couple seconds.")
    print("Leave this window open. Press Ctrl+C to stop.\n")

    try:
        result = sync_all(ROOT)
    except Exception as exc:
        print(f"[sync] First pass hit an error ({exc}) -- will keep retrying every {POLL_SECONDS}s.")
        result = {"games": [], "games_json_changed": False, "buttons_added": [], "index_html_changed": False}

    print(f"[sync] {len(result['games'])} game(s): " + ", ".join(g["slug"] for g in result["games"]))
    if result["buttons_added"]:
        print("[sync] Added/fixed the Home button on: " + ", ".join(result["buttons_added"]))

    last_slugs = tuple(g["slug"] for g in result["games"])

    try:
        while True:
            time.sleep(POLL_SECONDS)
            try:
                result = sync_all(ROOT)
            except KeyboardInterrupt:
                raise
            except Exception as exc:
                # A file can be mid-write/locked (e.g. you just dropped in a new
                # build) or have odd encoding for a moment -- don't let that kill
                # the whole watcher. Skip this pass, keep watching, try again in
                # POLL_SECONDS.
                print(f"[sync] Skipped one pass after an error ({exc}). Still watching...")
                continue

            slugs = tuple(g["slug"] for g in result["games"])
            changed = (
                slugs != last_slugs
                or result["games_json_changed"]
                or result["index_html_changed"]
                or result["buttons_added"]
            )
            if changed:
                added = [s for s in slugs if s not in last_slugs]
                removed = [s for s in last_slugs if s not in slugs]
                if added:
                    print("[sync] New game(s) found: " + ", ".join(added) + " -- index.html updated.")
                if removed:
                    print("[sync] Game(s) removed: " + ", ".join(removed) + " -- index.html updated.")
                if result["buttons_added"]:
                    print("[sync] Added/fixed the Home button on: " + ", ".join(result["buttons_added"]))
                if not added and not removed and not result["buttons_added"]:
                    print("[sync] index.html refreshed.")
                last_slugs = slugs
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
