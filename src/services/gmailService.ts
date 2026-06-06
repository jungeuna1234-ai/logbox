import type { LogBoxRecord, SecurityPlatform } from '../types/index';
import { getThreatLevel } from '../utils/geoUtils';
import { formatRecordSummary } from '../utils/recordUtils';
import { geocode } from './geocodingService';
import { isDeviceTrusted } from '../utils/deviceUtils';
import { sanitizeToPlainText } from '../utils/sanitize';

export function isValidIp(ipStr: string): boolean {
  const parts = ipStr.split('.');
  if (parts.length !== 4) return false;
  
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) return false;
    // 마디가 1자리를 초과하면서 '0'으로 시작하는 경우(예: '05.28...' 등 날짜/버전 번호) 오인 차단
    if (part.length > 1 && part.startsWith('0')) return false;
  }
  return true;
}

export function extractFirstIp(text: string): string | null {
  const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
  let match;
  while ((match = ipRegex.exec(text)) !== null) {
    if (isValidIp(match[0])) {
      return match[0];
    }
  }
  return null;
}

const MAX_MESSAGES = 20;

function extractDomain(text: string): string | undefined {
  const urlRegex = /(https?:\/\/[^\s/$.?#].[^\s]*)/gi;
  const match = text.match(urlRegex);
  if (match && match[0]) {
    try {
      const url = new URL(match[0]);
      return url.hostname;
    } catch {
      const hostMatch = match[0].match(/https?:\/\/([^\/\s]+)/i);
      return hostMatch ? hostMatch[1] : undefined;
    }
  }
  const domainRegex = /\b([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/i;
  const domainMatch = text.match(domainRegex);
  return domainMatch ? domainMatch[1] : undefined;
}

/** Gmail 검색: 외부 서비스 및 구글/네이버/카카오의 로그인 관련 보안 메일 (최근 30일) */
export function buildGmailSecurityListQuery(): string {
  return '보안 OR 로그인 OR 인증 OR security OR login';
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

/** 수집된 이메일의 발신 주소(From) 및 제목(Subject) 메타데이터를 분석하여 실제 서비스 명칭을 판별하는 '플랫폼 식별 매핑 헬퍼' */
export function detectPlatform(from: string, subject: string): SecurityPlatform {
  const combined = `${from} ${subject}`.toLowerCase();
  
  if (combined.includes('github') || combined.includes('깃허브')) {
    return 'github';
  }
  if (combined.includes('openai') || combined.includes('chatgpt')) {
    return 'openai';
  }
  if (combined.includes('tryhackme')) {
    return 'tryhackme';
  }
  if (combined.includes('mangoboard') || combined.includes('망고보드')) {
    return 'mangoboard';
  }
  if (combined.includes('instagram') || combined.includes('인스타그램')) {
    return 'instagram';
  }
  if (combined.includes('discord') || combined.includes('디스코드')) {
    return 'discord';
  }
  if (combined.includes('netflix') || combined.includes('넷플릭스')) {
    return 'netflix';
  }
  if (combined.includes('facebook') || combined.includes('페이스북')) {
    return 'facebook';
  }
  if (combined.includes('pinterest') || combined.includes('핀터레스트')) {
    return 'pinterest';
  }
  if (combined.includes('lilys') || combined.includes('릴리스') || combined.includes('릴리즈')) {
    return 'lilys';
  }
  if (combined.includes('steam') || combined.includes('스팀')) {
    return 'steam';
  }
  if (combined.includes('cursor.sh') || combined.includes('cursor.com') || combined.includes('cursor')) {
    return 'cursor';
  }
  if (combined.includes('accounts.google.com') || combined.includes('google.com') || combined.includes('google') || combined.includes('구글')) {
    return 'google';
  }
  if (combined.includes('mail.naver.com') || combined.includes('naver.com') || combined.includes('navercorp') || combined.includes('naver') || combined.includes('네이버')) {
    return 'naver';
  }
  if (combined.includes('mail.kakao.com') || combined.includes('kakao.com') || combined.includes('kakao') || combined.includes('카카오')) {
    return 'kakao';
  }
  return 'unknown';
}

/** 제목·발신·스니펫으로 플랫폼 추정 */
export function detectSecurityPlatform(subject: string, from: string, snippet: string): SecurityPlatform {
  const plat = detectPlatform(from, subject);
  if (plat !== 'unknown') return plat;

  const blob = snippet.toLowerCase();
  if (blob.includes('github') || blob.includes('깃허브')) return 'github';
  if (blob.includes('openai') || blob.includes('chatgpt')) return 'openai';
  if (blob.includes('tryhackme')) return 'tryhackme';
  if (blob.includes('mangoboard') || blob.includes('망고보드')) return 'mangoboard';
  if (blob.includes('instagram') || blob.includes('인스타그램')) return 'instagram';
  if (blob.includes('discord') || blob.includes('디스코드')) return 'discord';
  if (blob.includes('netflix') || blob.includes('넷플릭스')) return 'netflix';
  if (blob.includes('facebook') || blob.includes('페이스북')) return 'facebook';
  if (blob.includes('pinterest') || blob.includes('핀터레스트')) return 'pinterest';
  if (blob.includes('lilys') || blob.includes('릴리스') || blob.includes('릴리즈')) return 'lilys';
  if (blob.includes('steam') || blob.includes('스팀')) return 'steam';
  if (blob.includes('cursor') || blob.includes('커서')) return 'cursor';
  if (blob.includes('google') || blob.includes('구글')) return 'google';
  if (blob.includes('naver') || blob.includes('네이버')) return 'naver';
  if (blob.includes('kakao') || blob.includes('카카오')) return 'kakao';
  
  return 'unknown';
}

/** 외부 서비스 보안 알림 파서 */
export function parseExternalSecurityAlert(
  platform: SecurityPlatform,
  subject: string,
  bodyText: string
): {
  summary: string;
  ip?: string;
  deviceHint?: string;
  locationHint?: string;
} {
  const combined = `${subject}\n${bodyText}`;
  const ip = extractFirstIp(combined) ?? undefined;
  
  // Extract device
  let deviceHint = undefined;
  if (/chrome/i.test(combined)) deviceHint = 'Chrome';
  else if (/safari/i.test(combined)) deviceHint = 'Safari';
  else if (/firefox/i.test(combined)) deviceHint = 'Firefox';
  else if (/iphone/i.test(combined)) deviceHint = 'iPhone';
  else if (/android/i.test(combined)) deviceHint = 'Android';
  else if (/windows/i.test(combined)) deviceHint = 'Windows';
  else if (/mac/i.test(combined)) deviceHint = 'Mac';
  
  // Extract location
  let locationHint = undefined;
  const locMatch = combined.match(/(?:위치|지역|location|near)[:：\s]*([가-힣\w\s]+(?:시|도|군|구|국가|country)?)/i);
  if (locMatch && locMatch[1]) {
    locationHint = locMatch[1].trim();
  }
  if (!locationHint) {
    if (/korea|한국|서울/i.test(combined)) locationHint = '서울';
    else if (/china|중국/i.test(combined)) locationHint = '중국';
    else if (/usa|united states|미국/i.test(combined)) locationHint = '미국';
    else if (/russia|러시아/i.test(combined)) locationHint = '러시아';
  }

  // Format platform name for 1020 friendly look
  let platformName = '외부 서비스';
  if (platform === 'instagram') platformName = '인스타그램';
  else if (platform === 'discord') platformName = '디스코드';
  else if (platform === 'netflix') platformName = '넷플릭스';
  else if (platform === 'steam') platformName = '스팀';
  else if (platform === 'facebook') platformName = '페이스북';
  else if (platform === 'pinterest') platformName = '핀터레스트';
  else if (platform === 'lilys') platformName = 'Lilys AI';
  else if (platform === 'github') platformName = 'GitHub';
  else if (platform === 'openai') platformName = 'OpenAI';
  else if (platform === 'tryhackme') platformName = 'TryHackMe';
  else if (platform === 'mangoboard') platformName = '망고보드';
  else if (platform === 'cursor') platformName = 'Cursor';

  const origin = locationHint || '알 수 없음';
  const dest = '서울'; // user default location

  const summary = `[${platformName}] 로그인 감지 · ${origin} → ${dest}`;
  
  return {
    summary: formatRecordSummary(summary),
    ip,
    deviceHint,
    locationHint
  };
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
  const ip = extractFirstIp(combined) ?? undefined;
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
  const ip = extractFirstIp(combined) ?? undefined;
  const deviceHint =
    extractFirstRegex(combined, /(?:기기|OS|Device)[:：\s]*([^\n<]+)/i) ?? extractFirstRegex(combined, /(iOS|Android[^<\n]*)/i) ?? undefined;

  let summary = subject.trim() || '카카오 보안 알림';
  if (deviceHint) summary = `${summary} · ${String(deviceHint).trim()}`;

  return { summary: formatRecordSummary(summary), ip, deviceHint: deviceHint ?? undefined };
}

type GmailPart = {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string };
  parts?: GmailPart[];
};

function findPartsByMimeType(part: GmailPart | undefined, mimeType: string, list: GmailPart[] = []): GmailPart[] {
  if (!part) return list;
  if (part.mimeType === mimeType && part.body?.data) {
    list.push(part);
  }
  if (Array.isArray(part.parts)) {
    for (const p of part.parts) {
      findPartsByMimeType(p, mimeType, list);
    }
  }
  return list;
}

export function sanitizeHtmlAndLegalese(text: string): string {
  const lines = text.split(/\r?\n/);
  const cleanLines: string[] = [];
  
  const blacklistKeywords = [
    'privacy policy', 'terms of service', 'unsubscribe', '수신거부', '수신 거부',
    'copyright', 'all rights reserved', 'amphitheatre parkway',
    '자동 발송', '자동발송', 'reply', 'no-reply', 'noreply',
    '이용약관', '개인정보처리방침', '개인정보 처리방침', '책임 한계와 법적고지', '법적 고지',
    '모든 권리', '소유권'
  ];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Normalize spacing
    line = line.replace(/\s+/g, ' ');

    const lineLower = line.toLowerCase();
    
    const isBlacklisted = blacklistKeywords.some(keyword => lineLower.includes(keyword));
    if (isBlacklisted) continue;

    // Strip any HTML tags that might have seeped in
    line = line.replace(/<[^>]+>/g, ' ');

    // Skip lines that look like CSS or Javascript blocks or XML tags
    if (line.length > 250 || /[{}:;@#]/.test(line)) {
      continue;
    }

    cleanLines.push(line.trim());
  }

  let result = cleanLines.join('\n').trim();

  // Fallback to avoid empty output
  if (!result) {
    result = lines
      .map(l => l.trim())
      .filter(l => l && !/[{}:;@#]/.test(l) && l.length < 150)
      .slice(0, 3)
      .join('\n');
  }

  return result;
}

export function cleanHtmlToText(html: string): string {
  // [FIX-07] DOMPurify 기반 안전한 텍스트 변환 후 법적 고지 제거
  try {
    const plainText = sanitizeToPlainText(html);
    return sanitizeHtmlAndLegalese(plainText);
  } catch {
    // 폴백: 기존 정규식 방식
    let text = html;
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return sanitizeHtmlAndLegalese(text);
  }
}

function collectBodyText(payload: GmailPart | undefined, snippet: string): string {
  if (!payload) return snippet || '';

  const plainParts = findPartsByMimeType(payload, 'text/plain');
  if (plainParts.length > 0) {
    let body = '';
    for (const p of plainParts) {
      if (p.body?.data) {
        try {
          body += base64UrlDecode(p.body.data);
        } catch (e) {
          console.warn('[LogBox] Failed to decode plain text part', e);
        }
      }
    }
    if (body.trim()) {
      return sanitizeHtmlAndLegalese(body);
    }
  }

  const htmlParts = findPartsByMimeType(payload, 'text/html');
  if (htmlParts.length > 0) {
    let htmlContent = '';
    for (const p of htmlParts) {
      if (p.body?.data) {
        try {
          htmlContent += base64UrlDecode(p.body.data);
        } catch (e) {
          console.warn('[LogBox] Failed to decode html part', e);
        }
      }
    }
    if (htmlContent.trim()) {
      return cleanHtmlToText(htmlContent);
    }
  }

  return snippet || '';
}

function collectRawBodyText(payload: GmailPart | undefined, snippet: string): string {
  if (!payload) return snippet || '';

  const plainParts = findPartsByMimeType(payload, 'text/plain');
  if (plainParts.length > 0) {
    let body = '';
    for (const p of plainParts) {
      if (p.body?.data) {
        try {
          body += base64UrlDecode(p.body.data);
        } catch (e) {
          console.warn('[LogBox] Failed to decode plain text part', e);
        }
      }
    }
    if (body.trim()) {
      return body;
    }
  }

  const htmlParts = findPartsByMimeType(payload, 'text/html');
  if (htmlParts.length > 0) {
    let htmlContent = '';
    for (const p of htmlParts) {
      if (p.body?.data) {
        try {
          htmlContent += base64UrlDecode(p.body.data);
        } catch (e) {
          console.warn('[LogBox] Failed to decode html part', e);
        }
      }
    }
    if (htmlContent.trim()) {
      return cleanHtmlToRawText(htmlContent);
    }
  }

  return snippet || '';
}

function cleanHtmlToRawText(html: string): string {
  let text = html;
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
    
  return text;
}

// isValidIp is moved to the top of the file

// [FIX-11] 이메일 발신자 인증 검증 (SPF/DKIM/DMARC)
export type EmailAuthResult = {
  spf: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'unknown';
  dkim: 'pass' | 'fail' | 'none' | 'unknown';
  dmarc: 'pass' | 'fail' | 'none' | 'unknown';
  isAuthentic: boolean;
};

function parseAuthStatus(value: string, protocol: string): string {
  const regex = new RegExp(`${protocol}=(\\w+)`, 'i');
  const match = value.match(regex);
  return match ? match[1].toLowerCase() : 'unknown';
}

export function checkEmailAuthenticity(
  headers: Array<{ name: string; value: string }>
): EmailAuthResult {
  const authHeader = headers.find(
    h => h.name.toLowerCase() === 'authentication-results'
  );

  if (!authHeader) {
    return { spf: 'unknown', dkim: 'unknown', dmarc: 'unknown', isAuthentic: false };
  }

  const value = authHeader.value;
  const spf = parseAuthStatus(value, 'spf') as EmailAuthResult['spf'];
  const dkim = parseAuthStatus(value, 'dkim') as EmailAuthResult['dkim'];
  const dmarc = parseAuthStatus(value, 'dmarc') as EmailAuthResult['dmarc'];

  return {
    spf,
    dkim,
    dmarc,
    isAuthentic: spf === 'pass' && dkim === 'pass' && dmarc === 'pass',
  };
}

export function extractIpPreflight(
  msgJson: { payload?: GmailPart; snippet?: string },
  rawBodyText: string,
  platform: SecurityPlatform
): { ip: string; isServerVerified: boolean } {
  const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;

  // 1. 헤더 영역 선 검사 (Received, X-Originating-IP 등)
  const headers = msgJson.payload?.headers || [];
  const headerIps: string[] = [];
  
  for (const header of headers) {
    const nameLower = header.name.toLowerCase();
    if (nameLower === 'x-originating-ip' || nameLower === 'x-sender-ip' || nameLower === 'cf-connecting-ip') {
      const match = header.value.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/);
      if (match && isValidIp(match[0])) {
        headerIps.push(match[0]);
      }
    }
  }

  for (const header of headers) {
    const nameLower = header.name.toLowerCase();
    if (nameLower === 'received') {
      const matches = header.value.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g);
      if (matches) {
        for (const rip of matches) {
          if (isValidIp(rip)) {
            headerIps.push(rip);
          }
        }
      }
    }
  }

  const isPublicIp = (ipStr: string): boolean => {
    if (ipStr.startsWith('127.') || ipStr.startsWith('10.') || ipStr.startsWith('192.168.')) return false;
    if (ipStr.startsWith('172.')) {
      const secondOctet = parseInt(ipStr.split('.')[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return false;
    }
    return true;
  };

  const publicHeaderIps = headerIps.filter(isPublicIp);

  // 본문 및 스니펫에서 IP 매칭
  const bodyIps: string[] = [];
  let m;
  while ((m = ipRegex.exec(rawBodyText)) !== null) {
    if (isValidIp(m[0]) && isPublicIp(m[0])) {
      bodyIps.push(m[0]);
    }
  }

  const snippetIps: string[] = [];
  const snippetMatch = (msgJson.snippet ?? '').match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g);
  if (snippetMatch) {
    for (const rip of snippetMatch) {
      if (isValidIp(rip) && isPublicIp(rip)) {
        snippetIps.push(rip);
      }
    }
  }

  // Type A 플랫폼 판별
  const isTypeA = platform === 'google' || platform === 'github' || platform === 'cursor' || platform === 'naver' || platform === 'kakao' || platform === 'instagram' || platform === 'discord' || platform === 'netflix' || platform === 'steam' || platform === 'facebook' || platform === 'pinterest' || platform === 'lilys';

  if (isTypeA) {
    if (bodyIps.length > 0) {
      return { ip: bodyIps[0], isServerVerified: false };
    }
    if (snippetIps.length > 0) {
      return { ip: snippetIps[0], isServerVerified: false };
    }
    if (publicHeaderIps.length > 0) {
      return { ip: publicHeaderIps[publicHeaderIps.length - 1], isServerVerified: false };
    }
  } else {
    // Type B (MangoBoard, OpenAI) 또는 unknown: 헤더에서 공식 발신 서버 IP 추출 우선
    if (publicHeaderIps.length > 0) {
      return { ip: publicHeaderIps[0], isServerVerified: true };
    }
    if (bodyIps.length > 0) {
      return { ip: bodyIps[0], isServerVerified: false };
    }
    if (snippetIps.length > 0) {
      return { ip: snippetIps[0], isServerVerified: false };
    }
  }

  return { ip: '플랫폼 미제공', isServerVerified: false };
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

  // Custom mock coordinates for common threat/login locations
  const combined = bodyText.toLowerCase();
  if (combined.includes('russia') || combined.includes('러시아') || combined.includes('moscow')) {
    return { latitude: 55.7558, longitude: 37.6173 };
  }
  if (combined.includes('china') || combined.includes('중국') || combined.includes('beijing')) {
    return { latitude: 39.9042, longitude: 116.4074 };
  }
  if (combined.includes('usa') || combined.includes('미국') || combined.includes('new york')) {
    return { latitude: 40.7128, longitude: -74.0060 };
  }
  if (combined.includes('부산') || combined.includes('busan')) {
    return { latitude: 35.1796, longitude: 129.0756 };
  }
  if (combined.includes('인천') || combined.includes('incheon')) {
    return { latitude: 37.4563, longitude: 126.7052 };
  }
  if (combined.includes('서울') || combined.includes('seoul') || combined.includes('korea') || combined.includes('한국')) {
    return { latitude: 37.5665, longitude: 126.9780 };
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
  
  // 1. 플랫폼 식별 선행 진행
  const platform = detectSecurityPlatform(subject, from, msgJson.snippet ?? '');

  // 2. 본문 정제 전 원본 텍스트 획득
  const rawBodyText = collectRawBodyText(msgJson.payload, msgJson.snippet ?? '');

  // 3. 0순위: 선(先) 만능 정규식 파싱을 통한 무유실 IP 추출 및 Type A/B 분류
  const { ip, isServerVerified } = extractIpPreflight(msgJson, rawBodyText, platform);

  // [FIX-11] 이메일 인증 결과 검증 (SPF/DKIM/DMARC)
  const emailAuth = checkEmailAuthenticity(msgJson.payload?.headers || []);
  const isSpoofSuspect = !emailAuth.isAuthentic && emailAuth.spf === 'fail';

  // 4. UI 렌더링용 본문 정제 진행
  const bodyTextClean = sanitizeHtmlAndLegalese(rawBodyText);
  const bodyText = isSpoofSuspect
    ? `⚠️ [보안 경고: 발신자 인증 실패 (SPF=${emailAuth.spf}, DKIM=${emailAuth.dkim})] \n${bodyTextClean}`
    : bodyTextClean;

  // Extract domain first
  const domain = extractDomain(bodyText) || undefined;

  // 5. Device extraction using regex
  let deviceName: string | undefined = undefined;
  const deviceRegexes = [
    /(?:device|기기|디바이스|OS|기기명)[:：\s]+([^\n<·\(\)]+)/i,
    /([a-zA-Z]+\s*PC|[a-zA-Z]+\s*Phone|[a-zA-Z]+\s*Tablet|iPhone|iPad|MacBook|Android|Windows|macOS|Linux)/i
  ];
  for (const rx of deviceRegexes) {
    const match = bodyText.match(rx);
    if (match && match[1]) {
      deviceName = match[1].trim();
      break;
    }
  }

  if (!deviceName) {
    if (/chrome/i.test(bodyText)) deviceName = 'Chrome';
    else if (/safari/i.test(bodyText)) deviceName = 'Safari';
    else if (/firefox/i.test(bodyText)) deviceName = 'Firefox';
    else if (/iphone/i.test(bodyText)) deviceName = 'iPhone';
    else if (/android/i.test(bodyText)) deviceName = 'Android';
    else if (/windows/i.test(bodyText)) deviceName = 'Windows';
    else if (/mac/i.test(bodyText)) deviceName = 'Mac';
  }

  // Fallback Device
  if (!deviceName) {
    if (platform === 'instagram' || platform === 'kakao') {
      deviceName = 'iPhone';
    } else if (platform === 'cursor') {
      deviceName = 'Windows PC';
    } else if (isServerVerified) {
      deviceName = 'SMTP Server';
    } else {
      deviceName = 'Windows PC';
    }
  }

  // 6. Query GeoIP location from backend API
  let locationHint = '알 수 없음';
  let geoLatitude: number | undefined = undefined;
  let geoLongitude: number | undefined = undefined;
  if (ip && ip !== '플랫폼 미제공') {
    try {
      const geoRes = await fetch(`/api/geoip/${ip}`);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        locationHint = geoData.city || '알 수 없음';
        if (geoData.latitude !== undefined && geoData.longitude !== undefined) {
          geoLatitude = geoData.latitude;
          geoLongitude = geoData.longitude;
        }
      }
    } catch (err) {
      console.warn('[LogBox] GeoIP lookup failed', err);
    }
  }

  // Standardize Device Info
  let deviceOs = 'Windows';
  let deviceBrowser = 'Chrome';
  let deviceModel = 'Windows PC';

  if (deviceName) {
    if (/chrome/i.test(deviceName)) deviceBrowser = 'Chrome';
    else if (/safari/i.test(deviceName)) deviceBrowser = 'Safari';
    else if (/firefox/i.test(deviceName)) deviceBrowser = 'Firefox';
    else if (/edge/i.test(deviceName)) deviceBrowser = 'Edge';

    if (/windows/i.test(deviceName)) deviceOs = 'Windows';
    else if (/mac/i.test(deviceName) || /os x/i.test(deviceName)) deviceOs = 'macOS';
    else if (/iphone|ipad/i.test(deviceName)) deviceOs = 'iOS';
    else if (/android/i.test(deviceName)) deviceOs = 'Android';
    else if (/linux/i.test(deviceName)) deviceOs = 'Linux';

    deviceModel = deviceName.split(' · ')[0] || deviceName;
  }

  // Formulate standard raw summary
  let platformKo = '외부 서비스';
  if (platform === 'google') platformKo = '구글 계정';
  else if (platform === 'naver') platformKo = '네이버';
  else if (platform === 'kakao') platformKo = '카카오';
  else if (platform === 'instagram') platformKo = '인스타그램';
  else if (platform === 'discord') platformKo = '디스코드';
  else if (platform === 'netflix') platformKo = '넷플릭스';
  else if (platform === 'steam') platformKo = '스팀';
  else if (platform === 'facebook') platformKo = '페이스북';
  else if (platform === 'pinterest') platformKo = '핀터레스트';
  else if (platform === 'lilys') platformKo = 'Lilys AI';
  else if (platform === 'github') platformKo = 'GitHub';
  else if (platform === 'openai') platformKo = 'OpenAI';
  else if (platform === 'tryhackme') platformKo = 'TryHackMe';
  else if (platform === 'mangoboard') platformKo = '망고보드';
  else if (platform === 'cursor') platformKo = 'Cursor';

  const origin = locationHint;
  const dest = '서울';
  const raw = `[${platformKo}] 로그인 감지 · ${origin} → ${dest}`;

  let { latitude, longitude } = await resolveCoordinates(bodyText, platform, geocodingApiKey);
  if (geoLatitude !== undefined && geoLongitude !== undefined) {
    latitude = geoLatitude;
    longitude = geoLongitude;
  }

  const timeISO = headers.date ? new Date(headers.date).toISOString() : new Date().toISOString();

  return {
    id: msgJson.id,
    platform,
    ip,
    latitude,
    longitude,
    device: {
      id: `device-${msgJson.id}`,
      name: deviceName,
      model: deviceModel,
      os: deviceOs,
      browser: deviceBrowser,
      trusted: isDeviceTrusted(deviceName),
      lastSeen: timeISO,
      lastActive: timeISO,
      ip: ip,
      location: locationHint,
    },
    timeISO,
    threatLevel: undefined, // Let enrichThreatLevels calculate it dynamically!
    raw,
    body: bodyText,
    from: from,
    subject: subject,
    domain,
    snippet: msgJson.snippet,
    isServerVerified,
    authMode: isServerVerified ? 'TypeB' : 'TypeA',
  };
}

export async function fetchSecurityEmails(accessToken: string, geocodingApiKey?: string): Promise<LogBoxRecord[]> {
  try {
    const q = buildGmailSecurityListQuery();
    const listUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${encodeURIComponent(q)}`;
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!listRes.ok) {
      if (listRes.status === 401) {
        console.warn('[LogBox] Gmail API 401 Unauthorized (token expired or revoked).');
        localStorage.removeItem('gmail_token');
        return [];
      }
      const errText = await listRes.text().catch(() => '');
      throw new Error(`Gmail 목록 조회 실패 (${listRes.status})${errText ? `: ${errText.slice(0, 120)}` : ''}`);
    }
    const listJson = await listRes.json();
    if (!Array.isArray(listJson.messages)) return [];

    const records: LogBoxRecord[] = [];

    for (const msg of listJson.messages as Array<{ id: string }>) {
      try {
        const msgRes = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!msgRes.ok) continue;
        const msgJson = await msgRes.json();
        records.push(await gmailMessageToLogRecord(msgJson, geocodingApiKey));
      } catch (e) {
        console.error(`[LogBox] Failed to fetch message detail for ${msg.id}`, e);
      }
    }

    return records;
  } catch (err) {
    console.error('[LogBox] fetchSecurityEmails error:', err);
    return [];
  }
}
