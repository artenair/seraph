#!/usr/bin/env node
import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';

const sitePath = resolve(process.argv[2] ?? process.env.SITE_PATH ?? '.');
const port     = process.env.PORT ?? 3001;
const musicDir = join(dirname(fileURLToPath(import.meta.url)), 'data/music');
mkdirSync(musicDir, { recursive: true });

const db = new Database(join(sitePath, 'data/site.db'));
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS rolls (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    stat         TEXT NOT NULL,
    stat_value   INTEGER NOT NULL,
    bonus        INTEGER NOT NULL DEFAULT 0,
    hard         INTEGER NOT NULL DEFAULT 0,
    risky        INTEGER NOT NULL DEFAULT 0,
    divine_agony INTEGER NOT NULL DEFAULT 0,
    pathos_spent INTEGER NOT NULL DEFAULT 0,
    dice         TEXT NOT NULL,
    zero_dice    TEXT,
    risk_die     INTEGER,
    risk_label   TEXT,
    success      INTEGER NOT NULL,
    pool_size    INTEGER NOT NULL
  );
`);
try { db.exec(`ALTER TABLE rolls ADD COLUMN username TEXT`); } catch {}
try { db.exec(`ALTER TABLE rolls ADD COLUMN die_type TEXT NOT NULL DEFAULT 'd6'`); } catch {}
try { db.exec(`ALTER TABLE rolls ADD COLUMN d3_dice TEXT`); } catch {}
try { db.exec(`ALTER TABLE talismans ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE talismans ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    title       TEXT NOT NULL,
    artist      TEXT NOT NULL DEFAULT '',
    youtube_url TEXT NOT NULL,
    filename    TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'pending',
    duration    REAL NOT NULL DEFAULT 0,
    thumbnail   TEXT NOT NULL DEFAULT ''
  );
`);
try { db.exec(`ALTER TABLE songs ADD COLUMN duration  REAL NOT NULL DEFAULT 0`);  } catch {}
try { db.exec(`ALTER TABLE songs ADD COLUMN thumbnail TEXT NOT NULL DEFAULT ''`); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS audio_zones (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL DEFAULT 'Zone',
    x        REAL NOT NULL DEFAULT 0,
    y        REAL NOT NULL DEFAULT 0,
    radius   REAL NOT NULL DEFAULT 60,
    playlist TEXT NOT NULL DEFAULT '[]'
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS talismans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    name         TEXT NOT NULL,
    slashes      INTEGER NOT NULL DEFAULT 0,
    total_slashes INTEGER NOT NULL
  );
`);
try { db.exec(`ALTER TABLE rolls ADD COLUMN d3_dice TEXT`); } catch {}

// ── Prepared statements ────────────────────────────────────────────────────────

