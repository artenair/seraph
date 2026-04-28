import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { fetchAudioZones, fetchSongs } from '../api.js';
import { isLocal, getLocalStorage, zonePlaylist } from '../lib/utils.js';
import { useWebSocket } from '../lib/useWebSocket.js';

const CROSSFADE = 10; // seconds

const Ctx = createContext({});
export const useAudio = () => useContext(Ctx);

export function AudioProvider({ children }) {
  const audioRef        = useRef(new Audio());
  const inAudioRef      = useRef(null);   // incoming audio during crossfade
  const crossfadeRef    = useRef(null);   // { nextIndex, raf } | null
  const sessionRef      = useRef(null);   // { zone, songs, index }
  const suppressRef     = useRef(false);
  const loopRef         = useRef(false);
  const shuffleRef      = useRef(false);
  const unlockedRef     = useRef(false);
  const zoneMemoryRef   = useRef(getLocalStorage('audiomap-zone-memory', {}));
  const isLocalRef      = useRef(isLocal);
  const onTimeupdateRef = useRef(null);   // stored for re-attachment after audio swap
  const onDurationRef   = useRef(null);   // stored for re-attachment after audio swap
  const isPlayingRef    = useRef(false);  // mirrors isPlaying for use inside event closures

  const [clientMuted,    setClientMuted]    = useState(!isLocal);
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

  // Mirrors volume state for access inside non-React callbacks
  const volumeRef = useRef(volume);

  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      document.removeEventListener('click',   unlock);
      document.removeEventListener('keydown', unlock);
      audioRef.current.muted = false;
      if (inAudioRef.current) inAudioRef.current.muted = false;
      if (isPlayingRef.current && audioRef.current.paused && audioRef.current.src) {
        audioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener('click',   unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click',   unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  function tryPlay() {
    audioRef.current.muted = !unlockedRef.current;
    audioRef.current.play().catch(() => {});
  }

  useEffect(() => { loopRef.current      = loop;      }, [loop]);
  useEffect(() => { shuffleRef.current   = shuffle;   }, [shuffle]);
  useEffect(() => { volumeRef.current    = volume;    }, [volume]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Only set volume directly when not crossfading — the RAF loop controls it during crossfade
  useEffect(() => {
    if (!crossfadeRef.current) audioRef.current.volume = volume;
    localStorage.setItem('audiomap-volume', volume);
  }, [volume]);

  // Store handlers in refs so they survive audio element swaps
  useEffect(() => {
    const onTime     = () => {
      setCurrentTime(audioRef.current.currentTime);
      maybeCrossfade();
    };
    const onDuration = () => setDuration(
      isFinite(audioRef.current.duration) ? audioRef.current.duration : 0
    );
    onTimeupdateRef.current = onTime;
    onDurationRef.current   = onDuration;
    const audio = audioRef.current;
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('loadedmetadata', onDuration);
    return () => {
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('loadedmetadata', onDuration);
    };
  }, []);

  // Detach listeners + clear old audio, then attach listeners to new audio
  function swapAudioRefs(newAudio) {
    const old = audioRef.current;
    old.removeEventListener('timeupdate',     onTimeupdateRef.current);
    old.removeEventListener('durationchange', onDurationRef.current);
    old.removeEventListener('loadedmetadata', onDurationRef.current);
    old.onended = null;
    old.pause();
    old.src = '';
    audioRef.current = newAudio;
    newAudio.addEventListener('timeupdate',     onTimeupdateRef.current);
    newAudio.addEventListener('durationchange', onDurationRef.current);
    newAudio.addEventListener('loadedmetadata', onDurationRef.current);
  }

  function cancelCrossfade() {
    const cf = crossfadeRef.current;
    if (!cf) return;
    cancelAnimationFrame(cf.raf);
    crossfadeRef.current = null;
    if (inAudioRef.current) {
      inAudioRef.current.pause();
      inAudioRef.current.src = '';
      inAudioRef.current.onended = null;
      inAudioRef.current = null;
    }
    audioRef.current.volume = volumeRef.current;
  }

  function maybeCrossfade() {
    const audio = audioRef.current;
    const s = sessionRef.current;
    if (!s || crossfadeRef.current) return;

    const remaining = audio.duration - audio.currentTime;
    if (!isFinite(remaining) || remaining > CROSSFADE || remaining <= 0) return;

    const pl  = zonePlaylist(s.zone);
    const len = Math.max(1, pl.length);
    const nextIndex = loopRef.current
      ? s.index
      : shuffleRef.current
        ? (s.index + 1 + Math.floor(Math.random() * (len - 1))) % len
        : (s.index + 1) % len;

    const nextSong = s.songs.find(song => song.id === pl[nextIndex % pl.length]);
    if (!nextSong?.filename) return;

    startCrossfade(nextIndex, nextSong);
  }

  function startCrossfade(nextIndex, nextSong) {
    const s = sessionRef.current;

    const inAudio    = new Audio();
    inAudio.src      = `/music/${nextSong.filename}`;
    inAudio.volume   = 0;
    inAudio.muted    = true; // start muted to satisfy autoplay policy
    inAudioRef.current = inAudio;
    inAudio.addEventListener('ended', () => {
      if (crossfadeRef.current) finishCrossfade(s.zone, s.songs, nextIndex, nextSong, inAudio);
    }, { once: true });
    inAudio.play().then(() => { inAudio.muted = false; }).catch(() => {});

    const startedAt   = performance.now();
    const fadeDuration = CROSSFADE * 1000;
    let rafId;

    function tick(now) {
      if (!crossfadeRef.current) return;
      const progress = Math.min((now - startedAt) / fadeDuration, 1);
      const vol = volumeRef.current;
      audioRef.current.volume = Math.max(0, Math.min(1, vol * (1 - progress)));
      inAudio.volume          = Math.max(0, Math.min(1, vol * progress));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
        crossfadeRef.current.raf = rafId;
      } else {
        finishCrossfade(s.zone, s.songs, nextIndex, nextSong, inAudio);
      }
    }

    rafId = requestAnimationFrame(tick);
    crossfadeRef.current = { nextIndex, raf: rafId };

    if (isLocalRef.current && !suppressRef.current) {
      sendCmd({ action: 'play_at', index: nextIndex, zone_id: s.zone.id, time: 0, crossfade: true });
    }
  }

  function finishCrossfade(zone, songs, nextIndex, nextSong, inAudio) {
    crossfadeRef.current = null;
    inAudioRef.current   = null;

    const playlist      = zonePlaylist(zone);
    const resolvedIndex = nextIndex % Math.max(1, playlist.length);

    swapAudioRefs(inAudio);
    inAudio.volume = volumeRef.current;

    sessionRef.current = { zone, songs, index: resolvedIndex };

    inAudio.onended = () => {
      const s = sessionRef.current;
      if (!s || crossfadeRef.current || !isLocalRef.current) return;
      if (loopRef.current) { playTrack(s.zone, s.songs, s.index); return; }
      const pl  = zonePlaylist(s.zone);
      const len = Math.max(1, pl.length);
      const next = shuffleRef.current
        ? (s.index + 1 + Math.floor(Math.random() * (len - 1))) % len
        : (s.index + 1) % len;
      playTrack(s.zone, s.songs, next);
      sendCmd({ action: 'play_at', index: next, zone_id: s.zone.id, time: 0 });
    };

    setCurrentSong(nextSong);
    setCurrentIndex(resolvedIndex);
    setPlaylistSongs(playlist.map(id => songs.find(s => s.id === id)).filter(Boolean));
    setDuration(isFinite(inAudio.duration) ? inAudio.duration : 0);
    setIsPlaying(true);
  }

  function seek(time, remote = false) {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    if (!remote && !suppressRef.current) sendCmd({ action: 'seek', time });
  }

  const sendWs = useWebSocket(msg => {
    if (msg.type !== 'audio_command') return;
    suppressRef.current = true;
    if      (msg.action === 'play')    { tryPlay(); setIsPlaying(true); }
    else if (msg.action === 'pause')   { audioRef.current.pause(); setIsPlaying(false); }
    else if (msg.action === 'seek')    { seek(msg.time, true); }
    else if (msg.action === 'request_state') {
      if (isLocalRef.current) {
        const s = sessionRef.current;
        if (s) sendCmd({ action: 'play_at', index: s.index, zone_id: s.zone.id, time: audioRef.current.currentTime });
      }
    }
    else if (msg.action === 'play_at') {
      // Crossfade auto-advance: remote handles it independently via timeupdate
      if (msg.crossfade) {
        suppressRef.current = false;
        return;
      }
      if (msg.zone_id && sessionRef.current?.zone.id !== msg.zone_id) {
        Promise.all([fetchAudioZones(), fetchSongs().then(ss => ss.filter(s => s.status === 'done'))])
          .then(([zones, songs]) => {
            const zone = zones.find(z => z.id === msg.zone_id);
            if (zone) playTrack(zone, songs, msg.index, msg.time ?? 0);
          });
      } else {
        playAt(msg.index, msg.time ?? 0);
      }
    }
    suppressRef.current = false;
  });

  function sendCmd(payload) {
    sendWs({ type: 'audio_command', ...payload });
  }

  function playTrack(zone, songs, index, startTime = 0) {
    cancelCrossfade();
    const playlist = zonePlaylist(zone);
    if (!playlist.length) return;
    const song = songs.find(s => s.id === playlist[index % playlist.length]);
    if (!song?.filename) return;

    const resolvedIndex = index % playlist.length;
    sessionRef.current = { zone, songs, index: resolvedIndex };
    const audio = audioRef.current;
    audio.onended = null;
    audio.src = `/music/${song.filename}`;
    audio.volume = volumeRef.current;
    if (startTime > 0) {
      audio.addEventListener('loadedmetadata', () => { audio.currentTime = startTime; }, { once: true });
    }
    tryPlay();
    setCurrentSong(song);
    setCurrentIndex(resolvedIndex);
    setPlaylistSongs(playlist.map(id => songs.find(s => s.id === id)).filter(Boolean));
    setIsPlaying(true);
    audio.onended = () => {
      const s = sessionRef.current;
      if (!s || crossfadeRef.current || !isLocalRef.current) return;
      if (loopRef.current) { playTrack(s.zone, s.songs, s.index); return; }
      const pl  = zonePlaylist(s.zone);
      const len = Math.max(1, pl.length);
      const next = shuffleRef.current
        ? (s.index + 1 + Math.floor(Math.random() * (len - 1))) % len
        : (s.index + 1) % len;
      playTrack(s.zone, s.songs, next);
      sendCmd({ action: 'play_at', index: next, zone_id: s.zone.id, time: 0 });
    };
  }

  function playZone(zone, songs) {
    const prev = sessionRef.current;
    if (prev && prev.zone.id !== zone.id) {
      zoneMemoryRef.current[prev.zone.id] = { index: prev.index, time: audioRef.current.currentTime };
      localStorage.setItem('audiomap-zone-memory', JSON.stringify(zoneMemoryRef.current));
    }
    setActiveZoneId(zone.id);
    setActiveZoneName(zone.name);
    const mem = zoneMemoryRef.current[zone.id];
    const index = mem?.index ?? 0;
    const time  = mem?.time  ?? 0;
    playTrack(zone, songs, index, time);
    sendCmd({ action: 'play_at', index, zone_id: zone.id, time });
  }

  function loadZone(zone, songs) {
    cancelCrossfade();
    const playlist = zonePlaylist(zone);
    if (!playlist.length) return;
    const mem   = zoneMemoryRef.current[zone.id];
    const index = mem?.index ?? 0;
    const song  = songs.find(s => s.id === playlist[index % playlist.length]);
    if (!song?.filename) return;
    sessionRef.current = { zone, songs, index };
    const audio = audioRef.current;
    audio.onended = null;
    audio.src = `/music/${song.filename}`;
    if (mem?.time > 0) {
      audio.addEventListener('loadedmetadata', () => { audio.currentTime = mem.time; }, { once: true });
    }
    audio.onended = () => {
      const s = sessionRef.current;
      if (!s || crossfadeRef.current) return;
      if (loopRef.current) { playTrack(s.zone, s.songs, s.index); return; }
      const pl  = zonePlaylist(s.zone);
      const len = Math.max(1, pl.length);
      const next = shuffleRef.current
        ? (s.index + 1 + Math.floor(Math.random() * (len - 1))) % len
        : (s.index + 1) % len;
      playTrack(s.zone, s.songs, next);
    };
    setCurrentSong(song);
    setCurrentIndex(index);
    setPlaylistSongs(playlist.map(id => songs.find(s => s.id === id)).filter(Boolean));
    setActiveZoneId(zone.id);
    setActiveZoneName(zone.name);
    setIsPlaying(false);
  }

  function stopAudio() {
    cancelCrossfade();
    const s = sessionRef.current;
    if (s) {
      zoneMemoryRef.current[s.zone.id] = { index: s.index, time: audioRef.current.currentTime };
      localStorage.setItem('audiomap-zone-memory', JSON.stringify(zoneMemoryRef.current));
    }
    const audio = audioRef.current;
    audio.onended = null;
    audio.pause();
    audio.src = '';
    sessionRef.current = null;
    setCurrentSong(null);
    setActiveZoneId(null);
    setActiveZoneName(null);
    setIsPlaying(false);
  }

  function togglePlay() {
    if (suppressRef.current) return;
    const audio = audioRef.current;
    if (isPlaying) {
      cancelCrossfade();
      audio.pause(); setIsPlaying(false);
      sendCmd({ action: 'pause' });
    } else {
      tryPlay(); setIsPlaying(true);
      const s = sessionRef.current;
      if (s) sendCmd({ action: 'play_at', index: s.index, zone_id: s.zone.id, time: audio.currentTime });
      else   sendCmd({ action: 'play' });
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
    const s = sessionRef.current;
    if (!s) return;
    const pl = zonePlaylist(s.zone);
    const prev = (s.index - 1 + pl.length) % Math.max(1, pl.length);
    playTrack(s.zone, s.songs, prev);
    if (!suppressRef.current) sendCmd({ action: 'play_at', index: prev, zone_id: s.zone.id, time: 0 });
  }

  // On mount: check if the persisted listener position overlaps a zone and pre-load it paused
  useEffect(() => {
    Promise.all([
      fetchAudioZones(),
      fetchSongs().then(ss => ss.filter(s => s.status === 'done')),
    ]).then(([zones, songs]) => {
      try {
        const l = getLocalStorage('audiomap-listener', { x: 200, y: 150 });
        for (let i = zones.length - 1; i >= 0; i--) {
          const z = zones[i];
          const dx = l.x - z.x, dy = l.y - z.y;
          if (Math.sqrt(dx * dx + dy * dy) <= z.radius) {
            loadZone(z, songs);
            break;
          }
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const s = sessionRef.current;
      if (!s || !isLocalRef.current) return;
      zoneMemoryRef.current[s.zone.id] = { index: s.index, time: audioRef.current.currentTime };
      localStorage.setItem('audiomap-zone-memory', JSON.stringify(zoneMemoryRef.current));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  function toggleClientMute() {
    if (clientMuted) {
      setClientMuted(false);
      sendCmd({ action: 'request_state' });
    } else {
      setClientMuted(true);
      stopAudio();
    }
  }

  useEffect(() => () => { cancelCrossfade(); audioRef.current.pause(); }, []);

  return (
    <Ctx.Provider value={{
      currentSong, activeZoneId, activeZoneName, isPlaying,
      currentTime, duration, seek,
      currentIndex, playlistSongs, playAt,
      drawerOpen, setDrawerOpen,
      volume, setVolume,
      loop, setLoop, shuffle, setShuffle,
      playZone, loadZone, stopAudio, togglePlay, nextTrack, prevTrack,
      clientMuted, toggleClientMute,
    }}>
      {children}
    </Ctx.Provider>
  );
}
