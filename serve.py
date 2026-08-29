#!/usr/bin/env python3
"""Run AI Games locally through a small dev server (optional).

    python3 serve.py            (serves on http://localhost:8080)
    python3 serve.py 9000        (or pick your own port)

You do NOT need this for the homepage's game list to update automatically --
index.html's game list is self-contained (see the GAMES array near the bottom of
its <script>), and watch_and_update.py (or this script) keeps that array in sync
with your games/ folder. Just double-click index.html to open it.

This script is here for the cases where you DO want an actual local server:
testing "Add to Home Screen"/offline behavior (service workers require a real
http/https origin, not file://), or just a habit from other web projects. While
it's running it keeps everything in sync the same way watch_and_update.py does
(games.json, each game's Home button, and index.html's embedded list), on every
request and once up front at startup.
"""
import http.server
import os
import socketserver
import sys

from aigames_common import ensure_home_button, sync_all

ROOT = os.path.dirname(os.path.abspath(__file__))
GAMES_DIR = os.path.join(ROOT, "games")


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Quieter default logging; comment this out if you want full request logs.
        sys.stderr.write("[serve] " + (fmt % args) + "\n")

    def do_GET(self):
        path_only = self.path.split("?", 1)[0]

        if path_only == "/" or path_only == "/index.html":
            sync_all(ROOT)  # keep the embedded list fresh right before it's served
            super().do_GET()
            return

        if path_only.startswith("/games/") and path_only.endswith("/index.html"):
            slug = path_only[len("/games/"):-len("/index.html")]
            file_path = os.path.join(GAMES_DIR, slug, "index.html")
            if "/" not in slug and os.path.isfile(file_path):
                ensure_home_button(file_path)
                super().do_GET()
                return

        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    os.chdir(ROOT)

    result = sync_all(ROOT)
    print(f"Synced ({len(result['games'])} game(s)): " + ", ".join(g["slug"] for g in result["games"]))
    if result["buttons_added"]:
        print("Added the Home button to: " + ", ".join(result["buttons_added"]))

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"\nAI Games running at http://localhost:{port}/index.html")
        print("Add a folder under games/ (with its own index.html) and just refresh the page.")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
