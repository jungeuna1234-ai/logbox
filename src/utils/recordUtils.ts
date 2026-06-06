import { AuthToken, LogBoxRecord } from '../types/index';
import { ThreatLevel } from './geoUtils';
import { escapeHtml } from './sanitize';

export const DEMO_ACCESS_TOKEN = 'demo-token';

const MOCK_RECORD_ID_PREFIXES = ['rec-google-', 'rec-naver-', 'rec-ig-', 'rec-yt-', 'rec-kakao-', 'rec-tw-', 'rec-discord-', 'rec-netflix-', 'rec-steam-', 'rec-instagram-'];

export function isMockRecordId(id: string): boolean {
  return MOCK_RECORD_ID_PREFIXES.some((p) => id.startsWith(p));
}

export function stripMockRecords(records: LogBoxRecord[]): LogBoxRecord[] {
  return records.filter((r) => !isMockRecordId(r.id));
}

export function isMockDeviceId(id: string): boolean {
  return id === 'hacker-device-001' || id.startsWith('d-') || ['d1', 'd2', 'd3', 'd4'].includes(id);
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

export function isPhishingThreat(record: LogBoxRecord): boolean {
  const from = (record.from || '').toLowerCase();
  const subject = (record.subject || '').toLowerCase();
  const body = (record.body || '').toLowerCase();
  const snippet = (record.snippet || '').toLowerCase();

  // 1. Explicit phishing/spoofed domains or subjects
  const phishingDomains = [
    'paypai-verify.com',
    'bank-security.net',
    'amazon-notice.org',
    'netflix-renewal.com',
    'naver-support.kr.com',
  ];

  if (phishingDomains.some(d => from.includes(d) || body.includes(d) || subject.includes(d) || snippet.includes(d))) {
    return true;
  }

  // 2. Sender domain spoofing check
  const plat = record.platform;
  if (plat) {
    if (plat === 'naver' && from !== '' && !from.endsWith('@naver.com') && !from.endsWith('.navercorp.com') && !from.endsWith('@mail.naver.com')) {
      return true;
    }
    if (plat === 'google' && from !== '' && !from.endsWith('@google.com') && !from.endsWith('@accounts.google.com') && !from.endsWith('@gmail.com') && !from.endsWith('@support.google.com')) {
      // If the email uses warning or security keywords, but domain is not google/gmail
      if (/security|alert|login|verify|verification|check|보안|인증|비정상|경고/i.test(subject + ' ' + body + ' ' + snippet)) {
        return true;
      }
    }
    if (plat === 'netflix' && from !== '' && !from.endsWith('@netflix.com') && !from.endsWith('@mailer.netflix.com')) {
      return true;
    }
    if (plat === 'facebook' && from !== '' && !from.endsWith('@facebook.com') && !from.endsWith('@facebookmail.com')) {
      return true;
    }
    if (plat === 'pinterest' && from !== '' && !from.endsWith('@pinterest.com') && !from.endsWith('@pinterestmail.com')) {
      return true;
    }
    if (plat === 'lilys' && from !== '' && !from.endsWith('@lilys.ai') && !from.endsWith('@lilysai.com') && !from.endsWith('@lilys-ai.com')) {
      return true;
    }
    if (plat === 'instagram' && from !== '' && !from.endsWith('@instagram.com') && !from.endsWith('@mail.instagram.com')) {
      return true;
    }
    if (plat === 'discord' && from !== '' && !from.endsWith('@discord.com') && !from.endsWith('@discordapp.com')) {
      return true;
    }
    if (plat === 'steam' && from !== '' && !from.endsWith('@steampowered.com') && !from.endsWith('@steamcommunity.com')) {
      return true;
    }
  }

  // 3. Suspicious body/snippet URL check
  const urlRegex = /(https?:\/\/[^\s/$.?#].[^\s]*)/gi;
  const combinedText = `${body} ${snippet}`;
  const urls = combinedText.match(urlRegex) || [];
  for (const urlStr of urls) {
    try {
      const url = new URL(urlStr);
      const host = url.hostname.toLowerCase();
      // If the URL host matches any known phishing patterns
      if (phishingDomains.some(d => host.includes(d))) {
        return true;
      }
      // If the URL host looks like a spoofed/suspicious subdomain and doesn't match the safe service domains
      if ((host.includes('secure') || host.includes('verify') || host.includes('password') || host.includes('login') || host.includes('update') || host.includes('account') || host.includes('support')) &&
          !host.endsWith('naver.com') && !host.endsWith('google.com') && !host.endsWith('gmail.com') && !host.endsWith('kakao.com') &&
          !host.endsWith('facebook.com') && !host.endsWith('instagram.com') && !host.endsWith('discord.com') && !host.endsWith('netflix.com') &&
          !host.endsWith('pinterest.com') && !host.endsWith('lilys.ai') && !host.endsWith('steampowered.com')) {
        return true;
      }
    } catch {
      // ignore invalid URL
    }
  }

  return false;
}

