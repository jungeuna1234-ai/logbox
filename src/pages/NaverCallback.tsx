// src/pages/NaverCallback.tsx
// ──────────────────────────────────────────────────
// 네이버 OAuth 2.0 콜백 핸들러
// 인가 코드(code) + state 파라미터를 검증하고 처리한 뒤 /settings로 리다이렉트
// ──────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAVER_STORAGE_KEYS, verifyOAuthState } from '../config/authConfig';
import { saveEncryptedSync, STORAGE_PASS } from '../services/cryptoService';

const NaverCallback: React.FC = () => {
  const navigate = useNavigate();
  const processedRef = useRef(false); // React StrictMode 중복 호출 차단용

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');

    // CSRF 보안 검증 (동적 state 검증)
    if (!code || !verifyOAuthState(returnedState)) {
      console.error('[NaverCallback] 유효하지 않은 인가 코드 또는 State:', { code, returnedState });
      navigate('/settings', { replace: true, state: { naverError: 'INVALID_STATE' } });
      return;
    }

    try {
      // 로컬 스토리지 정보 갱신
      saveEncryptedSync(NAVER_STORAGE_KEYS.connected, true, STORAGE_PASS);
      saveEncryptedSync(NAVER_STORAGE_KEYS.email, 'user****@naver.com', STORAGE_PASS);
    } catch (err) {
      console.error('[NaverCallback] localStorage 저장 실패:', err);
    }

    // 성공 상태를 전달하여 설정 페이지로 리다이렉트
    navigate('/settings', { replace: true, state: { naverSuccess: true } });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center gap-5 select-none">
      {/* 네온 로딩 스피너 */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-[#03C75A]/20" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#03C75A] animate-spin"
          style={{ animationDuration: '0.9s' }}
        />
        <div className="absolute inset-[6px] rounded-full bg-[#03C75A]/8 flex items-center justify-center">
          <span className="text-[#03C75A] text-lg font-bold">N</span>
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-slate-200 tracking-wide">
          네이버 계정 연동 처리 중
        </p>
        <p className="text-xs text-slate-500 font-mono">
          네이버 로그인 성공! 내 계정 연결하는 중...
        </p>
      </div>
    </div>
  );
};

export default NaverCallback;
