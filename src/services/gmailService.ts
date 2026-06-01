import type { LogBoxRecord, SecurityPlatform } from '../types/index';
import { getThreatLevel } from '../utils/geoUtils';
import { formatRecordSummary } from '../utils/recordUtils';
import { escapeHtml } from '../utils/sanitize';
import { geocode } from './geocodingService';

const MAX_MESSAGES = 20;

/** Gmail 검색: 구글 보안 메일 + 네이버/카카오 포워딩(제목·발신 패턴) */
export function buildGmailSecurityListQuery(): string {
  const parts = [
    'from:no-reply@accounts.google.com',
    'subject:"[네이버]"',
    'subject:"네이버"',
    'subject:"Naver"',
    'subject:"Kakao"',
    'subject:"카카오"',
    'from:no-reply@mail.naver.com',
    'from:notification@mail.kakao.com',
  ];
  return parts.join(' OR ');
}

function base64UrlDecode(input: string): string {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  
  if (typeof window === 'undefined' || typeof window.atob !== 'function') {
    throw new Error('base64 decode is only supported in the browser');
  }

  // atob()는 Latin-1로 디코딩하므로, UTF-8 다중바이트 문자(한글)가 깨집니다.
  // TextDecoder를 사용하여 UTF-8을 올바르게 처리합니다.
  try {
    const binaryString = window.atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (err) {
    // 폴백: decodeURIComponent(escape()) 방식
    try {
      return decodeURIComponent(escape(window.atob(b64)));
    } catch {
      throw new Error(`base64 decode failed: ${String(err)}`);
    }
  }
}

function extractFirstRegex(text: string, rx: RegExp): string | null {
  const m = rx.exec(text);
  return m && m[1] ? m[1] : null;
}

/** 제목·발신·스니펫으로 플랫폼 추정 (향후 파서 분기에 사용) */
export function detectSecurityPlatform(subject: string, from: string, snippet: string): SecurityPlatform {
  const blob = `${subject}\n${from}\n${snippet}`.toLowerCase();

  if (from.includes('accounts.google.com') || from.includes('google.com') || blob.includes('google account')) {
    return 'google';
  }
  if (
    /\[네이버\]|naver|네이버|mail\.naver\.com|navercorp/i.test(subject + from) ||
    /네이버|naver/i.test(snippet)
  ) {
    return 'naver';
  }
  if (/kakao|카카오|mail\.kakao/i.test(subject + from + snippet)) {
    return 'kakao';
  }
  return 'unknown';
}

/** 구글 보안 메일 요약 (기존 로직) */
function summarizeGoogleSecurityEmail(raw: string, device?: string): string {
  const loc =
    extractFirstRegex(raw, /(?:Location|위치)[:：]?\s*([^\n<]+)/i) ??
    extractFirstRegex(raw, /(?:from|에서)\s+([A-Za-z가-힣\s]+)/i);
  const dev = device ?? extractFirstRegex(raw, /Device[:：]?\s*([^\n<]+)/i);
  if (dev && loc) return `${dev.trim()} · ${loc.trim()}`;
  if (dev) return dev.trim();
  return formatRecordSummary(raw);
}

/**
 * 네이버 보안 알림(본문/제목) 파싱 뼈대 — 포워딩된 메일 형식에 맞춰 정규식 확장 예정
 * 예: '[네이버] 새로운 기기에서 로그인', IP·지역·기기명 추출
 */
export function parseNaverSecurityAlert(subject: string, bodyText: string): {
  summary: string;
  ip?: string;
  deviceHint?: string;
  locationHint?: string;
} {
  const combined = `${subject}\n${bodyText}`;
  const ip = extractFirstRegex(combined, /(\d{1,3}(?:\.\d{1,3}){3})/) ?? undefined;
  const deviceHint =
    extractFirstRegex(combined, /(?:기기|디바이스|Device)[:：\s]*([^\n<]+)/i) ??
    extractFirstRegex(combined, /(?:모델|Model)[:：\s]*([^\n<]+)/i) ??
    undefined;
  const locationHint =
    extractFirstRegex(combined, /(?:접속\s*지역|위치|Location)[:：\s]*([^\n<]+)/i) ??
    extractFirstRegex(combined, /([가-힣]+(?:시|도))\s*([가-힣]+(?:구|군|시))?/) ??
    undefined;

  let summary = subject.trim() || '네이버 보안 알림';
  if (deviceHint) summary = `${summary} · ${deviceHint.trim()}`;
  else if (locationHint && typeof locationHint === 'string') summary = `${summary} · ${String(locationHint).trim()}`;

  return { summary: formatRecordSummary(summary), ip, deviceHint: deviceHint ?? undefined, locationHint: locationHint ?? undefined };
}

/**
 * 카카오 보안 알림 파싱 뼈대 — '[Kakao] 로그인 알림' 등 제목·본문 패턴 확장 예정
 */
export function parseKakaoSecurityAlert(subject: string, bodyText: string): {
  summary: string;
  ip?: string;
  deviceHint?: string;
} {
  const combined = `${subject}\n${bodyText}`;
  const ip = extractFirstRegex(combined, /(\d{1,3}(?:\.\d{1,3}){3})/) ?? undefined;
  const deviceHint =
    extractFirstRegex(combined, /(?:기기|OS|Device)[:：\s]*([^\n<]+)/i) ?? extractFirstRegex(combined, /(iOS|Android[^<\n]*)/i) ?? undefined;

  let summary = subject.trim() || '카카오 보안 알림';
  if (deviceHint) summary = `${summary} · ${String(deviceHint).trim()}`;

  return { summary: formatRecordSummary(summary), ip, deviceHint: deviceHint ?? undefined };
}

type GmailPart = {
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string };
  parts?: GmailPart[];
};

