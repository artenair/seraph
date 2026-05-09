export const STATS = [
  'force', 'conditioning', 'coordination', 'covert', 'interfacing',
  'investigation', 'surveillance', 'negotiation', 'authority', 'connection', 'psyche',
];

export const DEFAULT_STATS = Object.fromEntries(STATS.map(s => [s, 0]));
