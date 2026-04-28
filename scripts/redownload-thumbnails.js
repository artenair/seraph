#!/usr/bin/env node
// Redownloads thumbnails for all songs that have a filename but are missing a thumbnail file.
// Run from the repo root: node scripts/redownload-thumbnails.js

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFile, access, readFile } from 'fs/promises';
import Database from 'better-sqlite3';

// Load .env from repo root if present
try {
  const env = await readFile(join(dirname(fileURLToPath(import.meta.url)), '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
} catch {}

const sitePath = process.argv[2] ?? process.env.SITE_PATH ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const musicDir = join(sitePath, 'data/music');
const db       = new Database(join(sitePath, 'data/site.db'));

const songs = db.prepare(`SELECT * FROM songs WHERE status = 'done' AND filename != ''`).all();

console.log(`Found ${songs.length} completed songs.`);

const force = process.argv.includes('--force');
let ok = 0, skipped = 0, failed = 0;

for (const song of songs) {
  const ytId    = song.filename.replace(/\.mp3$/, '');
  const outFile = join(musicDir, `${ytId}.jpg`);

  if (!force) {
    const exists = await access(outFile).then(() => true).catch(() => false);
    if (exists) { skipped++; continue; }
  }

  const urls = [
    `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
  ];

  let downloaded = false;
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      await writeFile(outFile, Buffer.from(await r.arrayBuffer()));
      downloaded = true;
      break;
    } catch {}
  }

  if (downloaded) {
    db.prepare(`UPDATE songs SET thumbnail = ? WHERE id = ?`).run(`${ytId}.jpg`, song.id);
    console.log(`  ✓ ${song.title}`);
    ok++;
  } else {
    console.warn(`  ✗ ${song.title} (${ytId})`);
    failed++;
  }
}

console.log(`\nDone. ${ok} downloaded, ${skipped} skipped, ${failed} failed.`);
db.close();
