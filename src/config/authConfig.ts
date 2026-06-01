// src/config/authConfig.ts
// ──────────────────────────────────────────────────
// 네이버 OAuth 2.0 및 로컬 저장소 환경 설정 상수
// ──────────────────────────────────────────────────

export const NAVER_OAUTH_CONFIG = {
  CLIENT_ID: 'ixKgoLD_Sl',
  CALLBACK_URL: 'http://localhost:5173/oauth/callback/naver',
  STATE: 'logbox_state', // CSRF 방지용 state 값
} as const;

export const NAVER_STORAGE_KEYS = {
  connected: 'naver_connected',
  email: 'naver_user_email',
} as const;
