import { useState } from 'react';
import { usePersonalAudio } from '../context/PersonalAudioContext.jsx';
import { useAudio } from '../context/AudioContext.jsx';
import { PlayerBar } from './PlayerBar.jsx';
import { SongThumbnail } from './SongThumbnail.jsx';
import { Play, Pause, X, SkipBack, SkipForward, ListMusic } from 'lucide-react';

const SERVER_BAR_HEIGHT = 60;

export function PersonalNowPlaying() {
  const {
    localSong, localPlaylist, localIndex,
    isPlaying, volume, setVolume, currentTime, duration,
    seek, togglePlay, stop, nextTrack, prevTrack, playPlaylist,
  } = usePersonalAudio();
  const { currentSong: serverSong, clientMuted } = useAudio();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!localSong) return null;

  const serverBarVisible = serverSong && !clientMuted;
  const hasPlaylist      = localPlaylist.length > 1;

  const drawer = drawerOpen && hasPlaylist ? (
    <div className="border-b border-border max-h-64 overflow-y-auto">
      {localPlaylist.map((song, i) => (
        <button
          key={song.id}
          onClick={() => playPlaylist(localPlaylist, i)}
          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/50 ${i === localIndex ? 'bg-muted/40' : ''}`}>
          <SongThumbnail song={song} className="w-7 h-7" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${i === localIndex ? 'text-primary font-medium' : 'text-foreground'}`}>
              {song.title}
            </p>
            {song.artist && <p className="text-xs text-muted-foreground truncate">{song.artist}</p>}
          </div>
          {i === localIndex && <span className="text-xs text-primary shrink-0">▶</span>}
        </button>
      ))}
    </div>
  ) : null;

  const center = (
    <>
      {hasPlaylist && (
        <button onClick={prevTrack} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <SkipBack size={15} />
        </button>
      )}
      <button onClick={togglePlay} className="p-1.5 text-foreground hover:text-primary transition-colors">
        {isPlaying ? <Pause size={17} /> : <Play size={17} />}
      </button>
      {hasPlaylist && (
        <button onClick={nextTrack} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <SkipForward size={15} />
        </button>
      )}
    </>
  );

  const right = (
    <>
      {hasPlaylist && (
        <button
          onClick={() => setDrawerOpen(v => !v)}
          title="Playlist"
          className={`p-1.5 transition-colors ${drawerOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <ListMusic size={15} />
        </button>
      )}
      <button
        onClick={stop}
        title="Close"
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
        <X size={15} />
      </button>
    </>
  );

  return (
    <PlayerBar
      song={localSong}
      isPlaying={isPlaying}
      currentTime={currentTime}
      duration={duration}
      volume={volume}
      onVolumeChange={setVolume}
      onSeek={seek}
      subtitle={hasPlaylist ? `${localIndex + 1} / ${localPlaylist.length}` : (localSong.artist || undefined)}
      center={center}
      right={right}
      bottom={serverBarVisible ? SERVER_BAR_HEIGHT : 0}
      zIndex={70}
      drawer={drawer}
    />
  );
}
