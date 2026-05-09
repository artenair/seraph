import { useLocalStore } from '../lib/localStore.js';
import { useAuth } from '../context/AuthContext.jsx';
import { STATS, DEFAULT_STATS } from '../lib/diceConstants.js';
import { Stepper } from './Stepper.jsx';

export function CharacterTab() {
  const { displayName } = useAuth();
  const [stats,  setStats]  = useLocalStore('stats',  DEFAULT_STATS);
  const [pathos, setPathos] = useLocalStore('pathos', 0);

  return (
    <div className="p-6 max-w-sm flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Character</p>
        <p className="text-lg font-semibold">{displayName}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Stats</p>
        {STATS.map(s => (
          <div key={s} className="flex items-center justify-between gap-2">
            <label className="text-xs text-muted-foreground capitalize">{s}</label>
            <Stepper
              value={stats[s] ?? 0}
              min={0}
              max={4}
              onChange={v => setStats({ ...stats, [s]: v })}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Pathos</p>
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <button key={i} type="button"
              onClick={() => setPathos(i === pathos ? i - 1 : i)}
              className={`w-5 h-5 border-2 transition-colors ${i <= pathos
                ? 'bg-primary border-primary'
                : 'bg-muted/20 border-muted-foreground/40 hover:border-primary/60'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
