import * as CryptoJS from 'crypto-js';

type EncryptedPayload = {
  saltHex: string;
  ivHex: string;
  ctBase64: string;
};

function pbkdf2Key(password: string, saltHex: string): CryptoJS.lib.WordArray {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  return CryptoJS.PBKDF2(password, salt, { keySize: 256 / 32, iterations: 10000 });
}

export async function saveEncrypted<T>(storageKey: string, data: T, password: string): Promise<void> {
  const salt = CryptoJS.lib.WordArray.random(128 / 8).toString(CryptoJS.enc.Hex);
  const key = pbkdf2Key(password, salt);
  const iv = CryptoJS.lib.WordArray.random(128 / 8);
  const plaintext = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv });

  const payload: EncryptedPayload = {
    saltHex: salt,
    ivHex: iv.toString(CryptoJS.enc.Hex),
    ctBase64: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
  };

  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

export async function loadDecrypted<T>(storageKey: string, password: string): Promise<T | null> {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  const payload: EncryptedPayload = JSON.parse(raw) as EncryptedPayload;
  const key = pbkdf2Key(password, payload.saltHex);
  const iv = CryptoJS.enc.Hex.parse(payload.ivHex);
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(payload.ctBase64) });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, { iv });
  const text = decrypted.toString(CryptoJS.enc.Utf8);
  if (!text) return null;
  return JSON.parse(text) as T;
}

// [FIX-03] 하드코딩 폴백 제거 — 환경 변수 필수화 + 세션 기반 임시 키
function resolveStoragePass(): string {
  const envSecret = ((import.meta.env as any).VITE_LOGBOX_STORAGE_SECRET as string | undefined)?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  if (typeof window !== 'undefined' && (import.meta.env as any).DEV) {
    console.warn(
      '[LogBox Security] VITE_LOGBOX_STORAGE_SECRET 환경 변수가 설정되지 않았습니다.\n' +
      '.env.local에 최소 16자 이상의 비밀 키를 설정하세요.\n' +
      '예: VITE_LOGBOX_STORAGE_SECRET=my-super-secret-key-32chars-long'
    );
  }

  // 세션 기반 임시 키 (탭 종료 시 소멸 → 보안성 향상)
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const SESSION_KEY = '__logbox_session_key__';
    let sessionKey = window.sessionStorage.getItem(SESSION_KEY);
    if (!sessionKey) {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      sessionKey = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
      window.sessionStorage.setItem(SESSION_KEY, sessionKey);
    }
    return sessionKey;
  }

  return 'logbox-ssr-fallback-' + Date.now();
}

export const STORAGE_PASS = resolveStoragePass();

export function saveEncryptedSync<T>(storageKey: string, data: T, password: string): void {
  const salt = CryptoJS.lib.WordArray.random(128 / 8).toString(CryptoJS.enc.Hex);
  const key = pbkdf2Key(password, salt);
  const iv = CryptoJS.lib.WordArray.random(128 / 8);
  const plaintext = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv });

  const payload: EncryptedPayload = {
    saltHex: salt,
    ivHex: iv.toString(CryptoJS.enc.Hex),
    ctBase64: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
  };

  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function loadDecryptedSync<T>(storageKey: string, password: string): T | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const payload: EncryptedPayload = JSON.parse(raw) as EncryptedPayload;
    const key = pbkdf2Key(password, payload.saltHex);
    const iv = CryptoJS.enc.Hex.parse(payload.ivHex);
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(payload.ctBase64) });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, { iv });
    const text = decrypted.toString(CryptoJS.enc.Utf8);
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
