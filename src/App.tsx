import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogBoxProvider, useLogBox } from './context/LogBoxContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WarpAnalysisPage from './pages/WarpAnalysisPage';
import BaseManagePage from './pages/BaseManagePage';
import SettingsPage from './pages/SettingsPage';
import OnboardingPage from './pages/OnboardingPage';
import SecurityPage from './pages/SecurityPage';
import NaverCallback from './pages/NaverCallback';
import Layout from './components/Layout';
import { requestNotificationPermission } from './utils/notificationUtils';

function AuthLoading(): React.ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--bg)] text-gray-400 text-sm">
      세션 확인 중…
    </div>
  );
}

function ProtectedLayout(): React.ReactElement {
  const { authToken, authReady } = useLogBox();
  if (!authReady) return <AuthLoading />;
  if (!authToken) return <Navigate to="/login" replace />;
  return <Layout />;
}

function AppRoutes(): React.ReactElement {
  const { authToken, authReady } = useLogBox();
  const location = useLocation();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean>(false);

  useEffect(() => {
    setOnboardingSeen(typeof window !== 'undefined' && localStorage.getItem('onboardingSeen') === 'true');
  }, [location.pathname]);

  const redirectRoot = useMemo(() => {
    if (!authToken) return '/login';
    return onboardingSeen ? '/' : '/onboarding';
  }, [authToken, onboardingSeen]);

  if (!authReady) return <AuthLoading />;

  return (
    <Routes>
      {/* ── 퍼블릭 라우트 (인증 불필요) ── */}
      <Route path="/login" element={authToken ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/onboarding" element={authToken ? <OnboardingPage /> : <Navigate to="/login" replace />} />

      {/* ── 네이버 OAuth 콜백: 인증 전 상태에서도 진입 가능해야 함 ── */}
      <Route path="/oauth/callback/naver" element={<NaverCallback />} />

      {/* ── 보호된 라우트 (Layout 안) ── */}
      <Route element={<ProtectedLayout />}>
        <Route
          index
          element={
            authToken ? (
              onboardingSeen ? <DashboardPage /> : <Navigate to="/onboarding" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="warp-analysis" element={<WarpAnalysisPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="base" element={<BaseManagePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={authToken ? (onboardingSeen ? '/' : '/onboarding') : '/login'}
            replace
          />
        }
      />
    </Routes>
  );
}

const App: React.FC = () => {
  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  return (
    <LogBoxProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LogBoxProvider>
  );
};

export default App;
