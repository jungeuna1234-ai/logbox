export type LatLng = { lat: number; lng: number };

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function calcDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);s

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aa = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  const d = R * c;
  return Number(d.toFixed(6));
}

export function calcVelocityKmh(distanceKm: number, timeSeconds: number): number {
  if (timeSeconds <= 0) return 0;
  const hours = timeSeconds / 3600;
  return Number((distanceKm / hours).toFixed(3));
}

export enum ThreatLevel {
  Low = 0,
  Medium = 1,
  High = 2,
  Critical = 3,
}

export function getThreatLevel(velocityKmh: number): ThreatLevel {
  if (velocityKmh >= 800) return ThreatLevel.Critical;
  if (velocityKmh >= 200) return ThreatLevel.High;
  if (velocityKmh >= 50) return ThreatLevel.Medium;
  return ThreatLevel.Low;
}

// ... (기존에 작성되어 있던 원래 코드들) ...

/**
 * 위도, 경도 값을 안전하게 파싱하고 유효성을 검사합니다. (자가진단 리팩토링 추가본)
 */
export const parseCoord = (lat: unknown, lng: unknown): [number, number] | null => {
  if (lat == null || lng == null) return null;
  
  const la = Number(lat);
  const lo = Number(lng);
  
  if (isNaN(la) || isNaN(lo)) return null;
  
  // 정상적인 위경도 범위를 벗어나는 기형적 데이터 방어
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  
  return [la, lo];
};
