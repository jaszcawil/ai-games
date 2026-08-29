# AI Games

A home screen that lists every game in `games/` and lets you play them, built as a
responsive Progressive Web App (PWA) — installable on iOS and Android today, with a
clear path to wrap it as a native app with Capacitor later.

**Just want to play it? Double-click `index.html`.** No server needed for that —
see "Adding a game" below for how new games get picked up.

## What's in this folder

```
Mobile App/
├── index.html              <- homepage: game list, theme toggle, PWA bootstrap.
│                              The game list is a plain JS array baked right into
│                              this file (see "How the homepage works") -- that's
│                              what makes double-clicking it work with no server.
├── Start Auto-Update.bat    <- Windows: double-click to keep index.html in sync
│                              automatically while you add/remove game folders
├── watch_and_update.py      <- what that .bat file runs: watches games/ in the
│                              background and updates everything, no server/browser
├── serve.py                 <- OPTIONAL local server, only needed for testing
│                              "Add to Home Screen"/offline behavior
├── manifest.webmanifest     <- installable-app metadata (name, icons, colors)
├── sw.js                    <- service worker (offline caching, once hosted for real)
├── games.json               <- a plain-data copy of the game list (kept in sync too,
│                              handy for tooling/Capacitor; index.html doesn't read it)
├── build-games.mjs          <- regenerates games.json by scanning games/ (for deploys,
│                              if you don't have Python but do have Node)
├── aigames_common.py        <- shared code used by watch_and_update.py, serve.py, and
│                              inject_home_button.py, so they can never drift apart
├── inject_home_button.py    <- one-off: bakes the Home button into every game's
│                              index.html on disk (for deploys)
├── generate_icons.py        <- (re)generates the placeholder app icons
├── icons/                   <- app icons (placeholders — see "Branding" below)
└── games/
    ├── <slug>/index.html            <- a normal game: one folder, one index.html
    └── <slug>/<version name>/index.html   <- a VERSIONED game: two or more
                                          subfolders, each with its own index.html
                                          (e.g. games/math-adventures/version 1/,
                                          .../version 2/) -- see "Games with more
                                          than one version" below
```

## How the homepage works

- The list of games rendered on the homepage comes from a plain JavaScript array
  named `GAMES`, sitting inside `index.html`'s own `<script>` tag, between two comment
  markers. There's no network request involved in showing the list — which is exactly
  why opening `index.html` with a plain double-click works, with no server required.
- The title shown for each game is the folder name with dashes turned into spaces and
  each word capitalized (e.g. `wonderblocks-adventures` → "Wonderblocks Adventures").
- Tapping a card opens `games/<slug>/index.html` directly (not in an iframe), so each
  game gets the full screen and full performance.
- The grid is a responsive CSS grid — it reflows from 2 columns on a phone up to 5+ on
  a wide desktop window, so the same file works on any screen size.

## Adding a game — automatic, no server

1. Drop a new folder into `games/` (folder name = title, dashes = spaces), containing
   its `index.html`.
2. Make sure the auto-updater is running (see below) — it notices within a couple of
   seconds.
3. Refresh (or reopen) `index.html` in your browser.

**To have the auto-updater running: double-click `Start Auto-Update.bat`** (Windows)
and leave that window open in the background while you're adding games — minimize it,
ignore it, whatever, just don't close it. It doesn't open a browser tab or a website;
all it does is watch the `games/` folder and, the moment something changes, rewrite:

- the `GAMES` array inside `index.html` (this is what actually makes the new game
  show up — a real, permanent edit to the file, not something temporary),
- `games.json` (kept as a plain-data copy, in case some other tool wants it),
- and the game's own `index.html`, to add the floating Home button, if it's missing.

None of this needs a server, a browser tab, or an internet connection — it's a small
Python script polling a folder on your own computer. If you'd rather run it without
the `.bat` file (e.g. on Mac/Linux), it's just:

```
python3 watch_and_update.py
```

**If you don't want to keep that window open all the time**, that's fine too — just
run it once by hand after adding a game (or a batch of games):

```
python3 -c "from aigames_common import sync_all; sync_all('.')"
```

That does one full sync and exits immediately — no watching, no waiting.

**If you have neither Python running nor want to** — for example you're on a computer
without Python at all — send me the new folder name and I can update `index.html`'s
`GAMES` array for you directly, but that's a manual ask-me-each-time step, not
automatic.

