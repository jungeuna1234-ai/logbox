import { LogBoxRecord } from '../types/index';
import {
  calcDistanceKm,
  calcVelocityKmh,
  isLikelyVpnOrProxy,
  isKnownLocation,
  calculateAnomalyScore,
  getThreatLevelFromScore
} from './geoUtils';

/** 좌표·시간이 있는 연속 기록에서 위협 단계 추정 (다차원 이상 탐지) */
export function enrichThreatLevels(records: LogBoxRecord[]): LogBoxRecord[] {
  const sorted = [...records].sort((a, b) => (a.timeISO ?? '').localeCompare(b.timeISO ?? ''));
  return sorted.map((r, i) => {
    if (r.threatLevel !== undefined) return r;

    // 1. 속도(Velocity) 계산
    let velocity = 0;
    if (i > 0) {
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
        velocity = calcVelocityKmh(dist, dtSec);
      }
    }

    // 2. VPN/Proxy 감지
    const isVpnSuspect = isLikelyVpnOrProxy(r.ip);

    // 3. 접속지 이력 대조 (최근 5건 접속 국가/지역)
    const recentLocations = sorted
      .slice(Math.max(0, i - 5), i)
      .map(x => x.device?.location)
      .filter(Boolean) as string[];
    const isKnownLoc = isKnownLocation(r.device?.location, recentLocations);

    // 4. 신규 기기 여부 감지 (과거 이력 중 동일 기기명 존재 여부)
    const priorDeviceNames = sorted
      .slice(0, i)
      .map(x => x.device?.name)
      .filter(Boolean) as string[];
    const isNewDevice = r.device?.name
      ? !priorDeviceNames.includes(r.device.name)
      : false;

    // 5. 다차원 Anomaly Score 계산
    const score = calculateAnomalyScore({
      velocityKmh: velocity,
      isVpnSuspect,
      isKnownLoc,
      isNewDevice,
    });

    const calculatedThreatLevel = getThreatLevelFromScore(score);

    return { ...r, threatLevel: calculatedThreatLevel };
  });
}

