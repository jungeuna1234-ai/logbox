import axios from 'axios';
import { TrustedDevice } from '../types/index';
import { loadDecryptedSync, saveEncryptedSync, STORAGE_PASS } from '../services/cryptoService';

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

export function getTrustedDevices(): string[] {
  try {
    const decrypted = loadDecryptedSync<string[]>('trusted_devices', STORAGE_PASS);
    return decrypted || [];
  } catch {
    return [];
  }
}

export function addTrustedDeviceName(name: string): void {
  try {
    const list = getTrustedDevices();
    if (!list.includes(name)) {
      list.push(name);
      saveEncryptedSync('trusted_devices', list, STORAGE_PASS);
      
      // 백엔드 MongoDB에 신뢰 기기 이름 동기화 요청
      axios.post('/api/user/trusted-device-names', { name }).catch((err) => {
        console.error('[LogBox] Failed to add trusted device name to server:', err);
      });
    }
  } catch (e) {
    console.error(e);
  }
}

export function isDeviceTrusted(name?: string): boolean {
  if (!name) return false;
  const list = getTrustedDevices();
  return list.some((trustedName) => name.toLowerCase().includes(trustedName.toLowerCase()));
}
