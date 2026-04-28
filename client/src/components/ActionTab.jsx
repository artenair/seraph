import { useState, useEffect } from 'react';
import { useLocalStore } from '../lib/localStore.js';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { TalismanPanel } from './TalismanPanel.jsx';
import { AudioMap } from './AudioMap.jsx';
import { useAudio } from '../context/AudioContext.jsx';
import { Map, Volume2, VolumeX } from 'lucide-react';
import { isLocal, inputBase } from '../lib/utils.js';
import { useWebSocket } from '../lib/useWebSocket.js';

const STATS = [
  'force', 'conditioning', 'coordination', 'covert', 'interfacing',
  'investigation', 'surveillance', 'negotiation', 'authority', 'connection', 'psyche',
];

const DEFAULT_STATS = Object.fromEntries(STATS.map(s => [s, 0]));

const input = inputBase;

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

const RISK_COLOR = {
  Terrible: 'text-red-400',
  Bad:      'text-orange-400',
  Expected: 'text-muted-foreground',
  Good:     'text-green-400',
};

function Die({ value, success, muted }) {
  return (
    <div className={`w-9 h-9 flex items-center justify-center text-sm font-bold border
      ${success ? 'bg-primary text-primary-foreground border-primary'
                : muted  ? 'bg-muted/30 text-muted-foreground border-border'
                         : 'bg-muted text-foreground border-border'}`}>
      {value}
    </div>
  );
}

function RollEntry({ roll }) {
  const threshold = roll.threshold ?? (roll.hard ? 6 : 4);
  const isCustom  = !roll.stat;
  return (
    <div className="bg-muted/30 border border-border p-3 text-xs">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {roll.username && <span className="font-semibold text-foreground">{roll.username}</span>}
        {isCustom
          ? <span className="text-muted-foreground font-medium">
              {[roll.d6Dice?.length && `${roll.d6Dice.length}d6`, roll.d3Dice?.length && `${roll.d3Dice.length}d3`].filter(Boolean).join(' + ')}
            </span>
          : <span className="text-muted-foreground capitalize font-medium">{roll.stat}</span>
        }
        {roll.hard      && <span className="text-[0.6rem] uppercase tracking-wide text-yellow-400 border border-yellow-400/40 px-1.5 py-0.5">hard</span>}
        {roll.risky     && <span className="text-[0.6rem] uppercase tracking-wide text-orange-400 border border-orange-400/40 px-1.5 py-0.5">risky</span>}
        {roll.divineAgony && <span className="text-[0.6rem] uppercase tracking-wide text-purple-400 border border-purple-400/40 px-1.5 py-0.5">divine agony</span>}
        <span className="text-muted-foreground/50 ml-auto">{new Date(roll.created_at).toLocaleTimeString()}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {isCustom ? (
          <>
            {roll.d6Dice?.map((d, i) => <Die key={`d6-${i}`} value={d} />)}
            {roll.d6Dice?.length > 0 && roll.d3Dice?.length > 0 && (
              <span className="text-muted-foreground/50 mx-1">|</span>
            )}
            {roll.d3Dice?.map((d, i) => <Die key={`d3-${i}`} value={d} muted />)}
          </>
        ) : roll.zeroDice ? (
          <>
            {roll.zeroDice.map((d, i) => {
              const isLowest = d === Math.min(...roll.zeroDice);
              return <Die key={i} value={d} success={isLowest && d >= threshold} muted={!isLowest} />;
            })}
            <span className="text-muted-foreground ml-1">lowest</span>
          </>
        ) : (
          roll.dice.map((d, i) => <Die key={i} value={d} success={d >= threshold} />)
        )}
        {roll.riskDie !== null && roll.riskDie !== undefined && (
          <div className="flex items-center gap-1.5 border-l border-border pl-2 ml-1">
            <Die value={roll.riskDie} muted />
            <span className={`font-semibold ${RISK_COLOR[roll.riskLabel]}`}>{roll.riskLabel}</span>
          </div>
        )}
      </div>
      {!isCustom && (
        <span className={`font-bold text-sm ${roll.success ? 'text-green-400' : 'text-destructive'}`}>
          {roll.success ? 'Success' : 'Failure'}
        </span>
      )}
    </div>
  );
}

