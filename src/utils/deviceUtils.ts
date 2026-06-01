import { TrustedDevice, SecurityPlatform } from '../types/index';

export function getCurrentDeviceFingerprint(): string {
  if (typeof navigator === 'undefined') return 'unknown-device';
  return `${navigator.userAgent}|${navigator.language}|${screen.width}x${screen.height}`;
}

function parseOs(ua: string): string {
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown OS';
}

function parseBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  return 'Browser';
}

function parseModel(ua: string, os: string): string {
  if (os === 'Android') {
    const m = /Android[^;]*;\s*([^)]+)\)/i.exec(ua);
    if (m?.[1]) return m[1].trim();
  }
  if (os === 'iOS') {
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
  }
  if (os === 'Windows' || os === 'macOS') return 'Desktop';
  return 'Unknown';
}

/** 현재 브라우저 기준 TrustedDevice 생성 */
export function buildCurrentTrustedDevice(): TrustedDevice {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const os = parseOs(ua);
  const browser = parseBrowser(ua);
  const model = parseModel(ua, os);
  const now = new Date().toISOString();
  const id = getCurrentDeviceFingerprint();

  return {
    id,
    name: `${model} · ${browser}`,
    model,
    os,
    browser,
    isCurrent: true,
    lastActive: now,
    lastSeen: now,
    trusted: true,
  };
}

export function formatDeviceLabel(d: TrustedDevice): string {
  if (d.model && d.browser) return `${d.model} · ${d.browser}`;
  return d.name;
}

export function getDeviceLastActive(d: TrustedDevice): string | undefined {
  return d.lastActive ?? d.lastSeen;
}

export interface ParsedDeviceInfo {
  platform: SecurityPlatform;
  deviceModel: string;
}

export function parseDeviceAndPlatform(text: string): ParsedDeviceInfo {
  if (!text) {
    return { platform: 'unknown', deviceModel: '알 수 없는 기기' };
  }

  // 1. 플랫폼 판별
  let platform: SecurityPlatform = 'unknown';
  const lowerText = text.toLowerCase();
  if (lowerText.includes('google')) {
    platform = 'google';
  } else if (lowerText.includes('naver') || lowerText.includes('네이버')) {
    platform = 'naver';
  } else if (lowerText.includes('kakao') || lowerText.includes('카카오')) {
    platform = 'kakao';
  }

  // 2. 기기명 판별 (우선순위에 따라 매칭)
  let deviceModel = '';

  // 갤럭시 모델명 특화 매칭
  // SM-S916N 등 구체적인 모델명 확인
  const smModelMatch = text.match(/SM-[A-Z0-9]+/i);
  if (smModelMatch) {
    const modelCode = smModelMatch[0].toUpperCase();
    if (modelCode.includes('S916') || modelCode.includes('S911') || modelCode.includes('S918')) {
      deviceModel = 'Galaxy S23';
    } else if (modelCode.includes('S901') || modelCode.includes('S906') || modelCode.includes('S908')) {
      deviceModel = 'Galaxy S22';
    } else if (modelCode.includes('S921') || modelCode.includes('S926') || modelCode.includes('S928')) {
      deviceModel = 'Galaxy S24';
    } else if (modelCode.includes('G991') || modelCode.includes('G996') || modelCode.includes('G998')) {
      deviceModel = 'Galaxy S21';
    } else if (modelCode.includes('N980') || modelCode.includes('N981') || modelCode.includes('N985') || modelCode.includes('N986')) {
      deviceModel = 'Galaxy Note 20';
    } else {
      deviceModel = `Galaxy (${modelCode})`;
    }
  } else if (/Galaxy|갤럭시/i.test(text)) {
    // 텍스트에 갤럭시/Galaxy가 포함되어 있는 경우
    if (/S23/i.test(text)) {
      deviceModel = 'Galaxy S23';
    } else if (/S22/i.test(text)) {
      deviceModel = 'Galaxy S22';
    } else if (/S24/i.test(text)) {
      deviceModel = 'Galaxy S24';
    } else if (/S21/i.test(text)) {
      deviceModel = 'Galaxy S21';
    } else {
      deviceModel = 'Galaxy S23'; // 기본 예시로 Galaxy S23 매핑 또는 Galaxy Phone
    }
  } else if (/iPhone/i.test(text)) {
    // iPhone인 경우, 뒤에 숫자가 오는지 확인
    const iphoneMatch = text.match(/iPhone\s*(\d+)/i);
    if (iphoneMatch) {
      deviceModel = `iPhone ${iphoneMatch[1]}`;
    } else {
      deviceModel = 'iPhone';
    }
  } else if (/iPad/i.test(text)) {
    deviceModel = 'iPad';
  } else if (/Windows/i.test(text)) {
    deviceModel = 'Windows PC';
  } else if (/Macintosh|Mac OS|macOS|MacBook/i.test(text)) {
    deviceModel = 'Mac';
  } else if (/Linux/i.test(text)) {
    deviceModel = 'Linux PC';
  } else if (/Android/i.test(text)) {
    deviceModel = 'Android Phone';
  } else {
    // 만약 "Device: Chrome" 같은 형식이 있을 경우
    const deviceMatch = text.match(/(?:Device|기기|디바이스|모델)[:：\s]+([^\n\r·•,;[\]]+)/i);
    if (deviceMatch && deviceMatch[1]) {
      const candidate = deviceMatch[1].trim();
      // 이미지 태그나 불필요한 줄글 제거
      const cleaned = candidate.replace(/\[image:[^\]]+\]/gi, '').trim();
      if (cleaned && cleaned.length < 30) {
        deviceModel = cleaned;
      }
    }
  }

  if (!deviceModel) {
    deviceModel = '알 수 없는 기기';
  }

  return { platform, deviceModel };
}
