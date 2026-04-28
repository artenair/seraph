import { useAudio } from '../context/AudioContext.jsx';
import { isLocal } from '../lib/utils.js';
import { SongThumbnail } from './SongThumbnail.jsx';
import { SkipBack, SkipForward, Play, Pause, Volume2, Repeat, Shuffle, ListMusic } from 'lucide-react';
import { FaYoutube } from 'react-icons/fa';

function fmt(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export function NowPlaying() {
  const {
    currentSong, activeZoneName, isPlaying, togglePlay, nextTrack, prevTrack,
    currentTime, duration, seek,
    currentIndex, playlistSongs, playAt,
    drawerOpen, setDrawerOpen,
    volume, setVolume,
    loop, setLoop, shuffle, setShuffle,
    clientMuted,
  } = useAudio();
  if (!currentSong || clientMuted) return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border flex flex-col">

      {/* Playlist drawer */}
      {drawerOpen && (
        <div className="border-b border-border max-h-64 overflow-y-auto">
          {playlistSongs.map((song, i) => (
            <button
              key={song.id}
              onClick={() => { playAt(i); }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted/50 transition-colors
                ${i === currentIndex ? 'bg-muted/40' : ''}`}
            >
              <SongThumbnail song={song} className="w-7 h-7" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${i === currentIndex ? 'text-primary font-medium' : 'text-foreground'}`}>
                  {song.title}
                </p>
                {song.artist && <p className="text-xs text-muted-foreground truncate">{song.artist}</p>}
              </div>
              {i === currentIndex && (
                <span className="text-xs text-primary shrink-0">▶</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className={`relative h-1 w-full bg-muted group ${isLocal ? 'cursor-pointer' : ''}`}
        onClick={e => {
          if (!isLocal) return;
          const rect = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - rect.left) / rect.width) * duration);
        }}
      >
        <div className="h-full bg-primary transition-none" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Main row — three-column grid keeps controls truly centred */}
      <div className="grid grid-cols-3 items-center px-4 h-14">

        {/* Left: song info + time + volume */}
        <div className="flex items-center gap-5 min-w-0">
          {currentSong.youtube_url && (
            <a
              href={currentSong.youtube_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#FF0000] hover:text-[#ff4444] shrink-0 transition-colors"
              title="Open on YouTube"
            >
              <FaYoutube size={36} />
            </a>
          )}
          <SongThumbnail song={currentSong} className="w-9 h-9" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{currentSong.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {currentSong.artist ? `${currentSong.artist} · ` : ''}{activeZoneName}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Volume2 size={14} className="text-muted-foreground shrink-0" />
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-20 accent-primary cursor-pointer"
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        </div>

        {/* Centre: prev / play-pause / next */}
        {isLocal
          ? <div className="flex items-center justify-center gap-1">
              <button onClick={prevTrack} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <SkipBack size={15} />
              </button>
              <button onClick={togglePlay} className="p-1.5 text-foreground hover:text-primary transition-colors">
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button onClick={nextTrack} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <SkipForward size={15} />
              </button>
            </div>
          : <div />
        }

        {/* Right: playlist drawer toggle + repeat + shuffle */}
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setDrawerOpen(v => !v)}
            title="Playlist"
            className={`p-1.5 transition-colors ${drawerOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <ListMusic size={15} />
          </button>
          {isLocal && <>
            <button
              onClick={() => setLoop(v => !v)}
              title="Loop"
              className={`p-1.5 transition-colors ${loop ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Repeat size={15} />
            </button>
            <button
              onClick={() => setShuffle(v => !v)}
              title="Shuffle"
              className={`p-1.5 transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Shuffle size={15} />
            </button>
          </>}
        </div>

      </div>
    </div>
  );
}
