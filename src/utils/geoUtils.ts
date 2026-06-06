export type LatLng = { lat: number; lng: number };

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function calcDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

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

// [FIX-14] ──── VPN/프록시 IP 대역 감지 (간이 판별) ────
const KNOWN_CLOUD_CIDRS = [
  '34.', '35.',       // Google Cloud
  '52.', '54.',       // AWS
  '13.', '18.',       // AWS
  '104.16.', '104.18.', '104.24.', // Cloudflare
  '172.64.', '172.65.', '172.66.', '172.67.', // Cloudflare
  '198.41.',          // Cloudflare
];

/**
 * IP가 알려진 클라우드/VPN 대역에 해당하는지 간이 판별합니다.
 */
export function isLikelyVpnOrProxy(ip: string | undefined): boolean {
  if (!ip || ip === '플랫폼 미제공') return false;
  return KNOWN_CLOUD_CIDRS.some(prefix => ip.startsWith(prefix));
}

/**
 * 접속 국가가 사용자의 최근 5건 접속 이력과 일치하는지 확인합니다.
 */
export function isKnownLocation(
  currentCountry: string | undefined,
  recentCountries: string[]
): boolean {
  if (!currentCountry || recentCountries.length === 0) return true; // 이력이 없으면 신뢰함
  return recentCountries.some(c =>
    c.toLowerCase().trim() === currentCountry.toLowerCase().trim()
  );
}

/**
 * 다차원 이상 징후 점수를 산출합니다.
 * 0~100 범위이며, 높을수록 위험합니다.
 */
export function calculateAnomalyScore(params: {
  velocityKmh: number;
  isVpnSuspect: boolean;
  isKnownLoc: boolean;
  isNewDevice: boolean;
}): number {
  let score = 0;

  // 속도 기반 점수 (0~50)
  if (params.velocityKmh >= 800) score += 50;
  else if (params.velocityKmh >= 200) score += 35;
  else if (params.velocityKmh >= 50) score += 15;

  // VPN/클라우드 IP 감지 (0~20)
  if (params.isVpnSuspect) score += 20;

  // 미접속 국가/지역 (0~15)
  if (!params.isKnownLoc) score += 15;

  // 신규 기기 (0~15)
  if (params.isNewDevice) score += 15;

  return Math.min(100, score);
}

export function getThreatLevelFromScore(score: number): ThreatLevel {
  if (score >= 80) return ThreatLevel.Critical;
  if (score >= 50) return ThreatLevel.High;
  if (score >= 30) return ThreatLevel.Medium;
  return ThreatLevel.Low;
}