Removing a game is the mirror image: delete its folder from `games/`; the next sync
(auto or manual) removes it from the list too.

### If you have Node instead of Python

`node build-games.mjs` regenerates `games.json`, but — important — it does **not**
touch `index.html`'s embedded list, so the homepage won't update from that alone.
This script is really aimed at the Capacitor path below. If Python isn't available at
all, ask me to update `index.html` directly instead.

## Games with more than one version

Some games (like Math Adventures) have more than one version you want to keep around
side by side. To set that up, don't put `index.html` directly in the game's folder —
instead, put each version in its own subfolder:

```
games/
└── math-adventures/
    ├── version 1/index.html
    └── version 2/index.html
```

The subfolder name becomes the version's label on the homepage (spaces, dashes, and
underscores all work — `version 1`, `version-1`, and `final_build` all get capitalized
into a readable label). You can name them anything: `version 1` / `version 2`, `classic`
/ `remastered`, `2024` / `2025` — whatever makes sense.

Once the auto-updater (or `serve.py`) picks this up, the homepage shows Math Adventures
as one card, same as any other game — but tapping it opens a small "Choose a version"
sheet listing every version subfolder, and tapping one of those plays that version.
A game with only one subfolder (or no subfolders, just a plain `index.html`) skips the
sheet entirely and plays immediately, like always.

This works exactly the same way as adding a normal game — no server, drop the folders
in, let the auto-updater notice, refresh the page.

## Going home from inside a game

Every game has a small round Home button fixed to the top-left corner (it respects the
iPhone notch/status bar via `safe-area-inset`). Tapping it sends the browser back to the
real homepage — `../../index.html` for a normal game, or `../../../index.html` for a
game inside a version subfolder (one extra folder deep). The auto-updater figures out
which one a file needs automatically; you never have to think about it, even if a
button was already added with the wrong one (e.g. because a game was moved into a
version subfolder after the fact) — the next sync fixes it in place. The button sits
above everything else in the game (very high z-index) so it stays clickable regardless
of what the game is drawing underneath.

## Dark / light mode

- By default the app follows the device's system setting (`prefers-color-scheme`).
- The moon/sun button in the header lets the user override that; the choice is saved in
  `localStorage` (`aigames.theme`) and restored on the next visit, applied before the
  page paints so there's no flash of the wrong theme.
- This toggle controls the homepage shell only. Each game keeps its own existing art
  direction/colors — they weren't built with a light/dark variant, so we didn't reskin
  them.

## "Add to Home Screen" prompt

The homepage asks people to install it:

- A banner slides up from the bottom about a second after the page loads, with an
  "Add" button and a dismiss (×). Dismissing it snoozes it for 14 days (stored in
  `localStorage` as `aigames.installPromptDismissedAt`) — it never nags every visit.
- A matching button sits in the header (next to the theme toggle) so the prompt is
  always available on demand, even after the banner's been dismissed.
- On Chrome/Edge (Android or desktop), tapping either one triggers the browser's real
  native install prompt. On iPhone/iPad Safari and everywhere else that doesn't expose
  that native prompt, it opens a small step-by-step sheet instead.
- Both hide automatically once the app is already installed (running in standalone
  mode).

## Storage / save games

Every game already saves its own progress via the browser's `localStorage` (this was
already built into each game, using its own storage key, e.g. `wyldkin_save_v1_slot_`,
`hollowWickSave_v1`, etc. — so different games never overwrite each other's saves).
Two games (Claw Catch, Doodleverse) don't currently save anything — that's how they
were built, not a limitation of the app.

**One honest caveat:** iOS Safari can occasionally clear a home-screen web app's
storage if it hasn't been opened in a long time (Apple's anti-tracking policy). The
Capacitor path below removes this caveat entirely.

## Installing it as an app (once it's hosted somewhere real)

The "Add to Home Screen" / offline features need a real server (not a
double-clicked file) to fully work — that's a browser security requirement for service
workers, not something specific to this app. Use `python3 serve.py` to test that
locally (see below), or host it anywhere for real use:

- **Android (Chrome):** open the site, tap the menu (⋮) → "Install app" / "Add to Home
  screen".
- **iPhone (Safari):** open the site, tap the Share icon → "Add to Home Screen".

