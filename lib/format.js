// The eight Hyrox stations, in race order. Legs 1..16 alternate run / station.
export const LEGS = Array.from({ length: 16 }, (_, i) => {
  const n = i + 1;
  const isRun = n % 2 === 1;
  const stationNames = [
    'SkiErg',
    'Sled Push',
    'Sled Pull',
    'Burpee Broad Jump',
    'Row',
    'Farmers Carry',
    'Sandbag Lunges',
    'Wall Balls',
  ];
  const label = isRun
    ? `Run ${(n + 1) / 2}`
    : stationNames[(n / 2) - 1];
  return { leg: n, isRun, label };
});

// Seconds -> "m:ss" or "h:mm:ss".
export function formatSeconds(sec) {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// "m:ss" or "h:mm:ss" or plain seconds -> seconds. Returns null if empty, NaN if invalid.
export function parseTime(input) {
  const str = String(input ?? '').trim();
  if (str === '') return null;
  const parts = str.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return NaN;
  if (parts.length === 1) return Number(parts[0]);
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  return NaN;
}
