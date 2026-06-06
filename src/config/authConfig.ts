// src/config/authConfig.ts
// ──────────────────────────────────────────────────
// 네이버 OAuth 2.0 및 로컬 저장소 환경 설정 상수
// ──────────────────────────────────────────────────

export const NAVER_OAUTH_CONFIG = {
  CLIENT_ID: '9pstr6cexosS8yhrPmu9',
  CALLBACK_URL: (import.meta.env.VITE_NAVER_CALLBACK_URL as string) || (typeof window !== 'undefined'
    ? `${window.location.origin}/oauth/callback/naver`
    : 'http://localhost:5173/oauth/callback/naver'),
} as const;

export function generateOAuthState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const state = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem('naver_oauth_state', state);
  }
  return state;
}

export function verifyOAuthState(receivedState: string | null): boolean {
  if (!receivedState) return false;
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  const storedState = window.sessionStorage.getItem('naver_oauth_state');
  window.sessionStorage.removeItem('naver_oauth_state'); // 1회용 소비
  return !!storedState && storedState === receivedState;
}

export const NAVER_STORAGE_KEYS = {
  connected: 'naver_connected',
  email: 'naver_user_email',
} as const;