const q = {
  site: db.prepare('SELECT * FROM sites LIMIT 1'),

  exorcists: db.prepare(`
    SELECT id, site_id, name, sex, category, missions_count,
           blasphemy_name, agenda_name, agenda_ability_name, status
    FROM exorcists
    WHERE (:status IS NULL OR status = :status)
    ORDER BY missions_count DESC, name
  `),
  exorcistById: db.prepare('SELECT * FROM exorcists WHERE id = ?'),

  blasphemy:          db.prepare('SELECT * FROM blasphemies WHERE name = ?'),
  blasphemyAbilities: db.prepare('SELECT name, cost, tags, description FROM abilities WHERE blasphemy_name = ?'),

  agenda:          db.prepare('SELECT * FROM agendas WHERE name = ?'),
  agendaAbilities: db.prepare('SELECT name, description FROM agenda_abilities WHERE agenda_name = ?'),

  exorcistAbilities:  db.prepare('SELECT ability_name, role FROM exorcist_abilities WHERE exorcist_id = ?'),
  exorcistBoldVoices: db.prepare('SELECT voice FROM exorcist_bold_voices WHERE exorcist_id = ? ORDER BY sort_order'),

  missions: db.prepare(`
    SELECT id, name, round, handler, category, archetype, form
    FROM missions
    WHERE site_id = :site_id AND (:round IS NULL OR round = :round)
    ORDER BY round, id
  `),
  missionById:    db.prepare('SELECT * FROM missions WHERE id = ?'),
  missionSquad:   db.prepare(`
    SELECT ms.exorcist_name, ms.cat, ms.deceased, e.id AS exorcist_id
    FROM mission_squad ms
    LEFT JOIN exorcists e ON e.name = ms.exorcist_name
    WHERE ms.mission_id = ?
  `),
  missionDomains: db.prepare('SELECT name, description FROM mission_domains WHERE mission_id = ?'),

  blasphemies:         db.prepare('SELECT name FROM blasphemies ORDER BY name'),
  blasphemyAbilitiesW: db.prepare('SELECT name, cost, tags, description FROM abilities WHERE blasphemy_name = ?'),
  agendas:             db.prepare('SELECT name, voice_regular, voice_bold FROM agendas ORDER BY name'),
  agendaAbilitiesW:    db.prepare('SELECT name, description FROM agenda_abilities WHERE agenda_name = ?'),

  insertExorcist:      db.prepare(`INSERT INTO exorcists VALUES (?,?,?,?,?,?,?,?,?,?,?)`),
  insertExoAbility:    db.prepare(`INSERT OR IGNORE INTO exorcist_abilities VALUES (?,?,?)`),
  insertBoldVoice:     db.prepare(`INSERT INTO exorcist_bold_voices VALUES (?,?,?)`),
  deleteExorcist:      db.prepare(`DELETE FROM exorcists WHERE id = ?`),
  deleteExoAbilities:  db.prepare(`DELETE FROM exorcist_abilities WHERE exorcist_id = ?`),
  deleteExoBoldVoices: db.prepare(`DELETE FROM exorcist_bold_voices WHERE exorcist_id = ?`),

  talismans:       db.prepare(`SELECT * FROM talismans ORDER BY id`),
  talismanById:    db.prepare(`SELECT * FROM talismans WHERE id = ?`),
  insertTalisman:  db.prepare(`INSERT INTO talismans (name, slashes, total_slashes, hidden) VALUES (?, ?, ?, ?)`),
  updateTalismanSlashes: db.prepare(`UPDATE talismans SET slashes = ? WHERE id = ?`),
  updateTalismanTotal:   db.prepare(`UPDATE talismans SET total_slashes = ? WHERE id = ?`),
  updateTalismanName:    db.prepare(`UPDATE talismans SET name = ? WHERE id = ?`),
  updateTalismanHidden:  db.prepare(`UPDATE talismans SET hidden = ? WHERE id = ?`),
  updateTalismanPinned:  db.prepare(`UPDATE talismans SET pinned = ? WHERE id = ?`),
  deleteTalisman:  db.prepare(`DELETE FROM talismans WHERE id = ?`),

  audioZones:      db.prepare(`SELECT * FROM audio_zones ORDER BY id`),
  audioZoneById:   db.prepare(`SELECT * FROM audio_zones WHERE id = ?`),
  insertAudioZone: db.prepare(`INSERT INTO audio_zones (name, x, y, radius, playlist) VALUES (?, ?, ?, ?, ?)`),
  updateAudioZone: db.prepare(`UPDATE audio_zones SET name = ?, x = ?, y = ?, radius = ?, playlist = ? WHERE id = ?`),
  deleteAudioZone: db.prepare(`DELETE FROM audio_zones WHERE id = ?`),

  songs:           db.prepare(`SELECT * FROM songs ORDER BY created_at DESC`),
  songById:        db.prepare(`SELECT * FROM songs WHERE id = ?`),
  insertSong:      db.prepare(`INSERT INTO songs (title, artist, youtube_url, tags, status, duration) VALUES (?, ?, ?, ?, ?, ?)`),
  updateSong:      db.prepare(`UPDATE songs SET title = ?, artist = ?, tags = ? WHERE id = ?`),
  updateSongStatus:db.prepare(`UPDATE songs SET status = ?, filename = ?, thumbnail = ? WHERE id = ?`),
  deleteSong:      db.prepare(`DELETE FROM songs WHERE id = ?`),

  insertRoll:  db.prepare(`
    INSERT INTO rolls (stat, stat_value, bonus, hard, risky, divine_agony, pathos_spent,
                       dice, zero_dice, risk_die, risk_label, success, pool_size, username, die_type, d3_dice)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `),
  recentRolls: db.prepare(`SELECT * FROM rolls ORDER BY id DESC LIMIT ?`),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcCategory(missions) {
  if (missions >= 7) return 5;
  if (missions >= 3) return 4;
  if (missions >= 2) return 3;
  if (missions >= 1) return 2;
  return 1;
}

function hydrateExorcist(row) {
  const traits = JSON.parse(row.traits ?? '{}');

  const blasphemy = row.blasphemy_name ? (() => {
    const b         = q.blasphemy.get(row.blasphemy_name);
    const abilities = q.blasphemyAbilities.all(row.blasphemy_name)
      .map(a => ({ ...a, tags: JSON.parse(a.tags) }));
    return { ...b, hook: b.hook ? JSON.parse(b.hook) : null, abilities };
  })() : null;

  const agenda = row.agenda_name ? (() => {
    const a = q.agenda.get(row.agenda_name);
    return { ...a, abilities: q.agendaAbilities.all(row.agenda_name) };
  })() : null;

  const boldVoices = q.exorcistBoldVoices.all(row.id).map(r => r.voice);
  const assigned   = q.exorcistAbilities.all(row.id);
  const abilityMap = new Map((blasphemy?.abilities ?? []).map(a => [a.name, a]));
  const passive    = assigned.find(a => a.role === 'passive');
  const actives    = assigned.filter(a => a.role === 'active');

  return {
    id:                  row.id,
    name:                row.name,
    sex:                 row.sex,
    category:            row.category,
    missions_count:      row.missions_count,
    status:              row.status,
    traits,
    blasphemy,
    agenda,
    agenda_ability_name: row.agenda_ability_name,
    bold_voices:         boldVoices,
    passive_ability:     passive ? (abilityMap.get(passive.ability_name) ?? null) : null,
    active_abilities:    actives.map(a => abilityMap.get(a.ability_name)).filter(Boolean),
  };
}

function hydrateMission(row) {
  return {
    ...row,
    squad:  q.missionSquad.all(row.id).map(p => ({ ...p, deceased: p.deceased === 1 })),
    domain: q.missionDomains.all(row.id),
  };
}

function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }
function rollD6()       { return rollDie(6); }

