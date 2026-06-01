import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLogBox } from '../context/LogBoxContext';
import { useNaverAuth } from '../hooks/useNaverAuth';

// ──────────────────────────────────────────────────
// 보안 달력 유틸리티
// ──────────────────────────────────────────────────
type StatusType = 'safe' | 'caution' | 'danger';

const dateStatuses: StatusType[] = Array.from({ length: 30 }, (_, index) => {
  const value = (index + 1) % 7;
  if (value === 0 || value === 6) return 'danger';
  if (value === 1 || value === 4) return 'caution';
  return 'safe';
});

const getDotClass = (status: StatusType) => {
  switch (status) {
    case 'safe':    return 'bg-emerald-400';
    case 'caution': return 'bg-amber-400';
    case 'danger':  return 'bg-rose-500';
    default:        return 'bg-slate-500';
  }
};

// ──────────────────────────────────────────────────
// 공통 토글 스위치 컴포넌트 (터치 영역 확대)
// ──────────────────────────────────────────────────
interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  accentColor?: 'emerald' | 'naver';
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id, checked, onChange, disabled = false, accentColor = 'emerald',
}) => {
  const trackOn  = accentColor === 'naver' ? 'bg-[#03C75A]' : 'bg-emerald-500';
  const trackOff = 'bg-slate-700';
  const glowOn   = accentColor === 'naver'
    ? 'shadow-[0_0_14px_rgba(3,199,90,0.60)]'
    : 'shadow-[0_0_14px_rgba(52,211,153,0.60)]';

  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-14 h-7 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-40 active:scale-95 ${
        checked
          ? `${trackOn} border-transparent ${glowOn}`
          : `${trackOff} border-slate-600 hover:border-slate-500`
      }`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${
          checked ? 'left-[1.875rem]' : 'left-1'
        }`}
      />
    </button>
  );
};

