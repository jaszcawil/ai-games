"""Shared helpers used by inject_home_button.py, serve.py, and watch_and_update.py.
Keeping this in one place means the button injected by the batch script, the dev
server, and the background watcher are always exactly the same snippet, and the
game list is always computed the same way everywhere.

Games come in two shapes:
  - games/<slug>/index.html                      -- a normal, single-version game
  - games/<slug>/<version name>/index.html        -- a game with two or more versions
    (e.g. games/math-adventures/version 1/index.html, .../version 2/index.html)
A folder counts as a "versioned" game the moment it has NO index.html directly
inside it, but one or more subfolders that each have their own index.html.
"""
import json
import os
import re

MARKER = "aigames-home-btn"

GAMES_LIST_START = "// ===== AUTO-GENERATED GAME LIST START (do not edit by hand -- edit the games/ folders instead) ====="
GAMES_LIST_END = "// ===== AUTO-GENERATED GAME LIST END ====="

HOME_BLOCK_START = "<!-- === AI Games: floating home button (injected) === -->"
HOME_BLOCK_END = "<!-- === /AI Games home button === -->"

# __HOME_HREF__ is substituted per-file, since a game nested one folder deeper
# (a version subfolder) needs one extra "../" to get back to the real index.html.
SNIPPET_TEMPLATE = """
""" + HOME_BLOCK_START + """
<style>
  #aigames-home-wrap{
    position:fixed !important;
    top:0; left:0; right:0; bottom:0;
    pointer-events:none !important;
    z-index:2147483647 !important;
  }
  #aigames-home-btn{
    position:absolute !important;
    top:calc(env(safe-area-inset-top, 0px) + 10px);
    left:calc(env(safe-area-inset-left, 0px) + 10px);
    width:40px; height:40px;
    display:flex !important; align-items:center; justify-content:center;
    background:rgba(20,20,28,0.55);
    border:1px solid rgba(255,255,255,0.25);
    border-radius:50%;
    backdrop-filter:blur(4px);
    -webkit-backdrop-filter:blur(4px);
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
    pointer-events:auto !important;
    cursor:pointer;
    -webkit-tap-highlight-color:transparent;
    touch-action:manipulation;
  }
  #aigames-home-btn:active{ transform:scale(0.92); background:rgba(20,20,28,0.8); }
  #aigames-home-btn svg{ width:20px; height:20px; display:block; }
</style>
<div id="aigames-home-wrap">
  <button id="aigames-home-btn" type="button" aria-label="Back to AI Games home" title="Home">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 11.5L12 4l8 7.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5h3a1 1 0 0 0 1-1v-9" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>
</div>
<script>
(function(){
  try{
    var btn = document.getElementById('aigames-home-btn');
    if(!btn) return;
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      window.location.href = '__HOME_HREF__';
    }, {passive:false});
  }catch(err){}
})();
</script>
""" + HOME_BLOCK_END + """
"""

DEFAULT_HOME_HREF = "../../index.html"


def slug_to_title(slug: str) -> str:
    """claw-catch -> Claw Catch, wonderblocks-adventures -> Wonderblocks Adventures"""
    return " ".join(w.capitalize() for w in slug.split("-") if w)


def folder_label(name: str) -> str:
    """version 1 -> Version 1, version-2 -> Version 2, final_build -> Final Build.
    Used for version-subfolder names, which people may separate with spaces,
    dashes, or underscores."""
    parts = re.split(r"[-_\s]+", name.strip())
    return " ".join(p.capitalize() for p in parts if p)


def natural_key(name: str):
    """Sorts 'version 2' before 'version 10' (plain alphabetical sort would not)."""
    return [int(part) if part.isdigit() else part.lower()
            for part in re.split(r"(\d+)", name)]


def home_href_for_depth(depth: int) -> str:
    """depth = number of folders between the project root and the file's own
    folder. games/<slug>/index.html -> depth 2. games/<slug>/<version>/index.html
    -> depth 3."""
    return "../" * depth + "index.html"


def home_button_snippet(home_href: str) -> str:
    return SNIPPET_TEMPLATE.replace("__HOME_HREF__", home_href)


def inject_home_button(html_text: str, home_href: str = DEFAULT_HOME_HREF) -> str:
    """Returns html_text with the home-button snippet inserted, unless it's already there."""
    if MARKER in html_text:
        return html_text
    snippet = home_button_snippet(home_href)
    m = re.search(r"</body\s*>", html_text, flags=re.IGNORECASE)
    if m:
        idx = m.start()
        return html_text[:idx] + snippet + html_text[idx:]
    return html_text.rstrip("\n") + "\n" + snippet + "\n"


def _current_home_href(block_text: str):
    m = re.search(r"window\.location\.href\s*=\s*'([^']*)'", block_text)
    return m.group(1) if m else None


_HOME_BLOCK_RE = re.compile(
    re.escape(HOME_BLOCK_START) + r".*?" + re.escape(HOME_BLOCK_END),
    flags=re.DOTALL,
)