function computeRoll({ statValue, bonus, hard, risky, divineAgony, pathos }) {
  const threshold   = hard ? 6 : 4;
  const naturalPool = Math.min(statValue + bonus, 6);
  const finalPool   = divineAgony ? naturalPool + pathos : naturalPool;

  let mainDice = [], zeroDice = null;

  if (finalPool === 0) {
    const d1 = rollD6(), d2 = rollD6();
    zeroDice = [d1, d2];
    mainDice = [Math.min(d1, d2)];
  } else {
    for (let i = 0; i < finalPool; i++) mainDice.push(rollD6());
  }

  const success = mainDice.some(d => d >= threshold);

  let riskDie = null, riskLabel = null;
  if (risky) {
    riskDie   = rollD6();
    riskLabel = riskDie === 1 ? 'Terrible'
              : riskDie <= 3 ? 'Bad'
              : riskDie <= 5 ? 'Expected'
              : 'Good';
  }

  return { mainDice, zeroDice, success, riskDie, riskLabel, threshold, finalPool };
}

function computeCustomRoll({ d6Count, d3Count }) {
  const d6Dice = Array.from({ length: d6Count }, () => rollD6());
  const d3Dice = Array.from({ length: d3Count }, () => rollDie(3));
  return { d6Dice, d3Dice, finalPool: d6Count + d3Count };
}

function parseRollRow(row) {
  return {
    id:          row.id,
    created_at:  row.created_at,
    username:    row.username ?? null,
    stat:        row.stat,
    statValue:   row.stat_value,
    bonus:       row.bonus,
    hard:        row.hard === 1,
    risky:       row.risky === 1,
    divineAgony: row.divine_agony === 1,
    pathosSent:  row.pathos_spent,
    dice:        JSON.parse(row.dice),
    zeroDice:    row.zero_dice ? JSON.parse(row.zero_dice) : null,
    riskDie:     row.risk_die,
    riskLabel:   row.risk_label,
    success:     row.success === 1,
    poolSize:    row.pool_size,
    d3Dice:      row.d3_dice ? JSON.parse(row.d3_dice) : null,
    threshold:   row.hard === 1 ? 6 : 4,
  };
}

// ── WebSocket ──────────────────────────────────────────────────────────────────

const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws', verifyClient: ({ origin }, cb) => cb(true) });

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'audio_command') {
        const out = JSON.stringify(msg);
        for (const client of wss.clients)
          if (client !== ws && client.readyState === 1) client.send(out);
      }
    } catch {}
  });

  const history = q.recentRolls.all(50).map(parseRollRow);
  ws.send(JSON.stringify({ type: 'history', rolls: history }));
  ws.send(JSON.stringify({ type: 'talismans', talismans: q.talismans.all() }));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

