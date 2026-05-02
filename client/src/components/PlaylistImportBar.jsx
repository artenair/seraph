import { useState, useRef } from 'react';
import { useWebSocket } from '../lib/useWebSocket.js';
import { useAudio } from '../context/AudioContext.jsx';
import { usePersonalAudio } from '../context/PersonalAudioContext.jsx';
import { ListMusic, X } from 'lucide-react';

const BAR_HEIGHT = 60;

export function PlaylistImportBar() {
  const [state, setState] = useState(null); // { playlistTitle, done, total, complete }
  const dismissTimer = useRef(null);

  const { currentSong, clientMuted } = useAudio();
  const { localSong } = usePersonalAudio();

  useWebSocket(msg => {
    if (msg.type === 'playlist_import_progress') {
      clearTimeout(dismissTimer.current);
      setState({ playlistTitle: msg.playlistTitle, done: msg.done, total: msg.total, complete: false });
    }
    if (msg.type === 'playlist_import_done') {
      setState(prev => prev ? { ...prev, done: prev.total, complete: true } : null);
      dismissTimer.current = setTimeout(() => setState(null), 3000);
    }
  });

  if (!state) return null;

  const { playlistTitle, done, total, complete } = state;
  const progress = total > 0 ? done / total : 0;

  const serverBarVisible  = currentSong && !clientMuted;
  const personalBarVisible = !!localSong;
  const bottomOffset = (serverBarVisible ? BAR_HEIGHT : 0) + (personalBarVisible ? BAR_HEIGHT : 0);

  return (
    <div
      className="fixed left-0 right-0 bg-background border-t border-border flex flex-col"
      style={{ bottom: bottomOffset, zIndex: 60 }}
    >
      <div className="relative h-1 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-4 h-14">
        <ListMusic size={15} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{playlistTitle}</p>
          <p className="text-xs text-muted-foreground">
            {complete ? 'Import complete' : `Importing… ${done} / ${total}`}
          </p>
        </div>
        <button
          onClick={() => { clearTimeout(dismissTimer.current); setState(null); }}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