// ──────────────────────────────────────────────────
// 메인 SettingsPage
// ──────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken } = useLogBox();

  // ── 네이버 연동 상태 관리 커스텀 훅 ─────────────────
  const {
    isNaverConnected,
    naverEmail,
    naverDisconnecting,
    connectNaver,
    disconnectNaver,
  } = useNaverAuth();

  // ── 알림 스위치 상태 ──────────────────────────────
  const [alertOnThreat, setAlertOnThreat] = useState<boolean>(false);
  const [showLockHint, setShowLockHint] = useState<boolean>(false);

  // 연동 해제 시 알림도 강제 비활성화
  useEffect(() => {
    if (!isNaverConnected) {
      setAlertOnThreat(false);
    }
  }, [isNaverConnected]);

  // 콜백 복귀 후 에러 파라미터 처리 및 state 정리
  useEffect(() => {
    const state = location.state as { naverSuccess?: boolean; naverError?: string } | null;
    if (!state) return;

    if (state.naverError) {
      console.error('[Settings] 네이버 인증 오류:', state.naverError);
    }

    navigate('/settings', { replace: true, state: null });
  }, [location.state, navigate]);

  // ── 알림 스위치: 계정 미연동 시 차단 + Short-circuit ──
  const handleAlertToggle = useCallback(() => {
    if (!isNaverConnected) {
      setShowLockHint(true);
      setTimeout(() => setShowLockHint(false), 2500);
      return;
    }
    setAlertOnThreat((prev) => !prev);
  }, [isNaverConnected]);

  // ── 로그아웃 ──────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await setToken(null);
    navigate('/login', { replace: true });
  }, [setToken, navigate]);

  // ── 보안 달력 통계 ─────────────────────────────────
  const stats = useMemo(
    () =>
      dateStatuses.reduce(
        (acc, status) => { acc[status] += 1; return acc; },
        { safe: 0, caution: 0, danger: 0 } as Record<StatusType, number>,
      ),
    [],
  );

  // ──────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100 px-5 py-7 pb-36">
      <div className="max-w-md w-full mx-auto">

        {/* ── 헤더 ── */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-base text-slate-500 font-medium">개인 설정</p>
            <h1 className="mt-1.5 text-3xl font-bold text-white">보안과 계정 관리</h1>
          </div>
        </header>

        {/* ── 보안 달력 ── */}
        <section className="mb-6 rounded-3xl border border-slate-800/80 bg-[#15181e] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">이번 달 보안 현황</h2>
              <p className="mt-1 text-base text-slate-400">수집된 로그를 기반으로 위험도를 확인하세요.</p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-sm font-bold text-slate-400 mb-4">
            {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-base text-slate-200">
            {dateStatuses.map((status, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-800/60 bg-slate-950/70 py-3 px-1.5 transition duration-200 hover:border-slate-600 hover:bg-slate-900"
              >
                <div className="font-semibold text-sm">{index + 1}</div>
                <div className={`mx-auto mt-2 w-2 h-2 rounded-full ${getDotClass(status)}`} />
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-slate-950/80 p-4">
              <p className="text-sm font-semibold text-slate-500">안전</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">{stats.safe}</p>
            </div>
            <div className="rounded-2xl bg-slate-950/80 p-4">
              <p className="text-sm font-semibold text-slate-500">주의</p>
              <p className="mt-2 text-2xl font-bold text-amber-400">{stats.caution}</p>
            </div>
            <div className="rounded-2xl bg-slate-950/80 p-4">
              <p className="text-sm font-semibold text-slate-500">위험</p>
              <p className="mt-2 text-2xl font-bold text-rose-500">{stats.danger}</p>
            </div>
          </div>
        </section>

        {/* ── 계정 및 알림 관리 섹션 ── */}
        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-800/80 bg-[#15181e] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">계정 연동 관리</h2>
              <p className="mt-1.5 text-base text-slate-400">네이버 연동과 보안 알림을 한 곳에서 설정합니다.</p>
            </div>

            <div className="space-y-4">

              {/* ── [A] 네이버 계정 연동 카드 ──────────────── */}
              <div className="rounded-3xl border border-slate-800/80 bg-[#0f1320] p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* 좌측: 아이콘 + 타이틀 */}
                  <div className="flex items-center gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#03C75A] text-base font-bold text-white shadow-[0_4px_16px_rgba(3,199,90,0.35)]">
                      N
                    </span>
                    <div>
                      <p className="text-base font-bold text-white">네이버 계정 연동</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {isNaverConnected
                          ? '네이버 계정이 연결되었습니다.'
                          : '보안 알림을 받으려면 연동이 필요합니다.'}
                      </p>
                    </div>
                  </div>

                  {/* 우측: 상태 배지 */}
                  <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    isNaverConnected
                      ? 'bg-[#03C75A]/15 text-[#03C75A]'
                      : 'bg-slate-700/80 text-slate-400'
                  }`}>
                    {isNaverConnected ? '연동 완료' : '미연동'}
                  </div>
                </div>

                {/* 연동 완료 상태: 이메일 + 해제 버튼 */}
                {isNaverConnected && naverEmail && (
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950/70 px-5 py-4">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-1">연결된 계정</p>
                      <p className="text-base font-bold text-white">{naverEmail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={disconnectNaver}
                      disabled={naverDisconnecting}
                      className="shrink-0 ml-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-2 text-sm font-bold text-rose-400 hover:bg-rose-950/60 hover:border-rose-500/60 active:scale-95 disabled:opacity-50 transition-all duration-200"
                    >
                      {naverDisconnecting ? (
                        <>
                          <span className="w-4 h-4 border border-rose-400/60 border-t-rose-400 rounded-full animate-spin" />
                          해제 중
                        </>
                      ) : (
                        '연동 해제'
                      )}
                    </button>
                  </div>
                )}

                {/* 미연동 상태: 연결하기 버튼 */}
                {!isNaverConnected && (
                  <button
                    type="button"
                    id="naver-connect-btn"
                    onClick={connectNaver}
                    className="mt-4 w-full flex items-center justify-center gap-2.5 rounded-2xl bg-[#03C75A] py-3.5 text-base font-bold text-white shadow-[0_0_20px_rgba(3,199,90,0.25)] hover:bg-[#02b350] hover:shadow-[0_0_28px_rgba(3,199,90,0.45)] active:scale-[0.98] transition-all duration-200"
                  >
                    <span className="text-lg font-black">N</span>
                    네이버로 연결하기
                  </button>
                )}
              </div>

              {/* ── [B] 구글 계정 (로그인 연동) ── */}
              <div className="rounded-3xl border border-slate-800/80 bg-[#0f1320] p-5 opacity-60">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-base font-semibold text-slate-950 shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
                      G
                    </span>
                    <div>
                      <p className="text-base font-bold text-white">구글 계정 연동</p>
                      <p className="mt-0.5 text-sm text-slate-500">로그인 시 구글 계정으로 자동 연동됩니다.</p>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full px-3 py-1 text-xs font-bold bg-slate-700/80 text-slate-400">
                    자동 연동
                  </div>
                </div>
              </div>

              {/* ── [C] 위협 감지 알림 스위치 ── */}
              <div className={`rounded-3xl border bg-[#0f1320] p-5 transition-all duration-300 ${
                isNaverConnected
                  ? 'border-slate-800/80'
                  : 'border-slate-800/40 opacity-70'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-bold text-white flex items-center gap-2">
                      위협 감지 즉시 알림
                      {!isNaverConnected && (
                        <span className="text-xs font-semibold text-slate-600 normal-case">
                          (네이버 연동 필요)
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-500">이상 접근 징후를 놓치지 않고 즉시 안내합니다.</p>
                  </div>

                  <ToggleSwitch
                    id="alert-on-threat-toggle"
                    checked={alertOnThreat}
                    onChange={handleAlertToggle}
                    disabled={!isNaverConnected}
                  />
                </div>

                {/* 차단 안내 토스트 인라인 */}
                {showLockHint && (
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-400 font-semibold animate-[fadeIn_0.2s_ease-out]">
                    <span>⚠</span>
                    <span>네이버 계정을 먼저 연동해 주세요.</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* ── 로그아웃 / 회원탈퇴 ── */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleLogout}
            className="text-base text-slate-400 hover:text-white transition-colors duration-200 font-medium"
          >
            로그아웃
          </button>
          <button
            type="button"
            onClick={() => alert('회원탈퇴는 아직 구현되지 않았습니다.')}
            className="text-sm text-slate-600 hover:text-rose-400 transition-colors duration-200"
          >
            회원탈퇴
          </button>
        </div>

      </div>

      {/* 인라인 애니메이션 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SettingsPage;
