import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getLocalStorage(key, defaultValue) {
  try { return JSON.parse(localStorage.getItem(key)) ?? defaultValue; } catch { return defaultValue; }
}

export function zonePlaylist(zone) {
  if (!zone?.playlist) return [];
  if (Array.isArray(zone.playlist)) return zone.playlist;
  try { return JSON.parse(zone.playlist); } catch { return []; }
}

export const inputBase = 'bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

export function extractYtId(url) {
  if (!url) return null;
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

export function extractYtPlaylistId(url) {
  if (!url || /[?&]v=/.test(url)) return null;
  const m = /[?&]list=([a-zA-Z0-9_-]+)/.exec(url);
  return m ? m[1] : null;
}
