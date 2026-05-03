import { useState, useEffect } from 'react';
import { TalismanPanel } from './TalismanPanel.jsx';
import { AudioMap } from './AudioMap.jsx';
import { useAudio } from '../context/AudioContext.jsx';
import { Map, Volume2, VolumeX } from 'lucide-react';
import { useRoom } from '../context/RoomContext.jsx';
import { ref as rtdbRef, onValue } from 'firebase/database';
import { rtdb } from '../lib/firebase.js';
import { fetchRoomTalismans } from '../api.js';

function useTalismans() {
  const { currentRoom } = useRoom();
  const [talismans, setTalismans] = useState([]);

  useEffect(() => {
    if (!currentRoom?.id) return;
    fetchRoomTalismans(currentRoom.id).then(setTalismans);
  }, [currentRoom?.id]);

  useEffect(() => {
    if (!currentRoom?.id) return;
    const firstCall = { seen: false };
    const unsub = onValue(rtdbRef(rtdb, `rooms/${currentRoom.id}/talismanEvent`), snapshot => {
      if (!firstCall.seen) { firstCall.seen = true; return; }
      const event = snapshot.val();
      if (!event) return;
      if (event.type === 'talisman_created') setTalismans(prev => [...prev, event.talisman]);
      if (event.type === 'talisman_updated') setTalismans(prev => prev.map(t => t.id === event.talisman.id ? event.talisman : t));
      if (event.type === 'talisman_deleted') setTalismans(prev => prev.filter(t => t.id !== event.talismanId));
    });
    return unsub;
  }, [currentRoom?.id]);

  return talismans;
}

export function ActionTab({ drawerOpen = false }) {
  const [showMap, setShowMap] = useState(false);
  const { isAdmin, isDJ } = useRoom();
  const { clientMuted, toggleClientMute } = useAudio();
  const talismans = useTalismans();

  if (showMap) return (
    <div className="flex flex-col gap-2 h-full overflow-hidden">
      <button
        onClick={() => setShowMap(false)}
        className="text-xs text-muted-foreground hover:text-foreground self-start shrink-0">
        ← Back
      </button>
      <AudioMap />
    </div>
  );

  return (
    <>
      <TalismanPanel talismans={talismans} />

      {isAdmin && !drawerOpen && (
        <button
          onClick={() => setShowMap(true)}
          title="Audio Map"
          className="fixed bottom-16 left-16 z-50 p-2.5 bg-background border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
          <Map size={18} />
        </button>
      )}
      {!isDJ && (
        <button
          onClick={toggleClientMute}
          className="fixed bottom-16 left-16 z-50 flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-95 transition-all shadow-lg">
          {clientMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {clientMuted ? 'Listen' : 'Mute'}
        </button>
      )}
    </>
  );
}
