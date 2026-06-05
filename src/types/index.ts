export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  scope?: string;
  tokenType?: string;
}

export interface UserProfile {
  email?: string;
  name?: string;
  picture?: string;
}

/** 보안 알림 출처 (Gmail로 포워딩된 메일 포함) */
export type SecurityPlatform = 'google' | 'naver' | 'kakao' | 'instagram' | 'discord' | 'netflix' | 'steam' | 'unknown';

/** 기획서 6번 — 신뢰 기기 */
export interface TrustedDevice {
  id: string;
  /** 표시용 이름 (model + browser 조합 등) */
  name: string;
  model?: string;
  os?: string;
  browser?: string;
  isCurrent?: boolean;
  lastActive?: string;
  trusted: boolean;
  /** @deprecated lastActive 사용 */
  lastSeen?: string;
}

export interface SafeZoneBase {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radiusKm: number;
  muted?: boolean;
}

export interface LogBoxRecord {
  id: string;
  platform?: SecurityPlatform;
  ip?: string;
  latitude?: number;
  longitude?: number;
  device?: TrustedDevice;
  timeISO?: string;
  threatLevel?: number;
  raw?: string;
}
