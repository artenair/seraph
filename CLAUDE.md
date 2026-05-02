# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full dev environment (server + Vite client)
npm run dev

# Server only
npm run server

# Client only
npm run client    # port 5173, proxies /api and /auth to server :3001

# Production build (output goes to client/dist/)
npm run build
```

There is no test suite or lint script configured.

## Architecture

Seraph is a tabletop RPG companion app. The codebase is split into two equal peers:

```
seraph/
├── client/    React 19 + Vite frontend
├── server/    Node/Express API server
└── .env       Server environment variables
```

**Server** (`server/index.js`) runs on port 3001:
- `POST /api/rooms/:roomId/songs` — YouTube song/playlist import (API key stays server-side)
- `GET/POST /auth/discord` — Discord OAuth → Firebase custom token
- No database — all persistent data is in Firebase

**Client** (`client/src/`) is a single-page app. Vite proxies `/api` and `/auth` to the server in dev.

### Firebase services

| Service | Purpose |
|---|---|
| Firebase Auth | Google + Discord login |
| Firestore | All persistent data (rooms, songs, rolls, talismans, audio zones) |
| RTDB | Real-time events (audio commands, audio state, song/roll/talisman events, presence, import progress) |

### Firestore data model

All data is room-scoped:
- `rooms/{roomId}` — name, inviteCode, ownerId
- `rooms/{roomId}/members/{userId}` — roles array (`Admin`, `Exorcist`, `DJ`)
- `rooms/{roomId}/songs/{songId}`
- `rooms/{roomId}/rolls/{rollId}`
- `rooms/{roomId}/talismans/{talismanId}`
- `rooms/{roomId}/audioZones/{zoneId}`
- `users/{userId}` — displayName, provider, onboardingComplete

### RTDB structure

- `rooms/{roomId}/audioCommand` — live audio commands (play, pause, seek, play_at)
- `rooms/{roomId}/audioState` — DJ heartbeat (zone, index, time) for sync-on-join
- `rooms/{roomId}/presence/{userId}` — online presence
- `rooms/{roomId}/rollEvent` — new roll notifications
- `rooms/{roomId}/songEvent` — song CRUD notifications
- `rooms/{roomId}/talismanEvent` — talisman CRUD notifications
- `rooms/{roomId}/importProgress` — playlist import progress

### Key context providers

- `AuthContext` — Firebase auth state, display name, onboarding
- `RoomContext` — current room, roles (isAdmin, isDJ, isOwner), members, presence
- `AudioContext` — YouTube IFrame player, zone-based playback, RTDB audio sync. Most complex file.
- `PersonalAudioContext` — per-client isolated playback, bypasses room sync

### Role system

- **Admin** — room management, talisman editing, exorcist/mission tabs (if re-enabled)
- **DJ** — audio controls, music library management
- **Exorcist** — player character role (no special gates currently)
- Room creator gets Admin + DJ by default

### Music / tagging

Songs are auto-tagged by keyword scraping from YouTube (not LLM). See `fetchYtTags` in `server/index.js`.

### Environment

Server vars live in `.env` at the project root. Client vars (all `VITE_*`) live in `client/.env.local`.
See `.env.example` for all required variables.
