import { usePersonalAudio } from '../context/PersonalAudioContext.jsx';
import { useAudio } from '../context/AudioContext.jsx';
import { PlayerBar } from './PlayerBar.jsx';
import { Play, Pause, X } from 'lucide-react';

const SERVER_BAR_HEIGHT = 60;

export function PersonalNowPlaying() {
  const { localSong, isPlaying, volume, setVolume, currentTime, duration, seek, togglePlay, stop } = usePersonalAudio();
  const { currentSong: serverSong, clientMuted } = useAudio();

  if (!localSong) return null;

  const serverBarVisible = serverSong && !clientMuted;

  const center = (
    <button onClick={togglePlay} className="p-1.5 text-foreground hover:text-primary transition-colors">
      {isPlaying ? <Pause size={17} /> : <Play size={17} />}
    </button>
  );

  const right = (
    <button
      onClick={stop}
      title="Close"
      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      <X size={15} />
    </button>
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
      subtitle={localSong.artist || undefined}
      center={center}
      right={right}
      bottom={serverBarVisible ? SERVER_BAR_HEIGHT : 0}
      zIndex={50}
    />
  );
}
