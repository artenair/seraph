import { useState, useEffect } from 'react';
import { fetchBlasphemies, fetchAgendas, createExorcist } from '../api.js';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { inputBase } from '../lib/utils.js';

const TRAIT_FIELDS = [
  'appearance', 'physical_detail', 'mannerism', 'personality',
  'goal', 'hobby', 'background', 'asset', 'liability',
  'reputation', 'secret', 'misfortune',
];

const input  = `w-full ${inputBase} px-2.5 py-1.5`;
const label  = 'text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1 block';

function SectionTitle({ children }) {
  return (
    <div className="mt-5 mb-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">{children}</p>
      <Separator />
    </div>
  );
}

function ActiveAbilityRow({ ability: a, checked, onToggle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2 items-start">
      <input type="checkbox" className="accent-primary mt-2.5 shrink-0"
        checked={checked} onChange={onToggle} />
      <div className="bg-muted/50 border-l-2 border-border flex-1">
        <button type="button"
          className="w-full flex items-center justify-between px-2.5 py-2 text-left"
          onClick={() => setOpen(o => !o)}>
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">{a.name}</span>
            <span className="text-[0.6rem] text-muted-foreground">{a.cost}</span>
          </span>
          <span className="text-muted-foreground text-[0.6rem]">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <p className="px-2.5 pb-2 text-xs text-muted-foreground leading-relaxed">{a.description?.trim()}</p>
        )}
      </div>
    </div>
  );
}

function AgendaAbilityRow({ ability: a, checked, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2 items-start">
      <input type="radio" className="accent-primary mt-2.5 shrink-0"
        checked={checked} onChange={onSelect} />
      <div className="bg-muted/50 border-l-2 border-border flex-1">
        <button type="button"
          className="w-full flex items-center justify-between px-2.5 py-2 text-left"
          onClick={() => setOpen(o => !o)}>
          <span className="text-xs font-semibold text-foreground">{a.name}</span>
          <span className="text-muted-foreground text-[0.6rem]">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <p className="px-2.5 pb-2 text-xs text-muted-foreground leading-relaxed">{a.description?.trim()}</p>
        )}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  name: '', sex: 'male', missions_count: 0,
  blasphemy_name: '', active_abilities: [],
  agenda_name: '', agenda_ability_name: '',
  traits: Object.fromEntries(TRAIT_FIELDS.map(f => [f, ''])),
};

export function ExorcistForm({ onCreated, onClose }) {
  const [blasphemies, setBlasphemies] = useState([]);
  const [agendas,     setAgendas]     = useState([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);

  useEffect(() => {
    fetchBlasphemies().then(setBlasphemies);
    fetchAgendas().then(setAgendas);
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const selectedBlasphemy = blasphemies.find(b => b.name === form.blasphemy_name);
  const selectedAgenda    = agendas.find(a => a.name === form.agenda_name);
  const passive           = selectedBlasphemy?.abilities.find(a => a.cost === 'Passive') ?? null;
  const actives           = selectedBlasphemy?.abilities.filter(a => a.cost !== 'Passive') ?? [];

  function toggleActive(name) {
    set('active_abilities', form.active_abilities.includes(name)
      ? form.active_abilities.filter(n => n !== name)
      : [...form.active_abilities, name]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const traits = Object.fromEntries(
        TRAIT_FIELDS.map(f => [f, form.traits[f].split('\n').map(s => s.trim()).filter(Boolean)])
      );
      const created = await createExorcist({
        name: form.name, sex: form.sex,
        missions_count: Number(form.missions_count),
        blasphemy_name: form.blasphemy_name || null,
        passive_ability: null,
        active_abilities: form.active_abilities,
        agenda_name: form.agenda_name || null,
        agenda_ability_name: form.agenda_ability_name || null,
        traits,
      });
      onCreated(created);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-lg font-bold text-foreground mb-0.5">New Exorcist</p>

      <SectionTitle>Identity</SectionTitle>
      <div className="grid grid-cols-2 gap-3 mb-1">
        <div className="col-span-2">
          <label className={label}>Name</label>
          <input className={input} value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className={label}>Sex</label>
          <select className={input} value={form.sex} onChange={e => set('sex', e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className={label}>Missions</label>
          <input className={input} type="number" min="0"
            value={form.missions_count} onChange={e => set('missions_count', e.target.value)} />
        </div>
      </div>

      <SectionTitle>Blasphemy</SectionTitle>
      <div className="mb-3">
        <label className={label}>Blasphemy</label>
        <select className={input} value={form.blasphemy_name}
          onChange={e => { set('blasphemy_name', e.target.value); set('active_abilities', []); }}>
          <option value="">— none —</option>
          {blasphemies.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
        </select>
      </div>

      {selectedBlasphemy && (
        <>
          {passive && (
            <div className="bg-muted/50 border-l-2 border-primary p-2.5 mb-3">
              <p className="text-xs font-semibold text-foreground mb-0.5">{passive.name}
                <span className="ml-1.5 text-[0.6rem] font-normal text-muted-foreground uppercase tracking-wide">passive</span>
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{passive.description?.trim()}</p>
            </div>
          )}
          {actives.length > 0 && (
            <div className="mb-3">
              <label className={label}>Active abilities</label>
              <div className="flex flex-col gap-1.5 mt-1">
                {actives.map(a => (
                  <ActiveAbilityRow key={a.name} ability={a}
                    checked={form.active_abilities.includes(a.name)}
                    onToggle={() => toggleActive(a.name)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <SectionTitle>Agenda</SectionTitle>
      <div className="mb-3">
        <label className={label}>Agenda</label>
        <select className={input} value={form.agenda_name}
          onChange={e => { set('agenda_name', e.target.value); set('agenda_ability_name', ''); }}>
          <option value="">— none —</option>
          {agendas.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
        </select>
      </div>

      {selectedAgenda && (
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-muted/50 p-2.5">
            <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Regular</p>
            <p className="text-xs text-foreground/80 italic">{selectedAgenda.voice_regular}</p>
          </div>
          <div className="flex-1 bg-muted/50 p-2.5">
            <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Bold</p>
            <p className="text-xs text-foreground/80 italic">{selectedAgenda.voice_bold}</p>
          </div>
        </div>
      )}

      {selectedAgenda?.abilities.length > 0 && (
        <div className="mb-3">
          <label className={label}>Assigned ability</label>
          <div className="flex flex-col gap-1.5 mt-1">
            {selectedAgenda.abilities.map(a => (
              <AgendaAbilityRow key={a.name} ability={a}
                checked={form.agenda_ability_name === a.name}
                onSelect={() => set('agenda_ability_name', form.agenda_ability_name === a.name ? '' : a.name)} />
            ))}
          </div>
        </div>
      )}

      <SectionTitle>Traits</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {TRAIT_FIELDS.map(f => (
          <div key={f}>
            <label className={label}>{f.replace('_', ' ')}</label>
            <textarea className={`${input} resize-none`} rows={2} placeholder="one per line"
              value={form.traits[f]}
              onChange={e => setForm(prev => ({ ...prev, traits: { ...prev.traits, [f]: e.target.value } }))} />
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-destructive mt-3">{error}</p>}

      <div className="flex justify-end gap-2 mt-5">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={submitting || !form.name.trim()}>
          {submitting ? 'Saving…' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
