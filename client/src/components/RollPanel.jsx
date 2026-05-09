import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useLocalStore } from '../lib/localStore.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRoom } from '../context/RoomContext.jsx';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { inputBase } from '../lib/utils.js';
import { computeRoll, computeCustomRoll } from '../lib/dice.js';
import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { ref as rtdbRef, set, onValue } from 'firebase/database';
import { db, rtdb } from '../lib/firebase.js';

const STATS = [
  'force', 'conditioning', 'coordination', 'covert', 'interfacing',
  'investigation', 'surveillance', 'negotiation', 'authority', 'connection', 'psyche',
];
const DEFAULT_STATS = Object.fromEntries(STATS.map(s => [s, 0]));
const input = inputBase;

const RISK_COLOR = {
  Terrible: 'text-red-400',
  Bad:      'text-orange-400',
  Expected: 'text-muted-foreground',
  Good:     'text-green-400',
};

function Stepper({ value, onChange, min = 0, max }) {
  return (
    <div className="flex items-center border border-border bg-muted/50">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="px-2 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors select-none">−</button>
      <span className="w-6 text-center text-sm text-foreground tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)} disabled={max !== undefined && value >= max}
        className="px-2 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors select-none">+</button>
    </div>
  );
}

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

function RollEntry({ roll, isAdmin, onDelete }) {
  const threshold = roll.threshold ?? (roll.hard ? 6 : 4);
  const isCustom  = !roll.stat;
  return (
    <div className="bg-muted/30 border border-border p-3 text-xs">
      <div className="flex items-center gap-2 mb-1">
        {roll.username && <span className="font-semibold text-foreground">{roll.username}</span>}
        {isCustom
          ? <span className="text-muted-foreground font-medium">
              {[roll.d6Dice?.length && `${roll.d6Dice.length}d6`, roll.d3Dice?.length && `${roll.d3Dice.length}d3`].filter(Boolean).join(' + ')}
            </span>
          : <span className="text-muted-foreground capitalize font-medium">{roll.stat}</span>
        }
        <span className="text-muted-foreground/50 ml-auto">{new Date(roll.createdAt ?? roll.created_at).toLocaleTimeString()}</span>
        {isAdmin && (
          <button onClick={onDelete} className="text-muted-foreground/40 hover:text-destructive transition-colors ml-1">
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {(roll.hard || roll.risky || roll.divineAgony) && (
        <div className="flex gap-1.5 mb-2">
          {roll.hard        && <span className="text-[0.6rem] uppercase tracking-wide text-yellow-400 border border-yellow-400/40 px-1.5 py-0.5">hard</span>}
          {roll.risky       && <span className="text-[0.6rem] uppercase tracking-wide text-orange-400 border border-orange-400/40 px-1.5 py-0.5">risky</span>}
          {roll.divineAgony && <span className="text-[0.6rem] uppercase tracking-wide text-purple-400 border border-purple-400/40 px-1.5 py-0.5">divine agony</span>}
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {isCustom ? (
          <>
            {roll.d6Dice?.map((d, i) => <Die key={`d6-${i}`} value={d} />)}
            {roll.d6Dice?.length > 0 && roll.d3Dice?.length > 0 && <span className="text-muted-foreground/50 mx-1">|</span>}
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

export function RollPanel({ className = 'overflow-y-auto' }) {
  const { displayName: username } = useAuth();
  const { currentRoom, isAdmin } = useRoom();
  const [stats,  setStats]  = useLocalStore('stats',  DEFAULT_STATS);
  const [pathos, setPathos] = useLocalStore('pathos', 0);

  const [selectedStat, setSelectedStat] = useState('force');
  const [bonus,        setBonus]        = useState(0);
  const [hard,         setHard]         = useState(false);
  const [risky,        setRisky]        = useState(false);
  const [divineAgony,  setDivineAgony]  = useState(false);
  const [rolling,      setRolling]      = useState(false);
  const [d6Count,      setD6Count]      = useState(1);
  const [d3Count,      setD3Count]      = useState(0);
  const [rollingCustom, setRollingCustom] = useState(false);
  const [rolls,        setRolls]        = useState([]);

  // Initial roll load
  useEffect(() => {
    if (!currentRoom?.id) return;
    getDocs(query(
      collection(db, 'rooms', currentRoom.id, 'rolls'),
      orderBy('createdAt', 'desc'),
      limit(50),
    )).then(snap => setRolls(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentRoom?.id]);

  // Real-time roll updates
  useEffect(() => {
    if (!currentRoom?.id) return;
    const firstCall = { seen: false };
    const unsub = onValue(rtdbRef(rtdb, `rooms/${currentRoom.id}/rollEvent`), snapshot => {
      if (!firstCall.seen) { firstCall.seen = true; return; }
      const event = snapshot.val();
      if (event?.deleted) { setRolls(prev => prev.filter(r => r.id !== event.deleted)); return; }
      if (!event?.roll) return;
      const roll = event.roll;
      setRolls(prev => [roll, ...prev].slice(0, 50));
      const isCustom = !roll.stat;
      const who = roll.username ?? 'Someone';
      if (isCustom) {
        const parts = [
          roll.d6Dice?.length && `d6: ${roll.d6Dice.join(' ')}`,
          roll.d3Dice?.length && `d3: ${roll.d3Dice.join(' ')}`,
        ].filter(Boolean).join('  ');
        toast(`${who} - Custom roll`, { description: parts });
      } else {
        const mods   = [roll.hard && 'Hard', roll.risky && 'Risky'].filter(Boolean).join(' ');
        const result = roll.success ? '✓ Success' : '✗ Failure';
        const risk   = roll.riskDie != null ? ` - ${roll.riskLabel} (${roll.riskDie})` : '';
        toast(`${who}${mods ? ` - ${mods}` : ''}`, { description: `${result}${risk}` });
      }
    });
    return unsub;
  }, [currentRoom?.id]);

  const statValue   = stats[selectedStat] ?? 0;
  const maxBonus    = Math.min(3, Math.max(0, 6 - statValue));
  const naturalPool = Math.min(statValue + bonus, 6);
  const finalPool   = divineAgony ? naturalPool + pathos : naturalPool;

  async function deleteRoll(rollId) {
    await deleteDoc(doc(db, 'rooms', currentRoom.id, 'rolls', rollId));
    await set(rtdbRef(rtdb, `rooms/${currentRoom.id}/rollEvent`), { deleted: rollId, ts: Date.now() });
    setRolls(prev => prev.filter(r => r.id !== rollId));
  }

  async function saveRoll(rollData) {
    const ref  = await addDoc(collection(db, 'rooms', currentRoom.id, 'rolls'), rollData);
    const roll = { id: ref.id, ...rollData };
    await set(rtdbRef(rtdb, `rooms/${currentRoom.id}/rollEvent`), { roll, ts: Date.now() });
    return roll;
  }

  async function handleRoll() {
    setRolling(true);
    try {
      const r    = computeRoll({ statValue, bonus, hard, risky, divineAgony, pathos });
      const roll = await saveRoll({
        createdAt: Date.now(), username,
        stat: selectedStat, statValue, bonus, hard, risky, divineAgony,
        pathosSent: divineAgony ? pathos : 0,
        dice: r.mainDice, zeroDice: r.zeroDice ?? null,
        riskDie: r.riskDie ?? null, riskLabel: r.riskLabel ?? null,
        success: r.success, poolSize: r.finalPool, threshold: r.threshold,
      });
      if (divineAgony) { setPathos(0); setDivineAgony(false); }
      else if (!roll.success) setPathos(Math.min(3, pathos + 1));
    } finally { setRolling(false); }
  }

  async function handleCustomRoll() {
    setRollingCustom(true);
    try {
      const c = computeCustomRoll({ d6Count, d3Count });
      await saveRoll({ createdAt: Date.now(), username, stat: null, d6Dice: c.d6Dice, d3Dice: c.d3Dice, poolSize: c.finalPool });
    } finally { setRollingCustom(false); }
  }

  return (
    <div className={`w-80 shrink-0 border-l border-border flex flex-col ${className}`}>

      {/* Static controls — never scrolls */}
      <div className="p-4 flex flex-col gap-2 shrink-0">

        {/* Roll controls */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1 min-w-0">
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Stat</p>
              <select value={selectedStat} onChange={e => { setSelectedStat(e.target.value); setBonus(0); }}
                className={`${input} px-2 py-1.5 capitalize w-full`}>
                {STATS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)} ({stats[s] ?? 0})</option>
                ))}
              </select>
            </div>
            <div className="shrink-0">
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Bonus</p>
              <Stepper value={bonus} min={0} max={maxBonus} onChange={setBonus} />
            </div>
          </div>

          <div className="flex gap-2 items-center">
            {[['Hard', hard, setHard, 'text-yellow-400 border-yellow-400/60 bg-yellow-400/10'],
              ['Risky', risky, setRisky, 'text-orange-400 border-orange-400/60 bg-orange-400/10']
            ].map(([lbl, val, set, activeClass]) => (
              <button key={lbl} type="button" onClick={() => set(!val)}
                className={`px-3 py-1 text-xs font-medium border transition-colors ${val ? activeClass : 'text-muted-foreground border-muted-foreground/40 hover:border-muted-foreground/70 hover:text-foreground'}`}>
                {lbl}
              </button>
            ))}
            {pathos > 0 && (
              <button type="button" onClick={() => setDivineAgony(!divineAgony)}
                className={`px-3 py-1 text-xs font-medium border transition-colors ${divineAgony ? 'text-purple-400 border-purple-400/60 bg-purple-400/10' : 'text-muted-foreground border-muted-foreground/40 hover:border-muted-foreground/70 hover:text-foreground'}`}>
                Divine agony <span className="opacity-60">(+{pathos}d)</span>
              </button>
            )}
            <Button className="ml-auto" onClick={handleRoll} disabled={rolling || !username?.trim()}>
              {rolling ? 'Rolling…' : `Roll ${finalPool === 0 ? '2d6 lowest' : `${finalPool}d6`}`}
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">Success on {hard ? '6' : '4+'}</span>
        </div>

        {/* Pathos */}
        <div className="flex items-center gap-3 mt-4">
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

        <Separator />

        {/* Custom pool */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">d6</p>
            <Stepper value={d6Count} min={0} max={10} onChange={setD6Count} />
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">d3</p>
            <Stepper value={d3Count} min={0} max={10} onChange={setD3Count} />
          </div>
          <Button onClick={handleCustomRoll} disabled={rollingCustom || !username?.trim() || (d6Count === 0 && d3Count === 0)}>
            {rollingCustom ? 'Rolling…' : `Roll ${[d6Count && `${d6Count}d6`, d3Count && `${d3Count}d3`].filter(Boolean).join(' + ') || '…'}`}
          </Button>
        </div>
      </div>

      {/* Roll history — scrollable */}
      {rolls.length > 0 && (
        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 flex flex-col gap-2">
          <p className="sticky top-0 bg-background py-2 text-xs uppercase tracking-widest text-muted-foreground">Roll history</p>
          <div className="flex flex-col gap-2">
            {rolls.map(r => <RollEntry key={r.id} roll={r} isAdmin={isAdmin} onDelete={() => deleteRoll(r.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
