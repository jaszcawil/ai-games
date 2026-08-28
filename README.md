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
├── games.json              <- the list the homepage reads (slug + title per game)
├── build-games.mjs         <- regenerates games.json by scanning games/
├── inject_home_button.py   <- adds the floating Home button to a game's index.html
├── generate_icons.py       <- (re)generates the placeholder app icons
├── icons/                  <- app icons (placeholders — see "Branding" below)
└── games/
    └── <slug>/index.html   <- one folder per game, unchanged except for the added Home button
```

## How the homepage works

- `index.html` reads `games.json` and renders one card per game. The title shown is the
  folder name with dashes turned into spaces and each word capitalized (e.g.
  `wonderblocks-adventures` → "Wonderblocks Adventures"), exactly as requested.
- Tapping a card opens `games/<slug>/index.html` directly (not in an iframe), so each
  game gets the full screen and full performance.
- The grid is a responsive CSS grid — it reflows from 2 columns on a phone up to 5+ on a
  wide desktop window, so the same file works on any screen size.

## Adding or removing a game

1. Drop a new folder into `games/` (folder name = title, dashes = spaces), containing
   its `index.html`.
2. Run `node build-games.mjs` to regenerate `games.json` automatically. (You can also
   hand-edit `games.json` if you'd rather not use Node.)
3. Run `python3 inject_home_button.py .` from this folder to add the floating Home
   button to any new game's `index.html`. It's safe to re-run any time — it skips files
   that already have the button.

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
python3 -m http.server 8080
```

then open `http://localhost:8080/index.html` in a browser. (Opening `index.html` by
double-clicking it won't fully work — browsers block local-file `fetch()` calls needed
for `games.json` and service workers need a real http/https origin.)

## What was verified before delivery

An automated check (Playwright/Chromium) confirmed: all 9 games appear on the homepage
with the correct titles; every game's Home button is present, positioned correctly, and
returns to the homepage; the dark/light toggle switches themes and the choice survives
a page reload; `localStorage` persists across reloads; and the homepage has no
horizontal overflow at phone, tablet, and desktop widths.
