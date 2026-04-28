#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import Database from 'better-sqlite3';

const sitePath = resolve(process.argv[2] ?? '.');
const siteData = JSON.parse(readFileSync(join(sitePath, 'data/site.json'),     'utf-8'));
const missData = JSON.parse(readFileSync(join(sitePath, 'data/missions.json'), 'utf-8'));

const db = new Database(join(sitePath, 'data/site.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    site_id        TEXT PRIMARY KEY,
    squad_id       TEXT,
    name           TEXT NOT NULL,
    exorcist_count INTEGER
  );

  CREATE TABLE IF NOT EXISTS blasphemies (
    name TEXT PRIMARY KEY,
    hook TEXT
  );

  CREATE TABLE IF NOT EXISTS abilities (
    id             INTEGER PRIMARY KEY,
    blasphemy_name TEXT NOT NULL REFERENCES blasphemies(name),
    name           TEXT NOT NULL,
    cost           TEXT NOT NULL,
    tags           TEXT NOT NULL,
    description    TEXT NOT NULL,
    UNIQUE(blasphemy_name, name)
  );

  CREATE TABLE IF NOT EXISTS agendas (
    name          TEXT PRIMARY KEY,
    voice_regular TEXT NOT NULL,
    voice_bold    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agenda_abilities (
    id          INTEGER PRIMARY KEY,
    agenda_name TEXT NOT NULL REFERENCES agendas(name),
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    UNIQUE(agenda_name, name)
  );

  CREATE TABLE IF NOT EXISTS exorcists (
    id                  TEXT PRIMARY KEY,
    site_id             TEXT NOT NULL REFERENCES sites(site_id),
    name                TEXT NOT NULL,
    sex                 TEXT NOT NULL,
    category            INTEGER NOT NULL,
    missions_count      INTEGER NOT NULL DEFAULT 0,
    blasphemy_name      TEXT REFERENCES blasphemies(name),
    agenda_name         TEXT REFERENCES agendas(name),
    agenda_ability_name TEXT,
    status              TEXT NOT NULL DEFAULT 'live',
    traits              TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS exorcist_abilities (
    exorcist_id  TEXT NOT NULL REFERENCES exorcists(id),
    ability_name TEXT NOT NULL,
    role         TEXT NOT NULL,
    PRIMARY KEY (exorcist_id, ability_name)
  );

  CREATE TABLE IF NOT EXISTS exorcist_bold_voices (
    exorcist_id TEXT    NOT NULL REFERENCES exorcists(id),
    voice       TEXT    NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS missions (
    id        TEXT PRIMARY KEY,
    site_id   TEXT NOT NULL REFERENCES sites(site_id),
    name      TEXT NOT NULL,
    round     INTEGER NOT NULL,
    handler   TEXT NOT NULL,
    category  INTEGER NOT NULL,
    archetype TEXT NOT NULL,
    form      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mission_squad (
    mission_id     TEXT    NOT NULL REFERENCES missions(id),
    exorcist_name  TEXT    NOT NULL,
    cat            INTEGER NOT NULL,
    deceased       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (mission_id, exorcist_name)
  );

  CREATE TABLE IF NOT EXISTS mission_domains (
    id          INTEGER PRIMARY KEY,
    mission_id  TEXT NOT NULL REFERENCES missions(id),
    name        TEXT NOT NULL,
    description TEXT NOT NULL
  );
`);

const stmts = {
  site:           db.prepare(`INSERT OR REPLACE INTO sites VALUES (?,?,?,?)`),
  blasphemy:      db.prepare(`INSERT OR IGNORE INTO blasphemies VALUES (?,?)`),
  ability:        db.prepare(`INSERT OR IGNORE INTO abilities (blasphemy_name,name,cost,tags,description) VALUES (?,?,?,?,?)`),
  agenda:         db.prepare(`INSERT OR IGNORE INTO agendas VALUES (?,?,?)`),
  agendaAbility:  db.prepare(`INSERT OR IGNORE INTO agenda_abilities (agenda_name,name,description) VALUES (?,?,?)`),
  exorcist:          db.prepare(`INSERT OR REPLACE INTO exorcists VALUES (?,?,?,?,?,?,?,?,?,?,?)`),
  exoAbility:        db.prepare(`INSERT OR IGNORE INTO exorcist_abilities VALUES (?,?,?)`),
  clearBoldVoices:   db.prepare(`DELETE FROM exorcist_bold_voices WHERE exorcist_id = ?`),
  exoBoldVoice:      db.prepare(`INSERT INTO exorcist_bold_voices VALUES (?,?,?)`),
  mission:        db.prepare(`INSERT OR REPLACE INTO missions VALUES (?,?,?,?,?,?,?,?)`),
  squad:          db.prepare(`INSERT OR IGNORE INTO mission_squad VALUES (?,?,?,?)`),
  domain:         db.prepare(`INSERT OR IGNORE INTO mission_domains (mission_id,name,description) VALUES (?,?,?)`),
};

function importExorcist(e, status) {
  if (e.blasphemy) {
    stmts.blasphemy.run(e.blasphemy.name, e.blasphemy.hook ? JSON.stringify(e.blasphemy.hook) : null);
    for (const a of e.blasphemy.abilities ?? []) {
      stmts.ability.run(e.blasphemy.name, a.name, a.cost, JSON.stringify(a.tags ?? []), a.description);
    }
  }
  if (e.agenda) {
    stmts.agenda.run(e.agenda.name, e.agenda.voices.regular, e.agenda.voices.bold);
    for (const a of e.agenda.abilities ?? []) {
      stmts.agendaAbility.run(e.agenda.name, a.name, a.description);
    }
  }

  const traits = JSON.stringify({
    appearance:     e.appearance     ?? [],
    physical_detail: e.physical_detail ?? [],
    mannerism:      e.mannerism      ?? [],
    personality:    e.personality    ?? [],
    goal:           e.goal           ?? [],
    hobby:          e.hobby          ?? [],
    background:     e.background     ?? [],
    asset:          e.asset          ?? [],
    liability:      e.liability      ?? [],
    reputation:     e.reputation     ?? [],
    secret:         e.secret         ?? [],
    misfortune:     e.misfortune     ?? [],
  });

  stmts.exorcist.run(
    e.id, siteData.site_id, e.name, e.sex,
    e.category, e.missions ?? 0,
    e.blasphemy?.name ?? null,
    e.agenda?.name    ?? null,
    e.agenda_ability?.name ?? null,
    status, traits,
  );

  for (const a of e.active_abilities ?? []) {
    stmts.exoAbility.run(e.id, a.name, 'active');
  }
  if (e.passive_ability) {
    stmts.exoAbility.run(e.id, e.passive_ability.name, 'passive');
  }

  stmts.clearBoldVoices.run(e.id);
  const boldVoices = Array.isArray(e.bold_voices)
    ? e.bold_voices
    : e.agenda?.voices?.bold ? [e.agenda.voices.bold] : [];
  boldVoices.forEach((v, i) => stmts.exoBoldVoice.run(e.id, v, i));
}

db.transaction(() => {
  stmts.site.run(siteData.site_id, siteData.squad_id ?? null, siteData.name, siteData.exorcist_count ?? null);

  for (const e of siteData.exorcists ?? []) importExorcist(e, 'live');
  for (const e of missData.deceased  ?? []) importExorcist(e, 'deceased');

  for (const m of missData.missions ?? []) {
    stmts.mission.run(m.id, siteData.site_id, m.name, m.round, m.handler, m.category, m.archetype, m.form);
    for (const p of m.squad  ?? []) stmts.squad.run(m.id, p.name, p.cat, p.deceased ? 1 : 0);
    for (const d of m.domain ?? []) stmts.domain.run(m.id, d.name, d.description);
  }
})();

console.log(`imported → ${join(sitePath, 'data/site.db')}`);
