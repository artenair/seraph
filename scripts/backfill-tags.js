#!/usr/bin/env node
// Backfills YouTube keywords as tags for songs that currently have no tags.
// Run from the repo root: node scripts/backfill-tags.js
// Add --force to overwrite existing tags.

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import Database from 'better-sqlite3';

try {
  const env = await readFile(join(dirname(fileURLToPath(import.meta.url)), '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
} catch {}

const args     = process.argv.slice(2);
const force    = args.includes('--force');
const sitePath = args.find(a => !a.startsWith('--')) ?? process.env.SITE_PATH ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const db       = new Database(join(sitePath, 'data/site.db'));

function extractYtId(url) {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = p.exec(url);
    if (m) return m[1];
  }
  return null;
}

async function fetchYtTags(ytId) {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!r.ok) return [];
    const html = await r.text();

    const vdStart = html.indexOf('"videoDetails"');
    if (vdStart === -1) return [];
    const kwStart = html.indexOf('"keywords":[', vdStart);
    if (kwStart === -1) return [];

    const arrStart = kwStart + '"keywords":'.length;
    let depth = 0, i = arrStart;
    while (i < html.length) {
      if (html[i] === '[') depth++;
      else if (html[i] === ']') { depth--; if (depth === 0) break; }
      i++;
    }
    const tags = JSON.parse(html.slice(arrStart, i + 1));
    return Array.isArray(tags) ? tags.slice(0, 10) : [];
  } catch {
    return [];
  }
}

const update = db.prepare(`UPDATE songs SET tags = ? WHERE id = ?`);

const songs = force
  ? db.prepare(`SELECT id, title, youtube_url, tags FROM songs`).all()
  : db.prepare(`SELECT id, title, youtube_url, tags FROM songs WHERE tags = '[]' OR tags = ''`).all();

console.log(`Found ${songs.length} song(s) to process.`);

let ok = 0, skipped = 0, failed = 0;

for (const song of songs) {
  const ytId = extractYtId(song.youtube_url);
  if (!ytId) {
    console.warn(`  - ${song.title}: could not extract YouTube ID`);
    failed++;
    continue;
  }

  const tags = await fetchYtTags(ytId);
  if (!tags.length) {
    console.warn(`  - ${song.title}: no tags found`);
    skipped++;
    continue;
  }

  update.run(JSON.stringify(tags), song.id);
  console.log(`  ✓ ${song.title}: [${tags.join(', ')}]`);
  ok++;
}

console.log(`\nDone. ${ok} updated, ${skipped} no tags found, ${failed} failed.`);
db.close();