function walkParts(part: GmailPart | undefined, sink: (s: string) => void): void {
  if (!part) return;
  if (part.body && typeof part.body.data === 'string') {
    sink(base64UrlDecode(part.body.data));
  }
  if (Array.isArray(part.parts)) {
    for (const p of part.parts) walkParts(p, sink);
  }
}

function collectBodyText(payload: GmailPart | undefined, snippet: string): string {
  let body = '';
  walkParts(payload, (chunk) => {
    body += chunk;
  });
  return body || snippet || '';
}

async function resolveCoordinates(
  bodyText: string,
  platform: SecurityPlatform,
  geocodingApiKey?: string,
): Promise<{ latitude?: number; longitude?: number }> {
  const coordMatch = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/.exec(bodyText);
  if (coordMatch) {
    return { latitude: Number(coordMatch[1]), longitude: Number(coordMatch[2]) };
  }
  const locPatterns: RegExp[] = [
    /Location[:]?\s*([\w\s,\-가-힣]+)/i,
    /(?:접속\s*지역|위치)[:：\s]*([^\n<]+)/i,
    /(?:국가|지역)[:：\s]*([^\n<]+)/i,
  ];
  if (!geocodingApiKey) return {};
  for (const rx of locPatterns) {
    const locStr = extractFirstRegex(bodyText, rx);
    if (locStr) {
      try {
        const loc = await geocode(locStr.trim(), geocodingApiKey);
        return { latitude: loc.lat, longitude: loc.lng };
      } catch {
        // try next
      }
    }
  }
  void platform;
  return {};
}

/**
 * Gmail 메시지 JSON → LogBoxRecord (플랫폼별 파서로 확장 가능한 단일 진입점)
 */
export async function gmailMessageToLogRecord(
  msgJson: { id: string; snippet?: string; payload?: GmailPart },
  geocodingApiKey?: string,
): Promise<LogBoxRecord> {
  const headers: Record<string, string> = {};
  const headerList = msgJson.payload?.headers;
  if (Array.isArray(headerList)) {
    for (const h of headerList) {
      headers[h.name.toLowerCase()] = h.value;
    }
  }

  const subject = headers.subject ?? '';
  const from = headers.from ?? '';
  const bodyText = collectBodyText(msgJson.payload, msgJson.snippet ?? '');
  const platform = detectSecurityPlatform(subject, from, msgJson.snippet ?? '');

  let raw = '';
  let ip: string | undefined;
  let deviceName: string | undefined;

  if (platform === 'google') {
    ip = extractFirstRegex(bodyText, /(\d{1,3}(?:\.\d{1,3}){3})/) ?? undefined;
    deviceName =
      extractFirstRegex(bodyText, /Device[:]?\s*([\w\s\-\(\)]+)/i) ??
      extractFirstRegex(bodyText, /<strong>Device<\/strong>:\s*([^<\n]+)/i) ??
      undefined;
    raw = summarizeGoogleSecurityEmail(bodyText, deviceName);
  } else if (platform === 'naver') {
    const parsed = parseNaverSecurityAlert(subject, bodyText);
    ip = parsed.ip;
    deviceName = parsed.deviceHint;
    raw = parsed.summary;
  } else if (platform === 'kakao') {
    const parsed = parseKakaoSecurityAlert(subject, bodyText);
    ip = parsed.ip;
    deviceName = parsed.deviceHint;
    raw = parsed.summary;
  } else {
    raw = formatRecordSummary(subject || bodyText || msgJson.snippet);
    ip = extractFirstRegex(bodyText, /(\d{1,3}(?:\.\d{1,3}){3})/) ?? undefined;
  }

  raw = escapeHtml(raw);
  deviceName = deviceName ? escapeHtml(deviceName) : undefined;

  const { latitude, longitude } = await resolveCoordinates(bodyText, platform, geocodingApiKey);

  const timeISO = headers.date ? new Date(headers.date).toISOString() : undefined;

  return {
    id: msgJson.id,
    platform,
    ip,
    latitude,
    longitude,
    device: deviceName
      ? { id: `device-${msgJson.id}`, name: deviceName, trusted: false, lastSeen: timeISO }
      : undefined,
    timeISO,
    threatLevel: getThreatLevel(0),
    raw,
  };
}

export async function fetchSecurityEmails(accessToken: string, geocodingApiKey?: string): Promise<LogBoxRecord[]> {
  const q = buildGmailSecurityListQuery();
  const listUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${MAX_MESSAGES}&q=${encodeURIComponent(q)}`;
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!listRes.ok) {
    const errText = await listRes.text().catch(() => '');
    throw new Error(`Gmail 목록 조회 실패 (${listRes.status})${errText ? `: ${errText.slice(0, 120)}` : ''}`);
  }
  const listJson = await listRes.json();
  if (!Array.isArray(listJson.messages)) return [];

  const records: LogBoxRecord[] = [];

  for (const msg of listJson.messages as Array<{ id: string }>) {
    const msgRes = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!msgRes.ok) continue;
    const msgJson = await msgRes.json();
    records.push(await gmailMessageToLogRecord(msgJson, geocodingApiKey));
  }

  return records;
}
