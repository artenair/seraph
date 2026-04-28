import { useEffect, useState } from 'react';
import { fetchMission } from '../api.js';
import { Separator } from '@/components/ui/separator';
import { CatBadge } from './CatBadge.jsx';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ExorcistDetail } from './ExorcistDetail.jsx';

function SectionTitle({ children }) {
  return (
    <div className="mt-5 mb-2">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">{children}</p>
      <Separator />
    </div>
  );
}

export function MissionDetail({ id }) {
  const [mission, setMission] = useState(null);
  const [exorcistId, setExorcistId] = useState(null);

  useEffect(() => {
    setMission(null);
    fetchMission(id).then(setMission);
  }, [id]);

  if (!mission) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <>
      <p className="text-lg font-bold text-foreground mb-0.5">{mission.name}</p>
      <p className="text-xs text-muted-foreground font-mono mb-2">{mission.id}</p>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <CatBadge n={mission.category} />
        <span className="text-xs text-muted-foreground">Round {mission.round}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        <span>{mission.archetype}</span> · <span>{mission.form}</span> · <span>{mission.handler}</span>
      </p>

      <SectionTitle>Squad</SectionTitle>
      <div className="flex flex-col gap-2">
        {(mission.squad ?? []).map(p => (
          <div key={p.exorcist_name}
            className={`flex items-center gap-2 text-sm ${p.exorcist_id ? 'cursor-pointer hover:text-primary' : ''}`}
            onClick={() => p.exorcist_id && setExorcistId(p.exorcist_id)}>
            <span className="flex-1">{p.exorcist_name}</span>
            <CatBadge n={p.cat} />
            {p.deceased && <span className="text-destructive font-bold">†</span>}
          </div>
        ))}
      </div>


      <Dialog open={exorcistId !== null} onOpenChange={open => !open && setExorcistId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {exorcistId && <ExorcistDetail id={exorcistId} onDeleted={() => setExorcistId(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