function useFeed() {
  const [rolls,     setRolls]     = useState([]);
  const [talismans, setTalismans] = useState([]);

  useEffect(() => {
    fetch('/api/rolls').then(r => r.json()).then(setRolls);
    fetch('/api/talismans').then(r => r.json()).then(setTalismans);
  }, []);

  useWebSocket(msg => {
    if (msg.type === 'history')          setRolls(msg.rolls);
    if (msg.type === 'roll')             setRolls(prev => [msg.roll, ...prev].slice(0, 50));
    if (msg.type === 'talismans')        setTalismans(msg.talismans);
    if (msg.type === 'talisman_created') setTalismans(prev => [...prev, msg.talisman]);
    if (msg.type === 'talisman_updated') setTalismans(prev => prev.map(t => t.id === msg.talisman.id ? msg.talisman : t));
    if (msg.type === 'talisman_deleted') setTalismans(prev => prev.filter(t => t.id !== msg.id));
  });

  return { rolls, talismans };
}

export function ActionTab({ drawerOpen = false }) {
  const [showMap, setShowMap] = useState(false);
  const { clientMuted, toggleClientMute } = useAudio();

  const [stats,    setStats]    = useLocalStore('stats',    DEFAULT_STATS);
  const [pathos,   setPathos]   = useLocalStore('pathos',   0);
  const [username, setUsername] = useLocalStore('username', '');

  const [selectedStat, setSelectedStat] = useState('force');
  const [bonus,        setBonus]        = useState(0);
  const [hard,         setHard]         = useState(false);
  const [risky,        setRisky]        = useState(false);
  const [divineAgony,  setDivineAgony]  = useState(false);
  const [rolling,      setRolling]      = useState(false);

  const [d6Count,       setD6Count]      = useState(1);
  const [d3Count,       setD3Count]      = useState(0);
  const [rollingCustom, setRollingCustom] = useState(false);

  const { rolls, talismans } = useFeed();

  const statValue   = stats[selectedStat] ?? 0;
  const maxBonus    = Math.min(3, Math.max(0, 6 - statValue));
  const naturalPool = Math.min(statValue + bonus, 6);
  const finalPool   = divineAgony ? naturalPool + pathos : naturalPool;

  function setStat(stat, val) {
    setStats({ ...stats, [stat]: val });
  }

  async function handleRoll() {
    setRolling(true);
    try {
      const res = await fetch('/api/rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stat: selectedStat, statValue, bonus, hard, risky, divineAgony, pathos, username }),
      });
      const roll = await res.json();

      if (divineAgony) {
        setPathos(0);
        setDivineAgony(false);
      } else if (!roll.success) {
        setPathos(Math.min(3, pathos + 1));
      }
    } finally {
      setRolling(false);
    }
  }

  async function handleCustomRoll() {
    setRollingCustom(true);
    try {
      await fetch('/api/rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ d6: d6Count, d3: d3Count, username }),
      });
    } finally {
      setRollingCustom(false);
    }
  }

  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (showMap) return (
    <div className="flex flex-col gap-2 h-full overflow-hidden">
      <button
        onClick={() => setShowMap(false)}
        className="text-xs text-muted-foreground hover:text-foreground self-start shrink-0">
        ← Back
      </button>
      <AudioMap />
    </div>
  );

  return (
    <>
    <div className="flex gap-6 py-2 items-start">

      {/* Sidebar */}
      <div className={`shrink-0 border-r border-border pr-6 transition-all ${sidebarOpen ? 'w-48' : 'w-6'}`}>
        <button type="button" onClick={() => setSidebarOpen(o => !o)}
          className="text-muted-foreground hover:text-foreground mb-4 text-xs flex items-center gap-1 transition-colors">
          {sidebarOpen ? '← hide' : '→'}
        </button>
        {sidebarOpen && (
          <div className="flex flex-col gap-2">
            {STATS.map(s => (
              <div key={s} className="flex items-center justify-between gap-2">
                <label className="text-xs text-muted-foreground capitalize">{s}</label>
                <Stepper value={stats[s] ?? 0} min={0} max={4} onChange={v => setStat(s, v)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0">
        <TalismanPanel talismans={talismans} />
      </div>

      {/* Right sidebar */}
      <div className="w-[480px] shrink-0 border-l border-border pl-6">

        {/* Username */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs uppercase tracking-widest text-muted-foreground w-14">Name</span>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Your name…"
            className={`${input} px-2.5 py-1.5 flex-1`}
          />
        </div>

        {/* Pathos */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs uppercase tracking-widest text-muted-foreground w-14">Pathos</span>
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

        <Separator className="mb-6" />

        {/* Roll controls */}
        <div className="flex flex-wrap gap-3 items-end mb-6">
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Stat</p>
            <select value={selectedStat}
              onChange={e => { setSelectedStat(e.target.value); setBonus(0); }}
              className={`${input} px-2.5 py-1.5 capitalize`}>
              {STATS.map(s => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)} ({stats[s] ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Bonus dice</p>
            <Stepper value={bonus} min={0} max={maxBonus} onChange={setBonus} />
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            {[['Hard', hard, setHard, 'text-yellow-400 border-yellow-400/60 bg-yellow-400/10'],
              ['Risky', risky, setRisky, 'text-orange-400 border-orange-400/60 bg-orange-400/10']
            ].map(([lbl, val, set, activeClass]) => (
              <button key={lbl} type="button"
                onClick={() => set(!val)}
                className={`px-3 py-1 text-xs font-medium border transition-colors ${
                  val
                    ? activeClass
                    : 'text-muted-foreground border-muted-foreground/40 hover:border-muted-foreground/70 hover:text-foreground'
                }`}>
                {lbl}
              </button>
            ))}
            {pathos > 0 && (
              <button type="button"
                onClick={() => setDivineAgony(!divineAgony)}
                className={`px-3 py-1 text-xs font-medium border transition-colors ${
                  divineAgony
                    ? 'text-purple-400 border-purple-400/60 bg-purple-400/10'
                    : 'text-muted-foreground border-muted-foreground/40 hover:border-muted-foreground/70 hover:text-foreground'
                }`}>
                Divine agony <span className="opacity-60">(+{pathos}d)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleRoll} disabled={rolling || !username.trim()}>
              {rolling ? 'Rolling…' : `Roll ${finalPool === 0 ? '2d6 lowest' : `${finalPool}d6`}`}
            </Button>
            <span className="text-xs text-muted-foreground">Success on {hard ? '6' : '4+'}</span>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Custom pool */}
        <div className="flex flex-wrap gap-4 items-end mb-8">
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">d6</p>
            <Stepper value={d6Count} min={0} max={10} onChange={setD6Count} />
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">d3</p>
            <Stepper value={d3Count} min={0} max={10} onChange={setD3Count} />
          </div>
          <Button onClick={handleCustomRoll} disabled={rollingCustom || !username.trim() || (d6Count === 0 && d3Count === 0)}>
            {rollingCustom ? 'Rolling…' : `Roll ${[d6Count && `${d6Count}d6`, d3Count && `${d3Count}d3`].filter(Boolean).join(' + ') || '…'}`}
          </Button>
        </div>

        {/* Roll feed */}
        {rolls.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Roll history</p>
            <div className="flex flex-col gap-2">
              {rolls.map(r => <RollEntry key={r.id} roll={r} />)}
            </div>
          </>
        )}

      </div>
    </div>
    {isLocal && !drawerOpen && (
      <button
        onClick={() => setShowMap(true)}
        title="Audio Map"
        className="fixed bottom-16 left-4 z-50 p-2.5 bg-background border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
        <Map size={18} />
      </button>
    )}
    {!isLocal && (
      <button
        onClick={toggleClientMute}
        className="fixed bottom-16 left-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-95 transition-all shadow-lg">
        {clientMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        {clientMuted ? 'Listen' : 'Mute'}
      </button>
    )}
    </>
  );
}
