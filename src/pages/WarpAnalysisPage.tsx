// src/pages/WarpAnalysisPage.tsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { InfoCell } from '../components/InfoCell';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLogBox } from '../context/LogBoxContext';

const simulateApiCall = async (_url: string, _data?: any): Promise<void> => {
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
  raw?: string;
}

interface RouteProps {
  origin: string;
  destination: string;
}

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#12141C] border border-[#FF2E63]/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl transform scale-100 transition-all duration-300">
        
        {/* 1. 비밀번호 변경 모달 */}
        {activeModal === 'password' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[#FF2E63]">
              <span className="material-symbols-outlined text-lg">warning</span>
              <h3 className="text-sm font-semibold tracking-wider">원격 보안 비밀번호 재설정</h3>
            </div>
            <p className="text-xs text-slate-400">해당 엔드포인트 세션 위험 감지로 인해 즉시 변경이 권장됩니다.</p>
            <input 
              type="password" 
              placeholder="새 비밀번호 입력" 
              className="w-full bg-[#0B0C10] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF2E63] font-mono transition-colors"
            />
            <div className="flex space-x-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 bg-[#161923] border border-white/5 text-slate-300 py-2.5 rounded-xl text-xs hover:bg-[#1C202E] active:scale-95 transition-all"
              >
                취소
              </button>
              <button 
                onClick={onApplyPassword}
                disabled={passwordStatus === 'loading'}
                className="flex-1 bg-[#FF2E63] text-[#0B0C10] py-2.5 rounded-xl text-xs font-bold hover:bg-[#ff4d7c] active:scale-95 transition-all disabled:opacity-50"
              >
                {passwordStatus === 'loading' ? '변경 중...' : '보안 변경 적용'}
              </button>
            </div>
            {passwordStatus === 'success' && (
              <p className="text-center text-xs text-[#00F5D4] font-mono animate-pulse">성공적으로 변경되었습니다.</p>
            )}
          </div>
        )}

        {/* 2. 원격 로그아웃 모달 */}
        {activeModal === 'logout' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[#00F5D4]">
              <span className="material-symbols-outlined text-lg animate-pulse">emergency</span>
              <h3 className="text-sm font-semibold tracking-wider">원격 세션 즉시 차단 중...</h3>
            </div>
            <p className="text-xs text-slate-400">원격 엔드포인트(확인되지 않은 경로) 세션 강제 종료 수행 중...</p>
            
            {/* 실시간 네트워크 차단율 게이지 프로그레스 바 */}
            <div className="w-full bg-[#0B0C10] h-2.5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="bg-gradient-to-r from-[#00F5D4] to-blue-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${logoutProgress}%` }}
              />
            </div>

            {logoutCompleted ? (
              <div className="space-y-3 pt-2">
                <p className="text-center text-xs text-[#00F5D4] font-mono">
                  ✔ 해당 기기의 접근 권한이 영구 차단되었습니다.
                </p>
                <button 
                  onClick={onClose}
                  className="w-full bg-[#00F5D4]/10 border border-[#00F5D4]/30 text-[#00F5D4] py-2.5 rounded-xl text-xs font-bold hover:bg-[#00F5D4]/20 active:scale-95 transition-all"
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

// SVG 세계 지도의 가상 2D 좌표 리턴 헬퍼
const getCoordsForLocation = (name: string): [number, number] => {
  const norm = (name || '').toLowerCase();
  
  if (norm.includes('러시아') || norm.includes('russia') || norm.includes('moscow') || norm.includes('모스크바')) {
    return [420, 110];
  }
  if (norm.includes('부산') || norm.includes('busan')) {
    return [690, 175];
  }
  if (norm.includes('서울') || norm.includes('seoul') || norm.includes('한국') || norm.includes('korea')) {
    return [675, 160];
  }
  if (norm.includes('미국') || norm.includes('usa') || norm.includes('new york') || norm.includes('뉴욕')) {
    return [160, 130];
  }
  if (norm.includes('la') || norm.includes('los angeles') || norm.includes('샌프란시스코')) {
    return [110, 155];
  }
  if (norm.includes('독일') || norm.includes('germany') || norm.includes('berlin') || norm.includes('베를린') || norm.includes('유럽')) {
    return [375, 120];
  }
  if (norm.includes('중국') || norm.includes('china') || norm.includes('beijing') || norm.includes('베이징')) {
    return [620, 145];
  }
  if (norm.includes('싱가포르') || norm.includes('singapore')) {
    return [605, 245];
  }
  if (norm.includes('호주') || norm.includes('australia') || norm.includes('sydney') || norm.includes('시드니')) {
    return [710, 335];
  }
  if (norm.includes('일본') || norm.includes('japan') || norm.includes('tokyo') || norm.includes('도쿄')) {
    return [705, 155];
  }
  
  // 기본 좌표: 모스크바(러시아)
  return [420, 110];
};

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

  // 토스트 전용 상태 및 메소드
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
    return { origin: '러시아', destination: '부산' }; // 기본 테스트 시 데모용 기본값 제공
  }, [incoming?.raw]);

  const route = propsRoute ?? parsedRoute;

  // 동적 지도 앵커 설정
  const originCoords = useMemo(() => getCoordsForLocation(route.origin), [route.origin]);
  const destCoords = useMemo(() => getCoordsForLocation(route.destination), [route.destination]);

  // bezier control point 계산
  const pathD = useMemo(() => {
    const [x1, y1] = originCoords;
    const [x2, y2] = destCoords;
    const cx = (x1 + x2) / 2;
    const cy = Math.min(y1, y2) - 50; // 위로 볼록하게
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  }, [originCoords, destCoords]);

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
      <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col items-center justify-center p-6 font-sans select-none">
        <div className="bg-[#12141C] border border-[#FF2E63]/30 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)] animate-fade-in">
          <div className="w-16 h-16 bg-[#FF2E63]/10 border border-[#FF2E63]/30 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(255,46,99,0.15)]">
            <span className="text-[#FF2E63] text-3xl">⚠️</span>
          </div>
          <h2 className="text-sm font-bold text-slate-200 mb-2">유효하지 않은 보안 세션</h2>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
            유효하지 않은 보안 세션입니다.<br />메인 화면으로 이동합니다.
          </p>
          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-[#161923] border border-white/5 text-slate-200 hover:text-white py-3 rounded-2xl text-xs font-semibold hover:bg-[#1C202E] active:scale-95 transition-all"
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

  const routeLabel = route.origin !== '알 수 없음' && route.destination !== '알 수 없음'
    ? `${route.origin} → ${route.destination}`
    : '러시아 → 부산 (확인되지 않은 접근)';

  const displayTime = useMemo(() => {
    if (!incoming.timeISO) return '알 수 없음';
    return new Date(incoming.timeISO).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
  }, [incoming.timeISO]);

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
    <div className="min-h-screen bg-[#0B0C10] text-white p-6 pb-28 font-sans select-none flex flex-col gap-6">
      
      {/* 커스텀 키프레임 애니메이션 주입 */}
      <style>{`
        @keyframes path-glow {
          0% {
            stroke-dashoffset: 200;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .animate-laser {
          animation: path-glow 3s linear infinite;
        }
        @keyframes map-pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.3; }
        }
        .animate-map-glow {
          animation: map-pulse 4s ease-in-out infinite;
        }
      `}</style>

      {/* Back button */}
      <header className="flex justify-between items-center w-full pb-4 border-b border-white/5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-slate-400 text-xs hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back_ios</span>
          뒤로가기
        </button>
        <span className="text-xs font-bold tracking-wider text-[#FF2E63]">Threat Intelligence Portal</span>
      </header>

      {/* 세계 지도 UI 풀스크린(Full-width) 패널 */}
      <div className="w-full flex flex-col gap-6">
        <div className="relative bg-[#12141C] border border-white/5 rounded-2xl p-6 flex flex-col justify-between overflow-hidden min-h-[400px] lg:min-h-[550px] shadow-2xl">
          
          {/* 상단 메타 헤더 */}
          <div className="flex justify-between items-start z-10">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#FF2E63] uppercase">Global Threat Tracking Map</span>
              <h3 className="text-base font-bold mt-1 tracking-wide">실시간 공격 세션 위협 경로</h3>
            </div>
            <div className="flex items-center gap-2 bg-[#0B0C10] border border-white/5 px-3 py-1.5 rounded-lg text-[10px] font-mono text-[#00F5D4]">
              <span className="w-1.5 h-1.5 bg-[#00F5D4] rounded-full animate-ping" />
              GPS LINKED
            </div>
          </div>

          {/* 다크 사이버펑크 2D 세계 지도 SVG 영역 (웅장하게 확장된 스케일) */}
          <div className="relative flex-1 flex items-center justify-center my-6">
            <svg 
              viewBox="0 0 800 360" 
              className="w-full h-full max-h-[480px] drop-shadow-[0_0_24px_rgba(0,0,0,0.9)]"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 1. 하이테크 모눈 격자 배경 */}
              <defs>
                <pattern id="map-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0, 245, 212, 0.04)" strokeWidth="0.75" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#map-grid)" className="rounded-xl" />

              {/* 2. 추상화된 대륙 패스들 (네온 블루 테마의 프리미엄 사이버펑크 무드) */}
              <g className="opacity-45 animate-map-glow">
                {/* 북미/남미 대륙 */}
                <path 
                  d="M 60 70 L 140 70 L 165 110 L 130 150 L 140 190 L 180 230 L 165 310 L 145 340 L 130 300 L 105 240 L 95 210 L 50 160 L 40 110 Z" 
                  fill="rgba(0, 245, 212, 0.08)" 
                  stroke="rgba(0, 245, 212, 0.2)" 
                  strokeWidth="1.2" 
                />
                {/* 유라시아 대륙 */}
                <path 
                  d="M 280 60 L 420 50 L 610 60 L 685 90 L 710 130 L 695 190 L 650 200 L 620 160 L 550 210 L 490 230 L 450 180 L 400 160 L 320 180 L 290 130 L 260 110 Z" 
                  fill="rgba(0, 245, 212, 0.08)" 
                  stroke="rgba(0, 245, 212, 0.2)" 
                  strokeWidth="1.2" 
                />
                {/* 아프리카 대륙 */}
                <path 
                  d="M 310 180 L 390 180 L 420 200 L 430 240 L 400 300 L 365 320 L 345 280 L 330 240 L 300 220 Z" 
                  fill="rgba(0, 245, 212, 0.08)" 
                  stroke="rgba(0, 245, 212, 0.2)" 
                  strokeWidth="1.2" 
                />
                {/* 호주 대륙 */}
                <path 
                  d="M 640 260 L 690 270 L 710 300 L 675 320 L 630 300 Z" 
                  fill="rgba(0, 245, 212, 0.08)" 
                  stroke="rgba(0, 245, 212, 0.2)" 
                  strokeWidth="1.2" 
                />
              </g>

              {/* 3. 공격 추적 네온 레이저 경로 (Bezier Curve) */}
              <path 
                d={pathD} 
                fill="none" 
                stroke="#FF2E63" 
                strokeWidth="2" 
                strokeOpacity="0.3" 
              />
              
              {/* 실시간 흐르는 네온 광선 선 (Dash-array 애니메이션) */}
              <path 
                d={pathD} 
                fill="none" 
                stroke="#FF2E63" 
                strokeWidth="4" 
                strokeLinecap="round" 
                strokeDasharray="40 160" 
                className="animate-laser" 
                style={{ filter: 'drop-shadow(0 0 8px #FF2E63)' }}
              />

              {/* 4. 출발지 노드 (공격지: Origin) */}
              <g transform={`translate(${originCoords[0]}, ${originCoords[1]})`}>
                <circle r="16" fill="none" stroke="#FF2E63" strokeWidth="1" className="animate-ping" strokeOpacity="0.6" />
                <circle r="6.5" fill="#FF2E63" style={{ filter: 'drop-shadow(0 0 6px #FF2E63)' }} />
                <text 
                  y="-16" 
                  textAnchor="middle" 
                  fill="#FF2E63" 
                  className="text-[10px] font-mono font-bold"
                  style={{ textShadow: '0 0 5px rgba(255, 46, 99, 0.8)' }}
                >
                  {route.origin.toUpperCase()} (공격 근원)
                </text>
              </g>

              {/* 5. 목적지 노드 (대상지: Target) */}
              <g transform={`translate(${destCoords[0]}, ${destCoords[1]})`}>
                <circle r="18" fill="none" stroke="#00F5D4" strokeWidth="1.2" className="animate-ping" strokeOpacity="0.7" />
                <circle r="6.5" fill="#00F5D4" style={{ filter: 'drop-shadow(0 0 6px #00F5D4)' }} />
                <text 
                  y="-16" 
                  textAnchor="middle" 
                  fill="#00F5D4" 
                  className="text-[10px] font-mono font-bold"
                  style={{ textShadow: '0 0 5px rgba(0, 245, 212, 0.8)' }}
                >
                  {route.destination.toUpperCase()} (경유 거점)
                </text>
              </g>
            </svg>
          </div>

          {/* 하단 지리 좌표계 스탯 레이블 */}
          <div className="flex justify-between items-center bg-[#0B0C10]/60 backdrop-blur-sm border border-white/5 rounded-xl p-3.5 z-10 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[#FF2E63] font-semibold">ORIGIN:</span> LAT {originCoords[1]}, LNG {originCoords[0]}
              </div>
              <div>
                <span className="text-[#00F5D4] font-semibold">DEST:</span> LAT {destCoords[1]}, LNG {destCoords[0]}
              </div>
            </div>
            <div className="text-right">
              PATH STATE: <span className="text-[#FF2E63] font-bold animate-pulse">ACTIVE THREAT DETECTED</span>
            </div>
          </div>

        </div>
      </div>

      {/* 정보 및 제어 영역 (하단 2열 구성) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 왼쪽 패널: 상세 정보 카드 */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label="보안 엔드포인트" value={routeLabel} sub="원격 접근 경로 분석" />
            <InfoCell label="발생 시각" value={displayTime} sub="시간 역행 무결성 확인" />
            <InfoCell label="기기 명칭" value={incoming.device?.name ?? '확인되지 않음'} sub={`ID: ${incoming.device?.id ?? 'N/A'}`} />
            <InfoCell label="접속 IP 주소" value={incoming.ip ?? '확인되지 않음'} sub="패킷 위조 방지 활성" />
          </div>

          <div className="bg-[#12141C] border border-white/5 rounded-2xl p-4.5 space-y-2">
            <h4 className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">보안 분석 세션 현황</h4>
            <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-[#0B0C10] border border-white/5">
              <span className="text-slate-400 font-mono">침입 차단 시스템(IPS)</span>
              <span className="text-[#00F5D4] font-mono font-bold">STANDBY</span>
            </div>
            <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-[#0B0C10] border border-white/5">
              <span className="text-slate-400 font-mono">워프 추적 무결성</span>
              <span className="text-[#FF2E63] font-mono font-bold animate-pulse">WARNING (ANOMALY)</span>
            </div>
          </div>
        </div>

        {/* 오른쪽 패널: 보안 제어 버튼 카드 */}
        <div className="bg-[#12141C] border border-white/5 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold tracking-wide text-white mb-1">보안 위협 제어 소스</h4>
            <p className="text-[11px] text-slate-400">감지된 비정상 로그인 경로에 대해 아래 원격 제어 옵션을 즉시 실행할 수 있습니다.</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleBlockAccess}
              disabled={isBlocking}
              className={`w-full text-[#0B0C10] py-4 rounded-xl font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-60 ${
                isBlocking
                  ? 'bg-red-700/70 cursor-not-allowed text-white'
                  : 'bg-[#FF2E63] hover:bg-[#ff4d7c] hover:shadow-[0_0_20px_rgba(255,46,99,0.4)] shadow-[0_0_10px_rgba(255,46,99,0.2)]'
              }`}
            >
              {isBlocking ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  차단 요청 중...
                </>
              ) : (
                '⛔ BLOCK ACCESS (접근 차단)'
              )}
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveModal('password')}
                className="bg-[#161923] border border-white/5 text-slate-300 py-3 rounded-xl text-xs font-semibold hover:bg-[#1C202E] hover:border-[#FF2E63]/30 hover:text-white active:scale-95 transition-all duration-200"
              >
                🔑 비밀번호 변경
              </button>
              <button
                onClick={openLogoutModal}
                className="bg-[#161923] border border-white/5 text-slate-300 py-3 rounded-xl text-xs font-semibold hover:bg-[#1C202E] hover:border-[#00F5D4]/30 hover:text-white active:scale-95 transition-all duration-200"
              >
                🚪 원격 로그아웃
              </button>
            </div>
          </div>
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
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-xl border text-xs font-mono font-semibold tracking-wide flex items-center gap-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] transition-all duration-300 animate-fade-in z-[60] ${
          toastType === 'success' 
            ? 'bg-[#12141C] border-[#00F5D4]/30 text-[#00F5D4] shadow-[0_0_20px_rgba(0,245,212,0.15)]' 
            : 'bg-[#12141C] border-[#FF2E63]/30 text-[#FF2E63] shadow-[0_0_20px_rgba(255,46,99,0.15)]'
        }`}>
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white/5 text-[10px]">
            {toastType === 'success' ? '✔' : '✕'}
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default WarpAnalysisPage;
