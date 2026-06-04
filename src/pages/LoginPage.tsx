import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogBox } from '../context/LogBoxContext';
import { AuthToken } from '../types/index';
import {
  getGoogleClientId,
  getGoogleClientIdSetupHint,
  isGoogleOAuthConfigured,
} from '../config/googleAuth';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { DEMO_ACCESS_TOKEN } from '../utils/recordUtils';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setToken } = useLogBox();
  const googleReady = isGoogleOAuthConfigured();
  const setupHint = getGoogleClientIdSetupHint();
  const rawId = getGoogleClientId();
  const hasEnvFileHint = rawId.length > 0;
  const [isLoadingScreen, setIsLoadingScreen] = useState(false);

  const handleGoogleSuccess = () => {
    setIsLoadingScreen(true);
    setTimeout(() => {
      const onboardingSeen = localStorage.getItem('onboardingSeen') === 'true';
      if (onboardingSeen) {
        navigate('/', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }, 2000);
  };

  const demoLogin = async () => {
    const token: AuthToken = {
      accessToken: DEMO_ACCESS_TOKEN,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      tokenType: 'Bearer',
      scope: 'demo',
    };
    await setToken(token);
    setIsLoadingScreen(true);
    setTimeout(() => {
      const onboardingSeen = localStorage.getItem('onboardingSeen') === 'true';
      if (onboardingSeen) {
        navigate('/', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }, 2000);
  };

  if (isLoadingScreen) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0C10',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {/* Minimalist Spinner */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '3px solid rgba(255, 59, 92, 0.1)',
              borderTopColor: 'var(--accent)',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ fontSize: 15, fontWeight: 500, color: '#94A3B8', letterSpacing: '0.02em' }}>
            메일함에서 실시간 보안 알림 수집 중...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B0C10',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, padding: 24 }}>
        <div
          style={{
            background: '#121318',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            borderRadius: 16,
            padding: 32,
            color: '#fff',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>LogBox</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>내 기기의 로그인 기록과 보안 위험을 확인하려면 로그인하세요</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {googleReady ? (
              <GoogleLoginButton onSuccess={handleGoogleSuccess} />
            ) : (
              <div>
                <button
                  type="button"
                  disabled
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: '#181920',
                    color: '#6b6b6b',
                    width: '100%',
                    cursor: 'not-allowed',
                  }}
                >
                  <span>Google로 로그인 (설정 필요)</span>
                </button>
                {setupHint ? (
                  <p style={{ marginTop: 8, fontSize: 12, color: '#FF8A3D', lineHeight: 1.55 }}>{setupHint}</p>
                ) : null}
                {hasEnvFileHint && !googleReady ? (
                  <p style={{ marginTop: 6, fontSize: 11, color: '#94A3B8', lineHeight: 1.5 }}>
                    {rawId.includes('xxxx') || rawId.startsWith('123456789-') ? (
                      <>
                        <strong style={{ color: '#FF8A3D' }}>예시 ID가 그대로입니다.</strong> 123456789-xxxx… 는 Google에 없는
                        가짜 값입니다.
                      </>
                    ) : (
                      <>
                        현재 값: <code style={{ fontSize: 10 }}>{rawId.slice(0, 28)}…</code>
                      </>
                    )}
                    <br />
                    구글 로그인 설정이 잘못되었습니다. 관리자 설정을 확인해 주세요.
                  </p>
                ) : null}
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: 12, color: '#6B6B6B', margin: '4px 0' }}>또는</div>

            <button
              type="button"
              onClick={demoLogin}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(255, 59, 92, 0.25)',
                transition: 'opacity 0.2s ease',
              }}
            >
              데모 계정으로 계속
            </button>
          </div>

          <div style={{ marginTop: 24, padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: '#94A3B8', lineHeight: 1.55 }}>
            <strong style={{ color: '#fff' }}>네이버·카카오는</strong> 귀찮은 연동 과정 없이, 보안 알림 메일을 내 Gmail로{' '}
            <strong style={{ color: '#fff' }}>자동 전달(포워딩)</strong> 설정만 해두면 LogBox가 알아서 한눈에 모아 보여줍니다.
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: '#6B6B6B', textAlign: 'center', lineHeight: 1.5 }}>
            Gmail 연결: 로그인 동의 화면에서 <code style={{ fontSize: 10 }}>gmail.readonly</code> 권한 동의(체크)가 필요합니다.
            <br />
            설정 파일: <code style={{ fontSize: 10 }}>.env.local</code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
