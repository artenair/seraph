import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, Check, X, Loader2 } from 'lucide-react';
import { useRoom } from '../context/RoomContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchAgendas, createAgenda, updateAgenda, deleteAgenda, fetchAbilities, createAbility, updateAbility, deleteAbility } from '../api.js';
import { inputBase } from '../lib/utils.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const input = `${inputBase} px-2 py-1.5 w-full`;
const ALL_ROLES = ['Admin', 'DJ', 'Exorcist'];

// ── Create Agenda Modal ────────────────────────────────────────────────────────

function CreateAgendaModal({ open, onClose, onCreated }) {
  const { currentRoom, userRoles } = useRoom();
  const { user } = useAuth();
  const [name,          setName]          = useState('');
  const [regularVoice,  setRegularVoice]  = useState('');
  const [boldedVoice,   setBoldedVoice]   = useState('');
  const [visibleTo,     setVisibleTo]     = useState([...ALL_ROLES]);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    if (!open) { setName(''); setRegularVoice(''); setBoldedVoice(''); setVisibleTo([...ALL_ROLES]); }
  }, [open]);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    const agenda = await createAgenda(currentRoom.id, { name: name.trim(), regularVoice, boldedVoice, visibleTo }, user.uid);
    onCreated(agenda);
    onClose();
    setSaving(false);
  }

  function toggleRole(role) {
    setVisibleTo(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Agenda</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <input className={input} placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <input className={input} placeholder="Regular voice" value={regularVoice} onChange={e => setRegularVoice(e.target.value)} />
          <input className={input} placeholder="Bolded voice" value={boldedVoice} onChange={e => setBoldedVoice(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Visible to</span>
            <div className="flex gap-2">
              {ALL_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-2.5 py-1 text-xs border transition-colors ${visibleTo.includes(role) ? 'border-foreground text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
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

// ── Ability Row ────────────────────────────────────────────────────────────────

function AbilityRow({ ability, roomId, agendaId, isAdmin, onUpdated, onDeleted }) {
  const [editing,     setEditing]     = useState(false);
  const [name,        setName]        = useState(ability.name);
  const [description, setDescription] = useState(ability.description);
  const [saving,      setSaving]      = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateAbility(roomId, agendaId, ability.id, { name, description });
    onUpdated({ ...ability, name, description });
    setEditing(false);
    setSaving(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 p-3 border border-border">
        <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Ability name" />
        <textarea className={`${input} resize-none`} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" />
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="text-green-500 hover:text-green-400 disabled:opacity-50"><Check size={14} /></button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-3 p-3 border border-border">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{ability.name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{ability.description}</p>
      </div>
      {isAdmin && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setEditing(true)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><Pencil size={12} /></button>
          <button onClick={() => onDeleted(ability.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
        </div>
      )}
    </div>
  );
}

// ── Agenda Detail ──────────────────────────────────────────────────────────────

function AgendaDetail({ agenda, onBack, onUpdated, onDeleted }) {
  const { currentRoom, isAdmin } = useRoom();
  const [abilities,    setAbilities]    = useState(null);
  const [editing,      setEditing]      = useState(false);
  const [name,         setName]         = useState(agenda.name);
  const [regularVoice, setRegularVoice] = useState(agenda.regularVoice);
  const [boldedVoice,  setBoldedVoice]  = useState(agenda.boldedVoice);
  const [visibleTo,    setVisibleTo]    = useState(agenda.visibleTo ?? [...ALL_ROLES]);
  const [saving,       setSaving]       = useState(false);
  const [newAbility,   setNewAbility]   = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newDesc,      setNewDesc]      = useState('');

  useEffect(() => {
    fetchAbilities(currentRoom.id, agenda.id).then(setAbilities);
  }, [agenda.id]);

  async function handleSave() {
    setSaving(true);
    const body = { name, regularVoice, boldedVoice, visibleTo };
    await updateAgenda(currentRoom.id, agenda.id, body);
    onUpdated({ ...agenda, ...body });
    setEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${agenda.name}"?`)) return;
    await deleteAgenda(currentRoom.id, agenda.id);
    onDeleted(agenda.id);
  }

  async function handleAddAbility() {
    if (!newName.trim()) return;
    const ability = await createAbility(currentRoom.id, agenda.id, {
      name: newName.trim(), description: newDesc.trim(), order: (abilities?.length ?? 0),
    });
    setAbilities(prev => [...(prev ?? []), ability]);
    setNewName(''); setNewDesc(''); setNewAbility(false);
  }

  async function handleDeleteAbility(id) {
    if (!confirm('Delete this ability?')) return;
    await deleteAbility(currentRoom.id, agenda.id, id);
    setAbilities(prev => prev.filter(a => a.id !== id));
  }

  function toggleRole(role) {
    setVisibleTo(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Back + actions */}
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

      {/* Agenda fields */}
      {editing ? (
        <div className="flex flex-col gap-3">
          <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
          <input className={input} value={regularVoice} onChange={e => setRegularVoice(e.target.value)} placeholder="Regular voice" />
          <input className={input} value={boldedVoice} onChange={e => setBoldedVoice(e.target.value)} placeholder="Bolded voice" />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Visible to</span>
            <div className="flex gap-2">
              {ALL_ROLES.map(role => (
                <button key={role} onClick={() => toggleRole(role)}
                  className={`px-2.5 py-1 text-xs border transition-colors ${visibleTo.includes(role) ? 'border-foreground text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-foreground">{agenda.name}</h2>
          {agenda.regularVoice && <p className="text-sm text-foreground">{agenda.regularVoice}</p>}
          {agenda.boldedVoice  && <p className="text-sm font-bold text-foreground">{agenda.boldedVoice}</p>}
          <div className="flex gap-1.5 mt-1">
            {(agenda.visibleTo ?? ALL_ROLES).map(r => (
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
            roomId={currentRoom.id}
            agendaId={agenda.id}
            isAdmin={isAdmin}
            onUpdated={updated => setAbilities(prev => prev.map(a => a.id === updated.id ? updated : a))}
            onDeleted={handleDeleteAbility}
          />
        ))}
      </div>

    </div>
  );
}

// ── Agendas Section ────────────────────────────────────────────────────────────

export function AgendasSection() {
  const { currentRoom, isAdmin, userRoles } = useRoom();
  const [agendas,     setAgendas]     = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [createOpen,  setCreateOpen]  = useState(false);

  useEffect(() => {
    if (!currentRoom?.id) return;
    fetchAgendas(currentRoom.id).then(all => {
      const visible = isAdmin ? all : all.filter(a => (a.visibleTo ?? []).some(r => userRoles.includes(r)));
      setAgendas(visible);
    });
  }, [currentRoom?.id, isAdmin]);

  if (agendas === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (selected) {
    const agenda = agendas.find(a => a.id === selected);
    if (!agenda) { setSelected(null); return null; }
    return (
      <AgendaDetail
        agenda={agenda}
        onBack={() => setSelected(null)}
        onUpdated={updated => setAgendas(prev => prev.map(a => a.id === updated.id ? updated : a))}
        onDeleted={id => { setAgendas(prev => prev.filter(a => a.id !== id)); setSelected(null); }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Agendas</span>
        {isAdmin && (
          <button onClick={() => setCreateOpen(true)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors" title="New agenda">
            <Plus size={15} />
          </button>
        )}
      </div>

      {agendas.length === 0 && <p className="text-sm text-muted-foreground">No agendas yet.</p>}

      <div className="flex flex-col gap-2">
        {agendas.map(agenda => (
          <button
            key={agenda.id}
            onClick={() => setSelected(agenda.id)}
            className="flex flex-col gap-1 p-3 border border-border hover:border-foreground/40 text-left transition-colors"
          >
            <span className="text-sm font-semibold text-foreground">{agenda.name}</span>
            {agenda.regularVoice && <span className="text-xs text-muted-foreground truncate">{agenda.regularVoice}</span>}
          </button>
        ))}
      </div>

      <CreateAgendaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={agenda => setAgendas(prev => [agenda, ...(prev ?? [])])}
      />
    </div>
  );
}
