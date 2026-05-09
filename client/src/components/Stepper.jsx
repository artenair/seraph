export function Stepper({ value, onChange, min = 0, max }) {
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
