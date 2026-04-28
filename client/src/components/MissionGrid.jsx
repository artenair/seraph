import { Card, CardContent } from '@/components/ui/card';
import { CatBadge, catColor } from './CatBadge.jsx';

export function MissionGrid({ missions, selectedId, onSelect }) {
  const rounds = [...new Set(missions.map(m => m.round))].sort((a, b) => a - b);

  return (
    <>
      {rounds.map(r => (
        <div key={r} className="mb-7">
          <div className="text-xs uppercase tracking-widest text-muted-foreground border-b border-border pb-1.5 mb-3">
            Round {r}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
            {missions.filter(m => m.round === r).map(m => (
              <Card
                key={m.id}
                className={`cursor-pointer transition-colors py-0 border-l-4 ${selectedId === m.id ? 'ring-2 ring-primary' : ''}`}
                style={{ borderLeftColor: catColor(m.category) }}
                onClick={() => onSelect(m.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-semibold text-sm flex-1 truncate">{m.name}</span>
                    <CatBadge n={m.category} />
                  </div>
                  <div className="text-xs text-muted-foreground">{m.archetype} · {m.form}</div>
                  <div className="text-xs text-muted-foreground/70 mt-0.5">{m.handler}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
