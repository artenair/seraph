# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full dev environment (server + Vite client + cloudflared tunnel)
npm run dev

# Server only
npm start

# Client only (from client/)
cd client && npm run dev    # port 5173, proxies /api and /ws to :3001

# Production build (output goes to dist/)
cd client && npm run build

# Initialize database from JSON files
npm run import
```

There is no test suite or lint script configured.

## Architecture

Seraph is a full-stack tabletop RPG companion app: Node/Express backend with SQLite, React 19 + Vite frontend, and real-time audio sync over WebSockets.

**Server** (`server.js`) runs on port 3001 and owns:
- REST API under `/api/*`
- WebSocket server at `/ws` — broadcasts audio commands and streams roll history to new connections
- SQLite database via `better-sqlite3` (`data/site.db`)

**Client** (`client/src/`) is a single-page app. Vite proxies `/api` and `/ws` to the server in dev. In production, the server serves `dist/` statically.

### Database schema (key tables)

| Table | Purpose |
|---|---|
| `sites` | Single-row site metadata |
| `exorcists` | Player characters with abilities JSON and status |
| `blasphemies` | Dark-power rules with associated abilities |
| `agendas` | Character agendas with voice line metadata |
| `missions` | Mission definitions with squads and domains JSON |
| `rolls` | Dice roll history (d6/d3, hard/risky/divine modifiers) |
| `talismans` | Story items tracked by slash count |
| `songs` | YouTube music library (id, title, tags, status) |
| `audio_zones` | Map zones each carrying a playlist and spatial config |

### Context providers (frontend state)

- `AudioContext.jsx` — controls the global YouTube IFrame player, handles zone-based playback, crossfading, and relays commands received over WebSocket. This is the most complex file in the project.
- `PersonalAudioContext.jsx` — per-client isolated playback mode that bypasses the synchronized zone system.

### `isLocal` pattern

Use `isLocal()` from `client/src/lib/utils.js` to detect local vs. remote client. Mirror this on the server with `req.hostname === 'localhost'` (or the existing util in `server.js`). Do not invent a new mechanism.

### Music / tagging

Songs are auto-tagged by keyword matching (not LLM). See `scripts/backfill-tags.js` for the pattern; match it for any new tagging logic.

### Environment

`.env.example` documents the only env var: `SITE_PATH` (empty = local dev, set to a path prefix for deployed environments).
