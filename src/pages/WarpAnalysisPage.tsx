// src/pages/WarpAnalysisPage.tsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { InfoCell } from '../components/InfoCell';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLogBox } from '../context/LogBoxContext';

// 가상 비동기 API 통신 시뮬레이션 함수 (85% 성공, 15% 확률 500 Internal Server Error 유발)
const simulateApiCall = async (url: string, data?: any): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      const isSuccess = Math.random() > 0.15;
      if (isSuccess) {
        resolve();
      } else {
        reject(new Error("Network Error 500 (Internal Server Error)"));
      }
    }, 1200);
  });
};

interface LogBoxRecord {
  id?: string;
  latitude?: string | number;
  longitude?: string | number;
  timeISO?: string;
  ip?: string;
  device?: {
    id: string;
    name?: string;
  };
}

interface RouteProps {
  origin: string;
  destination: string;
}

// ──────────────────────────────────────────────────
// 🔒 [미흡점 4] ActionModal을 부모 외부로 완전 분리하여 메모리/버그 방지
// ──────────────────────────────────────────────────
interface ActionModalProps {
  activeModal: 'password' | 'logout' | null;
  passwordStatus: 'idle' | 'loading' | 'success';
  logoutProgress: number;
  logoutCompleted: boolean;
  onApplyPassword: () => void;
  onClose: () => void;
}

