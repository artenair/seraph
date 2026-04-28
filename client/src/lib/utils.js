import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const isLocal =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const wsUrl =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export function getLocalStorage(key, defaultValue) {
  try { return JSON.parse(localStorage.getItem(key)) ?? defaultValue; } catch { return defaultValue; }
}

export function zonePlaylist(zone) {
  try { return JSON.parse(zone.playlist || '[]'); } catch { return []; }
}

export const inputBase = 'bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';
