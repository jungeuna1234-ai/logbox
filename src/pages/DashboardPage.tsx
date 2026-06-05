import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogBox } from '../context/LogBoxContext';
import { mapThreatToVelocity } from '../utils/recordUtils';
import { ThreatLevel } from '../utils/geoUtils';
import { LogBoxRecord } from '../types/index';
import { fetchSecurityEmails } from '../services/gmailService';
import { enrichThreatLevels } from '../utils/enrichRecords';
import { isDeviceTrusted } from '../utils/deviceUtils';

const parsePlatform = (text?: string): string => {
  const raw = (text || '').toLowerCase();
  if (raw.includes('google')) return 'google';
  if (raw.includes('naver')) return 'naver';
  if (raw.includes('kakao')) return 'kakao';
  if (raw.includes('instagram')) return 'instagram';
  if (raw.includes('discord')) return 'discord';
  if (raw.includes('netflix')) return 'netflix';
  if (raw.includes('steam')) return 'steam';
  return 'unknown';
};

const parseRoute = (rawText?: string) => {
  const text = rawText || '';
  const match = text.match(/([^\s·[\]]+)\s*(?:→|->)\s*([^\s·[\]]+)/);
  if (match) {
    return {
      origin: match[1].trim(),
      destination: match[2].trim(),
    };
  }
  return {
    origin: '알 수 없음',
    destination: '알 수 없음',
  };
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    speed: contextSpeed,
    isLoading,
    syncTime: contextSyncTime,
    blockAccessHandler,
    whitelistHandler,
    logs,
    userProfile,
    isGoogleConnected: contextIsGoogleConnected,
    syncGmail,
  } = useLogBox();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localLogs, setLocalLogs] = useState<LogBoxRecord[]>([]);
  const [localLoading, setLocalLoading] = useState<boolean>(false);

  const gmailToken = localStorage.getItem('gmail_token');
  const isGoogleConnected = contextIsGoogleConnected || !!gmailToken;

  const fetchLocalGmail = async (token: string) => {
    setLocalLoading(true);
    try {
      const fetched = await fetchSecurityEmails(token);
      const enriched = enrichThreatLevels(fetched);
      setLocalLogs(enriched);
    } catch (err) {
      console.error('[DashboardPage] Failed to fetch security emails:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    if (gmailToken) {
      void fetchLocalGmail(gmailToken);
    }
  }, [gmailToken]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (gmailToken) {
        await fetchLocalGmail(gmailToken);
      } else {
        await syncGmail();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const isCurrentlyLoading = isLoading || isRefreshing || localLoading;

  const displayLogs = useMemo(() => {
    return gmailToken ? localLogs : logs;
  }, [gmailToken, localLogs, logs]);

  const recentLogs = useMemo(
    () => [...displayLogs].sort((a, b) => (b.timeISO ?? '').localeCompare(a.timeISO ?? '')).slice(0, 4),
    [displayLogs],
  );

  const isThreatDetected = useMemo(() => {
    return displayLogs.some((record) => {
      if (isDeviceTrusted(record.device?.name)) return false;
      return (record.threatLevel ?? 0) >= ThreatLevel.Critical;
    });
  }, [displayLogs]);

  const attackRecord = recentLogs.find((record) => (record.threatLevel ?? 0) >= ThreatLevel.Critical) ?? recentLogs[0];
  
  const attackTime = attackRecord?.timeISO
    ? new Date(attackRecord.timeISO).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Now';
  
  const attackRoute = useMemo(() => parseRoute(attackRecord?.raw), [attackRecord]);
  
  const attackIp = useMemo(() => {
    const ip = attackRecord?.ip;
    if (!ip || ip.trim() === '' || ip.toUpperCase() === 'N/A') {
      return '확인되지 않음';
    }
    return ip;
  }, [attackRecord]);

  const speed = useMemo(() => {
    if (displayLogs.length === 0) return 0;
    const maxThreat = Math.max(...displayLogs.map((record) => record.threatLevel ?? 0));
    return mapThreatToVelocity(maxThreat);
  }, [displayLogs]);

  const syncTime = useMemo(() => {
    if (displayLogs.length === 0) return null;
    const sorted = [...displayLogs].sort((a, b) => (b.timeISO ?? '').localeCompare(a.timeISO ?? ''));
    const latest = sorted[0]?.timeISO;
    if (!latest) return null;
    try {
      return new Date(latest).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return latest;
    }
  }, [displayLogs]);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white p-6 pb-28 select-none relative font-sans overflow-x-hidden">
      <header className="flex justify-between items-center w-full mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#FF2E63] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            security
          </span>
          <span className="text-xl font-bold tracking-wider text-white">LOGBOX</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isCurrentlyLoading}
            className="flex items-center justify-center p-2 rounded-xl bg-[#121318] border border-white/10 text-slate-400 hover:text-white hover:border-white/20 active:scale-95 transition-all duration-200 disabled:opacity-40"
            title="최신 업데이트"
          >
            <span className={`material-symbols-outlined text-lg ${isCurrentlyLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
          <span className="text-[10px] font-mono tracking-widest text-[#00F5D4] bg-[#00F5D4]/10 px-3 py-1 rounded-full border border-[#00F5D4]/20">
            실시간 보호 중
          </span>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-6">
        {/* User profile info */}
        <div className="w-full bg-[#121318] border border-white/10 rounded-2xl p-6 flex flex-col justify-center gap-1 shadow-lg">
          <span className="text-xs text-slate-500 font-medium">
            {isGoogleConnected ? '연결됨 · 실제 계정' : '데모 모드 활성화됨'}
          </span>
          <span className="text-sm font-mono text-[#00F5D4] font-semibold">
            {isGoogleConnected ? (userProfile?.email ?? '계정 정보 없음') : 'demo@logbox.io'}
          </span>
        </div>

        {/* System scanner state */}
        {!isThreatDetected && (
          <section className="flex flex-col items-center justify-center py-6 relative overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div className="relative w-60 h-60 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle className="text-slate-800/30" cx="120" cy="120" fill="transparent" r="110" stroke="currentColor" strokeWidth="4" />
                <circle
                  className="text-[#00F5D4] transition-all duration-500"
                  cx="120"
                  cy="120"
                  fill="transparent"
                  r="110"
                  stroke="currentColor"
                  strokeDasharray="691.15"
                  strokeDashoffset={isCurrentlyLoading ? '450' : '130'}
                  strokeWidth="4"
                />
              </svg>
              <div className="z-10 flex flex-col items-center">
                <div className={`w-28 h-28 bg-[#121318] rounded-full flex items-center justify-center mb-3 border border-white/10 ${isCurrentlyLoading ? 'animate-pulse' : ''}`}>
                  <span className="material-symbols-outlined text-[#00F5D4] text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified_user
                  </span>
                </div>
                <h2 className="text-xl text-[#00F5D4] font-bold tracking-widest font-mono">
                  {isCurrentlyLoading ? '메일 검사 중...' : '내 계정 안전함'}
                </h2>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F5D4] animate-ping" />
              <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">
                {isCurrentlyLoading ? '실시간 접근 신호 분석 중...' : '연결된 이메일 검사 완료'}
              </p>
            </div>
          </section>
        )}

        {/* Threat detected state */}
        {isThreatDetected && (
          <section className="animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-[#121318] rounded-2xl p-6 border border-white/10 shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 p-6">
                <span className="text-[10px] font-mono text-[#FF2E63]/60 tracking-wider">위험도: 매우 위험</span>
              </div>
              <div className="flex items-center gap-2.5 mb-5">
                <span className="material-symbols-outlined text-[#FF2E63] animate-bounce" style={{ fontVariationSettings: "'FILL' 1" }}>
                  emergency
                </span>
                <h3 className="text-lg font-bold text-[#FF2E63] tracking-tight">이상 접근 감지!</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5 relative">
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500 font-mono">{attackTime}</p>
                  <p className="text-sm font-bold text-white">{attackRoute.origin}</p>
                  <p className="text-[11px] font-mono text-[#FF2E63]/60">IP: {attackIp}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[11px] text-[#FF2E63] font-mono">Now</p>
                  <p className="text-sm font-bold text-white">{attackRoute.destination}</p>
                  <p className="text-[11px] font-mono text-[#FF2E63]/60">비정상 접속 감지</p>
                </div>
                <div className="col-span-2 h-14 relative flex items-center justify-center my-2">
                  <div className="absolute w-full h-[1px] bg-gradient-to-r from-[#00F5D4]/40 via-[#FF2E63]/60 to-[#FF2E63]" />
                  <div className="absolute left-0 w-2 h-2 bg-[#00F5D4] rounded-full" />
                  <div className="absolute right-0 w-2 h-2 bg-[#FF2E63] rounded-full" />
                  <div className="bg-[#121318] px-4 py-1 rounded-full border border-white/10 z-10 shadow-md">
                    <span className="text-xs font-mono text-[#FF2E63] font-bold">
                      Speed: {speed.toLocaleString()}km/h (위반)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => blockAccessHandler()}
                  className="w-full bg-[#FF2E63] text-[#0B0C10] font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#ff4d7c] active:scale-95 transition-all duration-200 text-sm"
                >
                  <span className="material-symbols-outlined text-sm">block</span>
                  해커 기기 차단하기
                </button>
                <button
                  onClick={() => whitelistHandler()}
                  className="w-full border border-white/10 text-slate-400 font-medium py-2.5 rounded-xl hover:bg-white/5 active:scale-95 transition-all duration-200 text-xs tracking-wider font-mono"
                >
                  내가 접속한 게 맞아요
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Recent logs */}
        <section className="animate-[fadeIn_0.4s_ease-out] space-y-4">
          <h4 className="text-xs text-slate-500 font-bold uppercase tracking-widest font-mono">최근 로그</h4>
          <ul className="space-y-3" aria-label="최근 보안 로그">
            {isCurrentlyLoading ? (
              Array.from({ length: 3 }, (_, index) => (
                <li key={index} className="h-24 rounded-2xl bg-[#121318] animate-pulse border border-white/10" />
              ))
            ) : recentLogs.length === 0 ? (
              <li className="rounded-2xl border border-white/10 bg-[#121318] p-6 text-center text-sm text-slate-500">
                표시할 로그가 없습니다.
              </li>
            ) : (
              recentLogs.map((record) => <InlineLogItem key={record.id} record={record} />)
            )}
          </ul>
        </section>

        <div className="text-center pt-4">
          <p className="text-[11px] font-mono text-slate-600 tracking-wide">
            Gmail 마지막 동기화: {syncTime || '없음'}
          </p>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;

const InlineLogItem: React.FC<{ record: LogBoxRecord }> = ({ record }) => {
  const rawText = record.raw || record.device?.name || '';
  const platform = record.platform || parsePlatform(rawText);
  const navigate = useNavigate();

  let badgeBg = 'bg-[#181920]';
  let badgeBorder = 'border-white/10';
  let badgeText = 'text-slate-400';
  let badgeChar: React.ReactNode = '🔒';
  
  if (platform === 'google') {
    badgeBg = 'bg-[#FF2E63]/10';
    badgeBorder = 'border-white/10';
    badgeText = 'text-[#FF2E63]';
    badgeChar = 'G';
  } else if (platform === 'naver') {
    badgeBg = 'bg-[#03C75A]/10';
    badgeBorder = 'border-[#03C75A]/20';
    badgeText = 'text-[#03C75A]';
    badgeChar = 'N';
  } else if (platform === 'kakao') {
    badgeBg = 'bg-[#FEE500]/10';
    badgeBorder = 'border-[#FEE500]/20';
    badgeText = 'text-[#FEE500]';
    badgeChar = 'K';
  } else if (platform === 'instagram') {
    badgeBg = 'bg-pink-500/10';
    badgeBorder = 'border-pink-500/20';
    badgeText = 'text-pink-500';
    badgeChar = 'I';
  } else if (platform === 'discord') {
    badgeBg = 'bg-indigo-500/10';
    badgeBorder = 'border-indigo-500/20';
    badgeText = 'text-indigo-500';
    badgeChar = 'D';
  } else if (platform === 'netflix') {
    badgeBg = 'bg-red-600/10';
    badgeBorder = 'border-red-600/20';
    badgeText = 'text-red-500';
    badgeChar = 'N';
  } else if (platform === 'steam') {
    badgeBg = 'bg-sky-500/10';
    badgeBorder = 'border-sky-500/20';
    badgeText = 'text-sky-400';
    badgeChar = 'S';
  }

  const formatTimeLine = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return iso;
    }
  };

  const rowStatusBadge = (threatLevel?: number): React.ReactNode => {
    if (isDeviceTrusted(record.device?.name)) {
      return (
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold text-[#00F5D4] bg-[#00F5D4]/15 border border-[#00F5D4]/20">
          신뢰 기기
        </span>
      );
    }
    if (threatLevel === undefined) {
      return <span className="text-xs px-2.5 py-1 rounded-full text-slate-500 bg-[#181920] border border-white/10">알 수 없음</span>;
    }
    if (threatLevel >= ThreatLevel.Critical) {
      return <span className="text-xs px-2.5 py-1 rounded-full font-semibold text-[#FF2E63] bg-[#FF2E63]/15 border border-[#FF2E63]/20">위협</span>;
    }
    if (threatLevel >= ThreatLevel.High) {
      return <span className="text-xs px-2.5 py-1 rounded-full font-semibold text-orange-400 bg-orange-400/15 border border-orange-400/20">주의</span>;
    }
    const kmh = mapThreatToVelocity(threatLevel);
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold text-[#00F5D4] bg-[#00F5D4]/15 border border-[#00F5D4]/20">{kmh} km/h</span>
    );
  };

  const handleClick = () => {
    navigate(`/warp-analysis?id=${record.id}`, { state: { logData: record } });
  };

  const route = parseRoute(record.raw);
  const displayName = route.origin !== '알 수 없음' && route.destination !== '알 수 없음'
    ? `${route.origin} → ${route.destination}`
    : (record.device?.name || rawText || '알 수 없는 경로');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <li>
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${displayName} 보안 로그 상세 보기`}
        className="group cursor-pointer flex items-center justify-between p-4 bg-[#121318] rounded-2xl border border-white/10 hover:border-white/20 hover:bg-[#181920] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-white/20"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border group-hover:scale-105 transition-transform duration-200 ${badgeBg} ${badgeBorder} ${badgeText} font-bold text-base`}>
            {badgeChar}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{displayName}</div>
            <div className="text-xs text-[#94A3B8] mt-1" title={record.timeISO}>{formatTimeLine(record.timeISO)}</div>
          </div>
        </div>
        <div className="shrink-0 ml-2 flex items-center gap-2">
          {rowStatusBadge(record.threatLevel)}
          <span className="material-symbols-outlined text-slate-600 group-hover:text-[#FF2E63] text-base transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>chevron_right</span>
        </div>
      </div>
    </li>
  );
};
