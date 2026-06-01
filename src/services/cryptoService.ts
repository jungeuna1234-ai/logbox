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
