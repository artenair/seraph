import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useWebSocket } from '../lib/useWebSocket.js';
import { extractYtId } from '../lib/utils.js';

const Ctx = createContext({});
export const usePersonalAudio = () => useContext(Ctx);

export function PersonalAudioProvider({ children }) {
  const playerRef    = useRef(null);
  const containerRef = useRef(null);
  const ytReadyRef   = useRef(false);
  const unlockedRef  = useRef(false);
  const volumeRef    = useRef(1);
  const pollRef      = useRef(null);

  const [localSong,    setLocalSong]    = useState(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [volume,       setVolume]       = useState(1);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);

  useEffect(() => { volumeRef.current = volume; }, [volume]);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      try { setCurrentTime(playerRef.current?.getCurrentTime() ?? 0); } catch {}
    }, 250);
  }

  function stopPolling() {
    if (!pollRef.current) return;
    clearInterval(pollRef.current);
    pollRef.current = null;
  }

  // YT player init — chains onto any existing onYouTubeIframeAPIReady
  useEffect(() => {
    let active = true;

    function initPlayer() {
      if (!active || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      const el = document.createElement('div');
      containerRef.current.appendChild(el);
      playerRef.current = new window.YT.Player(el, {
        height: '1', width: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => { if (active) ytReadyRef.current = true; },
          onStateChange: e => {
            if (!active) return;
            if (e.data === 1) { // PLAYING
              try {
                const dur = e.target.getDuration();
                if (isFinite(dur) && dur > 0) setDuration(dur);
              } catch {}
              setIsPlaying(true);
              startPolling();
            } else if (e.data === 2) { // PAUSED
              stopPolling();
              setIsPlaying(false);
            } else if (e.data === 0) { // ENDED
              stopPolling();
              setIsPlaying(false);
            }
          },
        },
      });
    }

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        initPlayer();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      active = false;
      stopPolling();
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
      ytReadyRef.current = false;
    };
  }, []);

  // Autoplay unlock
  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      document.removeEventListener('click',   unlock);
      document.removeEventListener('keydown', unlock);
      try {
        playerRef.current?.unMute();
        playerRef.current?.setVolume(volumeRef.current * 100);
      } catch {}
    };
    document.addEventListener('click',   unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click',   unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    try { playerRef.current?.setVolume(volume * 100); } catch {}
  }, [volume]);

  // Stop personal player when the server starts playing and the user is listening.
  // AudioContext dispatches 'server-playing' only when it receives a remote play
  // command AND clientMuted is false (listen button is active).
  useEffect(() => {
    const handler = () => stop();
    window.addEventListener('server-playing', handler);
    return () => window.removeEventListener('server-playing', handler);
  }, []);

  function play(song) {
    if (!song?.youtube_url) return;
    const ytId = extractYtId(song.youtube_url);
    if (!ytId) return;
    setLocalSong(song);
    setCurrentTime(0);
    setDuration(0);
    try {
      const p = playerRef.current;
      if (!p) return;
      p.setVolume(volumeRef.current * 100);
      if (!unlockedRef.current) p.mute(); else p.unMute();
      p.loadVideoById({ videoId: ytId });
    } catch {}
  }

  function stop() {
    stopPolling();
    try { playerRef.current?.stopVideo(); } catch {}
    setLocalSong(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }

  function togglePlay() {
    try {
      if (isPlaying) {
        playerRef.current?.pauseVideo();
      } else {
        playerRef.current?.playVideo();
      }
    } catch {}
  }

  function seek(time) {
    try { playerRef.current?.seekTo(time, true); } catch {}
    setCurrentTime(time);
  }

  return (
    <Ctx.Provider value={{ localSong, isPlaying, volume, setVolume, currentTime, duration, seek, play, stop, togglePlay }}>
      {children}
      <div style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', bottom: 0, left: 0, pointerEvents: 'none' }}>
        <div ref={containerRef} />
      </div>
    </Ctx.Provider>
  );
}
