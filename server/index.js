#!/usr/bin/env node
import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import admin from 'firebase-admin';

const port = process.env.PORT ?? 3001;

// -- Firebase Admin

const credential = process.env.FIREBASE_SERVICE_ACCOUNT
  ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  : admin.credential.applicationDefault();

admin.initializeApp({ credential, databaseURL: process.env.FIREBASE_DATABASE_URL });

// -- YouTube helpers

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

function extractYtPlaylistId(url) {
  if (!url || /[?&]v=/.test(url)) return null;
  const m = /[?&]list=([a-zA-Z0-9_-]+)/.exec(url);
  return m ? m[1] : null;
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
    const html     = await r.text();
    const vdStart  = html.indexOf('"videoDetails"');
    if (vdStart === -1) return [];
    const kwStart  = html.indexOf('"keywords":[', vdStart);
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
  } catch { return []; }
}

async function fetchPlaylistMeta(playlistId) {
  const key = process.env.YOUTUBE_API_KEY;
  const r   = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${encodeURIComponent(playlistId)}&key=${key}`);
  if (!r.ok) throw new Error('failed to fetch playlist info');
  const data = await r.json();
  return data.items?.[0]?.snippet?.title ?? 'Playlist';
}

async function fetchPlaylistVideoIds(playlistId) {
  const key = process.env.YOUTUBE_API_KEY;
  const ids = [];
  let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('key', key);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const r = await fetch(url);
    if (!r.ok) throw new Error('failed to fetch playlist items');
    const data = await r.json();
    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (videoId) ids.push({
        videoId,
        title:        item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail:    item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? '',
      });
    }
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);
  return ids;
}

// -- Express

const app    = express();
const server = createServer(app);

app.use(express.json());

// -- Room songs

async function importPlaylistToFirestore(roomId, playlistId, canManageMusic) {
  const fsDb = admin.firestore();
  const rtDb = admin.database();
  let playlistTitle, items;

  try {
    [playlistTitle, items] = await Promise.all([
      fetchPlaylistMeta(playlistId),
      fetchPlaylistVideoIds(playlistId),
    ]);
  } catch (e) {
    await rtDb.ref(`rooms/${roomId}/importProgress`).set({ error: e.message, ts: Date.now() });
    return;
  }

  const total = items.length;
  let done    = 0;
  await rtDb.ref(`rooms/${roomId}/importProgress`).set({ playlistTitle, done, total, complete: false, ts: Date.now() });

  for (const { videoId, title: ytTitle, channelTitle, thumbnail: ytThumb } of items) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const [meta, tags] = await Promise.all([
        fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`)
          .then(r => r.ok ? r.json() : null),
        fetchYtTags(videoId),
      ]);
      const songData = {
        title:       meta?.title       ?? ytTitle      ?? 'Unknown',
        artist:      meta?.author_name ?? channelTitle ?? '',
        youtube_url: videoUrl,
        tags:        JSON.stringify(tags),
        status:      canManageMusic ? 'done' : 'pending',
        thumbnail:   meta?.thumbnail_url ?? ytThumb    ?? '',
        message:     '',
        createdAt:   Date.now(),
      };
      const ref  = await fsDb.collection(`rooms/${roomId}/songs`).add(songData);
      const song = { id: ref.id, ...songData };
      await rtDb.ref(`rooms/${roomId}/songEvent`).set({ type: 'song_created', song, ts: Date.now() });
    } catch {}

    done++;
    await rtDb.ref(`rooms/${roomId}/importProgress`).set({ playlistTitle, done, total, complete: false, ts: Date.now() });
  }

  await rtDb.ref(`rooms/${roomId}/importProgress`).set({ playlistTitle, done: total, total, complete: true, ts: Date.now() });
}

app.post('/api/rooms/:roomId/songs', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }

  const { roomId }            = req.params;
  const { url, message = '' } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'url is required' });

  const memberSnap     = await admin.firestore().doc(`rooms/${roomId}/members/${uid}`).get();
  const roles          = memberSnap.data()?.roles ?? [];
  const canManageMusic = roles.includes('Admin') || roles.includes('DJ');

  const playlistId = extractYtPlaylistId(url.trim());
  if (playlistId) {
    importPlaylistToFirestore(roomId, playlistId, canManageMusic).catch(console.error);
    return res.status(202).json({ importing: true });
  }

  const ytId = extractYtId(url.trim());
  let meta, tags;
  try {
    [meta, tags] = await Promise.all([
      fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url.trim())}&format=json`).then(r => {
        if (!r.ok) throw new Error('could not fetch video info');
        return r.json();
      }),
      ytId ? fetchYtTags(ytId) : Promise.resolve([]),
    ]);
  } catch {
    return res.status(400).json({ error: 'could not fetch video info' });
  }

  const songData = {
    title:       meta.title         ?? 'Unknown',
    artist:      meta.author_name   ?? '',
    youtube_url: url.trim(),
    tags:        JSON.stringify(tags),
    status:      canManageMusic ? 'done' : 'pending',
    thumbnail:   meta.thumbnail_url ?? '',
    message:     message.trim(),
    createdAt:   Date.now(),
  };

  const ref  = await admin.firestore().collection(`rooms/${roomId}/songs`).add(songData);
  const song = { id: ref.id, ...songData };
  await admin.database().ref(`rooms/${roomId}/songEvent`).set({
    type: canManageMusic ? 'song_created' : 'song_submitted', song, ts: Date.now(),
  });
  res.status(201).json(song);
});

// -- Discord OAuth

const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI;
const CLIENT_ORIGIN         = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

app.get('/auth/discord', (_req, res) => {
  const params = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    redirect_uri:  DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope:         'identify',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  DISCORD_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Discord token response:', JSON.stringify(tokenData));
      throw new Error('No access token from Discord');
    }

    const userRes     = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    const uid         = `discord:${discordUser.id}`;
    const customToken = await admin.auth().createCustomToken(uid, {
      displayName: discordUser.global_name ?? discordUser.username,
      provider:    'discord',
    });

    const discordName = encodeURIComponent(discordUser.global_name ?? discordUser.username ?? '');
    res.redirect(`${CLIENT_ORIGIN}?discordToken=${customToken}&discordName=${discordName}`);
  } catch (err) {
    console.error('Discord auth error:', err);
    res.redirect(`${CLIENT_ORIGIN}?authError=discord`);
  }
});

// -- Start

server.listen(port, '0.0.0.0', () => {
  console.log(`server: http://localhost:${port}`);
});
