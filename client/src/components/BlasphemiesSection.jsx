import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, Check, X, Loader2 } from 'lucide-react';
import { useRoom } from '../context/RoomContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchBlasphemies, createBlasphemy, updateBlasphemy, deleteBlasphemy, fetchBlasphemyAbilities, createBlasphemyAbility, updateBlasphemyAbility, deleteBlasphemyAbility } from '../api.js';
import { inputBase } from '../lib/utils.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const input    = `${inputBase} px-2 py-1.5 w-full`;
const ALL_ROLES = ['Admin', 'DJ', 'Exorcist'];

// ── Shared subcomponents ───────────────────────────────────────────────────────

function RoleToggle({ visibleTo, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Visible to</span>
      <div className="flex gap-2">
        {ALL_ROLES.map(role => (
          <button key={role} onClick={() => onChange(
            visibleTo.includes(role) ? visibleTo.filter(r => r !== role) : [...visibleTo, role]
          )} className={`px-2.5 py-1 text-xs border transition-colors ${visibleTo.includes(role) ? 'border-foreground text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {role}
          </button>
        ))}
      </div>
    </div>
  );
}

function AbilityRow({ ability, onUpdate, onDelete, isAdmin }) {
  const [editing,     setEditing]     = useState(false);
  const [name,        setName]        = useState(ability.name);
  const [description, setDescription] = useState(ability.description);
  const [saving,      setSaving]      = useState(false);

  async function handleSave() {
    setSaving(true);
    await onUpdate(ability.id, { name, description });
    setEditing(false);
    setSaving(false);
  }

  if (editing) return (
    <div className="flex flex-col gap-2 p-3 border border-border">
      <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Ability name" />
      <textarea className={`${input} resize-none`} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" />
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="text-green-500 hover:text-green-400 disabled:opacity-50"><Check size={14} /></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>
    </div>
  );

  return (
    <div className="group flex gap-3 p-3 border border-border">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{ability.name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{ability.description}</p>
      </div>
      {isAdmin && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setEditing(true)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
          <button onClick={() => onDelete(ability.id)} className="p-1 text-muted-foreground hover:text-red-400"><Trash2 size={12} /></button>
        </div>
      )}
    </div>
  );
}

// ── Create Modal ───────────────────────────────────────────────────────────────

function CreateBlasphemyModal({ open, onClose, onCreated }) {
  const { currentRoom } = useRoom();
  const { user }        = useAuth();
  const [name,              setName]              = useState('');
  const [description,       setDescription]       = useState('');
  const [passiveName,       setPassiveName]       = useState('');
  const [passiveDesc,       setPassiveDesc]       = useState('');
  const [hookName,          setHookName]          = useState('');
  const [hookDesc,          setHookDesc]          = useState('');
  const [visibleTo,         setVisibleTo]         = useState([...ALL_ROLES]);
  const [saving,            setSaving]            = useState(false);

  useEffect(() => {
    if (!open) {
      setName(''); setDescription('');
      setPassiveName(''); setPassiveDesc('');
      setHookName(''); setHookDesc('');
      setVisibleTo([...ALL_ROLES]);
    }
  }, [open]);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    const blasphemy = await createBlasphemy(currentRoom.id, {
      name: name.trim(),
      description,
      passiveAbility: { name: passiveName.trim(), description: passiveDesc.trim() },
      hook: hookName.trim() ? { name: hookName.trim(), description: hookDesc.trim() } : null,
      visibleTo,
    }, user.uid);
    onCreated(blasphemy);
    onClose();
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Blasphemy</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
          <input className={input} placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <textarea className={`${input} resize-none`} rows={3} placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />

          <span className="text-xs text-muted-foreground uppercase tracking-wide">Passive ability</span>
          <input className={input} placeholder="Name" value={passiveName} onChange={e => setPassiveName(e.target.value)} />
          <textarea className={`${input} resize-none`} rows={2} placeholder="Description" value={passiveDesc} onChange={e => setPassiveDesc(e.target.value)} />

          <span className="text-xs text-muted-foreground uppercase tracking-wide">Hook (optional)</span>
          <input className={input} placeholder="Name" value={hookName} onChange={e => setHookName(e.target.value)} />
          <textarea className={`${input} resize-none`} rows={2} placeholder="Description" value={hookDesc} onChange={e => setHookDesc(e.target.value)} />

          <RoleToggle visibleTo={visibleTo} onChange={setVisibleTo} />
        </div>
        <DialogFooter showCloseButton>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail view ────────────────────────────────────────────────────────────────

function BlasphemyDetail({ blasphemy, onBack, onUpdated, onDeleted }) {
  const { currentRoom, isAdmin } = useRoom();
  const [abilities,    setAbilities]    = useState(null);
  const [editing,      setEditing]      = useState(false);
  const [name,         setName]         = useState(blasphemy.name);
  const [description,  setDescription]  = useState(blasphemy.description);
  const [passiveName,  setPassiveName]  = useState(blasphemy.passiveAbility?.name ?? '');
  const [passiveDesc,  setPassiveDesc]  = useState(blasphemy.passiveAbility?.description ?? '');
  const [hookName,     setHookName]     = useState(blasphemy.hook?.name ?? '');
  const [hookDesc,     setHookDesc]     = useState(blasphemy.hook?.description ?? '');
  const [visibleTo,    setVisibleTo]    = useState(blasphemy.visibleTo ?? [...ALL_ROLES]);
  const [saving,       setSaving]       = useState(false);
  const [newAbility,   setNewAbility]   = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newDesc,      setNewDesc]      = useState('');

  useEffect(() => {
    fetchBlasphemyAbilities(currentRoom.id, blasphemy.id).then(setAbilities);
  }, [blasphemy.id]);

  async function handleSave() {
    setSaving(true);
    const body = {
      name, description,
      passiveAbility: { name: passiveName, description: passiveDesc },
      hook: hookName.trim() ? { name: hookName, description: hookDesc } : null,
      visibleTo,
    };
    await updateBlasphemy(currentRoom.id, blasphemy.id, body);
    onUpdated({ ...blasphemy, ...body });
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${blasphemy.name}"?`)) return;
    await deleteBlasphemy(currentRoom.id, blasphemy.id);
    onDeleted(blasphemy.id);
  }

  async function handleAddAbility() {
    if (!newName.trim()) return;
    const ability = await createBlasphemyAbility(currentRoom.id, blasphemy.id, {
      name: newName.trim(), description: newDesc.trim(), order: abilities?.length ?? 0,
    });
    setAbilities(prev => [...(prev ?? []), ability]);
    setNewName(''); setNewDesc(''); setNewAbility(false);
  }

  async function handleDeleteAbility(id) {
    if (!confirm('Delete this ability?')) return;
    await deleteBlasphemyAbility(currentRoom.id, blasphemy.id, id);
    setAbilities(prev => prev.filter(a => a.id !== id));
  }

  async function handleUpdateAbility(id, body) {
    await updateBlasphemyAbility(currentRoom.id, blasphemy.id, id, body);
    setAbilities(prev => prev.map(a => a.id === id ? { ...a, ...body } : a));
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={15} /> Back
        </button>
        {isAdmin && !editing && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil size={13} className="mr-1.5" />Edit</Button>
            <Button size="sm" variant="outline" onClick={handleDelete} className="text-red-400 hover:text-red-300"><Trash2 size={13} /></Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
          <textarea className={`${input} resize-none`} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" />

          <span className="text-xs text-muted-foreground uppercase tracking-wide">Passive ability</span>
          <input className={input} value={passiveName} onChange={e => setPassiveName(e.target.value)} placeholder="Name" />
          <textarea className={`${input} resize-none`} rows={2} value={passiveDesc} onChange={e => setPassiveDesc(e.target.value)} placeholder="Description" />

          <span className="text-xs text-muted-foreground uppercase tracking-wide">Hook (optional)</span>
          <input className={input} value={hookName} onChange={e => setHookName(e.target.value)} placeholder="Name" />
          <textarea className={`${input} resize-none`} rows={2} value={hookDesc} onChange={e => setHookDesc(e.target.value)} placeholder="Description" />

          <RoleToggle visibleTo={visibleTo} onChange={setVisibleTo} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-foreground">{blasphemy.name}</h2>
          {blasphemy.description && <p className="text-sm text-muted-foreground">{blasphemy.description}</p>}

          {blasphemy.passiveAbility?.name && (
            <div className="flex flex-col gap-0.5 p-3 border border-border">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Passive</span>
              <p className="text-sm font-semibold text-foreground">{blasphemy.passiveAbility.name}</p>
              {blasphemy.passiveAbility.description && <p className="text-sm text-muted-foreground">{blasphemy.passiveAbility.description}</p>}
            </div>
          )}

          {blasphemy.hook?.name && (
            <div className="flex flex-col gap-0.5 p-3 border border-dashed border-border">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Hook</span>
              <p className="text-sm font-semibold text-foreground">{blasphemy.hook.name}</p>
              {blasphemy.hook.description && <p className="text-sm text-muted-foreground">{blasphemy.hook.description}</p>}
            </div>
          )}

          <div className="flex gap-1.5">
            {(blasphemy.visibleTo ?? ALL_ROLES).map(r => (
              <span key={r} className="px-1.5 py-0.5 text-[10px] uppercase tracking-wide border border-border text-muted-foreground">{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Abilities */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Abilities</span>
          {isAdmin && (
            <button onClick={() => setNewAbility(v => !v)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
              <Plus size={15} />
            </button>
          )}
        </div>

        {newAbility && (
          <div className="flex flex-col gap-2 p-3 border border-dashed border-border">
            <input className={input} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ability name" autoFocus />
            <textarea className={`${input} resize-none`} rows={3} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" />
            <div className="flex gap-2">
              <button onClick={handleAddAbility} disabled={!newName.trim()} className="text-green-500 hover:text-green-400 disabled:opacity-50"><Check size={14} /></button>
              <button onClick={() => { setNewAbility(false); setNewName(''); setNewDesc(''); }} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
          </div>
        )}

        {abilities === null && <p className="text-xs text-muted-foreground">Loading…</p>}
        {abilities?.length === 0 && !newAbility && <p className="text-xs text-muted-foreground">No abilities yet.</p>}
        {abilities?.map(ability => (
          <AbilityRow
            key={ability.id}
            ability={ability}
            isAdmin={isAdmin}
            onUpdate={handleUpdateAbility}
            onDelete={handleDeleteAbility}
          />
        ))}
      </div>

    </div>
  );
}

// ── Blasphemies Section ────────────────────────────────────────────────────────

export function BlasphemiesSection() {
  const { currentRoom, isAdmin, userRoles } = useRoom();
  const [blasphemies, setBlasphemies] = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [createOpen,  setCreateOpen]  = useState(false);

  useEffect(() => {
    if (!currentRoom?.id) return;
    fetchBlasphemies(currentRoom.id).then(all => {
      const visible = isAdmin ? all : all.filter(b => (b.visibleTo ?? []).some(r => userRoles.includes(r)));
      setBlasphemies(visible);
    });
  }, [currentRoom?.id, isAdmin]);

  if (blasphemies === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (selected) {
    const blasphemy = blasphemies.find(b => b.id === selected);
    if (!blasphemy) { setSelected(null); return null; }
    return (
      <BlasphemyDetail
        blasphemy={blasphemy}
        onBack={() => setSelected(null)}
        onUpdated={updated => setBlasphemies(prev => prev.map(b => b.id === updated.id ? updated : b))}
        onDeleted={id => { setBlasphemies(prev => prev.filter(b => b.id !== id)); setSelected(null); }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Blasphemies</span>
        {isAdmin && (
          <button onClick={() => setCreateOpen(true)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors" title="New blasphemy">
            <Plus size={15} />
          </button>
        )}
      </div>

      {blasphemies.length === 0 && <p className="text-sm text-muted-foreground">No blasphemies yet.</p>}

      <div className="flex flex-col gap-2">
        {blasphemies.map(b => (
          <button key={b.id} onClick={() => setSelected(b.id)}
            className="flex flex-col gap-1 p-3 border border-border hover:border-foreground/40 text-left transition-colors">
            <span className="text-sm font-semibold text-foreground">{b.name}</span>
            {b.description && <span className="text-xs text-muted-foreground truncate">{b.description}</span>}
          </button>
        ))}
      </div>

      <CreateBlasphemyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={b => setBlasphemies(prev => [b, ...(prev ?? [])])}
      />
    </div>
  );
}