wss.on('close', () => clearInterval(heartbeat));

// ── Routes ─────────────────────────────────────────────────────────────────────

app.use(express.json());
app.use('/music', express.static(musicDir));

app.get('/api/site', (_req, res) => {
  res.json(q.site.get());
});

app.get('/api/exorcists', (req, res) => {
  res.json(q.exorcists.all({ status: req.query.status ?? null }));
});

app.get('/api/exorcists/:id', (req, res) => {
  const row = q.exorcistById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(hydrateExorcist(row));
});

app.get('/api/blasphemies', (_req, res) => {
  const rows = q.blasphemies.all().map(b => ({
    ...b,
    abilities: q.blasphemyAbilitiesW.all(b.name).map(a => ({ ...a, tags: JSON.parse(a.tags) })),
  }));
  res.json(rows);
});

app.get('/api/agendas', (_req, res) => {
  const rows = q.agendas.all().map(a => ({
    ...a,
    abilities: q.agendaAbilitiesW.all(a.name),
  }));
  res.json(rows);
});

app.post('/api/exorcists', (req, res) => {
  const { name, sex, missions_count, blasphemy_name,
          active_abilities, agenda_name, agenda_ability_name, traits } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const site = q.site.get();
  let id;
  for (let i = 0; i < 10; i++) {
    const serial = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    id = `XO-${site.site_id}-${site.squad_id}-${serial}`;
    if (!q.exorcistById.get(id)) break;
  }

  const traitsJson     = JSON.stringify(traits ?? {});
  const passiveAbility = blasphemy_name
    ? q.blasphemyAbilitiesW.all(blasphemy_name).find(a => a.cost === 'Passive')
    : null;
  const agendaRow = agenda_name ? q.agenda.get(agenda_name) : null;

  db.transaction(() => {
    q.insertExorcist.run(
      id, site.site_id, name.trim(), sex ?? 'male',
      calcCategory(missions_count ?? 0), missions_count ?? 0,
      blasphemy_name || null, agenda_name || null,
      agenda_ability_name || null,
      'live', traitsJson,
    );
    for (const a of active_abilities ?? []) q.insertExoAbility.run(id, a, 'active');
    if (passiveAbility) q.insertExoAbility.run(id, passiveAbility.name, 'passive');
    if (agendaRow?.voice_bold) q.insertBoldVoice.run(id, agendaRow.voice_bold, 0);
  })();

  const row = q.exorcistById.get(id);
  res.status(201).json(hydrateExorcist(row));
});

app.delete('/api/exorcists/:id', (req, res) => {
  const row = q.exorcistById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  db.transaction(() => {
    q.deleteExoAbilities.run(req.params.id);
    q.deleteExoBoldVoices.run(req.params.id);
    q.deleteExorcist.run(req.params.id);
  })();
  res.status(204).end();
});

app.get('/api/missions', (req, res) => {
  const site  = q.site.get();
  const round = req.query.round ? Number(req.query.round) : null;
  res.json(q.missions.all({ site_id: site.site_id, round }));
});

app.get('/api/missions/:id', (req, res) => {
  const row = q.missionById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(hydrateMission(row));
});

app.get('/api/rolls', (_req, res) => {
  res.json(q.recentRolls.all(50).map(parseRollRow));
});

app.post('/api/rolls', (req, res) => {
  const { stat, statValue, bonus = 0, hard = false, risky = false,
          divineAgony = false, pathos = 0, username,
          d6 = 0, d3 = 0 } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });

  const isCustom = 'd6' in req.body || 'd3' in req.body;
  if (!isCustom && !stat) return res.status(400).json({ error: 'stat is required' });

  let r, roll;

  if (isCustom) {
    const c = computeCustomRoll({ d6Count: d6, d3Count: d3 });
    const insert = q.insertRoll.run(
      '', 0, 0, 0, 0, 0, 0,
      JSON.stringify(c.d6Dice),
      null, null, null,
      0, c.finalPool,
      username, 'd6',
      c.d3Dice.length ? JSON.stringify(c.d3Dice) : null,
    );
    roll = {
      id: insert.lastInsertRowid,
      created_at: new Date().toISOString(),
      username,
      stat: null,
      d6Dice: c.d6Dice,
      d3Dice: c.d3Dice,
      poolSize: c.finalPool,
    };
  } else {
    r = computeRoll({ statValue, bonus, hard, risky, divineAgony, pathos });
    const insert = q.insertRoll.run(
      stat, statValue, bonus,
      hard ? 1 : 0, risky ? 1 : 0, divineAgony ? 1 : 0,
      divineAgony ? pathos : 0,
      JSON.stringify(r.mainDice),
      r.zeroDice ? JSON.stringify(r.zeroDice) : null,
      r.riskDie, r.riskLabel,
      r.success ? 1 : 0,
      r.finalPool,
      username, 'd6', null,
    );
    roll = {
      id: insert.lastInsertRowid,
      created_at: new Date().toISOString(),
      username,
      stat, statValue, bonus, hard, risky,
      divineAgony, pathosSent: divineAgony ? pathos : 0,
      dice:      r.mainDice,
      zeroDice:  r.zeroDice,
      riskDie:   r.riskDie,
      riskLabel: r.riskLabel,
      success:   r.success,
      poolSize:  r.finalPool,
      threshold: r.threshold,
    };
  }

  broadcast({ type: 'roll', roll });
  res.status(201).json(roll);
});

