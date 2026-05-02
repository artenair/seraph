import { useState, useEffect } from 'react';
import { useRoom } from '@/context/RoomContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { inputBase } from '@/lib/utils.js';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase.js';

const input = inputBase;

function RoomForm({ onDone }) {
  const { createRoom, joinRoom } = useRoom();
  const [tab,   setTab]   = useState('create');
  const [name,  setName]  = useState('');
  const [code,  setCode]  = useState('');
  const [error, setError] = useState(null);
  const [busy,  setBusy]  = useState(false);

  useEffect(() => {
    const joinCode = new URLSearchParams(window.location.search).get('join');
    if (joinCode) { setTab('join'); setCode(joinCode.toUpperCase()); }
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError(null);
    try {
      await createRoom(name.trim());
      window.history.replaceState({}, '', '/');
      onDone?.();
    } catch (err) { setError(err.message); setBusy(false); }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setError(null);
    try {
      await joinRoom(code.trim());
      window.history.replaceState({}, '', '/');
      onDone?.();
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex border border-border">
        {[['create', 'Create room'], ['join', 'Join room']].map(([key, label]) => (
          <button key={key}
            onClick={() => { setTab(key); setError(null); }}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <input autoFocus className={`${input} px-3 py-2`} placeholder="Room name…"
            value={name} onChange={e => setName(e.target.value)} maxLength={48} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={!name.trim() || busy}>{busy ? 'Creating…' : 'Create'}</Button>
        </form>
      )}

      {tab === 'join' && (
        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <input autoFocus className={`${input} px-3 py-2 uppercase tracking-widest`}
            placeholder="Invite code…" value={code}
            onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={!code.trim() || busy}>{busy ? 'Joining…' : 'Join'}</Button>
        </form>
      )}
    </div>
  );
}

export function RoomGate({ embedded = false, onDone }) {
  const { userRooms, switchRoom } = useRoom();
  const [busy, setBusy] = useState(false);

  async function handleEnterRoom(roomId) {
    setBusy(true);
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (snap.exists()) switchRoom({ id: snap.id, ...snap.data() });
    setBusy(false);
    onDone?.();
  }

  if (embedded) return <RoomForm onDone={onDone} />;

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-950 text-foreground">
      <div className="flex items-stretch bg-zinc-900">

        {userRooms.length > 0 && (
          <>
            <div className="flex flex-col gap-2 p-8 w-56">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Your rooms</p>
              {userRooms.map(r => (
                <button key={r.id} onClick={() => handleEnterRoom(r.id)} disabled={busy}
                  className="px-3 py-2 text-sm text-left bg-zinc-950 hover:bg-zinc-800 transition-colors disabled:opacity-50">
                  {r.name}
                </button>
              ))}
            </div>
            <div className="w-px bg-zinc-800" />
          </>
        )}

        <div className="flex flex-col gap-6 p-8 w-80">
          <h1 className="text-3xl font-bold tracking-tight">SERAPH</h1>
          <RoomForm onDone={onDone} />
        </div>

      </div>
    </div>
  );
}
