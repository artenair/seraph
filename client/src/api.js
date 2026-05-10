import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, getDoc } from 'firebase/firestore';
import { ref as rtdbRef, set } from 'firebase/database';
import { getIdToken } from 'firebase/auth';
import { db, rtdb, auth } from './lib/firebase.js';

// -- Audio zones

export const fetchRoomZones = async (roomId) => {
  const snap = await getDocs(collection(db, 'rooms', roomId, 'audioZones'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createRoomZone = async (roomId, body) => {

  const data = { name: body.name ?? 'Zone', x: body.x ?? 0, y: body.y ?? 0, radius: body.radius ?? 60, playlist: [] };
  const ref  = await addDoc(collection(db, 'rooms', roomId, 'audioZones'), data);
  return { id: ref.id, ...data };
};

export const updateRoomZone = async (roomId, id, body) => {

  const zoneRef = doc(db, 'rooms', roomId, 'audioZones', id);
  await updateDoc(zoneRef, body);
  const snap = await getDoc(zoneRef);
  return { id: snap.id, ...snap.data() };
};

export const deleteRoomZone = async (roomId, id) => {
  await deleteDoc(doc(db, 'rooms', roomId, 'audioZones', id));
};

// -- Songs

export const fetchRoomSongs = async (roomId) => {
  const snap = await getDocs(collection(db, 'rooms', roomId, 'songs'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

async function authFetch(url, options = {}) {
  let token = await getIdToken(auth.currentUser);
  let r = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (r.status === 401) {
    token = await getIdToken(auth.currentUser, true);
    r = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
    });
  }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? r.statusText);
  return data;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

export const addRoomSong = (roomId, url, message = '') =>
  authFetch(`${SERVER_URL}/api/rooms/${roomId}/songs`, { method: 'POST', body: JSON.stringify({ url, message }) });

function songEvent(roomId, payload) {
  return set(rtdbRef(rtdb, `rooms/${roomId}/songEvent`), { ...payload, ts: Date.now() });
}

export const approveRoomSong = async (roomId, song) => {
  await updateDoc(doc(db, 'rooms', roomId, 'songs', song.id), { status: 'done' });
  const updated = { ...song, status: 'done' };
  await songEvent(roomId, { type: 'song_updated', song: updated });
  return updated;
};

export const updateRoomSong = async (roomId, song, body) => {
  await updateDoc(doc(db, 'rooms', roomId, 'songs', song.id), body);
  const updated = { ...song, ...body };
  await songEvent(roomId, { type: 'song_updated', song: updated });
  return updated;
};

export const deleteRoomSong = async (roomId, songId) => {
  await deleteDoc(doc(db, 'rooms', roomId, 'songs', songId));
  await songEvent(roomId, { type: 'song_deleted', songId });
};

// -- Playlists

export const fetchRoomPlaylists = async (roomId) => {
  const snap = await getDocs(collection(db, 'rooms', roomId, 'playlists'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createRoomPlaylist = async (roomId, { name }) => {

  const data = { name: name ?? 'New Playlist', songs: [] };
  const ref  = await addDoc(collection(db, 'rooms', roomId, 'playlists'), data);
  return { id: ref.id, ...data };
};

export const updateRoomPlaylist = async (roomId, id, body) => {

  const ref = doc(db, 'rooms', roomId, 'playlists', id);
  await updateDoc(ref, body);
  const snap = await getDoc(ref);
  return { id: snap.id, ...snap.data() };
};

export const deleteRoomPlaylist = async (roomId, id) => {
  await deleteDoc(doc(db, 'rooms', roomId, 'playlists', id));
};

// -- Talismans

export const fetchRoomTalismans = async (roomId) => {
  const snap = await getDocs(collection(db, 'rooms', roomId, 'talismans'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

function talismanEvent(roomId, payload) {
  return set(rtdbRef(rtdb, `rooms/${roomId}/talismanEvent`), { ...payload, ts: Date.now() });
}

export const createRoomTalisman = async (roomId, { name, totalSlashes, hidden, pinned, ownerId }) => {

  const data     = { name, slashes: 0, total_slashes: totalSlashes, hidden: !!hidden, pinned: !!pinned, ownerId: ownerId ?? null, createdAt: Date.now() };
  const ref      = await addDoc(collection(db, 'rooms', roomId, 'talismans'), data);
  const talisman = { id: ref.id, ...data };
  await talismanEvent(roomId, { type: 'talisman_created', talisman });
  return talisman;
};

export const updateRoomTalisman = async (roomId, talisman, updates) => {
  const updated = { ...talisman, ...updates };
  if (updates.total_slashes !== undefined) {
    updated.total_slashes = Math.max(1, updates.total_slashes);
    updated.slashes       = Math.min(talisman.slashes, updated.total_slashes);
  }
  if (updates.slashes !== undefined) {
    updated.slashes = Math.max(0, Math.min(updated.total_slashes, updates.slashes));
  }
  const { id, ...data } = updated;
  await updateDoc(doc(db, 'rooms', roomId, 'talismans', id), data);
  await talismanEvent(roomId, { type: 'talisman_updated', talisman: updated });
  return updated;
};

export const deleteRoomTalisman = async (roomId, talismanId) => {
  await deleteDoc(doc(db, 'rooms', roomId, 'talismans', talismanId));
  await talismanEvent(roomId, { type: 'talisman_deleted', talismanId });
};

// -- Agendas

export const fetchAgendas = async (roomId) => {
  const snap = await getDocs(collection(db, 'rooms', roomId, 'agendas'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createAgenda = async (roomId, { name, regularVoice, boldedVoice, visibleTo }, uid) => {
  const data = { name, regularVoice, boldedVoice, visibleTo, createdAt: Date.now(), createdBy: uid };
  const ref  = await addDoc(collection(db, 'rooms', roomId, 'agendas'), data);
  return { id: ref.id, ...data };
};

export const updateAgenda = async (roomId, id, body) => {
  await updateDoc(doc(db, 'rooms', roomId, 'agendas', id), body);
};

export const deleteAgenda = async (roomId, id) => {
  await deleteDoc(doc(db, 'rooms', roomId, 'agendas', id));
};

// -- Blasphemies

export const fetchBlasphemies = async (roomId) => {
  const snap = await getDocs(collection(db, 'rooms', roomId, 'blasphemies'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createBlasphemy = async (roomId, { name, description, passiveAbility, hook, visibleTo }, uid) => {
  const data = { name, description, passiveAbility, hook: hook ?? null, visibleTo, createdAt: Date.now(), createdBy: uid };
  const ref  = await addDoc(collection(db, 'rooms', roomId, 'blasphemies'), data);
  return { id: ref.id, ...data };
};

export const updateBlasphemy = async (roomId, id, body) => {
  await updateDoc(doc(db, 'rooms', roomId, 'blasphemies', id), body);
};

export const deleteBlasphemy = async (roomId, id) => {
  await deleteDoc(doc(db, 'rooms', roomId, 'blasphemies', id));
};

// -- Blasphemy abilities

export const fetchBlasphemyAbilities = async (roomId, blasphemyId) => {
  const snap = await getDocs(collection(db, 'rooms', roomId, 'blasphemies', blasphemyId, 'abilities'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order);
};

export const createBlasphemyAbility = async (roomId, blasphemyId, { name, description, order }) => {
  const data = { name, description, order };
  const ref  = await addDoc(collection(db, 'rooms', roomId, 'blasphemies', blasphemyId, 'abilities'), data);
  return { id: ref.id, ...data };
};

export const updateBlasphemyAbility = async (roomId, blasphemyId, id, body) => {
  await updateDoc(doc(db, 'rooms', roomId, 'blasphemies', blasphemyId, 'abilities', id), body);
};

export const deleteBlasphemyAbility = async (roomId, blasphemyId, id) => {
  await deleteDoc(doc(db, 'rooms', roomId, 'blasphemies', blasphemyId, 'abilities', id));
};

// -- Agenda abilities

export const fetchAbilities = async (roomId, agendaId) => {
  const snap = await getDocs(collection(db, 'rooms', roomId, 'agendas', agendaId, 'abilities'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order);
};

export const createAbility = async (roomId, agendaId, { name, description, order }) => {
  const data = { name, description, order };
  const ref  = await addDoc(collection(db, 'rooms', roomId, 'agendas', agendaId, 'abilities'), data);
  return { id: ref.id, ...data };
};

export const updateAbility = async (roomId, agendaId, id, body) => {
  await updateDoc(doc(db, 'rooms', roomId, 'agendas', agendaId, 'abilities', id), body);
};

export const deleteAbility = async (roomId, agendaId, id) => {
  await deleteDoc(doc(db, 'rooms', roomId, 'agendas', agendaId, 'abilities', id));
};