// ── Talismans ──────────────────────────────────────────────────────────────────

app.get('/api/talismans', (_req, res) => {
  res.json(q.talismans.all());
});

app.post('/api/talismans', (req, res) => {
  const { name, totalSlashes, hidden = false } = req.body;
  if (!name?.trim())   return res.status(400).json({ error: 'name is required' });
  if (!totalSlashes)   return res.status(400).json({ error: 'totalSlashes is required' });

  const insert   = q.insertTalisman.run(name.trim(), 0, totalSlashes, hidden ? 1 : 0);
  const talisman = q.talismanById.get(insert.lastInsertRowid);
  broadcast({ type: 'talisman_created', talisman });
  res.status(201).json(talisman);
});

app.patch('/api/talismans/:id', (req, res) => {
  const talisman = q.talismanById.get(req.params.id);
  if (!talisman) return res.status(404).json({ error: 'not found' });

  if (req.body.name !== undefined) {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'name cannot be empty' });
    q.updateTalismanName.run(name, talisman.id);
  }
  if (req.body.total_slashes !== undefined) {
    const total = Math.max(1, Number(req.body.total_slashes));
    q.updateTalismanTotal.run(total, talisman.id);
    const current = q.talismanById.get(talisman.id);
    if (current.slashes > total) q.updateTalismanSlashes.run(total, talisman.id);
  }
  if (req.body.slashes !== undefined) {
    const fresh = q.talismanById.get(talisman.id);
    const slashes = Math.max(0, Math.min(fresh.total_slashes, Number(req.body.slashes)));
    q.updateTalismanSlashes.run(slashes, talisman.id);
  }
  if (req.body.hidden !== undefined) {
    q.updateTalismanHidden.run(req.body.hidden ? 1 : 0, talisman.id);
  }
  if (req.body.pinned !== undefined) {
    q.updateTalismanPinned.run(req.body.pinned ? 1 : 0, talisman.id);
  }
  const updated = q.talismanById.get(talisman.id);
  broadcast({ type: 'talisman_updated', talisman: updated });
  res.json(updated);
});

app.delete('/api/talismans/:id', (req, res) => {
  const talisman = q.talismanById.get(req.params.id);
  if (!talisman) return res.status(404).json({ error: 'not found' });
  q.deleteTalisman.run(talisman.id);
  broadcast({ type: 'talisman_deleted', id: talisman.id });
  res.status(204).end();
});

// ── Audio Zones ────────────────────────────────────────────────────────────────

app.get('/api/audio-zones', (_req, res) => {
  res.json(q.audioZones.all());
});

app.post('/api/audio-zones', (req, res) => {
  const { name = 'Zone', x = 0, y = 0, radius = 60 } = req.body;
  const insert = q.insertAudioZone.run(name, x, y, radius, '[]');
  res.status(201).json(q.audioZoneById.get(insert.lastInsertRowid));
});

app.patch('/api/audio-zones/:id', (req, res) => {
  const zone = q.audioZoneById.get(req.params.id);
  if (!zone) return res.status(404).json({ error: 'not found' });
  const name     = req.body.name     ?? zone.name;
  const x        = req.body.x        ?? zone.x;
  const y        = req.body.y        ?? zone.y;
  const radius   = req.body.radius   ?? zone.radius;
  const playlist = req.body.playlist !== undefined ? JSON.stringify(req.body.playlist) : zone.playlist;
  q.updateAudioZone.run(name, x, y, radius, playlist, zone.id);
  res.json(q.audioZoneById.get(zone.id));
});

