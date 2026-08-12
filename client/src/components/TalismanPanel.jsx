import { useState, useEffect, useRef } from 'react';
import { getLocalStorage, inputBase } from '../lib/utils.js';
import { useRoom } from '../context/RoomContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createRoomTalisman, updateRoomTalisman, deleteRoomTalisman } from '../api.js';
import { Button } from '@/components/ui/button';
import { Stepper } from './Stepper.jsx';
import { Eye, EyeOff, Copy, Pin, PinOff } from 'lucide-react';

function DuplicateModal({ defaultName, onConfirm, onCancel }) {
  const [draft, setDraft] = useState(defaultName);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && draft.trim()) onConfirm(draft.trim());
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-background border border-border p-5 w-80 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Duplicate Talisman</p>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${inputBase} px-2.5 py-1.5 w-full`}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => draft.trim() && onConfirm(draft.trim())} disabled={!draft.trim()}>
            Duplicate
          </Button>
        </div>
      </div>
    </div>
  );
}

function TalismanCard({ talisman, onSetSlashes, onSetTotal, onDelete, onRename, onToggleHidden, onTogglePinned, onDuplicate, onAssignOwner, canAdmin, canEdit, members, memberMap, onDragStart, onDragEnd, onDragOver, onDrop, dragging }) {
  const broken = talisman.slashes >= talisman.total_slashes;
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  function startEdit() { setDraft(talisman.name); setEditing(true); }
  function commitEdit() {
    if (draft.trim() && draft.trim() !== talisman.name) onRename(draft.trim());
    setEditing(false);
  }

  const ownerName = talisman.ownerId
    ? (memberMap?.get(talisman.ownerId)?.displayName ?? 'Unknown')
    : null;

  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver?.(); }}
      onDrop={onDrop}
      className={`border p-3 transition-opacity ${broken ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-muted/20'} ${dragging || talisman.hidden ? 'opacity-40' : 'opacity-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {canAdmin && <span draggable onDragStart={onDragStart} onDragEnd={onDragEnd} className="text-muted-foreground cursor-grab select-none text-base leading-none">⠿</span>}
          {canAdmin && editing
            ? <input autoFocus type="text" value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                className="bg-transparent border-b border-primary text-sm font-medium text-foreground outline-none w-40" />
            : <span
                className={`text-sm font-medium ${broken ? 'text-destructive line-through' : 'text-foreground'} ${canAdmin ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                onClick={canAdmin ? startEdit : undefined}>
                {ownerName && <span className="text-muted-foreground font-normal">[{ownerName}]</span>}{ownerName ? ' ' : ''}{talisman.name}
              </span>
          }
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {talisman.slashes}/{talisman.total_slashes}
          </span>
          {canAdmin && (
            <>
              <button type="button" onClick={onDuplicate}
                className="text-muted-foreground/40 hover:text-primary transition-colors leading-none">
                <Copy size={13} />
              </button>
              <button type="button" onClick={onDelete}
                className="text-muted-foreground/40 hover:text-destructive transition-colors leading-none">
                ×
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {canAdmin && (
          <>
            <button type="button" onClick={onTogglePinned}
              className={`transition-colors ${talisman.pinned ? 'text-primary' : 'text-foreground hover:text-primary'}`}>
              {talisman.pinned ? <PinOff size={24} /> : <Pin size={24} />}
            </button>
            <button type="button" onClick={onToggleHidden}
              className="text-foreground hover:text-primary transition-colors">
              {talisman.hidden ? <EyeOff size={24} /> : <Eye size={24} />}
            </button>
            <Stepper value={talisman.total_slashes} min={1} max={12} onChange={onSetTotal} />
          </>
        )}
        {Array.from({ length: talisman.total_slashes }).map((_, i) => {
          const filled = i < talisman.slashes;
          const cls = `w-7 h-7 border-2 ${filled
            ? broken ? 'bg-destructive/60 border-destructive' : 'bg-primary border-primary'
            : 'bg-muted/30 border-muted-foreground/60'}`;
          return canEdit
            ? <button key={i} type="button"
                onClick={() => onSetSlashes(i + 1 === talisman.slashes ? i : i + 1)}
                className={`${cls} transition-colors hover:border-primary/50`} />
            : <div key={i} className={cls} />;
        })}
      </div>
      {canAdmin && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
          <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Owner</span>
          <select
            value={talisman.ownerId ?? ''}
            onChange={e => onAssignOwner(e.target.value || null)}
            className={`${inputBase} px-1.5 py-0.5 text-xs flex-1`}>
            <option value="">— None —</option>
            {members.map(m => (
              <option key={m.userId} value={m.userId}>{m.displayName ?? m.userId}</option>
            ))}
          </select>
          {ownerName && (
            <span className="text-xs text-muted-foreground truncate">{ownerName}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function TalismanPanel({ talismans }) {
  const { isAdmin, currentRoom, members } = useRoom();
  const { user } = useAuth();
  const [name,         setName]         = useState('');
  const [totalSlashes, setTotalSlashes] = useState(4);
  const [creating,      setCreating]      = useState(false);
  const [startHidden,   setStartHidden]   = useState(false);
  const [startPinned,   setStartPinned]   = useState(false);
  const [startOwnerId,  setStartOwnerId]  = useState('');
  const [duplicating,  setDuplicating]  = useState(null);
  const [filter,        setFilter]        = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    setSelectedOwner(isAdmin ? '' : user.uid);
  }, [isAdmin, user?.uid]);
  const [orderedIds,   setOrderedIds]   = useState(() => {
    return getLocalStorage('talisman-order', []);
  });
  const dragId = useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  useEffect(() => {
    // talismans starts as [] on every mount until the async fetch resolves; merging
    // against that empty snapshot would wipe the persisted order (and a legitimately
    // empty room is harmless to skip too, since nothing renders until one exists again).
    if (talismans.length === 0) return;
    setOrderedIds(prev => {
      const incoming = talismans.map(t => t.id);
      const kept     = prev.filter(id => incoming.includes(id));
      const added    = incoming.filter(id => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [talismans]);

  useEffect(() => {
    localStorage.setItem('talisman-order', JSON.stringify(orderedIds));
  }, [orderedIds]);

  const ordered = orderedIds.map(id => talismans.find(t => t.id === id)).filter(Boolean);

  const memberMap = new Map(members.map(m => [m.userId, m]));
  const ownerIds = [...new Set([
    ...talismans.map(t => t.ownerId).filter(Boolean),
    ...(!isAdmin && user?.uid ? [user.uid] : []),
  ])];
  const ownerMembers = ownerIds.map(id => memberMap.get(id)).filter(Boolean);

  function handleDrop(targetId) {
    const from = dragId.current;
    if (!from || from === targetId) return;
    setOrderedIds(prev => {
      const fi = prev.indexOf(from);
      const ti = prev.indexOf(targetId);
      if (fi === -1 || ti === -1) return prev;
      const next = [...prev];
      next.splice(fi, 1);
      // ti was computed pre-removal, so shift it if `from` sat before the target.
      next.splice(fi < ti ? ti - 1 : ti, 0, from);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createRoomTalisman(currentRoom.id, { name: name.trim(), totalSlashes, hidden: startHidden, pinned: startPinned, ownerId: startOwnerId || null });
      setName('');
      setStartPinned(false);
      setStartOwnerId('');
    } finally {
      setCreating(false);
    }
  }

  function getTalisman(id) { return talismans.find(t => t.id === id); }

  async function handleSetSlashes(id, slashes) {
    await updateRoomTalisman(currentRoom.id, getTalisman(id), { slashes });
  }

  async function handleRename(id, name) {
    await updateRoomTalisman(currentRoom.id, getTalisman(id), { name });
  }

  async function handleSetTotal(id, total_slashes) {
    await updateRoomTalisman(currentRoom.id, getTalisman(id), { total_slashes });
  }

  async function handleTogglePinned(id, pinned) {
    await updateRoomTalisman(currentRoom.id, getTalisman(id), { pinned: !pinned });
  }

  async function handleToggleHidden(id, hidden) {
    await updateRoomTalisman(currentRoom.id, getTalisman(id), { hidden: !hidden });
  }

  async function handleDelete(id) {
    await deleteRoomTalisman(currentRoom.id, id);
  }

  async function handleAssignOwner(id, ownerId) {
    await updateRoomTalisman(currentRoom.id, getTalisman(id), { ownerId: ownerId ?? null });
  }

  async function handleDuplicateConfirm(name) {
    const src = duplicating;
    setDuplicating(null);
    await createRoomTalisman(currentRoom.id, { name, totalSlashes: src.total_slashes, hidden: src.hidden });
  }

  return (
    <div className="p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Talismans</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter…"
          className={`${inputBase} px-2.5 py-1.5 flex-1`}
        />
        {ownerMembers.length > 0 && (
          <select
            value={selectedOwner}
            onChange={e => setSelectedOwner(e.target.value)}
            className={`${inputBase} px-2 py-1.5 text-sm`}>
            <option value="">All owners</option>
            {ownerMembers.map(m => (
              <option key={m.userId} value={m.userId}>{m.displayName ?? m.userId}</option>
            ))}
          </select>
        )}
      </div>

      {isAdmin && (
        <>
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1">
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Name</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Talisman name…"
              className={`${inputBase} px-2.5 py-1.5 w-full`}
            />
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Slashes</p>
            <Stepper value={totalSlashes} min={1} max={12} onChange={setTotalSlashes} />
          </div>
          <button type="button" onClick={() => setStartPinned(p => !p)}
            className={`transition-colors self-end pb-1.5 ${startPinned ? 'text-primary' : 'text-foreground hover:text-primary'}`}>
            {startPinned ? <PinOff size={24} /> : <Pin size={24} />}
          </button>
          <button type="button" onClick={() => setStartHidden(h => !h)}
            className="text-foreground hover:text-primary transition-colors self-end pb-1.5">
            {startHidden ? <EyeOff size={24} /> : <Eye size={24} />}
          </button>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Owner</span>
          <select
            value={startOwnerId}
            onChange={e => setStartOwnerId(e.target.value)}
            className={`${inputBase} px-2 py-1 text-xs`}>
            <option value="">— None —</option>
            {members.map(m => (
              <option key={m.userId} value={m.userId}>{m.displayName ?? m.userId}</option>
            ))}
          </select>
          <Button className="ml-auto" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? '…' : 'Add'}
          </Button>
        </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        {ordered.filter(t => {
          if (!isAdmin && t.hidden) return false;
          if (t.pinned) return true;
          if (filter && !t.name.toLowerCase().includes(filter.toLowerCase())) return false;
          if (selectedOwner && t.ownerId !== selectedOwner) return false;
          return true;
        }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(t => (
          <TalismanCard
            key={t.id}
            talisman={t}
            canAdmin={isAdmin}
            canEdit={isAdmin || t.ownerId === user?.uid}
            members={members}
            memberMap={memberMap}
            dragging={draggingId === t.id}
            onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); dragId.current = t.id; setDraggingId(t.id); }}
            onDragEnd={() => { dragId.current = null; setDraggingId(null); }}
            onDragOver={() => { if (dragId.current && dragId.current !== t.id) handleDrop(t.id); }}
            onDrop={() => handleDrop(t.id)}
            onSetSlashes={slashes => handleSetSlashes(t.id, slashes)}
            onSetTotal={total => handleSetTotal(t.id, total)}
            onRename={name => handleRename(t.id, name)}
            onToggleHidden={() => handleToggleHidden(t.id, t.hidden)}
            onTogglePinned={() => handleTogglePinned(t.id, t.pinned)}
            onDelete={() => handleDelete(t.id)}
            onDuplicate={() => setDuplicating(t)}
            onAssignOwner={ownerId => handleAssignOwner(t.id, ownerId)}
          />
        ))}
      </div>

      {duplicating && (
        <DuplicateModal
          defaultName={duplicating.name}
          onConfirm={handleDuplicateConfirm}
          onCancel={() => setDuplicating(null)}
        />
      )}
    </div>
  );
}
