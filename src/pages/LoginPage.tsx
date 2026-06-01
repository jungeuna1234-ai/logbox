import React from 'react';
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

  const demoLogin = async () => {
    const token: AuthToken = {
      accessToken: DEMO_ACCESS_TOKEN,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      tokenType: 'Bearer',
      scope: 'demo',
    };
    await setToken(token);
    navigate('/');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg,#070707,#0b0b0c)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, padding: 24 }}>
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.6))',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            borderRadius: 12,
            padding: 24,
            color: '#fff',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>LogBox</h1>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>기기 활동 및 보안 로그를 확인하려면 로그인하세요</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {googleReady ? (
              <GoogleLoginButton />
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
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: '#151515',
                    color: '#6b6b6b',
                    width: '100%',
                    cursor: 'not-allowed',
                  }}
                >
                  <span>Google로 로그인 (미구성)</span>
                </button>
                {setupHint ? (
                  <p style={{ marginTop: 8, fontSize: 12, color: '#FF8A3D', lineHeight: 1.55 }}>{setupHint}</p>
                ) : null}
                {hasEnvFileHint && !googleReady ? (
                  <p style={{ marginTop: 6, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
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
                    오류 URL의 flowName=GeneralOAuthFlow 는 일반 웹 로그인 흐름 이름일 뿐이며, 원인은 잘못된 클라이언트 ID입니다.
                  </p>
                ) : null}
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: 12, color: '#6B6B6B' }}>또는</div>

            <button
              type="button"
              onClick={demoLogin}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                fontWeight: 700,
              }}
            >
              데모 계정으로 계속
            </button>
          </div>

          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 11, color: '#8b8b8b', lineHeight: 1.55 }}>
            <strong style={{ color: '#b0b0b0' }}>네이버·카카오</strong>는 API 연동 없이, 보안 알림 메일을 본인 Gmail로{' '}
            <strong style={{ color: '#b0b0b0' }}>자동 전달(포워딩)</strong>하면 LogBox가 Gmail에서 함께 수집합니다.
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#6B6B6B', textAlign: 'center' }}>
            Gmail 동기화: OAuth 동의 화면에 <code style={{ fontSize: 10 }}>gmail.readonly</code> 범위 필요
            <br />
            설정 파일: <code style={{ fontSize: 10 }}>.env.local</code> (예시: <code style={{ fontSize: 10 }}>.env.local.example</code>)
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
