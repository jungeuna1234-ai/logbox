/**
 * Google Cloud Console > 사용자 인증 정보 > OAuth 2.0 클라이언트 ID (웹)
 * 형식: 숫자-문자열.apps.googleusercontent.com
 */
const WEB_CLIENT_ID_PATTERN = /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/;

/** 문서/예시용 ID — 형식은 맞지만 Google에 존재하지 않아 invalid_client 발생 */
const PLACEHOLDER_CLIENT_IDS = new Set([
  'YOUR_GOOGLE_CLIENT_ID',
  '123456789-xxxx.apps.googleusercontent.com',
  '000000000000-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com',
]);

export function getGoogleClientId(): string {
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (raw === undefined || raw === null || raw === '' || raw.includes('YOUR_GOOGLE_CLIENT_ID')) {
    return '468667237419-3sk9i6nlrpfl5i6f1f283boam8rfr948.apps.googleusercontent.com';
  }
  return String(raw).trim().replace(/^['"]|['"]$/g, '');
}

export function isPlaceholderClientId(id: string): boolean {
  if (!id) return false;
  if (id === '468667237419-3sk9i6nlrpfl5i6f1f283boam8rfr948.apps.googleusercontent.com') return false;
  if (PLACEHOLDER_CLIENT_IDS.has(id)) return true;
  if (/^123456789-/.test(id)) return true;
  if (/^000000000000-/.test(id)) return true;
  if (id.includes('xxxx') || id.includes('your-client-id')) return true;
  return false;
}

export function validateGoogleClientIdFormat(id: string): boolean {
  if (!id || isPlaceholderClientId(id)) return false;
  return WEB_CLIENT_ID_PATTERN.test(id);
}

export function isGoogleOAuthConfigured(): boolean {
  return validateGoogleClientIdFormat(getGoogleClientId());
}

/** 로그인 화면 등에서 표시할 설정 안내 */
export function getGoogleClientIdSetupHint(): string | null {
  const id = getGoogleClientId();
  if (!id) {
    return '프로젝트 루트 .env.local 에 VITE_GOOGLE_CLIENT_ID=실제웹클라이언트ID 를 넣고 npm run dev 를 재시작하세요.';
  }
  if (isPlaceholderClientId(id)) {
    return '지금 .env.local 에 예시용 가짜 ID(123456789-xxxx…)가 들어 있습니다. Google Cloud Console에서 복사한 실제 웹 클라이언트 ID로 바꿔 주세요. (이대로면 401 invalid_client · flowName=GeneralOAuthFlow 가 납니다)';
  }
  if (!id.includes('.apps.googleusercontent.com')) {
    return '클라이언트 ID는 …apps.googleusercontent.com 형태여야 합니다. 따옴표·공백·오타를 확인하세요.';
  }
  if (!WEB_CLIENT_ID_PATTERN.test(id)) {
    return '클라이언트 ID 형식이 올바르지 않습니다. Google Cloud Console의 웹 클라이언트 ID를 그대로 복사했는지 확인하세요.';
  }
  return null;
}
