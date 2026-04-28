import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CatBadge } from './CatBadge.jsx';

const FILTERS = ['all', 'live', 'deceased'];

export function ExorcistGrid({ exorcists, selectedId, onSelect }) {
  const [filter, setFilter] = useState('all');

  const visible = filter === 'all' ? exorcists : exorcists.filter(e => e.status === filter);

  return (
    <>
      <div className="flex gap-2 mb-4">
        {FILTERS.map(f => (
          <Button
            key={f}
            variant={filter === f ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
        {visible.map(e => (
          <Card
            key={e.id}
            className={`cursor-pointer transition-colors py-0 ${e.status === 'deceased' ? 'opacity-60' : ''} ${selectedId === e.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => onSelect(e.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-semibold text-sm flex-1 truncate">{e.name}</span>
                <CatBadge n={e.category} />
                {e.status === 'deceased' && <span className="text-destructive font-bold text-sm">†</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {e.missions_count} mission{e.missions_count !== 1 ? 's' : ''}
              </div>
              {(e.blasphemy_name || e.agenda_name) && (
                <div className="text-xs text-muted-foreground/70 mt-0.5">
                  {[e.blasphemy_name, e.agenda_name].filter(Boolean).join(' · ')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
