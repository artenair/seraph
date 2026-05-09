import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { fetchRoomZones, fetchRoomSongs } from '../api.js';
import { getLocalStorage, zonePlaylist, extractYtId } from '../lib/utils.js';
import { ref as rtdbRef, set, get, remove, onValue } from 'firebase/database';
import { rtdb } from '../lib/firebase.js';
import { useRoom } from './RoomContext.jsx';

const CROSSFADE = 10; // seconds

const Ctx = createContext({});
export const useAudio = () => useContext(Ctx);

export function AudioProvider({ children }) {
  const playerARef      = useRef(null);
  const playerBRef      = useRef(null);
  const containerARef   = useRef(null);
  const containerBRef   = useRef(null);
  const activePlayerRef = useRef('a');
  const ytReadyRef      = useRef(false);
  const pendingInitRef  = useRef(null);
  const pendingPlayRef  = useRef(null);

  const crossfadeRef    = useRef(null);  // { nextIndex, interval }
  const sessionRef      = useRef(null);  // { zone, songs, index }
  const pollRef         = useRef(null);

  const { isDJ, currentRoom } = useRoom();

  const suppressRef        = useRef(false);
  const loopRef            = useRef(false);
  const shuffleRef         = useRef(false);
  const unlockedRef        = useRef(false);
  const zoneMemoryRef      = useRef(getLocalStorage('audiomap-zone-memory', {}));
  const isDJRef            = useRef(false);
  const currentRoomRef     = useRef(currentRoom);
  const isPlayingRef       = useRef(false);
  const volumeRef          = useRef(1);
  const hasAutoUnmutedRef  = useRef(false);

  const [clientMuted,    setClientMuted]    = useState(true);
  const clientMutedRef  = useRef(true);

  // Keep refs in sync
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);

  // Update isDJRef and auto-unmute DJ on first role load
  useEffect(() => {
    isDJRef.current = isDJ;
    if (isDJ && !hasAutoUnmutedRef.current) {
      hasAutoUnmutedRef.current = true;
      setClientMuted(false);
      clientMutedRef.current = false;
    }
  }, [isDJ]);
  const [currentSong,    setCurrentSong]    = useState(null);
  const [activeZoneId,   setActiveZoneId]   = useState(null);
  const [activeZoneName, setActiveZoneName] = useState(null);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [currentTime,    setCurrentTime]    = useState(0);
  const [duration,       setDuration]       = useState(0);
  const [currentIndex,   setCurrentIndex]   = useState(0);
  const [playlistSongs,  setPlaylistSongs]  = useState([]);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [volume,         setVolume]         = useState(() => {
    const v = parseFloat(getLocalStorage('audiomap-volume', null));
    return isNaN(v) ? 1 : v;
  });
  const [loop,    setLoop]    = useState(false);
  const [shuffle, setShuffle] = useState(false);

  useEffect(() => { clientMutedRef.current = clientMuted; }, [clientMuted]);
  useEffect(() => { loopRef.current      = loop;      }, [loop]);
  useEffect(() => { shuffleRef.current   = shuffle;   }, [shuffle]);
  useEffect(() => { volumeRef.current    = volume;    }, [volume]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  function getActivePlayer()   { return activePlayerRef.current === 'a' ? playerARef.current : playerBRef.current; }
  function getInactivePlayer() { return activePlayerRef.current === 'a' ? playerBRef.current : playerARef.current; }

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      try {
        const ct = getActivePlayer()?.getCurrentTime() ?? 0;
        setCurrentTime(ct);
        maybeCrossfade();
      } catch {}
    }, 250);
  }

  function stopPolling() {
    if (!pollRef.current) return;
    clearInterval(pollRef.current);
    pollRef.current = null;
  }

  function whenReady(fn) {
    if (ytReadyRef.current) fn();
    else pendingPlayRef.current = fn;
  }

  // ── YouTube IFrame API init ────────────────────────────────────────────────────

  useEffect(() => {
    let active     = true;
    let readyCount = 0;

    function onPlayerReady() {
      if (!active) return;
      readyCount++;
      if (readyCount < 2) return;
      ytReadyRef.current = true;
      if (pendingInitRef.current) {
        pendingInitRef.current();
        pendingInitRef.current = null;
      }
      if (pendingPlayRef.current) {
        pendingPlayRef.current();
        pendingPlayRef.current = null;
      }
    }

    function makePlayerEl(containerRef) {
      if (!containerRef.current) return null;
      containerRef.current.innerHTML = '';
      const el = document.createElement('div');
      containerRef.current.appendChild(el);
      return el;
    }

    function initPlayers() {
      const elA = makePlayerEl(containerARef);
      const elB = makePlayerEl(containerBRef);
      if (!elA || !elB) return;
      playerARef.current = new window.YT.Player(elA, {
        height: '1', width: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: onPlayerReady,
          onStateChange: e => onPlayerStateChange('a', e),
        },
      });
      playerBRef.current = new window.YT.Player(elB, {
        height: '1', width: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: onPlayerReady,
          onStateChange: e => onPlayerStateChange('b', e),
        },
      });
    }

    if (window.YT && window.YT.Player) {
      initPlayers();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        initPlayers();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src   = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      active = false;
      try { playerARef.current?.destroy(); } catch {}
      try { playerBRef.current?.destroy(); } catch {}
      playerARef.current  = null;
      playerBRef.current  = null;
      ytReadyRef.current  = false;
      stopPolling();
      if (containerARef.current) containerARef.current.innerHTML = '';
      if (containerBRef.current) containerBRef.current.innerHTML = '';
    };
  }, []);

  function onPlayerStateChange(playerKey, event) {
    if (playerKey !== activePlayerRef.current) return;

    if (event.data === 1 /* PLAYING */) {
      try {
        const dur = event.target.getDuration();
        if (isFinite(dur) && dur > 0) setDuration(dur);
      } catch {}
    }

    if (event.data === 0 /* ENDED */) {
      if (crossfadeRef.current) return;
      const s = sessionRef.current;
      if (!s || !isDJRef.current) return;
      if (loopRef.current) { playTrack(s.zone, s.songs, s.index); return; }
      const pl  = zonePlaylist(s.zone);
      const len = Math.max(1, pl.length);
      const next = shuffleRef.current
        ? (s.index + 1 + Math.floor(Math.random() * (len - 1))) % len
        : (s.index + 1) % len;
      playTrack(s.zone, s.songs, next);
      sendCmd({ action: 'play_at', index: next, zone_id: s.zone.id, time: 0 });
    }
  }

  // ── Autoplay unlock ────────────────────────────────────────────────────────────

  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      document.removeEventListener('click',   unlock);
      document.removeEventListener('keydown', unlock);
      whenReady(() => {
        const player = getActivePlayer();
        if (player) {
          player.unMute();
          if (isPlayingRef.current) player.playVideo();
        }
      });
    };
    document.addEventListener('click',   unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click',   unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  function tryPlay() {
    whenReady(() => {
      const player = getActivePlayer();
      if (!player) return;
      if (!unlockedRef.current) player.mute(); else player.unMute();
      player.playVideo();
    });
  }

  // ── Volume ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (ytReadyRef.current && !crossfadeRef.current) {
      try { getActivePlayer()?.setVolume(volume * 100); } catch {}
    }
    localStorage.setItem('audiomap-volume', volume);
  }, [volume]);

  // ── Crossfade ──────────────────────────────────────────────────────────────────

  function cancelCrossfade() {
    const cf = crossfadeRef.current;
    if (!cf) return;
    clearInterval(cf.interval);
    crossfadeRef.current = null;
    try { getInactivePlayer()?.stopVideo(); } catch {}
    try { getInactivePlayer()?.setVolume(volumeRef.current * 100); } catch {}
    try { getActivePlayer()?.setVolume(volumeRef.current * 100);   } catch {}
  }

  function maybeCrossfade() {
    const s = sessionRef.current;
    if (!s || crossfadeRef.current) return;
    const player = getActivePlayer();
    if (!player) return;

    let dur, ct;
    try { dur = player.getDuration(); ct = player.getCurrentTime(); } catch { return; }

    const remaining = dur - ct;
    if (!isFinite(remaining) || remaining > CROSSFADE || remaining <= 0 || dur === 0) return;

    const pl  = zonePlaylist(s.zone);
    const len = Math.max(1, pl.length);
    const nextIndex = loopRef.current
      ? s.index
      : shuffleRef.current
        ? (s.index + 1 + Math.floor(Math.random() * (len - 1))) % len
        : (s.index + 1) % len;

    const nextSong = s.songs.find(song => song.id === pl[nextIndex % pl.length]);
    if (!nextSong?.youtube_url) return;

    startCrossfade(nextIndex, nextSong);
  }

  function startCrossfade(nextIndex, nextSong) {
    const s    = sessionRef.current;
    const ytId = extractYtId(nextSong.youtube_url);
    if (!ytId) return;

    const incoming = getInactivePlayer();
    if (!incoming) return;

    try {
      incoming.setVolume(0);
      incoming.loadVideoById({ videoId: ytId, startSeconds: 0 });
    } catch { return; }

    const startedAt   = Date.now();
    const fadeDuration = CROSSFADE * 1000;

    const intervalId = setInterval(() => {
      const progress = Math.min((Date.now() - startedAt) / fadeDuration, 1);
      const vol = volumeRef.current * 100;
      try {
        getActivePlayer().setVolume(Math.max(0, vol * (1 - progress)));
        getInactivePlayer().setVolume(Math.max(0, vol * progress));
      } catch {}
      if (progress >= 1) finishCrossfade(s.zone, s.songs, nextIndex, nextSong);
    }, 50);

    crossfadeRef.current = { nextIndex, interval: intervalId };

    if (isDJRef.current && !suppressRef.current) {
      sendCmd({ action: 'play_at', index: nextIndex, zone_id: s.zone.id, time: 0, crossfade: true });
    }
  }

  function finishCrossfade(zone, songs, nextIndex, nextSong) {
    if (!crossfadeRef.current) return;
    clearInterval(crossfadeRef.current.interval);
    crossfadeRef.current = null;

    try { getActivePlayer().stopVideo(); } catch {}

    activePlayerRef.current = activePlayerRef.current === 'a' ? 'b' : 'a';

    try { getActivePlayer().setVolume(volumeRef.current * 100); } catch {}

    const playlist      = zonePlaylist(zone);
    const resolvedIndex = nextIndex % Math.max(1, playlist.length);
    sessionRef.current  = { zone, songs, index: resolvedIndex };

    setCurrentSong(nextSong);
    setCurrentIndex(resolvedIndex);
    setPlaylistSongs(playlist.map(id => songs.find(s => s.id === id)).filter(Boolean));
    setIsPlaying(true);
    try {
      const dur = getActivePlayer().getDuration();
      setDuration(isFinite(dur) ? dur : 0);
    } catch {}
  }

  // ── Seek ───────────────────────────────────────────────────────────────────────

  function seek(time, remote = false) {
    try { getActivePlayer()?.seekTo(time, true); } catch {}
    setCurrentTime(time);
    if (!remote && !suppressRef.current) sendCmd({ action: 'seek', time });
  }

  // ── RTDB audio commands ────────────────────────────────────────────────────────

  function handleAudioCmd(msg) {
    if (!msg) return;
    suppressRef.current = true;
    if (clientMutedRef.current) { suppressRef.current = false; return; }

    if (msg.action === 'play') {
      tryPlay(); startPolling(); setIsPlaying(true);
      window.dispatchEvent(new Event('server-playing'));
    } else if (msg.action === 'pause') {
      stopPolling();
      try { getActivePlayer()?.pauseVideo(); } catch {}
      setIsPlaying(false);
    } else if (msg.action === 'seek') {
      seek(msg.time, true);
    } else if (msg.action === 'play_at') {
      if (msg.crossfade) { suppressRef.current = false; return; }
      window.dispatchEvent(new Event('server-playing'));
      if (msg.zone_id && sessionRef.current?.zone.id !== msg.zone_id) {
        Promise.all([fetchRoomZones(currentRoomRef.current?.id ?? ''), fetchRoomSongs(currentRoomRef.current?.id ?? '').then(ss => ss.filter(s => s.status === 'done'))])
          .then(([zones, songs]) => {
            const zone = zones.find(z => z.id === msg.zone_id);
            if (zone) playTrack(zone, songs, msg.index, msg.time ?? 0);
          });
      } else {
        playAt(msg.index, msg.time ?? 0);
      }
    }
    suppressRef.current = false;
  }

  // Listen to live audio commands (play, pause, seek, track changes)
  useEffect(() => {
    if (!currentRoom?.id) return;
    const firstCall = { seen: false };
    const cmdRef    = rtdbRef(rtdb, `rooms/${currentRoom.id}/audioCommand`);
    const unsub     = onValue(cmdRef, snapshot => {
      const msg = snapshot.val();
      if (!firstCall.seen) { firstCall.seen = true; if (isDJRef.current) return; }
      handleAudioCmd(msg);
    });
    return unsub;
  }, [currentRoom?.id]);

  // Write live commands (for all active clients)
  function sendCmd(payload) {
    const roomId = currentRoomRef.current?.id;
    if (!roomId) return;
    set(rtdbRef(rtdb, `rooms/${roomId}/audioCommand`), payload);
    if (payload.action === 'play_at') sendState();
  }

  // Write current position to audioState (for clients joining/unmuting)
  function sendState() {
    const roomId = currentRoomRef.current?.id;
    if (!roomId || !isDJRef.current || !isPlayingRef.current) return;
    const s = sessionRef.current;
    if (!s) return;
    const ct = (() => { try { return getActivePlayer()?.getCurrentTime() ?? 0; } catch { return 0; } })();
    set(rtdbRef(rtdb, `rooms/${roomId}/audioState`), {
      zone_id: s.zone.id, index: s.index, time: ct, sentAt: Date.now(),
    });
  }

  // ── Playback ───────────────────────────────────────────────────────────────────

  function playTrack(zone, songs, index, startTime = 0) {
    cancelCrossfade();
    const playlist = zonePlaylist(zone);
    if (!playlist.length) return;
    const song = songs.find(s => s.id === playlist[index % playlist.length]);
    if (!song?.youtube_url) return;
    const ytId = extractYtId(song.youtube_url);
    if (!ytId) return;

    const resolvedIndex    = index % playlist.length;
    sessionRef.current     = { zone, songs, index: resolvedIndex };

    const player = getActivePlayer();
    if (!player) return;

    setCurrentSong(song);
    setCurrentIndex(resolvedIndex);
    setPlaylistSongs(playlist.map(id => songs.find(s => s.id === id)).filter(Boolean));
    setIsPlaying(true);

    try {
      player.setVolume(volumeRef.current * 100);
      if (!unlockedRef.current) player.mute(); else player.unMute();
      player.loadVideoById({ videoId: ytId, startSeconds: startTime });
    } catch {}

    startPolling();
  }

  function playZone(zone, songs) {
    const prev = sessionRef.current;
    if (prev && prev.zone.id !== zone.id) {
      zoneMemoryRef.current[prev.zone.id] = {
        index: prev.index,
        time:  (() => { try { return getActivePlayer()?.getCurrentTime() ?? 0; } catch { return 0; } })(),
      };
      localStorage.setItem('audiomap-zone-memory', JSON.stringify(zoneMemoryRef.current));
    }
    setActiveZoneId(zone.id);
    setActiveZoneName(zone.name);
    const mem   = zoneMemoryRef.current[zone.id];
    const index = mem?.index ?? 0;
    const time  = mem?.time  ?? 0;
    playTrack(zone, songs, index, time);
    sendCmd({ action: 'play_at', index, zone_id: zone.id, time });
  }

  function loadZone(zone, songs) {
    cancelCrossfade();
    stopPolling();
    const playlist = zonePlaylist(zone);
    if (!playlist.length) return;
    const mem   = zoneMemoryRef.current[zone.id];
    const index = mem?.index ?? 0;
    const song  = songs.find(s => s.id === playlist[index % playlist.length]);
    if (!song?.youtube_url) return;
    const ytId = extractYtId(song.youtube_url);
    if (!ytId) return;

    sessionRef.current = { zone, songs, index };
    const player = getActivePlayer();
    if (!player) return;
    try { player.cueVideoById({ videoId: ytId, startSeconds: mem?.time ?? 0 }); } catch {}

    setCurrentSong(song);
    setCurrentIndex(index);
    setPlaylistSongs(playlist.map(id => songs.find(s => s.id === id)).filter(Boolean));
    setActiveZoneId(zone.id);
    setActiveZoneName(zone.name);
    setIsPlaying(false);
  }

  function stopAudio() {
    cancelCrossfade();
    stopPolling();
    const s = sessionRef.current;
    if (s) {
      zoneMemoryRef.current[s.zone.id] = {
        index: s.index,
        time:  (() => { try { return getActivePlayer()?.getCurrentTime() ?? 0; } catch { return 0; } })(),
      };
      localStorage.setItem('audiomap-zone-memory', JSON.stringify(zoneMemoryRef.current));
    }
    try { getActivePlayer()?.stopVideo(); } catch {}
    sessionRef.current = null;
    setCurrentSong(null);
    setActiveZoneId(null);
    setActiveZoneName(null);
    setIsPlaying(false);

    if (isDJRef.current && currentRoomRef.current?.id) {
      const roomId = currentRoomRef.current.id;
      remove(rtdbRef(rtdb, `rooms/${roomId}/audioCommand`));
      remove(rtdbRef(rtdb, `rooms/${roomId}/audioState`));
    }
  }

  function togglePlay() {
    if (suppressRef.current) return;
    if (isPlaying) {
      cancelCrossfade();
      stopPolling();
      try { getActivePlayer()?.pauseVideo(); } catch {}
      setIsPlaying(false);
      sendCmd({ action: 'pause' });
    } else {
      tryPlay();
      startPolling();
      setIsPlaying(true);
      const s = sessionRef.current;
      if (s) {
        const ct = (() => { try { return getActivePlayer()?.getCurrentTime() ?? 0; } catch { return 0; } })();
        sendCmd({ action: 'play_at', index: s.index, zone_id: s.zone.id, time: ct });
      } else {
        sendCmd({ action: 'play' });
      }
    }
  }

  function playAt(index, time = 0) {
    const s = sessionRef.current;
    if (!s) return;
    playTrack(s.zone, s.songs, index, time);
    if (!suppressRef.current) sendCmd({ action: 'play_at', index, zone_id: s.zone.id, time });
  }

  function nextTrack() {
    const s = sessionRef.current;
    if (!s) return;
    const pl  = zonePlaylist(s.zone);
    const len = Math.max(1, pl.length);
    const next = shuffleRef.current
      ? (s.index + 1 + Math.floor(Math.random() * (len - 1))) % len
      : (s.index + 1) % len;
    playTrack(s.zone, s.songs, next);
    if (!suppressRef.current) sendCmd({ action: 'play_at', index: next, zone_id: s.zone.id, time: 0 });
  }

  function prevTrack() {
    const s   = sessionRef.current;
    if (!s) return;
    const pl  = zonePlaylist(s.zone);
    const prev = (s.index - 1 + pl.length) % Math.max(1, pl.length);
    playTrack(s.zone, s.songs, prev);
    if (!suppressRef.current) sendCmd({ action: 'play_at', index: prev, zone_id: s.zone.id, time: 0 });
  }

  // On mount: preload zone under the persisted listener position
  useEffect(() => {
    if (!currentRoom?.id) return;
    Promise.all([
      fetchRoomZones(currentRoom.id),
      fetchRoomSongs(currentRoom.id).then(ss => ss.filter(s => s.status === 'done')),
    ]).then(([zones, songs]) => {
      const init = () => {
        try {
          const l = getLocalStorage('audiomap-listener', { x: 200, y: 150 });
          for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            const dx = l.x - z.x, dy = l.y - z.y;
            if (Math.sqrt(dx * dx + dy * dy) <= z.radius) { loadZone(z, songs); break; }
          }
        } catch {}
      };
      if (ytReadyRef.current) init();
      else pendingInitRef.current = init;
    });
  }, [currentRoom?.id]);

  // Periodic session position save + DJ state heartbeat
  useEffect(() => {
    const id = setInterval(() => {
      const s = sessionRef.current;
      if (!s || !isDJRef.current) return;
      try {
        const ct = getActivePlayer()?.getCurrentTime() ?? 0;
        zoneMemoryRef.current[s.zone.id] = { index: s.index, time: ct };
        localStorage.setItem('audiomap-zone-memory', JSON.stringify(zoneMemoryRef.current));
      } catch {}
      sendState();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  function playSong(song, allSongs, startIndex) {
    const songs = allSongs?.length ? allSongs : [song];
    const idx   = startIndex ?? songs.findIndex(s => s.id === song.id);
    const zone  = { id: null, name: null, playlist: JSON.stringify(songs.map(s => s.id)) };
    setActiveZoneId(null);
    setActiveZoneName(null);
    playTrack(zone, songs, idx < 0 ? 0 : idx);
    if (isDJRef.current) sendCmd({ action: 'play_at', index: idx < 0 ? 0 : idx, zone_id: null, time: 0 });
  }

  function toggleClientMute() {
    if (clientMuted) {
      setClientMuted(false);
      clientMutedRef.current = false;
      // Sync from DJ's latest position
      const roomId = currentRoomRef.current?.id;
      if (roomId) {
        get(rtdbRef(rtdb, `rooms/${roomId}/audioState`)).then(snapshot => {
          const state = snapshot.val();
          if (!state) return;
          const elapsed      = state.sentAt ? (Date.now() - state.sentAt) / 1000 : 0;
          const { zone_id, index, time } = state;
          Promise.all([
            fetchRoomZones(currentRoomRef.current?.id ?? ''),
            fetchRoomSongs(currentRoomRef.current?.id ?? '').then(ss => ss.filter(s => s.status === 'done')),
          ]).then(([zones, songs]) => {
            // Recalculate elapsed after fetch to stay accurate
            const totalElapsed  = state.sentAt ? (Date.now() - state.sentAt) / 1000 : elapsed;
            const adjustedTime  = Math.max(0, time + totalElapsed);
            const zone = zone_id ? zones.find(z => z.id === zone_id) : null;
            if (zone) playTrack(zone, songs, index, adjustedTime);
          });
        });
      }
    } else {
      setClientMuted(true);
      clientMutedRef.current = true;
      stopAudio();
    }
  }

  useEffect(() => () => {
    cancelCrossfade();
    stopPolling();
    try { getActivePlayer()?.stopVideo(); } catch {}
  }, []);

  return (
    <Ctx.Provider value={{
      currentSong, activeZoneId, activeZoneName, isPlaying,
      currentTime, duration, seek,
      currentIndex, playlistSongs, playAt,
      drawerOpen, setDrawerOpen,
      volume, setVolume,
      loop, setLoop, shuffle, setShuffle,
      playZone, loadZone, playSong, stopAudio, togglePlay, nextTrack, prevTrack,
      clientMuted, toggleClientMute,
    }}>
      {children}
      <div style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', bottom: 0, right: 0, pointerEvents: 'none' }}>
        <div ref={containerARef} />
        <div ref={containerBRef} />
      </div>
    </Ctx.Provider>
  );
}
