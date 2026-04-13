#!/usr/bin/env node
// Scans public/music/ for .mp3 files and writes index.json manifest.
// File name format: "Artist - Title.mp3"

import { readdirSync, writeFileSync } from "fs";
import { join } from "path";

const musicDir = join(import.meta.dirname, "../public/music");
const files = readdirSync(musicDir).filter((f) => f.endsWith(".mp3")).sort();

const songs = files.map((f) => {
  const name = f.replace(/\.mp3$/i, "");
  const sep = name.indexOf(" - ");
  return {
    file: f,
    artist: sep > -1 ? name.slice(0, sep) : "Unknown",
    title: sep > -1 ? name.slice(sep + 3) : name,
  };
});

writeFileSync(join(musicDir, "index.json"), JSON.stringify(songs, null, 2) + "\n");
console.log(`Wrote ${songs.length} songs to public/music/index.json`);
