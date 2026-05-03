import { useLocalStore } from '../lib/localStore.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATS = [
  'force', 'conditioning', 'coordination', 'covert', 'interfacing',
  'investigation', 'surveillance', 'negotiation', 'authority', 'connection', 'psyche',
];

const DEFAULT_STATS = Object.fromEntries(STATS.map(s => [s, 0]));

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
