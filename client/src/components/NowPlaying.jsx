import { useAudio } from '../context/AudioContext.jsx';
import { isLocal } from '../lib/utils.js';
import { PlayerBar } from './PlayerBar.jsx';
import { SongThumbnail } from './SongThumbnail.jsx';
import { SkipBack, SkipForward, Play, Pause, Repeat, Shuffle, ListMusic, X } from 'lucide-react';

export function NowPlaying() {
  const {
    currentSong, activeZoneName, isPlaying, togglePlay, nextTrack, prevTrack,
    currentTime, duration, seek,
    currentIndex, playlistSongs, playAt,
    drawerOpen, setDrawerOpen,
    volume, setVolume,
    loop, setLoop, shuffle, setShuffle,
    clientMuted, stopAudio,
  } = useAudio();

  if (!currentSong || clientMuted) return null;

  const subtitle = [currentSong.artist, activeZoneName].filter(Boolean).join(' · ');

  const drawer = drawerOpen ? (
    <div className="border-b border-border max-h-64 overflow-y-auto">
      {playlistSongs.map((song, i) => (
        <button
          key={song.id}
          onClick={() => { if (isLocal) playAt(i); }}
          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors
            ${isLocal ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'}
            ${i === currentIndex ? 'bg-muted/40' : ''}`}
        >
          <SongThumbnail song={song} className="w-7 h-7" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${i === currentIndex ? 'text-primary font-medium' : 'text-foreground'}`}>
              {song.title}
            </p>
            {song.artist && <p className="text-xs text-muted-foreground truncate">{song.artist}</p>}
          </div>
          {i === currentIndex && <span className="text-xs text-primary shrink-0">▶</span>}
        </button>
      ))}
    </div>
  ) : null;

  const center = isLocal ? (
    <>
      <button onClick={prevTrack} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
        <SkipBack size={15} />
      </button>
      <button onClick={togglePlay} className="p-1.5 text-foreground hover:text-primary transition-colors">
        {isPlaying ? <Pause size={17} /> : <Play size={17} />}
      </button>
      <button onClick={nextTrack} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
        <SkipForward size={15} />
      </button>
    </>
  ) : null;

  const right = (
    <>
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
      <button
        onClick={stopAudio}
        title="Close"
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={15} />
      </button>
    </>
  );

  return (
    <PlayerBar
      song={currentSong}
      isPlaying={isPlaying}
      currentTime={currentTime}
      duration={duration}
      volume={volume}
      onVolumeChange={setVolume}
      onSeek={isLocal ? seek : null}
      subtitle={subtitle || undefined}
      center={center}
      right={right}
      bottom={0}
      zIndex={40}
      drawer={drawer}
    />
  );
}
