#!/usr/bin/env python3
"""Run AI Games locally with fully automatic game discovery.

    python3 serve.py            (serves on http://localhost:8080)
    python3 serve.py 9000        (or pick your own port)

While this is running, adding a new game is just: drop a folder with its own
index.html under games/, then refresh the homepage in your browser. No build
step, no scripts to run:

  - Every time /games.json is requested, this rescans the games/ folder and
    REWRITES games.json on disk to match -- so the file itself stays in sync,
    not just what's served over the network.
  - The first time a game's index.html is requested and it doesn't have the
    floating Home button yet, this injects it and SAVES the change back to
    that file on disk -- so the button becomes a real, permanent part of the
    file, not just something added in memory for that one response.
  - On startup, it also does one full pass over every game right away, so
    games.json and every game's Home button are up to date immediately, even
    before you open them in a browser.

Because it writes the results to disk, this behaves the same as running
`node build-games.mjs` + `python3 inject_home_button.py .` yourself, except it
happens automatically, continuously, while this is running. Those two scripts
still exist for CI / a one-off build without starting a server.
"""
import http.server
import json
import os
import socketserver
import sys

from aigames_common import MARKER, inject_home_button, slug_to_title

ROOT = os.path.dirname(os.path.abspath(__file__))
GAMES_DIR = os.path.join(ROOT, "games")
GAMES_JSON = os.path.join(ROOT, "games.json")


def scan_games():
    games = []
    if os.path.isdir(GAMES_DIR):
        for name in sorted(os.listdir(GAMES_DIR)):
            folder = os.path.join(GAMES_DIR, name)
            if os.path.isdir(folder) and os.path.isfile(os.path.join(folder, "index.html")):
                games.append({"slug": name, "title": slug_to_title(name)})
    return games


def write_games_json(games):
    text = json.dumps(games, indent=2) + "\n"
    try:
        with open(GAMES_JSON, "r", encoding="utf-8") as f:
            if f.read() == text:
                return  # already up to date, don't touch the file's mtime for no reason
    except OSError:
        pass
    with open(GAMES_JSON, "w", encoding="utf-8") as f:
        f.write(text)


def ensure_home_button(slug):
    """Injects the Home button into games/<slug>/index.html and saves it, if missing.
    Returns True if the file was changed."""
    file_path = os.path.join(GAMES_DIR, slug, "index.html")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return False
    if MARKER in text:
        return False
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(inject_home_button(text))
    return True


def sync_all():
    """Full pass: refresh games.json and add the Home button to every game that's
    missing it. Called on startup, and safe to call any time."""
    games = scan_games()
    write_games_json(games)
    updated = [g["slug"] for g in games if ensure_home_button(g["slug"])]
    return games, updated


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Quieter default logging; comment this out if you want full request logs.
        sys.stderr.write("[serve] " + (fmt % args) + "\n")

    def do_GET(self):
        path_only = self.path.split("?", 1)[0]

        if path_only == "/games.json":
            games = scan_games()
            write_games_json(games)
            self._send_json(games)
            return

        if path_only.startswith("/games/") and path_only.endswith("/index.html"):
            slug = path_only[len("/games/"):-len("/index.html")]
            file_path = os.path.join(GAMES_DIR, slug, "index.html")
            if "/" not in slug and os.path.isfile(file_path):
                ensure_home_button(slug)
                self._send_file(file_path, "text/html; charset=utf-8")
                return

        super().do_GET()

    def _send_json(self, data):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, file_path, content_type):
        try:
            with open(file_path, "rb") as f:
                body = f.read()
        except OSError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    os.chdir(ROOT)

    games, updated = sync_all()
    print(f"Synced games.json ({len(games)} game(s)): " + ", ".join(g["slug"] for g in games))
    if updated:
        print("Added the Home button to: " + ", ".join(updated))

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"\nAI Games running at http://localhost:{port}/index.html")
        print("Add a folder under games/ (with its own index.html) and just refresh the page.")
        print("If the page looks stale in your browser, do a hard refresh (Ctrl+Shift+R) --")
        print("see the README's 'Troubleshooting' section if that still doesn't help.")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
