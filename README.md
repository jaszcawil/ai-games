# AI Games

A home screen that lists every game in `games/` and lets you play them, built as a
responsive Progressive Web App (PWA) — installable on iOS and Android today, with a
clear path to wrap it as a native app with Capacitor later.

## What's in this folder

```
Mobile App/
├── index.html              <- homepage (game list, theme toggle, PWA bootstrap)
├── manifest.webmanifest    <- installable-app metadata (name, icons, colors)
├── sw.js                   <- service worker (offline caching)
├── serve.py                <- run this locally: auto-discovers games, no build step
├── games.json              <- static fallback list, used when serve.py isn't running
├── build-games.mjs         <- regenerates games.json by scanning games/ (for deploys)
├── aigames_common.py       <- shared code for the Home-button snippet (used by both
│                              serve.py and inject_home_button.py)
├── inject_home_button.py   <- bakes the floating Home button into every game's
│                              index.html on disk (for deploys)
├── generate_icons.py       <- (re)generates the placeholder app icons
├── icons/                  <- app icons (placeholders — see "Branding" below)
└── games/
    └── <slug>/index.html   <- one folder per game, unchanged on disk
```

## How the homepage works

- `index.html` fetches `games.json` and renders one card per game. The title shown is
  the folder name with dashes turned into spaces and each word capitalized (e.g.
  `wonderblocks-adventures` → "Wonderblocks Adventures"), exactly as requested.
- Tapping a card opens `games/<slug>/index.html` directly (not in an iframe), so each
  game gets the full screen and full performance.
- The grid is a responsive CSS grid — it reflows from 2 columns on a phone up to 5+ on a
  wide desktop window, so the same file works on any screen size.

## Adding a game — fully automatic

Run the app with `python3 serve.py` (see "Testing it yourself locally" below) and
adding a game is just:

1. Drop a new folder into `games/` (folder name = title, dashes = spaces), containing
   its `index.html`.
2. Refresh the homepage in your browser.

That's it — nothing to run, nothing to edit. While `serve.py` is running:

- It rescans the `games/` folder and rewrites `games.json` on disk every time the
  homepage asks for the list — so the file itself stays up to date, not just what's
  shown in the browser.
- The first time a game is opened and it doesn't have the floating Home button yet,
  `serve.py` adds it and saves that change back into the game's own `index.html` — a
  real, permanent edit, not something faked just for that one page load.
- It also does one full pass over everything the moment it starts, so `games.json` and
  every game's Home button are current immediately, even before you've opened them in
  a browser.

**If you're not using `serve.py`** — e.g. testing with `python3 -m http.server`, or
this has been deployed somewhere static — there's no live server to do that discovery,
so you need one manual step after adding a game:

```
node build-games.mjs           # regenerates games.json
python3 inject_home_button.py .   # bakes the Home button into the new game's index.html
```

The same two commands are also what you'd run once, right before a static deploy or a
future Capacitor build, so the bundled files are self-contained and don't depend on
`serve.py` being there to help at runtime.

Removing a game is the mirror image: delete its folder from `games/`, refresh (with
`serve.py` running it just disappears from the list); otherwise re-run
`node build-games.mjs`.

## Going home from inside a game

Every game now has a small round Home button fixed to the top-left corner (it respects
the iPhone notch/status bar via `safe-area-inset`). Tapping it sends the browser back to
`../../index.html`. It sits above everything else in the game (very high z-index) so it
stays clickable regardless of what the game is drawing underneath.

## Dark / light mode

- By default the app follows the device's system setting (`prefers-color-scheme`).
- The moon/sun button in the header lets the user override that; the choice is saved in
  `localStorage` (`aigames.theme`) and restored on the next visit, and it's applied
  before the page paints so there's no flash of the wrong theme.
- This toggle controls the homepage shell only. Each game keeps its own existing art
  direction/colors — they weren't built with a light/dark variant, so we didn't
  reskin them.

## "Add to Home Screen" prompt

The homepage now asks people to install it:

- A banner slides up from the bottom about a second after the page loads, with an
  "Add" button and a dismiss (×). Dismissing it snoozes it for 14 days (stored in
  `localStorage` as `aigames.installPromptDismissedAt`) — it never nags every visit.
- A matching button sits in the header (next to the theme toggle) so the prompt is
  always available on demand, even after the banner's been dismissed.
- On Chrome/Edge (Android or desktop), tapping either one triggers the browser's real
  native install prompt. On iPhone/iPad Safari and everywhere else that doesn't expose
  that native prompt, it opens a small step-by-step sheet instead (Share icon → Add to
  Home Screen on iOS; browser menu → Add to Home screen / Install app elsewhere).