## The Capacitor path (for later)

You mentioned wanting a real native app down the road — good news: nothing here needs
to change for that. This folder is already shaped like a Capacitor `webDir`:

```
npm create @capacitor/app@latest        # point webDir at this folder
npx cap add android                     # generates the Android Studio project
npx cap add ios                         # generates the Xcode project (needs a Mac,
                                         # or a cloud Mac build service like Codemagic,
                                         # to actually compile it)
npx cap sync
```

At that point `index.html`, `sw.js`, `manifest.webmanifest`, and all of `games/` get
bundled straight into the native app, the Home button/theme toggle/game list keep
working unchanged (no fetch, no server — remember, it's all baked into `index.html`
already), and `localStorage` becomes fully reliable (no iOS storage-clearing caveat).
You can drop `sw.js`'s registration at that point since Capacitor apps don't need a
service worker for offline support.

## Branding

The icons in `icons/` are placeholders (a simple gradient + game-controller mark).
Swap them out any time — same filenames and sizes:

- `icons/icon-192.png` (192×192)
- `icons/icon-512.png` (512×512)
- `icons/icon-maskable-512.png` (512×512, keep the artwork inside the center ~66%)
- `icons/apple-touch-icon.png` (180×180, must be fully opaque)

Or run `python3 generate_icons.py` after editing the two colors at the top of that file
to regenerate a fresh placeholder set in the same style.

## Testing "Add to Home Screen" / offline behavior locally

This is the one thing that genuinely needs a server (a browser-security requirement,
not a choice we made): from this folder, run

```
python3 serve.py
```

then open `http://localhost:8080/index.html`. This is entirely optional for everyday
use — it's only relevant if you specifically want to test the install banner's native
prompt or offline caching before hosting this somewhere real.

## Heads up: Math Adventures needs its own local server to run

Math Adventures is a 3D game (built with Three.js) that loads its models, textures,
and save files as separate asset files at runtime. Browsers block that kind of asset
loading for a page opened directly from disk (`file://`) — this is a browser security
rule, unrelated to anything in this app — so unlike every other game here, Math
Adventures **will not load** if you just double-click into it from the homepage
without a server running.

Each Math Adventures version folder ships its own `server.js` and `run.bat` for this
reason (see that folder's own `README.txt`). To actually play either version:

1. Make sure Node.js is installed (https://nodejs.org, LTS version).
2. Double-click `run.bat` inside that version's folder (e.g.
   `games/math-adventures/version 1/run.bat`) — it opens a small black window and
   prints a `http://localhost:...` address.
3. Open that address in your browser (it usually opens automatically).

This is specific to Math Adventures' 3D assets — the homepage itself, and every other
game, still work with a plain double-click, no server, exactly as before.

## Troubleshooting: "I added a game but it's not showing up"

- **Is the auto-updater actually running?** `Start Auto-Update.bat` needs to be open
  in a visible window (or `watch_and_update.py` running in a terminal) at the moment
  you add the folder. It's not a background service that starts itself.
- **Did you refresh/reopen `index.html`** after the auto-updater printed a line saying
  it found the new game? The browser tab doesn't update on its own.
- **Is the new folder directly inside `games/`**, with its own `index.html` right
  inside it — `games/my-new-game/index.html`, not nested another level deeper?
- **Check `index.html` itself**: open it in a text editor and search for
  `AUTO-GENERATED GAME LIST` — your new game's slug should be listed right there in
  the `GAMES` array. If it's not there, the auto-updater hasn't run yet (see the first
  two bullets); if it IS there but the browser still doesn't show it, that's a real bug
  — tell me and I'll take a look.
- No Python at all, or don't want to deal with any of this? Just tell me the new
  folder's name and I'll update `index.html` for you directly.

## What was verified before delivery

An automated check (Playwright/Chromium) confirmed: all games appear on the homepage
with the correct titles when `index.html` is opened directly via `file://` with no
server running at all; every game's Home button is present, positioned correctly, and
returns to the homepage; the dark/light toggle and install banner work via `file://`
too; `localStorage` persists across reloads; the homepage has no horizontal overflow at
phone, tablet, and desktop widths; and — for this update specifically — dropping a
brand-new folder into `games/`, running the sync, and then opening `index.html` with no
server running shows the new game immediately, fully playable, Home button included.
