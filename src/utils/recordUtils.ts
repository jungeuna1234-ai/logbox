import { AuthToken, LogBoxRecord } from '../types/index';
import { ThreatLevel } from './geoUtils';
import { escapeHtml } from './sanitize';

export const DEMO_ACCESS_TOKEN = 'demo-token';

const MOCK_RECORD_ID_PREFIXES = ['rec-google-', 'rec-naver-', 'rec-ig-', 'rec-yt-', 'rec-kakao-', 'rec-tw-'];

export function isMockRecordId(id: string): boolean {
  return MOCK_RECORD_ID_PREFIXES.some((p) => id.startsWith(p));
}

export function stripMockRecords(records: LogBoxRecord[]): LogBoxRecord[] {
  return records.filter((r) => !isMockRecordId(r.id));
}

export function isDemoToken(token: AuthToken | null | undefined): boolean {
  return token?.accessToken === DEMO_ACCESS_TOKEN || token?.scope === 'demo';
}

export function isTokenExpired(token: AuthToken): boolean {
  return typeof token.expiresAt === 'number' && token.expiresAt < Date.now();
}

export function mapThreatToVelocity(level?: number): number {
  if (level === undefined) return 0;
  switch (level) {
    case ThreatLevel.Critical:
      return 900;
    case ThreatLevel.High:
      return 300;
    case ThreatLevel.Medium:
      return 100;
    case ThreatLevel.Low:
    default:
      return 10;
  }
}

export function mergeRecordsById(existing: LogBoxRecord[], incoming: LogBoxRecord[]): LogBoxRecord[] {
  const byId = new Map<string, LogBoxRecord>();
  for (const r of existing) byId.set(r.id, r);
  for (const r of incoming) {
    const prev = byId.get(r.id);
    byId.set(r.id, prev ? { ...prev, ...r } : r);
  }
  return [...byId.values()].sort((a, b) => (b.timeISO ?? '').localeCompare(a.timeISO ?? ''));
}

export function formatRecordSummary(raw: string | undefined, deviceName?: string): string {
  if (!raw) return deviceName ?? '알 수 없는 활동';
  const oneLine = raw.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 120) return escapeHtml(oneLine);
  return `${escapeHtml(oneLine.slice(0, 117))}…`;
}