app.delete('/api/audio-zones/:id', (req, res) => {
  const zone = q.audioZoneById.get(req.params.id);
  if (!zone) return res.status(404).json({ error: 'not found' });
  q.deleteAudioZone.run(zone.id);
  res.status(204).end();
});

// ── Music ──────────────────────────────────────────────────────────────────────

app.get('/api/music', (_req, res) => {
  res.json(q.songs.all());
});

app.post('/api/music', (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'url is required' });

  let infoBuf = '';
  const info = spawn('yt-dlp', ['--dump-json', '--no-playlist', url.trim()]);
  info.stdout.on('data', d => { infoBuf += d; });
  info.on('close', code => {
    if (code !== 0) return res.status(400).json({ error: 'could not fetch video info' });
    let meta;
    try { meta = JSON.parse(infoBuf); } catch { return res.status(400).json({ error: 'invalid video info' }); }

    const title    = meta.title    ?? 'Unknown';
    const artist   = meta.uploader ?? meta.channel ?? '';
    const ytId     = meta.id;
    const filename = `${ytId}.mp3`;

    const insert = q.insertSong.run(title, artist, url.trim(), '[]', 'downloading', meta.duration ?? 0);
    const song   = q.songById.get(insert.lastInsertRowid);
    res.status(202).json(song);

    // Download thumbnail from YouTube CDN
    const thumbFile = `${ytId}.jpg`;
    fetch(`https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`)
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
      .then(buf => writeFile(join(musicDir, thumbFile), Buffer.from(buf)))
      .catch(() => {});

    const dl = spawn('yt-dlp', [
      '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '--no-playlist',
      '-o', join(musicDir, `${ytId}.%(ext)s`),
      url.trim(),
    ]);
    const downloadRe = /\[download\]\s+([\d.]+)%/;
    const timeRe     = /time=(\d{2}):(\d{2}):(\d{2}\.?\d*)/;
    let lastPercent  = -1;
    function parseProgress(chunk) {
      const str = chunk.toString();
      const dlMatch = downloadRe.exec(str);
      if (dlMatch) {
        const percent = parseFloat(dlMatch[1]);
        if (percent !== lastPercent) {
          lastPercent = percent;
          broadcast({ type: 'song_progress', id: song.id, phase: 'download', percent });
        }
        return;
      }
      if (song.duration > 0) {
        const tMatch = timeRe.exec(str);
        if (tMatch) {
          const current = parseInt(tMatch[1]) * 3600 + parseInt(tMatch[2]) * 60 + parseFloat(tMatch[3]);
          const percent = Math.min(100, (current / song.duration) * 100);
          broadcast({ type: 'song_progress', id: song.id, phase: 'convert', percent });
        }
      }
    }
    dl.stdout.on('data', parseProgress);
    dl.stderr.on('data', parseProgress);
    dl.on('close', dlCode => {
      const status    = dlCode === 0 ? 'done' : 'error';
      const thumbnail = dlCode === 0 ? `${ytId}.jpg` : '';
      q.updateSongStatus.run(status, dlCode === 0 ? filename : '', thumbnail, song.id);
      broadcast({ type: 'song_updated', song: q.songById.get(song.id) });
    });
  });
});

app.patch('/api/music/:id', (req, res) => {
  const song = q.songById.get(req.params.id);
  if (!song) return res.status(404).json({ error: 'not found' });

  const title  = req.body.title  ?? song.title;
  const artist = req.body.artist ?? song.artist;
  const tags   = req.body.tags !== undefined ? JSON.stringify(req.body.tags) : song.tags;

  q.updateSong.run(title, artist, tags, song.id);
  res.json(q.songById.get(song.id));
});

app.delete('/api/music/:id', async (req, res) => {
  const song = q.songById.get(req.params.id);
  if (!song) return res.status(404).json({ error: 'not found' });

  q.deleteSong.run(song.id);
  if (song.filename) {
    try { await unlink(join(musicDir, song.filename)); } catch {}
  }
  res.status(204).end();
});

// ── Start ──────────────────────────────────────────────────────────────────────

server.listen(port, () => {
  console.log(`site:  ${sitePath}`);
  console.log(`api:   http://localhost:${port}/api`);
  console.log(`ws:    ws://localhost:${port}/ws`);
});
