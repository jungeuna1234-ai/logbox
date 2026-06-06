// src/hooks/useNaverAuth.ts
// ──────────────────────────────────────────────────
// 네이버 OAuth 2.0 연동 상태 관리 커스텀 훅
// ──────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { NAVER_OAUTH_CONFIG, NAVER_STORAGE_KEYS, generateOAuthState } from '../config/authConfig';
import { loadDecryptedSync, STORAGE_PASS } from '../services/cryptoService';

export function useNaverAuth() {
  const [isNaverConnected, setIsNaverConnected] = useState<boolean>(false);
  const [naverEmail, setNaverEmail] = useState<string | null>(null);
  const [naverDisconnecting, setNaverDisconnecting] = useState<boolean>(false);

  // 컴포넌트 마운트 및 활성화 시 로컬 스토리지 데이터 동기화
  useEffect(() => {
    const connected = loadDecryptedSync<boolean>(NAVER_STORAGE_KEYS.connected, STORAGE_PASS) === true;
    const email = loadDecryptedSync<string>(NAVER_STORAGE_KEYS.email, STORAGE_PASS);

    setIsNaverConnected(connected);
    setNaverEmail(connected ? email : null);
  }, []);

  // 네이버 로그인 인증 페이지 리다이렉트 (에러 방지를 위해 템플릿 리터럴로 엄밀히 구성)
  const connectNaver = useCallback(() => {
    const clientId = NAVER_OAUTH_CONFIG.CLIENT_ID;
    const redirectUri = encodeURIComponent(NAVER_OAUTH_CONFIG.CALLBACK_URL);
    const state = encodeURIComponent(generateOAuthState());
    
    const authUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;

    window.location.href = authUrl;
  }, []);
  // 네이버 연동 해제
  const disconnectNaver = useCallback(async () => {
    if (naverDisconnecting) return;
    setNaverDisconnecting(true);

    try {
      // 800ms 네트워크 지연 시뮬레이션
      await new Promise<void>((resolve) => setTimeout(resolve, 800));

      localStorage.removeItem(NAVER_STORAGE_KEYS.connected);
      localStorage.removeItem(NAVER_STORAGE_KEYS.email);

      setIsNaverConnected(false);
      setNaverEmail(null);
    } finally {
      setNaverDisconnecting(false);
    }
  }, [naverDisconnecting]);

  return {
    isNaverConnected,
    naverEmail,
    naverDisconnecting,
    connectNaver,
    disconnectNaver,
  };
}
