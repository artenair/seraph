import { useState, useEffect } from 'react';
import { TalismanPanel } from './TalismanPanel.jsx';
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

export function ActionTab() {
  const talismans = useTalismans();
  return <TalismanPanel talismans={talismans} />;
}