const ActionModal: React.FC<ActionModalProps> = ({
  activeModal,
  passwordStatus,
  logoutProgress,
  logoutCompleted,
  onApplyPassword,
  onClose,
}) => {
  if (!activeModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#15181e] border border-cyan-950/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl transform scale-100 transition-transform duration-300">
        
        {/* 1. 비밀번호 변경 모달 */}
        {activeModal === 'password' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-red-400">
              <span>⚠️</span>
              <h3 className="text-sm font-semibold">원격 보안 비밀번호 재설정</h3>
            </div>
            <p className="text-xs text-slate-400">해당 엔드포인트 세션 위험 감지로 인해 즉시 변경이 권장됩니다.</p>
            <input 
              type="password" 
              placeholder="새 비밀번호 입력" 
              className="w-full bg-[#0d0f12] border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <div className="flex space-x-2 pt-2">
              <button onClick={onClose} className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-xl text-xs hover:bg-slate-700">
                취소
              </button>
              <button 
                onClick={onApplyPassword}
                disabled={passwordStatus === 'loading'}
                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
              >
                {passwordStatus === 'loading' ? '변경 중...' : '보안 변경 적용'}
              </button>
            </div>
            {passwordStatus === 'success' && (
              <p className="text-center text-xs text-[#7ef0c5] font-mono animate-pulse">성공적으로 변경되었습니다.</p>
            )}
          </div>
        )}

        {/* 2. 원격 로그아웃 모달 (중앙 집중식 팝업) */}
        {activeModal === 'logout' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-cyan-400">
              <span className="animate-pulse">🚨</span>
              <h3 className="text-sm font-semibold">원격 세션 즉시 차단 중...</h3>
            </div>
            <p className="text-xs text-slate-400">원격 엔드포인트(확인되지 않은 경로) 세션 강제 종료 수행 중...</p>
            
            {/* 실시간 네트워크 차단율 게이지 프로그레스 바 */}
            <div className="w-full bg-[#0d0f12] h-2 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${logoutProgress}%` }}
              />
            </div>

            {logoutCompleted ? (
              <div className="space-y-3 pt-2">
                <p className="text-center text-xs text-[#7ef0c5] font-mono">
                  ✔ 해당 기기의 접근 권한이 영구 차단되었습니다.
                </p>
                <button 
                  onClick={onClose}
                  className="w-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 py-2 rounded-xl text-xs font-semibold hover:bg-cyan-900/50"
                >
                  확인 및 닫기
                </button>
              </div>
            ) : (
              <p className="text-right text-[10px] text-slate-500 font-mono">네트워크 차단율: {logoutProgress}%</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────
// 🪐 메인 WarpAnalysisPage 컴포넌트
// ──────────────────────────────────────────────────
export const WarpAnalysisPage: React.FC<{ incoming?: LogBoxRecord; route?: RouteProps; blockAccessHandler?: (id: string) => Promise<void> }> = ({
  incoming: propsIncoming,
  route: propsRoute,
  blockAccessHandler: propsBlockAccessHandler
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const logBoxContext = useLogBox();

  // state에서 데이터 복구 또는 context에서 fallback
  const locationState = location.state as { logData?: LogBoxRecord } | null;
  const incoming = propsIncoming ?? locationState?.logData ?? logBoxContext.logs[0];

  // 토스트 전용 상태 및 메소드 (훅은 항상 최상단)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastType(type);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  // route 파싱
  const parsedRoute = useMemo(() => {
    const rawText = incoming?.raw ?? '';
    const match = rawText.match(/([^\s·[\]]+)\s*(?:→|->)\s*([^\s·[\]]+)/);
    if (match) return { origin: match[1].trim(), destination: match[2].trim() };
    return { origin: '알 수 없음', destination: '알 수 없음' };
  }, [incoming?.raw]);

  const route = propsRoute ?? parsedRoute;

  // blockAccessHandler 바인딩
  const boundBlockAccessHandler = useCallback(async (id: string) => {
    if (propsBlockAccessHandler) {
      await propsBlockAccessHandler(id);
    } else {
      logBoxContext.blockAccessHandler(id);
    }
  }, [propsBlockAccessHandler, logBoxContext]);

  // 데이터 결손 시 강력한 에러 가드(Short-circuit)
  if (!incoming) {
    return (
      <div className="min-h-screen bg-[#05070a] text-white flex flex-col items-center justify-center p-6 font-sans select-none">
        <div className="bg-[#111417]/90 border border-red-950/40 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)] animate-fade-in">
          <div className="w-16 h-16 bg-red-950/30 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
            <span className="text-red-500 text-3xl">⚠️</span>
          </div>
          <h2 className="text-sm font-bold text-slate-200 mb-2">유효하지 않은 보안 세션</h2>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
            유효하지 않은 보안 세션입니다.<br />메인 화면으로 이동합니다.
          </p>
          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 hover:text-white py-3 rounded-2xl text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            메인으로 이동
          </button>
        </div>
      </div>
    );
  }

  // 상태 관리 단일화 및 최적화
  const [activeModal, setActiveModal] = useState<'password' | 'logout' | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [logoutProgress, setLogoutProgress] = useState(0);
  const [logoutCompleted, setLogoutCompleted] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false); 

  const modalTimers = useRef<NodeJS.Timeout[]>([]);

  // [미흡점 5] 타이머 싹 정리해 줄 클린업 핸들러
  const clearAllTimers = useCallback(() => {
    modalTimers.current.forEach(clearTimeout);
    modalTimers.current = [];
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // [미흡점 1] 독립 메모 가치 없는 파생 상태 인라인 처리
  const routeLabel = route.origin !== '알 수 없음' && route.destination !== '알 수 없음'
    ? `${route.origin} → ${route.destination}`
    : '확인되지 않은 경로';

  // [미흡점 3] displayTime 성능 최적화 useMemo
  const displayTime = useMemo(() => {
    if (!incoming.timeISO) return '알 수 없음';
    return new Date(incoming.timeISO).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
  }, [incoming.timeISO]);

  // [미흡점 7] Stale Closure 방지 가드 조건 추가 - 비동기 API 요청 및 try-catch 통합
  const applyPasswordChange = useCallback(async () => {
    if (passwordStatus !== 'idle') return;
    setPasswordStatus('loading');
    
    try {
      await simulateApiCall('/api/security/reset-password', { deviceId: incoming.device?.id });
      setPasswordStatus('success');
      showToast("보안 처리가 완료되었습니다.", "success");
    } catch (error) {
      setPasswordStatus('idle');
      showToast("서버 통신에 실패했습니다.", "error");
    }
  }, [passwordStatus, incoming.device?.id, showToast]);

  // [미흡점 5] React 18 자동 배칭을 고려해 타이머 상태 병합
  const openLogoutModal = useCallback(() => {
    setLogoutProgress(0);
    setLogoutCompleted(false);
    setActiveModal('logout');

    const timer1 = setTimeout(() => setLogoutProgress(45), 400);
    const timer2 = setTimeout(() => setLogoutProgress(85), 900);
    const timer3 = setTimeout(() => {
      setLogoutProgress(100);
      setLogoutCompleted(true); 
    }, 1500);

    modalTimers.current.push(timer1, timer2, timer3);
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveModal(null);
    setPasswordStatus('idle');
    clearAllTimers();

    if (logoutCompleted) {
      navigate('/', { replace: true }); 
    }
  }, [clearAllTimers, logoutCompleted, navigate]);

  // 로그아웃 완료 감지 및 1.2초 후 자동 리다이렉트
  useEffect(() => {
    if (logoutCompleted) {
      const timer = setTimeout(() => {
        handleCloseModal();
      }, 1200);
      modalTimers.current.push(timer);
    }
  }, [logoutCompleted, handleCloseModal]);


  // [미흡점 6] 더블 클릭 방지 및 예외처리 완료 - 비동기 API 연동 및 try-catch 통합
  const handleBlockAccess = useCallback(async () => {
    if (isBlocking) return;
    const id = incoming.device?.id ?? incoming.id;
    if (!id) {
      showToast("유효하지 않은 장치 식별자입니다.", "error");
      return;
    }

    setIsBlocking(true);
    try {
      await simulateApiCall('/api/security/block-endpoint', { id });
      await boundBlockAccessHandler(id);
      showToast("보안 처리가 완료되었습니다.", "success");
    } catch (error) {
      showToast("서버 통신에 실패했습니다.", "error");
    } finally {
      setIsBlocking(false);
    }
  }, [incoming, boundBlockAccessHandler, isBlocking, showToast]);

  return (
    <div className="min-h-screen bg-[#05070a] text-white p-4 font-sans select-none flex flex-col justify-between">
      
      {/* 🛸 3번 CONCEPT: CONCEPT 3: HEX RADAR 스캐너 디자인 구현 */}
      <div className="flex flex-col items-center justify-center my-8">
        <div className="relative w-48 h-48 rounded-full border border-cyan-500/30 bg-[#0a0d14]/60 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.25)] overflow-hidden flex items-center justify-center">
          
          {/* 하이테크 6각 그리드 격자 패턴 SVG */}
          <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <defs>
              <pattern id="hex-grid" width="24" height="41.569" patternUnits="userSpaceOnUse">
                <path d="M12 0 L24 6.928 L24 20.784 L12 27.712 L0 20.784 L0 6.928 Z M0 41.569 L12 34.641 L24 41.569" fill="none" stroke="#06b6d4" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hex-grid)" />
          </svg>

          {/* 360도 회전하는 부채꼴 레이더 스캔 광선 - conic-gradient로 하이테크 레이더 스윕 효과 극대화 */}
          <div 
            className="absolute inset-0 rounded-full animate-[spin_3s_linear_infinite]" 
            style={{
              background: 'conic-gradient(from 0deg, transparent 50%, rgba(6, 182, 212, 0.4) 100%)'
            }}
          />

          {/* 레이더 핑 포인트 (네온 도트 및 퍼지는 ping 파동 효과 적용) */}
          <div className="absolute top-1/4 left-1/3 w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-[0_0_12px_#06b6d4,0_0_20px_#06b6d4] animate-pulse" />
          
          <div className="absolute bottom-1/3 right-1/4 w-2.5 h-2.5 bg-[#7ef0c5] rounded-full shadow-[0_0_10px_#7ef0c5,0_0_18px_#7ef0c5] animate-[ping_1.5s_infinite_ease-in-out]" />
          <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-[#7ef0c5] rounded-full shadow-[0_0_8px_#7ef0c5]" />

          {/* 레이더 조준 십자 축 헬퍼선 */}
          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-cyan-500/10" />
          <div className="absolute inset-y-0 left-1/2 w-[1px] bg-cyan-500/10" />

          {/* 중앙 스캔 상태 코어 */}
          <div className="relative w-16 h-16 rounded-full border border-cyan-400/40 bg-[#0d111a] flex items-center justify-center shadow-inner">
            <span className="text-cyan-400 text-xs font-mono tracking-widest animate-pulse">SCAN</span>
          </div>
        </div>

        <div className="text-center mt-4">
          <h2 className="text-[#7ef0c5] text-xs font-mono tracking-widest uppercase">[ 시스템 무결성 가디언 ]</h2>
          <p className="text-slate-400 text-xs mt-1 font-mono">최종 보안 탐지 수행 중...</p>
        </div>
      </div>

      {/* 📊 [미흡점 10] 공통 컴포넌트 InfoCell 매핑으로 극대화된 가독성 */}
      <div className="grid grid-cols-2 gap-3 my-4">
        <InfoCell label="보안 엔드포인트" value={routeLabel} sub="접근 경로 자동 분석" />
        <InfoCell label="발생 시각" value={displayTime} sub="시간 역행 무결성 확인" />
        <InfoCell label="아이디 정보" value={incoming.device?.name ?? '확인되지 않음'} sub={`ID: ${incoming.device?.id ?? 'N/A'}`} />
        <InfoCell label="접속 IP 주소" value={incoming.ip ?? '확인되지 않음'} sub="패킷 위조 보호 활성" />
      </div>

      {/* 🛠️ 하단 인터랙션 컨트롤 패널 */}
      <div className="space-y-2 mt-auto">
        <button
          onClick={handleBlockAccess}
          disabled={isBlocking}
          className={`w-full text-white py-3.5 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.97] disabled:opacity-60 ${
            isBlocking
              ? 'bg-red-700/70 cursor-not-allowed'
              : 'bg-red-600/90 hover:bg-red-500 hover:shadow-[0_0_24px_rgba(239,68,68,0.4)] shadow-[0_0_12px_rgba(239,68,68,0.2)]'
          }`}
        >
          {isBlocking ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              처리 중...
            </>
          ) : (
            '⛔ BLOCK ACCESS'
          )}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveModal('password')}
            className="bg-slate-900 border border-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-800 hover:border-slate-600 active:scale-[0.97] transition-all duration-200"
          >
            🔑 비밀번호 변경
          </button>
          <button
            onClick={openLogoutModal}
            className="bg-slate-900 border border-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-800 hover:border-slate-600 active:scale-[0.97] transition-all duration-200"
          >
            🚪 원격 로그아웃
          </button>
        </div>
      </div>

      {/* 🎭 통합 중앙 집중형 모달 컨테이너 렌더링 */}
      <ActionModal 
        activeModal={activeModal}
        passwordStatus={passwordStatus}
        logoutProgress={logoutProgress}
        logoutCompleted={logoutCompleted}
        onApplyPassword={applyPasswordChange}
        onClose={handleCloseModal}
      />

      {/* 🍞 글로벌 다크 네온 토스트 팝업 */}
      {toastMessage && (
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-2xl border text-xs font-mono font-semibold tracking-wide flex items-center gap-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] transition-all duration-300 animate-fade-in z-[60] ${
          toastType === 'success' 
            ? 'bg-[#05110d]/90 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
            : 'bg-[#110508]/90 border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
        }`}>
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px]">
            {toastType === 'success' ? '✔' : '✕'}
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default WarpAnalysisPage;
