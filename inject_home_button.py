#!/usr/bin/env python3
"""Inject a floating 'Home' button + safe-area CSS into each game's index.html.
Idempotent: skips a file if the marker is already present."""
import re, sys, pathlib

MARKER = "aigames-home-btn"

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

def inject(path: pathlib.Path):
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        print(f"skip (already injected): {path}")
        return False
    m = re.search(r"</body\s*>", text, flags=re.IGNORECASE)
    if m:
        idx = m.start()
        new_text = text[:idx] + SNIPPET + text[idx:]
    else:
        new_text = text.rstrip("\n") + "\n" + SNIPPET + "\n"
    path.write_text(new_text, encoding="utf-8")
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
