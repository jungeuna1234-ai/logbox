import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogBox } from '../context/LogBoxContext';
import { mapThreatToVelocity } from '../utils/recordUtils';
import { ThreatLevel } from '../utils/geoUtils';
import { LogBoxRecord } from '../types/index';

const parsePlatformAndDevice = (text?: string) => {
  const raw = (text || '').toLowerCase();
  const result: { platform?: string; deviceModel?: string } = {};
  if (raw.includes('google')) result.platform = 'google';
  if (raw.includes('windows')) result.deviceModel = 'Windows PC';
  if (raw.includes('sm-s916n') || raw.includes('galaxy')) result.deviceModel = 'Galaxy S23';
  return result;
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
    speed,
    isLoading,
    syncTime,
    blockAccessHandler,
    whitelistHandler,
    logs,
    userProfile,
    isGoogleConnected,
  } = useLogBox();

  const recentLogs = useMemo(
    () => [...logs].sort((a, b) => (a.timeISO ?? '').localeCompare(b.timeISO ?? '')).slice(0, 4),
    [logs],
  );

  const isThreatDetected = useMemo(() => {
    return logs.some((record) => (record.threatLevel ?? 0) >= ThreatLevel.Critical);
  }, [logs]);

  const attackRecord = recentLogs.find((record) => (record.threatLevel ?? 0) >= ThreatLevel.Critical) ?? recentLogs[0];
  
  const attackTime = attackRecord?.timeISO
    ? new Date(attackRecord.timeISO).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Now';
  
  const attackRoute = useMemo(() => parseRoute(attackRecord?.raw), [attackRecord]);
  
  const attackIp = useMemo(() => {
    const ip = attackRecord?.ip ?? (attackRecord as any)?.ipAddress;
    if (!ip || ip.trim() === '' || ip.toUpperCase() === 'N/A') {
      return '확인되지 않음';
    }
    return ip;
  }, [attackRecord]);

  return (
    <div className="bg-[#05070A] min-h-screen text-[#e1e2e7] font-body-md overflow-x-hidden select-none pb-32 relative">
      <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-b from-transparent via-[#00f0ff]/5 to-transparent animate-[scan_4s_linear_infinite] pointer-events-none" />

      <header className="sticky top-0 w-full z-50 flex flex-col px-5 py-4 bg-[#111417]/80 backdrop-blur-xl border-b border-white/10 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
        <div className="flex justify-between items-center w-full mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00f0ff]" style={{ fontVariationSettings: "'FILL' 1" }}>
              security
            </span>
            <span className="text-xl font-bold tracking-tighter text-[#00f0ff]">LOGBOX</span>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-[#00f0ff] bg-[#00f0ff]/10 px-3 py-1 rounded-full border border-[#00f0ff]/20">
            가디언 액티브
          </span>
        </div>
        <div className="w-full bg-[#111417] border border-[#00f0ff]/20 rounded-xl p-3 flex flex-col justify-center">
          <span className="text-xs text-[#b9cacb]/80 font-medium mb-0.5">
            {isGoogleConnected ? '연결됨 · 실제 계정' : '데모 모드 활성화됨'}
          </span>
          <span className="text-sm font-mono text-[#00f0ff] font-semibold">
            {isGoogleConnected ? (userProfile?.email ?? '계정 정보 없음') : 'demo@logbox.io'}
          </span>
        </div>
      </header>

      <main className="pt-6 px-5 max-w-lg mx-auto space-y-8">
        {!isThreatDetected && (
          <section className="flex flex-col items-center justify-center py-6 relative overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div className="relative w-60 h-60 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle className="text-[#323539]/30" cx="120" cy="120" fill="transparent" r="110" stroke="currentColor" strokeWidth="4" />
                <circle
                  className="text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.6)] transition-all duration-500"
                  cx="120"
                  cy="120"
                  fill="transparent"
                  r="110"
                  stroke="currentColor"
                  strokeDasharray="691.15"
                  strokeDashoffset={isLoading ? '450' : '130'}
                  strokeWidth="4"
                />
              </svg>
              <div className="z-10 flex flex-col items-center">
                <div className={`w-28 h-28 bg-[#111417]/90 backdrop-blur-3xl rounded-full flex items-center justify-center mb-3 border border-[#00f0ff]/30 shadow-[0_0_20px_rgba(0,240,255,0.15)] ${isLoading ? 'animate-pulse' : ''}`}>
                  <span className="material-symbols-outlined text-[#00f0ff] text-5xl animate-[rotate-slow_20s_linear_infinite]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified_user
                  </span>
                </div>
                <h2 className="text-xl text-[#00f0ff] font-bold tracking-widest font-mono">
                  {isLoading ? '스캐닝...' : '시스템 시큐어'}
                </h2>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-[pulse_2s_infinite_ease-in-out] shadow-[0_0_8px_rgba(0,240,255,1)]" />
              <p className="text-[11px] text-[#b9cacb] uppercase tracking-widest font-mono">
                {isLoading ? '인바운드 패킷 벡터 분석 중...' : '연결된 이메일 스캔 중...'}
              </p>
            </div>
          </section>
        )}

        {isThreatDetected && (
          <section className="animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-[#111417]/90 backdrop-blur-3xl rounded-2xl p-6 border border-[#690005]/40 shadow-[0_0_25px_rgba(255,180,171,0.15)] overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4">
                <span className="text-[10px] font-mono text-[#ffb4ab]/60 tracking-wider">LVL: CRITICAL</span>
              </div>
              <div className="flex items-center gap-2.5 mb-5">
                <span className="material-symbols-outlined text-[#ffb4ab] animate-bounce" style={{ fontVariationSettings: "'FILL' 1" }}>
                  emergency
                </span>
                <h3 className="text-lg font-bold text-[#ffb4ab] tracking-tight">이상 접근 감지!</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5 relative">
                <div className="space-y-0.5">
                  <p className="text-[11px] text-[#b9cacb] font-mono">{attackTime}</p>
                  <p className="text-sm font-bold text-[#e1e2e7]">{attackRoute.origin}</p>
                  <p className="text-[11px] font-mono text-[#00f0ff]/60">IP: {attackIp}</p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[11px] text-[#ffb4ab] font-mono">Now</p>
                  <p className="text-sm font-bold text-[#e1e2e7]">{attackRoute.destination}</p>
                  <p className="text-[11px] font-mono text-[#ffb4ab]/60">위협 벡터 활성</p>
                </div>
                <div className="col-span-2 h-14 relative flex items-center justify-center my-1">
                  <div className="absolute w-full h-[1px] bg-gradient-to-r from-[#00f0ff]/40 via-[#ffb4ab]/60 to-[#ffb4ab]" />
                  <div className="absolute left-0 w-2 h-2 bg-[#00f0ff] rounded-full shadow-[0_0_10px_rgba(0,240,255,1)]" />
                  <div className="absolute right-0 w-2 h-2 bg-[#ffb4ab] rounded-full shadow-[0_0_10px_rgba(255,180,171,1)]" />
                  <div className="bg-[#111417] px-4 py-1 rounded-full border border-[#ffb4ab]/40 z-10 shadow-md">
                    <span className="text-xs font-mono text-[#ffb4ab] font-bold">
                      Speed: {speed.toLocaleString()}km/h (위반)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <button onClick={() => blockAccessHandler()} className="w-full bg-[#ffb4ab] text-[#690005] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all text-sm">
                  <span className="material-symbols-outlined text-sm">block</span>
                  블록 액세스
                </button>
                <button onClick={() => whitelistHandler()} className="w-full border border-[#3b494b] text-[#b9cacb] font-medium py-2.5 rounded-xl hover:bg-[#323539]/30 active:scale-[0.98] transition-all text-xs tracking-wider font-mono">
                  잇 워즈 미
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="animate-[fadeIn_0.4s_ease-out]">
          <h4 className="text-xs text-[#b9cacb] font-bold uppercase tracking-widest font-mono mb-4">최근 로그</h4>
          <ul className="space-y-3" aria-label="최근 보안 로그">
            {isLoading ? (
              Array.from({ length: 3 }, (_, index) => (
                <li key={index} className="h-24 rounded-3xl bg-[#111417]/70 animate-pulse" />
              ))
            ) : recentLogs.length === 0 ? (
              <li className="rounded-3xl border border-[#00f0ff]/10 bg-[#111417]/70 p-6 text-center text-sm text-[#b9cacb]">
                표시할 로그가 없습니다.
              </li>
            ) : (
              recentLogs.map((record) => <InlineLogItem key={record.id} record={record} />)
            )}
          </ul>
        </section>

        <div className="pt-2 text-center">
          <p className="text-[11px] font-mono text-[#b9cacb]/40 tracking-wide">
            Gmail 마지막 동기화: {syncTime || '없음'}
          </p>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;

const InlineLogItem: React.FC<{ record: LogBoxRecord }> = ({ record }) => {
  const rawText = record.raw || record.device?.name || '';
  const { platform } = parsePlatformAndDevice(rawText);
  const navigate = useNavigate();

  let badgeBg = 'bg-gray-900/60';
  let badgeBorder = 'border-gray-800';
  let badgeText = 'text-gray-400';
  let badgeChar: React.ReactNode = '🔒';
  if (platform === 'google') {
    badgeBg = 'bg-red-950/30';
    badgeBorder = 'border-red-900/50';
    badgeText = 'text-red-500';
    badgeChar = 'G';
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
    if (threatLevel === undefined) {
      return <span className="text-xs px-2 py-0.5 rounded text-gray-400 bg-gray-800/80">알 수 없음</span>;
    }
    if (threatLevel >= ThreatLevel.Critical) {
      return <span className="text-xs px-2 py-0.5 rounded font-semibold text-[#FF3B5C] bg-[#FF3B5C]/20">위협</span>;
    }
    if (threatLevel >= ThreatLevel.High) {
      return <span className="text-xs px-2 py-0.5 rounded font-semibold text-[#FF8A3D] bg-[#FF8A3D]/20">주의</span>;
    }
    const kmh = mapThreatToVelocity(threatLevel);
    return (
      <span className="text-xs px-2 py-0.5 rounded font-semibold text-[#3BD97A] bg-[#3BD97A]/20">{kmh} km/h</span>
    );
  };

  const handleClick = () => {
    const syncedRecord = {
      ...record,
      ip: record.ip ?? (record as any)?.ipAddress,
      latitude: record.latitude,
      longitude: record.longitude,
    };
    navigate('/warp-analysis', { state: { logData: syncedRecord } });
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
        className="group cursor-pointer flex items-center justify-between p-4 bg-[#111417]/80 rounded-3xl border border-[#00f0ff]/10 hover:border-[#00f0ff]/30 hover:bg-[#111c23]/80 hover:shadow-[0_0_20px_rgba(0,240,255,0.07)] active:scale-[0.97] transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#00f0ff]/40"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-2xl border group-hover:scale-105 transition-transform duration-200 ${badgeBg} ${badgeBorder} ${badgeText} font-bold text-base`}>
            {badgeChar}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{displayName}</div>
            <div className="text-xs text-[#b9cacb] mt-0.5" title={record.timeISO}>{formatTimeLine(record.timeISO)}</div>
          </div>
        </div>
        <div className="shrink-0 ml-2 flex items-center gap-2">
          {rowStatusBadge(record.threatLevel)}
          <span className="material-symbols-outlined text-[#00f0ff]/30 group-hover:text-[#00f0ff]/70 text-base transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>chevron_right</span>
        </div>
      </div>
    </li>
  );
};