- Both the banner and the button hide automatically once the app is already installed
  (running in standalone mode), so it doesn't pester people who've already added it.

## Storage / save games

Every game already saves its own progress via the browser's `localStorage` (this was
already built into each game, using its own storage key, e.g. `wyldkin_save_v1_slot_`,
`hollowWickSave_v1`, etc. — so different games never overwrite each other's saves).
Because the whole app is served from one folder (one "origin"), that storage works
exactly like it would on any website and is shared across every game and the homepage.

Two games (Claw Catch, Doodleverse) don't currently save anything — that's how they
were built, not a limitation of the app; storage is available to them the same as
everywhere else if you want to add saving to them later.

**One honest caveat:** iOS Safari can occasionally clear a home-screen web app's storage
if it hasn't been opened in a long time (Apple's anti-tracking policy, not anything in
this app). It's uncommon for an app people actually use, but if long-term save
durability ever becomes critical, the Capacitor path below removes this caveat
entirely, because native apps get real persistent storage.

## Installing it today (PWA)

- **Android (Chrome):** open the site, tap the menu (⋮) → "Install app" / "Add to Home
  screen".
- **iPhone (Safari):** open the site, tap the Share icon → "Add to Home Screen".

Either way it launches full-screen with the app icon, no browser bar, and works offline
after the first visit (the service worker caches the homepage and every game you've
opened).

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
bundled straight into the native app, the Home button and theme toggle keep working
unchanged, and `localStorage` becomes fully reliable (no iOS storage-clearing caveat).
You can drop `sw.js`'s registration at that point since Capacitor apps don't need a
service worker for offline support — everything's already on-device.

## Branding

The icons in `icons/` are placeholders (a simple gradient + game-controller mark) so
the app installs and looks presentable right now. To swap in real artwork later, just
replace these files with the same names and sizes — nothing else references them by
content, only by filename:

- `icons/icon-192.png` (192×192)
- `icons/icon-512.png` (512×512)
- `icons/icon-maskable-512.png` (512×512, keep the artwork inside the center ~66% —
  Android crops the edges into various shapes)
- `icons/apple-touch-icon.png` (180×180, must be fully opaque — iOS shows transparent
  areas as black)

Or run `python3 generate_icons.py` after editing the two colors at the top of that file
to regenerate a fresh placeholder set in the same style.

## Testing it yourself locally

From this folder:

```
python3 serve.py
```

then open `http://localhost:8080/index.html` in a browser. This is the version that
auto-discovers new games (see "Adding a game" above). If you'd rather use a plain
static server (e.g. `python3 -m http.server 8080`), that also works, just without the
live auto-discovery — regenerate `games.json` / re-inject the Home button by hand after
adding a game, as described above.

Either way, opening `index.html` by double-clicking it won't fully work — browsers
block local-file `fetch()` calls needed for `games.json`, and service workers need a
real http/https origin.

## Troubleshooting: "I added a game but it's not showing up"

- **Make sure the new folder is directly inside `games/`**, with its own `index.html`
  right inside it — `games/my-new-game/index.html`, not nested another level deeper,
  and not sitting next to `games/` instead of inside it.
- **Make sure `serve.py` is actually running** in a terminal, and that you're opening
  the exact `http://localhost:.../index.html` address it printed. If you opened the
  page before starting `serve.py`, or you're using a different terminal/tab, refresh
  the correct one.
- **Do a hard refresh** (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on Mac) rather than
  a normal refresh, just in case your browser cached something from before.
- **If you tested this app before this update**, your browser may have installed a
  "service worker" from that earlier version, which is a background helper that can
  keep showing you an old cached copy of the page. This version automatically detects
  when it's running on `localhost` and removes that old helper and its cache the next
  time you load the page — so one refresh should clear it for good. If it somehow
  still looks stale after that: open Chrome/Edge DevTools (F12) → **Application** tab →
  **Service Workers**, click **Unregister** on anything listed for `localhost`, then
  refresh once more.
- Still stuck? Open `http://localhost:.../games.json` directly in the browser — it
  should list your new game. If it doesn't, the folder isn't where the server expects
  it (see the first bullet above).

## What was verified before delivery

An automated check (Playwright/Chromium) confirmed: all games appear on the homepage
with the correct titles; every game's Home button is present, positioned correctly, and
returns to the homepage; the dark/light toggle switches themes and the choice survives
a page reload; `localStorage` persists across reloads; the homepage has no horizontal
overflow at phone, tablet, and desktop widths; the install banner/button behave
correctly per platform and install state; and — for this update — dropping a brand new
folder into `games/` and refreshing while `serve.py` is running makes it appear on the
homepage and play correctly, with the Home button already working, with zero manual
steps.
