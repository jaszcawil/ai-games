#!/usr/bin/env node
// Regenerates games.json by scanning the games/ folder.
// Run this after adding or removing a game folder: `node build-games.mjs`
//
// A folder counts as a game if it directly contains an index.html (a normal,
// single-version game), OR if it has no index.html of its own but one or more
// subfolders that each have their own index.html (a versioned game, e.g.
// games/math-adventures/version 1/index.html, .../version 2/index.html --
// the homepage will ask which version to play).
// The title/label is the folder name with "-"/"_"/spaces normalized and each
// word capitalized.
//
// NOTE: unlike watch_and_update.py / serve.py, this script only rewrites
// games.json -- it does NOT touch index.html's embedded GAMES array or add
// the Home button to game files. It's aimed at the Capacitor path in the
// README, not everyday use. Use Start Auto-Update.bat / watch_and_update.py
// for the homepage to actually update.

import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const GAMES_DIR = join(process.cwd(), "games");
const OUT_FILE = join(process.cwd(), "games.json");

function toLabel(name) {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function naturalSort(a, b) {
  const split = (s) => s.split(/(\d+)/).map((p) => (/^\d+$/.test(p) ? Number(p) : p.toLowerCase()));
  const pa = split(a), pb = split(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i], y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function main() {
  if (!existsSync(GAMES_DIR)) {
    console.error("No games/ folder found next to this script.");
    process.exit(1);
  }

  const entries = [];
  for (const name of readdirSync(GAMES_DIR).sort(naturalSort)) {
    const folder = join(GAMES_DIR, name);
    if (!isDir(folder)) continue;

    if (existsSync(join(folder, "index.html"))) {
      entries.push({ slug: name, title: toLabel(name), versions: [{ path: "", label: null }] });
      continue;
    }

    const versions = readdirSync(folder)
      .sort(naturalSort)
      .filter((sub) => isDir(join(folder, sub)) && existsSync(join(folder, sub, "index.html")))
      .map((sub) => ({ path: sub, label: toLabel(sub) }));
    if (versions.length) entries.push({ slug: name, title: toLabel(name), versions });
  }

  writeFileSync(OUT_FILE, JSON.stringify(entries, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${entries.length} game(s) to games.json:`);
  for (const g of entries) {
    const versionNote = g.versions.length > 1 ? ` (${g.versions.length} versions)` : "";
    console.log(`  - ${g.slug}  ->  "${g.title}"${versionNote}`);
  }
}

main();
