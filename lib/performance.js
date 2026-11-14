// RŌXCOACH HYROX Performance Engine
import { formatSeconds } from './format.js';

export const STATIONS = [
  { id: 2, key: 'skierg', name: 'SkiErg', standardDistance: '1000m' },
  { id: 4, key: 'sled_push', name: 'Sled Push', standardDistance: '50m' },
  { id: 6, key: 'sled_pull', name: 'Sled Pull', standardDistance: '50m' },
  { id: 8, key: 'burpees', name: 'Burpee Broad Jump', standardDistance: '80m' },
  { id: 10, key: 'row', name: 'Rowing', standardDistance: '1000m' },
  { id: 12, key: 'farmers', name: 'Farmers Carry', standardDistance: '200m' },
  { id: 14, key: 'lunges', name: 'Sandbag Lunges', standardDistance: '100m' },
  { id: 16, key: 'wallballs', name: 'Wall Balls', standardDistance: '100 reps' },
];

export function computeStationScorecard(currentSession, previousSession) {
  if (!currentSession?.station_results) return [];

  const prevResultsMap = {};
  if (previousSession?.station_results) {
    for (const r of previousSession.station_results) {
      prevResultsMap[r.leg] = r.time_sec;
    }
  }

  return STATIONS.map((st) => {
    const curResult = currentSession.station_results.find((r) => r.leg === st.id);
    const curTime = curResult?.time_sec ?? null;
    const prevTime = prevResultsMap[st.id] ?? null;

    let deltaSec = null;
    let deltaFormatted = '—';
    let isImproved = false;

    if (curTime != null && prevTime != null) {
      deltaSec = curTime - prevTime;
      // In racing, a negative delta means faster (improvement)
      const sign = deltaSec > 0 ? '+' : deltaSec < 0 ? '−' : '';
      deltaFormatted = `${sign}${formatSeconds(Math.abs(deltaSec))}`;
      isImproved = deltaSec < 0;
    }

    return {
      ...st,
      timeSec: curTime,
      formattedTime: formatSeconds(curTime),
      prevTimeSec: prevTime,
      deltaSec,
      deltaFormatted,
      isImproved,
    };
  });
}

export function computeRunSplits(session) {
  if (!session?.station_results) return { runs: [], totalRunSec: 0, avgPaceSec: 0 };

  const runs = [];
  let totalRunSec = 0;

  for (let i = 1; i <= 15; i += 2) {
    const runNum = (i + 1) / 2;
    const res = session.station_results.find((r) => r.leg === i);
    const sec = res?.time_sec ?? 0;
    totalRunSec += sec;
    runs.push({
      runNum,
      leg: i,
      timeSec: sec,
      formatted: formatSeconds(sec),
    });
  }

  const avgPaceSec = runs.length > 0 ? Math.round(totalRunSec / 8) : 0;
  return { runs, totalRunSec, avgPaceSec, formattedAvgPace: `${formatSeconds(avgPaceSec)}/km` };
}

export function identifyStationWeakness(scorecard) {
  // Finds the station that regressed the most or was slowest
  if (!scorecard || scorecard.length === 0) return null;
  const withTime = scorecard.filter((s) => s.timeSec != null);
  if (withTime.length === 0) return null;

  // Station with highest time relative to typical benchmark
  const sorted = [...withTime].sort((a, b) => (b.timeSec || 0) - (a.timeSec || 0));
  return sorted[0];
}
