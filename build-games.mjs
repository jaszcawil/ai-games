#!/usr/bin/env node
// Regenerates games.json by scanning the games/ folder.
// Run this after adding or removing a game folder: `node build-games.mjs`
//
// Rule: a folder counts as a game if it directly contains an index.html.
// The title is the folder name with "-" replaced by spaces and each word capitalized.

import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const GAMES_DIR = join(process.cwd(), "games");
const OUT_FILE = join(process.cwd(), "games.json");

function slugToTitle(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function main() {
  if (!existsSync(GAMES_DIR)) {
    console.error("No games/ folder found next to this script.");
    process.exit(1);
  }

  const entries = readdirSync(GAMES_DIR)
    .filter((name) => statSync(join(GAMES_DIR, name)).isDirectory())
    .filter((name) => existsSync(join(GAMES_DIR, name, "index.html")))
    .sort((a, b) => a.localeCompare(b))
    .map((slug) => ({ slug, title: slugToTitle(slug) }));

  writeFileSync(OUT_FILE, JSON.stringify(entries, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${entries.length} game(s) to games.json:`);
  for (const g of entries) console.log(`  - ${g.slug}  ->  "${g.title}"`);
}

main();
