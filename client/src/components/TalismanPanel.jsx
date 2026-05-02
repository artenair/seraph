import { useState, useEffect, useRef } from 'react';
import { getLocalStorage, inputBase } from '../lib/utils.js';
import { useRoom } from '../context/RoomContext.jsx';
import { createRoomTalisman, updateRoomTalisman, deleteRoomTalisman } from '../api.js';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Copy, ChevronDown, Pin, PinOff } from 'lucide-react';

const input = inputBase;

function extractTags(name) {
  return [...name.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
}

function TagSelect({ tags, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function toggle(tag) {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag]);
  }

  const label = selected.length === 0 ? 'Tags' : selected.length === 1 ? selected[0] : `${selected.length} tags`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`${input} flex items-center gap-1.5 px-2.5 py-1.5 whitespace-nowrap ${selected.length ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && tags.length > 0 && (
        <div className="absolute z-20 top-full mt-1 left-0 min-w-full bg-background border border-border shadow-md flex flex-col">
          {tags.map(tag => (
            <label key={tag} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/40 select-none">
              <input type="checkbox" checked={selected.includes(tag)} onChange={() => toggle(tag)}
                className="accent-primary" />
              {tag}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onChange, min = 0, max }) {
  return (
    <div className="flex items-center border border-border bg-muted/50">
      <button type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="px-2 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors select-none">
        −
      </button>
      <span className="w-6 text-center text-sm text-foreground tabular-nums">{value}</span>
      <button type="button"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        className="px-2 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors select-none">
        +
      </button>
    </div>
  );
}

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
          className={`${input} px-2.5 py-1.5 w-full`}
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

function TalismanCard({ talisman, onSetSlashes, onSetTotal, onDelete, onRename, onToggleHidden, onTogglePinned, onDuplicate, isLocal, onDragStart, onDragOver, onDrop, dragging }) {
  const broken = talisman.slashes >= talisman.total_slashes;
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  function startEdit() { setDraft(talisman.name); setEditing(true); }
  function commitEdit() {
    if (draft.trim() && draft.trim() !== talisman.name) onRename(draft.trim());
    setEditing(false);
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver?.(); }}
      onDrop={onDrop}
      className={`border p-3 transition-opacity ${broken ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-muted/20'} ${dragging || talisman.hidden ? 'opacity-40' : 'opacity-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground cursor-grab select-none text-base leading-none">⠿</span>
          {isLocal && editing
            ? <input autoFocus type="text" value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                className="bg-transparent border-b border-primary text-sm font-medium text-foreground outline-none w-40" />
            : <span
                className={`text-sm font-medium ${broken ? 'text-destructive line-through' : 'text-foreground'} ${isLocal ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                onClick={isLocal ? startEdit : undefined}>
                {talisman.name}
              </span>
          }
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {talisman.slashes}/{talisman.total_slashes}
          </span>
          {isLocal && (
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
        {isLocal && (
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
          return isLocal
            ? <button key={i} type="button"
                onClick={() => onSetSlashes(i + 1 === talisman.slashes ? i : i + 1)}
                className={`${cls} transition-colors hover:border-primary/50`} />
            : <div key={i} className={cls} />;
        })}
      </div>
    </div>
  );
}

export function TalismanPanel({ talismans }) {
  const { isAdmin, currentRoom } = useRoom();
  const [name,         setName]         = useState('');
  const [totalSlashes, setTotalSlashes] = useState(4);
  const [creating,     setCreating]     = useState(false);
  const [startHidden,  setStartHidden]  = useState(false);
  const [duplicating,  setDuplicating]  = useState(null);
  const [filter,       setFilter]       = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [orderedIds,   setOrderedIds]   = useState(() => {
    return getLocalStorage('talisman-order', []);
  });
  const dragId = useRef(null);

  useEffect(() => {
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

  const allTags = [...new Set(talismans.flatMap(t => extractTags(t.name)))].sort();

  function handleDrop(targetId) {
    const from = dragId.current;
    if (!from || from === targetId) return;
    setOrderedIds(prev => {
      const next = [...prev];
      const fi = next.indexOf(from);
      const ti = next.indexOf(targetId);
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      return next;
    });
    dragId.current = null;
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createRoomTalisman(currentRoom.id, { name: name.trim(), totalSlashes, hidden: startHidden });
      setName('');
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
          className={`${input} px-2.5 py-1.5 flex-1`}
        />
        {allTags.length > 0 && (
          <TagSelect tags={allTags} selected={selectedTags} onChange={setSelectedTags} />
        )}
      </div>

      {isAdmin && (
        <div className="flex gap-3 items-end mb-6">
          <div className="flex-1">
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Name</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Talisman name…"
              className={`${input} px-2.5 py-1.5 w-full`}
            />
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Slashes</p>
            <Stepper value={totalSlashes} min={1} max={12} onChange={setTotalSlashes} />
          </div>
          <button type="button" onClick={() => setStartHidden(h => !h)}
            className="text-foreground hover:text-primary transition-colors self-end pb-1.5">
            {startHidden ? <EyeOff size={24} /> : <Eye size={24} />}
          </button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? '…' : 'Add'}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {ordered.filter(t => {
          if (!isAdmin && t.hidden) return false;
          if (t.pinned) return true;
          if (filter && !t.name.toLowerCase().includes(filter.toLowerCase())) return false;
          if (selectedTags.length > 0 && !selectedTags.some(tag => extractTags(t.name).includes(tag))) return false;
          return true;
        }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(t => (
          <TalismanCard
            key={t.id}
            talisman={t}
            isLocal={isAdmin}
            dragging={dragId.current === t.id}
            onDragStart={() => { dragId.current = t.id; }}
            onDragOver={() => { if (dragId.current && dragId.current !== t.id) handleDrop(t.id); }}
            onDrop={() => handleDrop(t.id)}
            onSetSlashes={slashes => handleSetSlashes(t.id, slashes)}
            onSetTotal={total => handleSetTotal(t.id, total)}
            onRename={name => handleRename(t.id, name)}
            onToggleHidden={() => handleToggleHidden(t.id, t.hidden)}
            onTogglePinned={() => handleTogglePinned(t.id, t.pinned)}
            onDelete={() => handleDelete(t.id)}
            onDuplicate={() => setDuplicating(t)}
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
