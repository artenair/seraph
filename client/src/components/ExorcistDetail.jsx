import { useEffect, useState } from 'react';
import { fetchExorcist, deleteExorcist } from '../api.js';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CatBadge } from './CatBadge.jsx';

function SectionTitle({ children }) {
  return (
    <div className="mt-5 mb-2">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">{children}</p>
      <Separator />
    </div>
  );
}

function Ability({ ability, role }) {
  const tags = Array.isArray(ability.tags) ? ability.tags : JSON.parse(ability.tags ?? '[]');
  return (
    <div className="bg-muted/50 p-2.5 mb-2 border-l-2 border-primary">
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        <span className="font-semibold text-sm text-foreground">{ability.name}</span>
        <Badge variant="secondary" className="text-[0.6rem] px-1.5 py-0">{ability.cost}</Badge>
        {tags.map(t => (
          <Badge key={t} variant="outline" className="text-[0.6rem] px-1.5 py-0">{t}</Badge>
        ))}
        {role === 'passive' && <Badge className="text-[0.6rem] px-1.5 py-0 bg-blue-900 text-blue-200 border-none">passive</Badge>}
        {role === 'active'  && <Badge className="text-[0.6rem] px-1.5 py-0 bg-green-900 text-green-200 border-none">active</Badge>}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{ability.description?.trim()}</p>
    </div>
  );
}

export function ExorcistDetail({ id, onDeleted }) {
  const [exo, setExo] = useState(null);

  useEffect(() => {
    setExo(null);
    fetchExorcist(id).then(setExo);
  }, [id]);

  async function handleDelete() {
    await deleteExorcist(id);
    onDeleted(id);
  }

  if (!exo) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const nonEmptyTraits = Object.entries(exo.traits ?? {}).filter(([, v]) => v?.length);
  const agendaAbility  = exo.agenda_ability_name
    ? (exo.agenda?.abilities ?? []).find(a => a.name === exo.agenda_ability_name)
    : null;

  return (
    <>
      <p className="text-lg font-bold text-foreground mb-0.5">{exo.name}</p>
      <p className="text-xs text-muted-foreground font-mono mb-2">{exo.id}</p>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <CatBadge n={exo.category} />
        <Badge className={`text-[0.65rem] ${exo.status === 'live' ? 'bg-green-950 text-green-300 border-none' : 'bg-red-950 text-red-300 border-none'}`}>
          {exo.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {exo.missions_count} mission{exo.missions_count !== 1 ? 's' : ''}
        </span>
      </div>

      {exo.agenda && (
        <>
          <SectionTitle>Agenda — {exo.agenda.name}</SectionTitle>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 bg-muted/50 p-2.5">
              <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Regular</p>
              <p className="text-xs text-foreground/80 italic">{exo.agenda.voice_regular}</p>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              {(exo.bold_voices ?? []).map((v, i) => (
                <div key={i} className="bg-muted/50 p-2.5">
                  <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground mb-1">Bold</p>
                  <p className="text-xs text-foreground/80 italic">{v}</p>
                </div>
              ))}
            </div>
          </div>
          {agendaAbility && (
            <>
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Assigned</p>
              <div className="bg-muted/50 border-l-2 border-primary p-2.5 mb-2">
                <p className="font-semibold text-sm text-foreground mb-1">{agendaAbility.name}</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {agendaAbility.description?.trim()}
                </p>
              </div>
            </>
          )}
        </>
      )}

      {exo.blasphemy && (
        <>
          <SectionTitle>Blasphemy — {exo.blasphemy.name}</SectionTitle>
          {exo.blasphemy.hook && (
            <div className="bg-muted/50 border-l-2 border-yellow-500 p-2.5 mb-2">
              <p className="text-sm font-semibold text-yellow-300 mb-1">{exo.blasphemy.hook.name}</p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {exo.blasphemy.hook.description?.trim()}
              </p>
            </div>
          )}
          {exo.passive_ability && <Ability ability={exo.passive_ability} role="passive" />}
          {(exo.active_abilities ?? []).map(a => <Ability key={a.name} ability={a} role="active" />)}
        </>
      )}


      {nonEmptyTraits.length > 0 && (
        <>
          <SectionTitle>Traits</SectionTitle>
          <div className="mb-2 space-y-1">
            {nonEmptyTraits.map(([trait, values]) => (
              <div key={trait} className="flex gap-2">
                <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground w-24 shrink-0 pt-0.5">{trait}</span>
                <span className="text-xs text-foreground/80">{values.join(', ')}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-6 pt-4 border-t border-border flex justify-end">
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}>Delete exorcist</Button>
      </div>
    </>
  );
}
