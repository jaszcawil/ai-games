"""Shared helpers used by inject_home_button.py, serve.py, and watch_and_update.py.
Keeping this in one place means the button injected by the batch script, the dev
server, and the background watcher are always exactly the same snippet, and the
game list is always computed the same way everywhere."""
import json
import os
import re

MARKER = "aigames-home-btn"

GAMES_LIST_START = "// ===== AUTO-GENERATED GAME LIST START (do not edit by hand -- edit the games/ folders instead) ====="
GAMES_LIST_END = "// ===== AUTO-GENERATED GAME LIST END ====="

SNIPPET = """
<!-- === AI Games: floating home button (injected) === -->
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
      window.location.href = '../../index.html';
    }, {passive:false});
  }catch(err){}
})();
</script>
<!-- === /AI Games home button === -->
"""


def slug_to_title(slug: str) -> str:
    """claw-catch -> Claw Catch, wonderblocks-adventures -> Wonderblocks Adventures"""
    return " ".join(w.capitalize() for w in slug.split("-") if w)


def inject_home_button(html_text: str) -> str:
    """Returns html_text with the home-button snippet inserted, unless it's already there."""
    if MARKER in html_text:
        return html_text
    m = re.search(r"</body\s*>", html_text, flags=re.IGNORECASE)
    if m:
        idx = m.start()
        return html_text[:idx] + SNIPPET + html_text[idx:]
    return html_text.rstrip("\n") + "\n" + SNIPPET + "\n"


def scan_games(games_dir: str):
    """Returns [{"slug": ..., "title": ...}, ...] for every games_dir/<slug>/index.html,
    sorted by slug. This is the one place "what counts as a game" is decided."""
    games = []
    if os.path.isdir(games_dir):
        for name in sorted(os.listdir(games_dir)):
            folder = os.path.join(games_dir, name)
            if os.path.isdir(folder) and os.path.isfile(os.path.join(folder, "index.html")):
                games.append({"slug": name, "title": slug_to_title(name)})
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


def ensure_home_button(game_index_html_path: str) -> bool:
    """Injects the Home button into one game's index.html and saves it, if missing.
    Returns True if the file was changed."""
    try:
        with open(game_index_html_path, "r", encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return False
    if MARKER in text:
        return False
    with open(game_index_html_path, "w", encoding="utf-8") as f:
        f.write(inject_home_button(text))
    return True


def games_js_array(games) -> str:
    """Renders the games list as the JS array literal embedded in index.html."""
    lines = ["  var GAMES = ["]
    for g in games:
        lines.append('    { "slug": %s, "title": %s },' % (json.dumps(g["slug"]), json.dumps(g["title"])))
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
    """One full pass: refresh games.json, add the Home button to every game missing
    it, and rewrite index.html's embedded game list. Safe to call any time; returns
    what changed."""
    games_dir = os.path.join(root, "games")
    games = scan_games(games_dir)

    json_changed = write_games_json(os.path.join(root, "games.json"), games)
    buttons_added = [
        g["slug"] for g in games
        if ensure_home_button(os.path.join(games_dir, g["slug"], "index.html"))
    ]
    html_changed = update_index_html_games_list(os.path.join(root, "index.html"), games)

    return {
        "games": games,
        "games_json_changed": json_changed,
        "buttons_added": buttons_added,
        "index_html_changed": html_changed,
    }
