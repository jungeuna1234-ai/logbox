import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useLogBox } from '../context/LogBoxContext';
import { AuthToken } from '../types/index';
import { isGoogleOAuthConfigured } from '../config/googleAuth';

type GoogleTokenResp = { access_token?: string; expires_in?: number; token_type?: string; scope?: string };

interface GoogleLoginButtonProps {
  onSuccess?: () => void;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { setToken } = useLogBox();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (resp) => {
      setErrorMsg(null);
      setLoading(true);
      try {
        const tr = resp as unknown as GoogleTokenResp;
        const access = tr.access_token ?? '';
        if (!access) {
          setErrorMsg('액세스 토큰을 받지 못했습니다. 팝업이 차단되지 않았는지 확인하세요.');
          return;
        }
        const token: AuthToken = {
          accessToken: access,
          expiresAt: Date.now() + (tr.expires_in ?? 3600) * 1000,
          tokenType: tr.token_type ?? 'Bearer',
          scope: tr.scope ?? 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
        };
        await setToken(token);
        if (onSuccess) {
          onSuccess();
        } else {
          const onboardingSeen = localStorage.getItem('onboardingSeen') === 'true';
          if (onboardingSeen) {
            navigate('/', { replace: true });
          } else {
            navigate('/onboarding', { replace: true });
          }
        }
      } finally {
        setLoading(false);
      }
    },
    onError: (err) => {
      setLoading(false);
      console.error('[LogBox] Google login error', err);
      const detail = String((err as { error?: string })?.error ?? '');
      if (detail.includes('invalid_client') || detail.includes('401')) {
        setErrorMsg(
          'OAuth 클라이언트를 찾을 수 없습니다(invalid_client). .env.local의 VITE_GOOGLE_CLIENT_ID를 확인하고 dev 서버를 재시작하세요.',
        );
        return;
      }
      setErrorMsg('Google 로그인에 실패했습니다.');
    },
    scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
  });

  const handleClick = (): void => {
    setErrorMsg(null);
    if (!isGoogleOAuthConfigured()) {
      setErrorMsg('Google 클라이언트 ID가 설정되지 않았거나 형식이 잘못되었습니다.');
      return;
    }
    login();
  };

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.04)',
          background: '#0b0b0c',
          color: '#fff',
          width: '100%',
          opacity: loading ? 0.7 : 1,
        }}
      >
        <span>{loading ? '로그인 처리 중…' : 'Google로 로그인'}</span>
      </button>
      {errorMsg ? (
        <div style={{ marginTop: 8, fontSize: 12, color: '#FF8A3D', lineHeight: 1.5 }} role="alert">
          {errorMsg}
        </div>
      ) : null}
    </div>
  );
};

export default GoogleLoginButton;
