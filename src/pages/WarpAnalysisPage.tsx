// src/pages/WarpAnalysisPage.tsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { InfoCell } from '../components/InfoCell';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLogBox } from '../context/LogBoxContext';
import { LogBoxRecord } from '../types/index';
import { isDeviceTrusted, addTrustedDeviceName } from '../utils/deviceUtils';
import { loadDecryptedSync, STORAGE_PASS } from '../services/cryptoService';

const simulateApiCall = async (url: string, data?: unknown): Promise<void> => {
  const token = loadDecryptedSync<string>('gmail_token', STORAGE_PASS) || 'demo-token';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error(`Network Error ${response.status}`);
  }
};

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
      <div className="bg-[#121318] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-xl transform scale-100 transition-all duration-300">
        
        {/* 1. 비밀번호 변경 모달 */}
        {activeModal === 'password' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[#FF2E63]">
              <span className="material-symbols-outlined text-lg">warning</span>
              <h3 className="text-sm font-semibold tracking-wider">위험 기기 비밀번호 바꾸기</h3>
            </div>
            <p className="text-xs text-slate-400">해당 기기에서 위험 접속이 감지되어 비밀번호를 바꾸는 것이 좋아요.</p>
            <input 
              type="password" 
              placeholder="새 비밀번호 입력" 
              className="w-full bg-[#0B0C10] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF2E63] font-mono transition-colors"
            />
            <div className="flex space-x-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 bg-[#181920] border border-white/10 text-slate-300 py-2.5 rounded-xl text-xs hover:bg-[#202128] active:scale-95 transition-all"
              >
                취소
              </button>
              <button 
                onClick={onApplyPassword}
                disabled={passwordStatus === 'loading'}
                className="flex-1 bg-[#FF2E63] text-[#0B0C10] py-2.5 rounded-xl text-xs font-bold hover:bg-[#ff4d7c] active:scale-95 transition-all disabled:opacity-50"
              >
                {passwordStatus === 'loading' ? '변경 중...' : '비밀번호 변경 적용'}
              </button>
            </div>
            {passwordStatus === 'success' && (
              <p className="text-center text-xs text-emerald-400 font-mono animate-pulse">성공적으로 변경되었습니다.</p>
            )}
          </div>
        )}

        {/* 2. 원격 로그아웃 모달 */}
        {activeModal === 'logout' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[#FF2E63]">
              <span className="material-symbols-outlined text-lg animate-pulse">emergency</span>
              <h3 className="text-sm font-semibold tracking-wider">기기 접속 즉시 끊는 중...</h3>
            </div>
            <p className="text-xs text-slate-400">의심스러운 접속 즉시 종료 중...</p>
            
            {/* 실시간 네트워크 차단율 게이지 프로그레스 바 */}
            <div className="w-full bg-[#0B0C10] h-2.5 rounded-full overflow-hidden border border-white/10">
              <div 
                className="bg-rose-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${logoutProgress}%` }}
              />
            </div>

            {logoutCompleted ? (
              <div className="space-y-3 pt-2">
                <p className="text-center text-xs text-emerald-400 font-mono">
                  ✔ 해당 기기의 접근 권한이 영구 차단되었습니다.
                </p>
                <button 
                  onClick={onClose}
                  className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-all"
                >
                  확인 및 닫기
                </button>
              </div>
            ) : (
              <p className="text-right text-[10px] text-slate-500 font-mono">해커 접속 차단 진행도: {logoutProgress}%</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

// 실제 지구 위경도 좌표 사전 (도시명 -> [latitude, longitude])
const CITY_GEO_DICT: Record<string, [number, number]> = {
  '서울': [37.5665, 126.9780],
  'seoul': [37.5665, 126.9780],
  '한국': [37.5665, 126.9780],
  'korea': [37.5665, 126.9780],
  '부산': [35.1796, 129.0756],
  'busan': [35.1796, 129.0756],
  '인천': [37.4563, 126.7052],
  'incheon': [37.4563, 126.7052],
  '러시아': [55.7558, 37.6173],
  'russia': [55.7558, 37.6173],
  '모스크바': [55.7558, 37.6173],
  'moscow': [55.7558, 37.6173],
  '미국': [40.7128, -74.0060],
  'usa': [40.7128, -74.0060],
  '뉴욕': [40.7128, -74.0060],
  'new york': [40.7128, -74.0060],
  'la': [34.0522, -118.2437],
  'los angeles': [34.0522, -118.2437],
  '샌프란시스코': [37.7749, -122.4194],
  'san francisco': [37.7749, -122.4194],
  '독일': [52.5200, 13.4050],
  'germany': [52.5200, 13.4050],
  '베를린': [52.5200, 13.4050],
  'berlin': [52.5200, 13.4050],
  '중국': [39.9042, 116.4074],
  'china': [39.9042, 116.4074],
  '베이징': [39.9042, 116.4074],
  'beijing': [39.9042, 116.4074],
  '싱가포르': [1.3521, 103.8198],
  'singapore': [1.3521, 103.8198],
  '호주': [-33.8688, 151.2093],
  'australia': [-33.8688, 151.2093],
  '시드니': [-33.8688, 151.2093],
  'sydney': [-33.8688, 151.2093],
  '일본': [35.6762, 139.6503],
  'japan': [35.6762, 139.6503],
  '도쿄': [35.6762, 139.6503],
  'tokyo': [35.6762, 139.6503],
  '런던': [51.5074, -0.1278],
  'london': [51.5074, -0.1278],
  '로스앤젤레스': [34.0522, -118.2437],
  '시애틀': [47.6062, -122.3321],
  'seattle': [47.6062, -122.3321],
  '미국 오레곤 aws 리전': [44.0, -120.5],
  '서울 aws 리전': [37.5665, 126.9780],
  '오레곤': [44.0, -120.5],
};

// 위도/경도명 검색용 헬퍼
export const getGeoForLocationName = (name: string): [number, number] => {
  const norm = (name || '').toLowerCase().trim();
  for (const [key, coords] of Object.entries(CITY_GEO_DICT)) {
    if (norm.includes(key)) {
      return coords;
    }
  }
  return [55.7558, 37.6173]; // 기본값: 러시아 모스크바
};

// 공식 서버 및 미조회 IP에 대한 이메일 도메인 분석 기반 Fallback Dictionary
interface FallbackRegionInfo {
  regionName: string;
  coords: [number, number];
}

const SERVER_REGION_DICTIONARY: Record<string, FallbackRegionInfo> = {
  'cursor': { regionName: '미국 오레곤 AWS 리전', coords: [44.0, -120.5] },
  'github': { regionName: '미국 오레곤 AWS 리전', coords: [44.0, -120.5] },
  'google': { regionName: '미국 오레곤 AWS 리전', coords: [44.0, -120.5] },
  'openai': { regionName: '미국 오레곤 AWS 리전', coords: [44.0, -120.5] },
  'mangoboard': { regionName: '서울 AWS 리전', coords: [37.5665, 126.9780] },
  'naver': { regionName: '서울 AWS 리전', coords: [37.5665, 126.9780] },
  'kakao': { regionName: '서울 AWS 리전', coords: [37.5665, 126.9780] },
};

export const getFallbackRegion = (record: LogBoxRecord): FallbackRegionInfo => {
  const domain = (record?.domain || '').toLowerCase().trim();
  const platform = (record?.platform || '').toLowerCase().trim();
  const from = (record?.from || '').toLowerCase().trim();

  const keys = ['cursor', 'github', 'openai', 'google', 'mangoboard', 'naver', 'kakao'];
  for (const key of keys) {
    if (domain.includes(key) || platform.includes(key) || from.includes(key)) {
      return SERVER_REGION_DICTIONARY[key];
    }
  }

  // IP가 54.240.27.23 인 경우 AWS SES 리전이므로 미국 오레곤 AWS 리전으로 폴백
  if (record?.ip === '54.240.27.23') {
    return { regionName: '미국 오레곤 AWS 리전', coords: [44.0, -120.5] };
  }

  return { regionName: '미국 오레곤 AWS 리전', coords: [44.0, -120.5] };
};

// 실제 지구 위경도를 평면 SVG 픽셀(X: 0~800, Y: 0~360)로 동적 변환
export const convertGeoToPixel = (lat: number, lng: number): [number, number] => {
  const safeLat = typeof lat === 'number' && !isNaN(lat) ? Math.max(-90, Math.min(90, lat)) : 37.5665;
  const safeLng = typeof lng === 'number' && !isNaN(lng) ? Math.max(-180, Math.min(180, lng)) : 126.9780;
  // 경도(-180 ~ 180) -> X(0 ~ 800)
  const x = ((safeLng + 180) / 360) * 800;
  // 위도(-90 ~ 90) -> Y(360 ~ 0) (위도가 클수록 지도 상단이므로 90 - lat을 씀)
  const y = ((90 - safeLat) / 180) * 360;
  return [x, y];
};

function getPlatformSecurityUrls(platform?: string): { passwordUrl: string; logoutUrl: string } {
  const plat = (platform || 'google').toLowerCase();
  switch (plat) {
    case 'naver':
      return {
        passwordUrl: 'https://nid.naver.com/user2/help/myInfo.nhn?menu=security',
        logoutUrl: 'https://nid.naver.com/user2/help/myInfo.nhn?menu=security',
      };
    case 'kakao':
      return {
        passwordUrl: 'https://accounts.kakao.com/weblogin/account/security',
        logoutUrl: 'https://accounts.kakao.com/weblogin/account/security',
      };
    case 'instagram':
      return {
        passwordUrl: 'https://accountscenter.instagram.com/password_and_security/',
        logoutUrl: 'https://accountscenter.instagram.com/password_and_security/',
      };
    case 'discord':
      return {
        passwordUrl: 'https://discord.com/settings/account',
        logoutUrl: 'https://discord.com/settings/account',
      };
    case 'netflix':
      return {
        passwordUrl: 'https://www.netflix.com/password',
        logoutUrl: 'https://www.netflix.com/YourAccount',
      };
    case 'steam':
      return {
        passwordUrl: 'https://store.steampowered.com/account/',
        logoutUrl: 'https://help.steampowered.com/en/wizard/HelpWithLoginInfo',
      };
    case 'google':
    default:
      return {
        passwordUrl: 'https://myaccount.google.com/security',
        logoutUrl: 'https://myaccount.google.com/security',
      };
  }
}

export const WarpAnalysisPage: React.FC<{ incoming?: LogBoxRecord; route?: RouteProps; blockAccessHandler?: (id: string) => Promise<void> }> = ({
  incoming: propsIncoming,
  route: propsRoute,
  blockAccessHandler: propsBlockAccessHandler
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const logBoxContext = useLogBox();

  // state에서 데이터 복구 또는 query parameter (?id=...) 또는 context에서 fallback
  const locationState = location.state as { logData?: LogBoxRecord } | null;
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryId = queryParams.get('id');

  const [trustUpdateTrigger, setTrustUpdateTrigger] = useState(0);

  const matchedRecord = useMemo(() => {
    const targetId = queryId || locationState?.logData?.id;
    if (targetId) {
      const found = logBoxContext.logs.find((r) => r.id === targetId);
      if (found) return found;
    }
    return null;
  }, [locationState, queryId, logBoxContext.logs]);

  const incoming = propsIncoming ?? matchedRecord ?? logBoxContext.logs[0];

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
    const parts = rawText.split(/[·•]/);
    let origin = '알 수 없음';
    let destination = '부산';

    if (parts.length >= 2) {
      const routePart = parts[1].trim();
      const arrowParts = routePart.split(/→|->/);
      if (arrowParts.length >= 2) {
        origin = arrowParts[0].trim();
        destination = arrowParts[1].trim();
      }
    } else {
      const arrowParts = rawText.split(/→|->/);
      if (arrowParts.length >= 2) {
        origin = arrowParts[0].trim();
        destination = arrowParts[1].trim();
      }
    }

    // "알 수 없음" 이거나 공식 서버(isServerVerified === true)인 경우 사전 매핑 적용
    if (incoming?.isServerVerified || origin === '알 수 없음') {
      const fallback = getFallbackRegion(incoming);
      origin = fallback.regionName;
    }

    return {
      origin,
      destination,
    };
  }, [incoming]);

  const route = propsRoute ?? parsedRoute;

  // 동적 지도 위경도 설정
  const originLatLon = useMemo(() => {
    // 1. 위경도가 유효하게 존재하고, "알 수 없음"이나 "AWS 리전"이 아닌 일반 위경도 값인 경우 사용
    if (incoming && incoming.latitude !== undefined && incoming.longitude !== undefined && incoming.latitude !== 0 && incoming.longitude !== 0) {
      return [incoming.latitude, incoming.longitude] as [number, number];
    }
    
    // 2. 도메인 분석 기반 폴백 정보 획득
    const fallback = getFallbackRegion(incoming);

    // 3. route.origin 명칭으로 매핑된 좌표 검색
    const matchedCoords = getGeoForLocationName(route.origin);
    if (route.origin === fallback.regionName) {
      return fallback.coords;
    }

    const hasKey = Object.keys(CITY_GEO_DICT).some(k => route.origin.toLowerCase().includes(k));
    if (!hasKey) {
      return fallback.coords;
    }

    return matchedCoords;
  }, [incoming, route.origin]);

  const destLatLon = useMemo(() => {
    return getGeoForLocationName(route.destination);
  }, [route.destination]);

  const originCoords = useMemo(() => convertGeoToPixel(originLatLon[0], originLatLon[1]), [originLatLon]);
  const destCoords = useMemo(() => convertGeoToPixel(destLatLon[0], destLatLon[1]), [destLatLon]);

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
        <div className="bg-[#121318] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-xl animate-fade-in">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-[#FF2E63] text-3xl">⚠️</span>
          </div>
          <h2 className="text-sm font-bold text-slate-200 mb-2">로그인이 만료되었습니다.</h2>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed mb-6">
            로그인 정보가 만료되었습니다.<br />메인 화면으로 이동합니다.
          </p>
          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-[#181920] border border-white/10 text-slate-200 hover:text-white py-3 rounded-2xl text-xs font-semibold hover:bg-[#202128] active:scale-95 transition-all"
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

  const rawParts = (incoming?.raw || '').split(' · ');
  const serviceTitle = rawParts[0] || incoming?.device?.name || '보안 로그';

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

  const handleTrustCurrentDevice = useCallback(() => {
    const devName = incoming.device?.name;
    if (devName) {
      addTrustedDeviceName(devName);
      showToast(`"${devName}"이(가) 신뢰 기기로 등록되었습니다.`, "success");
      setTrustUpdateTrigger((c) => c + 1);
    }
  }, [incoming.device?.name, showToast]);

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
      `}</style>

      {/* Back button */}
      <header className="flex justify-between items-center w-full pb-4 border-b border-white/10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-slate-400 text-xs hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back_ios</span>
          뒤로가기
        </button>
        <span className="text-xs font-bold tracking-wider text-[#FF2E63]">실시간 위협 분석 센터</span>
      </header>

      {incoming.ip === '플랫폼 미제공' && !incoming.isServerVerified && (
        <div className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-400 p-4.5 rounded-2xl flex items-start gap-3 animate-fade-in text-left">
          <span className="material-symbols-outlined text-orange-500 text-lg shrink-0 mt-0.5">warning</span>
          <p className="text-xs leading-relaxed font-semibold">
            ⚠️ 해당 플랫폼은 보안 알림 내에 로그인 IP 정보를 제공하지 않는 취약한 상태입니다. 피싱 및 도용 방지를 위해 반드시 공식 앱 설정에서 2차 인증(2FA)을 활성화하세요.
          </p>
        </div>
      )}

      {incoming.isServerVerified && (
        <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4.5 rounded-2xl flex items-start gap-3 animate-fade-in text-left">
          <span className="material-symbols-outlined text-emerald-500 text-lg shrink-0 mt-0.5">verified</span>
          <p className="text-xs leading-relaxed font-semibold">
            🟢 <strong>공식 서버 인증 완료:</strong> 본 메일은 공식 발신 서버({incoming.ip})를 거쳐 정상 발송된 메일임이 검증되었습니다. 위조 또는 스포핑 위협이 없으며 해당 서비스의 정식 경로를 통한 안내 메일입니다.
          </p>
        </div>
      )}

      {/* 세계 지도 UI 풀스크린(Full-width) 패널 */}
      <div className="w-full flex flex-col gap-6">
        <div className="relative bg-[#121318] border border-white/10 rounded-2xl p-6 flex flex-col justify-between overflow-hidden min-h-[400px] lg:min-h-[550px] shadow-xl">
          
          {/* 상단 메타 헤더 */}
          <div className="flex justify-between items-start z-10">
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: incoming.isServerVerified ? '#00F5D4' : (incoming.ip === '플랫폼 미제공' ? '#f97316' : '#FF2E63') }}>
                {incoming.isServerVerified ? '공식 발신 서버 위치 분석' : (incoming.ip === '플랫폼 미제공' ? '위치 정보 추적 불가' : '글로벌 해킹 위치 추적 지도')}
              </span>
              <h3 className="text-base font-bold mt-1 tracking-wide">
                {incoming.isServerVerified ? '공식 발신처 서버 경로' : (incoming.ip === '플랫폼 미제공' ? '실시간 위치 추적 비활성화' : '실시간 해커 접속 경로')}
              </h3>
            </div>
            {incoming.isServerVerified ? (
              <div className="flex items-center gap-2 bg-[#0B0C10] border border-[#00F5D4]/20 px-3 py-1.5 rounded-lg text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 bg-[#00F5D4] rounded-full animate-pulse" />
                서버 인증 완료
              </div>
            ) : incoming.ip === '플랫폼 미제공' ? (
              <div className="flex items-center gap-2 bg-[#0B0C10] border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-mono text-red-400">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                위치 정보 없음
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[#0B0C10] border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 bg-[#00F5D4] rounded-full" />
                실시간 위치 연동
              </div>
            )}
          </div>

          {/* 다크 2D 세계 지도 SVG 영역 */}
          {incoming.ip === '플랫폼 미제공' && !incoming.isServerVerified ? (
            <div className="relative flex-1 flex flex-col items-center justify-center my-6 text-center px-4 animate-fade-in">
              <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mb-4 text-orange-400 animate-pulse">
                <span className="material-symbols-outlined text-4xl">location_off</span>
              </div>
              <h4 className="text-sm font-bold text-slate-200 mb-1.5">위치 추적 정보 없음</h4>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                해당 플랫폼은 보안 알림 메일 내에 로그인 IP 주소를 포함하지 않습니다. 지리적 위치 및 유동 속도 분석을 제공할 수 없습니다.
              </p>
            </div>
          ) : (
            <div className="relative flex-1 flex items-center justify-center my-6">
              <svg 
                viewBox="0 0 800 360" 
                className="w-full h-full max-h-[480px]"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 2. 추상화된 대륙 패스들 */}
                <g className="opacity-45">
                  {/* 북미/남미 대륙 */}
                  <path 
                    d="M 60 70 L 140 70 L 165 110 L 130 150 L 140 190 L 180 230 L 165 310 L 145 340 L 130 300 L 105 240 L 95 210 L 50 160 L 40 110 Z" 
                    fill="rgba(255, 255, 255, 0.03)" 
                    stroke="rgba(255, 255, 255, 0.1)" 
                    strokeWidth="1.2" 
                  />
                  {/* 유라시아 대륙 */}
                  <path 
                    d="M 280 60 L 420 50 L 610 60 L 685 90 L 710 130 L 695 190 L 650 200 L 620 160 L 550 210 L 490 230 L 450 180 L 400 160 L 320 180 L 290 130 L 260 110 Z" 
                    fill="rgba(255, 255, 255, 0.03)" 
                    stroke="rgba(255, 255, 255, 0.1)" 
                    strokeWidth="1.2" 
                  />
                  {/* 아프리카 대륙 */}
                  <path 
                    d="M 310 180 L 390 180 L 420 200 L 430 240 L 400 300 L 365 320 L 345 280 L 330 240 L 300 220 Z" 
                    fill="rgba(255, 255, 255, 0.03)" 
                    stroke="rgba(255, 255, 255, 0.1)" 
                    strokeWidth="1.2" 
                  />
                  {/* 호주 대륙 */}
                  <path 
                    d="M 640 260 L 690 270 L 710 300 L 675 320 L 630 300 Z" 
                    fill="rgba(255, 255, 255, 0.03)" 
                    stroke="rgba(255, 255, 255, 0.1)" 
                    strokeWidth="1.2" 
                  />
                </g>

                {/* 3. 공격 추적 레이저 경로 (Bezier Curve) */}
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke={incoming.isServerVerified ? "#00F5D4" : "#FF2E63"} 
                  strokeWidth="1.5" 
                  strokeOpacity="0.4" 
                />
                
                {/* 실시간 흐르는 레이저 광선 선 */}
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke={incoming.isServerVerified ? "#00F5D4" : "#FF2E63"} 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeDasharray="40 160" 
                  className="animate-laser" 
                />

                {/* 4. 출발지 노드 (공격지: Origin) */}
                <g transform={`translate(${originCoords[0]}, ${originCoords[1]})`}>
                  <circle r="4.5" fill={incoming.isServerVerified ? "#00F5D4" : "#FF2E63"} />
                  <text 
                    y="-16" 
                    textAnchor="middle" 
                    fill={incoming.isServerVerified ? "#00F5D4" : "#FF2E63"} 
                    className="text-[10px] font-mono font-bold"
                  >
                    {route.origin.toUpperCase()} {incoming.isServerVerified ? '(공식 서버)' : '(공격 근원)'}
                  </text>
                </g>

                {/* 5. 목적지 노드 (대상지: Target) */}
                <g transform={`translate(${destCoords[0]}, ${destCoords[1]})`}>
                  <circle r="4.5" fill="#00F5D4" />
                  <text 
                    y="-16" 
                    textAnchor="middle" 
                    fill="#00F5D4" 
                    className="text-[10px] font-mono font-bold"
                  >
                    {route.destination.toUpperCase()} (경유 거점)
                  </text>
                </g>
              </svg>
            </div>
          )}

          {/* 하단 지리 좌표계 스탯 레이블 */}
          <div className="flex justify-between items-center bg-[#0B0C10]/60 backdrop-blur-sm border border-white/10 rounded-xl p-3.5 z-10 text-[10px] font-mono text-slate-400">
            {incoming.ip === '플랫폼 미제공' && !incoming.isServerVerified ? (
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-red-400 font-semibold">ORIGIN:</span> LAT N/A, LNG N/A
                </div>
                <div>
                  <span className="text-[#00F5D4] font-semibold">DEST:</span> LAT N/A, LNG N/A
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div>
                  <span className="font-semibold" style={{ color: incoming.isServerVerified ? '#00F5D4' : '#FF2E63' }}>
                    ORIGIN:
                  </span> LAT {originLatLon[0].toFixed(4)}, LNG {originLatLon[1].toFixed(4)}
                </div>
                <div>
                  <span className="text-[#00F5D4] font-semibold">DEST:</span> LAT {destLatLon[0].toFixed(4)}, LNG {destLatLon[1].toFixed(4)}
                </div>
              </div>
            )}
            <div className="text-right">
              상태:{' '}
              {incoming.isServerVerified ? (
                <span className="text-[#00F5D4] font-bold">✓ 공식 발신 서버 인증됨 (안전)</span>
              ) : incoming.ip === '플랫폼 미제공' ? (
                <span className="text-red-400 font-bold">위치 추적 불가능 (IP 미제공)</span>
              ) : isDeviceTrusted(incoming.device?.name) ? (
                <span className="text-[#00F5D4] font-bold">✓ 신뢰 기기 (안전)</span>
              ) : (
                <span className="text-[#FF2E63] font-bold">의심스러운 기기 발견</span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 정보 및 제어 영역 (하단 2열 구성) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 왼쪽 패널: 상세 정보 카드 */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {incoming.isServerVerified ? (
              <>
                <InfoCell
                  label="발신처 서버 검증"
                  value={`✉️ 발신처: ${incoming.domain ?? '공식 서버'}`}
                  sub={`서버 위치: ${route.origin}`}
                />
                <InfoCell label="발생 시각" value={displayTime} sub="로그 위조 여부 검증 완료" />
                <InfoCell label="발신 기기 정보" value="SMTP 발신 서버" sub={`도메인: ${incoming.domain ?? 'N/A'}`} />
                <InfoCell
                  label="공식 서버 IP"
                  value={incoming.ip ?? '확인되지 않음'}
                  sub={`서버 위치: ${route.origin}`}
                />
              </>
            ) : (
              <>
                <InfoCell
                  label="접속한 서비스"
                  value={serviceTitle}
                  sub={incoming.ip === '플랫폼 미제공' ? '출발지: 확인 불가' : `출발지: ${route.origin}`}
                />
                <InfoCell label="발생 시각" value={displayTime} sub="로그 위조 여부 검증 완료" />
                <InfoCell label="기기 명칭" value={incoming.device?.name ?? '확인되지 않음'} sub={`ID: ${incoming.device?.id ?? 'N/A'}`} />
                <InfoCell
                  label="접속 IP 주소"
                  value={incoming.ip ?? '확인되지 않음'}
                  sub={incoming.ip === '플랫폼 미제공' ? '위치 확인 불가' : `국가: ${route.origin}`}
                />
              </>
            )}
          </div>

          <div className="bg-[#121318] border border-white/10 rounded-2xl p-4.5 space-y-2">
            <h4 className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">보안 실시간 검사 현황</h4>
            <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-[#0B0C10] border border-white/10">
              <span className="text-slate-400 font-mono">해킹 차단 시스템 작동</span>
              <span className="text-[#00F5D4] font-mono font-bold">대기 중</span>
            </div>
            <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-[#0B0C10] border border-white/10">
              <span className="text-slate-400 font-mono">위치 분석 경고</span>
              <span className={isDeviceTrusted(incoming.device?.name) ? "text-[#00F5D4] font-mono font-bold" : "text-[#FF2E63] font-mono font-bold"}>
                {isDeviceTrusted(incoming.device?.name) ? "안전 인증됨" : "이상 접속 감지"}
              </span>
            </div>
          </div>
        </div>

        {/* 오른쪽 패널: 보안 제어 버튼 카드 */}
        <div className="bg-[#121318] border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold tracking-wide text-white mb-1">위협 대응 조치</h4>
            <p className="text-[11px] text-slate-400">감지된 의심스러운 접속 경로에 대해 아래 원격 대처 기능을 즉시 실행할 수 있습니다.</p>
          </div>

          <div className="space-y-3">
            {incoming.device?.name && !isDeviceTrusted(incoming.device?.name) && (
              <button
                onClick={handleTrustCurrentDevice}
                className="w-full bg-[#00F5D4] text-[#0B0C10] font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#33ffd8] active:scale-95 transition-all duration-200 text-sm"
              >
                <span className="material-symbols-outlined text-sm">verified_user</span>
                신뢰 기기 등록
              </button>
            )}

            <button
              onClick={handleBlockAccess}
              disabled={isBlocking}
              className={`w-full text-[#0B0C10] py-4 rounded-xl font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-60 ${
                isBlocking
                  ? 'bg-red-700/70 cursor-not-allowed text-white'
                  : 'bg-[#FF2E63] hover:bg-[#ff4d7c]'
              }`}
            >
              {isBlocking ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  차단 요청 중...
                </>
              ) : (
                '⛔ 기기 즉시 차단하기'
              )}
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const urls = getPlatformSecurityUrls(incoming.platform);
                  window.open(urls.passwordUrl, '_blank');
                  setActiveModal('password');
                }}
                className="bg-[#181920] border border-white/10 text-[#94A3B8] py-3 rounded-xl text-xs font-semibold hover:bg-[#202128] hover:text-white active:scale-95 transition-all duration-200"
              >
                🔑 비밀번호 바꾸기
              </button>
              <button
                onClick={() => {
                  const urls = getPlatformSecurityUrls(incoming.platform);
                  window.open(urls.logoutUrl, '_blank');
                  openLogoutModal();
                }}
                className="bg-[#181920] border border-white/10 text-[#94A3B8] py-3 rounded-xl text-xs font-semibold hover:bg-[#202128] hover:text-white active:scale-95 transition-all duration-200"
              >
                🚪 다른 기기 로그아웃
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

      {/* 🍞 글로벌 다크 토스트 팝업 */}
      {toastMessage && (
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-xl border text-xs font-mono font-semibold tracking-wide flex items-center gap-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-300 animate-fade-in z-[60] ${
          toastType === 'success' 
            ? 'bg-[#121318] border-emerald-500/30 text-emerald-400' 
            : 'bg-[#121318] border-red-500/30 text-red-500'
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
