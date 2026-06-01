import { LogBoxRecord } from '../types/index';
import { calcDistanceKm, calcVelocityKmh, getThreatLevel } from './geoUtils';

/** 좌표·시간이 있는 연속 기록에서 위협 단계 추정 */
export function enrichThreatLevels(records: LogBoxRecord[]): LogBoxRecord[] {
  const sorted = [...records].sort((a, b) => (a.timeISO ?? '').localeCompare(b.timeISO ?? ''));
  return sorted.map((r, i) => {
    if (r.threatLevel !== undefined) return r;
    if (i === 0) return { ...r, threatLevel: getThreatLevel(0) };

    const prev = sorted[i - 1];
    const hasGeo =
      typeof prev.latitude === 'number' &&
      typeof prev.longitude === 'number' &&
      typeof r.latitude === 'number' &&
      typeof r.longitude === 'number';
    const hasTime = prev.timeISO && r.timeISO;

    if (hasGeo && hasTime) {
      const dist = calcDistanceKm(
        { lat: prev.latitude!, lng: prev.longitude! },
        { lat: r.latitude!, lng: r.longitude! },
      );
      const dtSec = Math.max(1, (new Date(r.timeISO!).getTime() - new Date(prev.timeISO!).getTime()) / 1000);
      const velocity = calcVelocityKmh(dist, dtSec);
      return { ...r, threatLevel: getThreatLevel(velocity) };
    }
    return { ...r, threatLevel: getThreatLevel(0) };
  });
}