def scan_games(games_dir: str):
    """Returns a list of games found under games_dir, sorted by slug. Each game is
    {"slug": ..., "title": ..., "versions": [...]}.

    "versions" is always a list of {"path": ..., "label": ...}:
      - a normal game (games/<slug>/index.html) gets exactly one entry with
        path "" and label None -- nothing extra to pick, tap and play.
      - a versioned game (games/<slug>/<version>/index.html for two or more
        subfolders) gets one entry per version subfolder, sorted naturally
        (so "version 2" comes before "version 10").

    This is the one place "what counts as a game" is decided."""
    games = []
    if not os.path.isdir(games_dir):
        return games
    for name in sorted(os.listdir(games_dir), key=natural_key):
        folder = os.path.join(games_dir, name)
        if not os.path.isdir(folder):
            continue

        if os.path.isfile(os.path.join(folder, "index.html")):
            games.append({
                "slug": name,
                "title": slug_to_title(name),
                "versions": [{"path": "", "label": None}],
            })
            continue

        versions = []
        for sub in sorted(os.listdir(folder), key=natural_key):
            subfolder = os.path.join(folder, sub)
            if os.path.isdir(subfolder) and os.path.isfile(os.path.join(subfolder, "index.html")):
                versions.append({"path": sub, "label": folder_label(sub)})
        if versions:
            games.append({"slug": name, "title": slug_to_title(name), "versions": versions})
        # else: no index.html directly and no version subfolders either --
        # not a game folder, skip it silently (could be a work-in-progress folder).

    return games


def write_games_json(games_json_path: str, games) -> bool:
    """Writes games.json if its content would actually change. Returns True if written."""
    text = json.dumps(games, indent=2) + "\n"
    try:
        with open(games_json_path, "r", encoding="utf-8") as f:
            if f.read() == text:
                return False
    except OSError:
        pass
    with open(games_json_path, "w", encoding="utf-8") as f:
        f.write(text)
    return True


def ensure_home_button(game_index_html_path: str, depth: int = 2) -> bool:
    """Makes sure one game's index.html has the floating Home button, pointing at
    the right relative path for how deep this file sits (2 for a normal game, 3
    for a version subfolder). If the button is already there but was injected
    with the wrong depth (e.g. a game that got moved into a version subfolder
    after the button was added), this fixes it in place. Returns True if the
    file was changed."""
    try:
        with open(game_index_html_path, "r", encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return False

    expected_href = home_href_for_depth(depth)

    if MARKER not in text:
        with open(game_index_html_path, "w", encoding="utf-8") as f:
            f.write(inject_home_button(text, expected_href))
        return True

    m = _HOME_BLOCK_RE.search(text)
    if not m:
        return False  # marker string present in some unexpected form -- leave it alone
    if _current_home_href(m.group(0)) == expected_href:
        return False

    new_block = home_button_snippet(expected_href).strip("\n")
    new_text = text[:m.start()] + new_block + text[m.end():]
    with open(game_index_html_path, "w", encoding="utf-8") as f:
        f.write(new_text)
    return True


def games_js_array(games) -> str:
    """Renders the games list as the JS array literal embedded in index.html."""
    lines = ["  var GAMES = ["]
    for g in games:
        lines.append(
            '    { "slug": %s, "title": %s, "versions": %s },'
            % (json.dumps(g["slug"]), json.dumps(g["title"]), json.dumps(g["versions"]))
        )
    if games:
        lines[-1] = lines[-1].rstrip(",")  # no trailing comma on the last entry
    lines.append("  ];")
    return "\n".join(lines)


def update_index_html_games_list(index_html_path: str, games) -> bool:
    """Rewrites the GAMES array embedded in index.html (between the AUTO-GENERATED
    markers) to match `games`. Returns True if the file changed. This is what makes
    the homepage work with zero server -- opening index.html directly (double-click)
    always shows whatever this function last wrote, no fetch() involved."""
    try:
        with open(index_html_path, "r", encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return False

    pattern = re.compile(
        re.escape(GAMES_LIST_START) + r".*?" + re.escape(GAMES_LIST_END),
        flags=re.DOTALL,
    )
    replacement = GAMES_LIST_START + "\n" + games_js_array(games) + "\n  " + GAMES_LIST_END
    if not pattern.search(text):
        return False  # markers not found -- don't guess, leave the file alone
    new_text = pattern.sub(lambda _m: replacement, text, count=1)
    if new_text == text:
        return False
    with open(index_html_path, "w", encoding="utf-8") as f:
        f.write(new_text)
    return True


def sync_all(root: str) -> dict:
    """One full pass: refresh games.json, add/fix the Home button on every game
    and every version of every game, and rewrite index.html's embedded game list.
    Safe to call any time; returns what changed."""
    games_dir = os.path.join(root, "games")
    games = scan_games(games_dir)

    json_changed = write_games_json(os.path.join(root, "games.json"), games)

    buttons_added = []
    for g in games:
        for v in g["versions"]:
            folder = os.path.join(games_dir, g["slug"], v["path"]) if v["path"] else os.path.join(games_dir, g["slug"])
            depth = 3 if v["path"] else 2
            index_path = os.path.join(folder, "index.html")
            if ensure_home_button(index_path, depth):
                buttons_added.append(g["slug"] + "/" + v["path"] if v["path"] else g["slug"])

    html_changed = update_index_html_games_list(os.path.join(root, "index.html"), games)

    return {
        "games": games,
        "games_json_changed": json_changed,
        "buttons_added": buttons_added,
        "index_html_changed": html_changed,
    }
