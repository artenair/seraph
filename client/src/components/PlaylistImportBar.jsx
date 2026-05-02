import { useState, useRef, useEffect } from 'react';
import { useAudio } from '../context/AudioContext.jsx';
import { usePersonalAudio } from '../context/PersonalAudioContext.jsx';
import { useRoom } from '../context/RoomContext.jsx';
import { ref as rtdbRef, onValue, remove } from 'firebase/database';
import { rtdb } from '../lib/firebase.js';
import { ListMusic, X } from 'lucide-react';

const BAR_HEIGHT = 60;

export function PlaylistImportBar() {
  const [state, setState] = useState(null);
  const dismissTimer = useRef(null);

  const { currentSong, clientMuted } = useAudio();
  const { localSong }                = usePersonalAudio();
  const { currentRoom }              = useRoom();

  useEffect(() => {
    if (!currentRoom?.id) return;
    const unsub = onValue(rtdbRef(rtdb, `rooms/${currentRoom.id}/importProgress`), snapshot => {
      const data = snapshot.val();
      if (!data) return;
      clearTimeout(dismissTimer.current);
      setState({ playlistTitle: data.playlistTitle, done: data.done, total: data.total, complete: data.complete ?? false });
      if (data.complete) {
        dismissTimer.current = setTimeout(() => {
          setState(null);
          remove(rtdbRef(rtdb, `rooms/${currentRoom.id}/importProgress`));
        }, 3000);
      }
    });
    return unsub;
  }, [currentRoom?.id]);

  if (!state) return null;

  const { playlistTitle, done, total, complete } = state;
  const progress = total > 0 ? done / total : 0;

  const serverBarVisible   = currentSong && !clientMuted;
  const personalBarVisible = !!localSong;
  const bottomOffset = (serverBarVisible ? BAR_HEIGHT : 0) + (personalBarVisible ? BAR_HEIGHT : 0);

  return (
    <div
      className="fixed left-0 right-0 bg-background border-t border-border flex flex-col"
      style={{ bottom: bottomOffset, zIndex: 60 }}
    >
      <div className="relative h-1 w-full bg-muted">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress * 100}%` }} />
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
          onClick={() => {
            clearTimeout(dismissTimer.current);
            setState(null);
            remove(rtdbRef(rtdb, `rooms/${currentRoom.id}/importProgress`));
          }}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
