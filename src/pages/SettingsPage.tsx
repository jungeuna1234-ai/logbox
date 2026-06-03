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
  const trackOn  = accentColor === 'naver' ? 'bg-[#03C75A]' : 'bg-[#FF2E63]';
  const trackOff = 'bg-[#0B0C10]';
  const glowOn   = accentColor === 'naver'
    ? 'shadow-[0_0_14px_rgba(3,199,90,0.60)]'
    : 'shadow-[0_0_14px_rgba(255,46,99,0.60)]';

  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-14 h-7 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#FF2E63]/40 disabled:opacity-40 active:scale-95 ${
        checked
          ? `${trackOn} border-transparent ${glowOn}`
          : `${trackOff} border-white/5 hover:border-white/20`
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
// 커스텀 알림 모달
// ──────────────────────────────────────────────────
interface UnregisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UnregisterModal: React.FC<UnregisterModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#12141C] border border-[#FF2E63]/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-[modalIn_0.25s_ease-out]">
        <div className="flex flex-col items-center gap-2 text-[#FF2E63] text-center">
          <span className="material-symbols-outlined text-4xl animate-pulse">info</span>
          <h3 className="text-base font-bold tracking-wider">회원탈퇴 안내</h3>
        </div>
        <p className="text-xs text-slate-400 text-center leading-relaxed">
          회원탈퇴 기능은 현재 데모 시스템에서 준비 중입니다.<br />
          정식 버전 출시 이후 이용해 주시기 바랍니다.
        </p>
        <button
          onClick={onClose}
          className="w-full bg-[#FF2E63] text-[#0B0C10] py-2.5 rounded-xl text-xs font-bold hover:bg-[#ff4d7c] active:scale-95 transition-all"
        >
          확인
        </button>
      </div>
    </div>
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
  const [showUnregisterModal, setShowUnregisterModal] = useState<boolean>(false);

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
    <div className="min-h-screen bg-[#0B0C10] text-white px-6 py-7 pb-28 select-none relative font-sans">
      <div className="max-w-md w-full mx-auto space-y-6">

        {/* ── 헤더 ── */}
        <header className="pb-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-wider text-white">보안과 계정 설정</h1>
            <p className="text-[10px] text-slate-500 font-mono mt-1">개인 계정 정보 및 보안 환경을 관리합니다.</p>
          </div>
        </header>

        {/* ── 보안 달력 ── */}
        <section className="rounded-2xl border border-white/5 bg-[#12141C] p-6 shadow-lg">
          <div className="mb-5">
            <h2 className="text-base font-bold text-white tracking-wider">이번 달 보안 현황</h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">수집된 위협 로그 기반 일별 상태 대시보드</p>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-500 mb-3 font-mono">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-xs text-slate-300">
            {dateStatuses.map((status, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/5 bg-[#0B0C10]/80 py-2.5 px-1.5 flex flex-col items-center justify-center transition duration-200 hover:border-white/10 hover:bg-[#161923]"
              >
                <div className="font-semibold text-[10px] font-mono text-slate-400">{index + 1}</div>
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${getDotClass(status)}`} />
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-[#0B0C10] border border-white/5 p-3">
              <p className="text-[10px] font-semibold text-slate-500 font-mono">안전</p>
              <p className="mt-1 text-lg font-bold text-[#00F5D4] font-mono">{stats.safe}</p>
            </div>
            <div className="rounded-xl bg-[#0B0C10] border border-white/5 p-3">
              <p className="text-[10px] font-semibold text-slate-500 font-mono">주의</p>
              <p className="mt-1 text-lg font-bold text-amber-400 font-mono">{stats.caution}</p>
            </div>
            <div className="rounded-xl bg-[#0B0C10] border border-white/5 p-3">
              <p className="text-[10px] font-semibold text-slate-500 font-mono">위험</p>
              <p className="mt-1 text-lg font-bold text-[#FF2E63] font-mono">{stats.danger}</p>
            </div>
          </div>
        </section>

        {/* ── 계정 및 알림 관리 섹션 ── */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/5 bg-[#12141C] p-6 shadow-lg space-y-5">
            <div>
              <h2 className="text-base font-bold text-white tracking-wider">계정 연동 관리</h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">외부 플랫폼 연동 및 수신 알림 설정</p>
            </div>

            <div className="space-y-4">

              {/* ── [A] 네이버 계정 연동 카드 ──────────────── */}
              <div className="rounded-2xl border border-white/5 bg-[#161923] p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  {/* 좌측: 아이콘 + 타이틀 */}
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#03C75A] text-sm font-black text-white shadow-[0_4px_16px_rgba(3,199,90,0.25)]">
                      N
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">네이버 계정 연동</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {isNaverConnected
                          ? '네이버 계정이 연결되었습니다.'
                          : '보안 메일 분석을 위해 연동이 필요합니다.'}
                      </p>
                    </div>
                  </div>

                  {/* 우측: 상태 배지 */}
                  <div className={`shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-bold ${
                    isNaverConnected
                      ? 'bg-[#03C75A]/20 text-[#03C75A] border border-[#03C75A]/30'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/50'
                  }`}>
                    {isNaverConnected ? '연동 완료' : '미연동'}
                  </div>
                </div>

                {/* 연동 완료 상태: 이메일 + 해제 버튼 */}
                {isNaverConnected && naverEmail && (
                  <div className="flex items-center justify-between rounded-xl bg-[#0B0C10] border border-white/5 px-4 py-3">
                    <div>
                      <p className="text-[9px] text-slate-500 font-mono">연결된 계정</p>
                      <p className="text-xs font-bold text-white font-mono mt-0.5">{naverEmail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={disconnectNaver}
                      disabled={naverDisconnecting}
                      className="shrink-0 ml-3 flex items-center gap-1.5 rounded-lg border border-[#FF2E63]/30 bg-[#FF2E63]/10 px-3 py-1.5 text-[10px] font-bold text-[#FF2E63] hover:bg-[#FF2E63]/25 active:scale-95 disabled:opacity-50 transition-all duration-200"
                    >
                      {naverDisconnecting ? (
                        <>
                          <span className="w-3 h-3 border border-[#FF2E63]/60 border-t-[#FF2E63] rounded-full animate-spin" />
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#03C75A] py-3 text-xs font-bold text-white shadow-[0_0_15px_rgba(3,199,90,0.2)] hover:bg-[#02b350] hover:shadow-[0_0_22px_rgba(3,199,90,0.35)] active:scale-[0.98] transition-all duration-200"
                  >
                    <span className="text-sm font-black">N</span>
                    네이버로 연결하기
                  </button>
                )}
              </div>

              {/* ── [B] 구글 계정 (로그인 연동) ── */}
              <div className="rounded-2xl border border-white/5 bg-[#161923] p-5 opacity-60">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-[#0B0C10] shadow-[0_4px_16px_rgba(255,255,255,0.15)]">
                      G
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">구글 계정 연동</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">로그인 시 구글 계정으로 자동 연동됩니다.</p>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-500 border border-slate-700/50">
                    자동 연동
                  </div>
                </div>
              </div>

              {/* ── [C] 위협 감지 알림 스위치 ── */}
              <div className={`rounded-2xl border bg-[#161923] p-5 transition-all duration-300 ${
                isNaverConnected
                  ? 'border-white/5'
                  : 'border-white/5 opacity-50'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      위협 감지 즉시 알림
                      {!isNaverConnected && (
                        <span className="text-[9px] font-semibold text-slate-500">
                          (네이버 연동 필요)
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">이상 접근 징후를 감지하여 알림을 보냅니다.</p>
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
                  <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-950/25 px-4 py-2.5 text-[10px] text-orange-400 font-semibold animate-[fadeIn_0.2s_ease-out]">
                    <span>⚠</span>
                    <span>네이버 계정을 먼저 연동해 주세요.</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* ── 로그아웃 / 회원탈퇴 ── */}
        <div className="pt-4 flex flex-col items-center gap-3.5">
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-[#FF2E63] active:scale-95 transition-all font-semibold tracking-wider"
          >
            로그아웃
          </button>
          <button
            type="button"
            onClick={() => setShowUnregisterModal(true)}
            className="text-[10px] text-slate-600 hover:text-[#FF2E63]/80 active:scale-95 transition-all font-mono"
          >
            회원탈퇴
          </button>
        </div>

      </div>

      {/* 🎭 회원탈퇴 커스텀 안내 모달 */}
      <UnregisterModal
        isOpen={showUnregisterModal}
        onClose={() => setShowUnregisterModal(false)}
      />

      {/* 인라인 애니메이션 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default SettingsPage;
