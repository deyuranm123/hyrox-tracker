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
  if (sec == null || Number.isNaN(sec)) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Auto-formats raw digits typed on mobile keypads into m:ss or h:mm:ss
// e.g. "4" -> "4", "43" -> "4:3", "430" -> "4:30", "11824" -> "1:18:24"
export function formatAsTimeInput(value) {
  if (value == null) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 6);
  if (digits.length === 0) return '';
  if (digits.length === 1) return digits;
  if (digits.length === 2) return `${digits[0]}:${digits[1]}`;
  if (digits.length === 3) return `${digits[0]}:${digits.slice(1)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  if (digits.length === 5) return `${digits[0]}:${digits.slice(1, 3)}:${digits.slice(3)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
}

// "m:ss" or "h:mm:ss" or plain seconds -> seconds.
// Strictly enforces 0 <= seconds < 60 and 0 <= minutes < 60 for multi-part formats.
// Returns null if empty, NaN if invalid or range violation (e.g. 1:60 -> NaN).
export function parseTime(input) {
  const str = String(input ?? '').trim();
  if (str === '') return null;
  const parts = str.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return NaN;

  if (parts.length === 1) {
    const s = Number(parts[0]);
    return Number.isFinite(s) && s >= 0 ? s : NaN;
  }

  if (parts.length === 2) {
    const min = Number(parts[0]);
    const sec = Number(parts[1]);
    if (sec < 0 || sec >= 60) return NaN;
    return min * 60 + sec;
  }

  if (parts.length === 3) {
    const hrs = Number(parts[0]);
    const min = Number(parts[1]);
    const sec = Number(parts[2]);
    if (min < 0 || min >= 60 || sec < 0 || sec >= 60) return NaN;
    return hrs * 3600 + min * 60 + sec;
  }

  return NaN;
}

// Validates all 16 splits simultaneously rather than returning on the first missing leg.
// Returns { isValid: boolean, missingLegs: number[], errors: Record<number, string> }
export function validateAllLegs(splits = {}) {
  const missingLegs = [];
  const errors = {};

  for (const leg of LEGS) {
    const raw = splits[leg.leg];
    const parsed = parseTime(raw);

    if (parsed === null) {
      missingLegs.push(leg.leg);
      errors[leg.leg] = `Leg ${leg.leg} (${leg.label}) is required`;
    } else if (Number.isNaN(parsed)) {
      errors[leg.leg] = `Leg ${leg.leg} (${leg.label}) format must be m:ss with seconds < 60 (e.g. 4:30)`;
    }
  }

  return {
    isValid: missingLegs.length === 0 && Object.keys(errors).length === 0,
    missingLegs,
    errors,
  };
}
