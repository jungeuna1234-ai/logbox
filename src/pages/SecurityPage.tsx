// src/pages/SecurityPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLogBox, SecurityLog } from '../context/LogBoxContext';

// ──────────────────────────────────────────────────
// 가상 비동기 API 통신 시뮬레이션 (85% 성공, 15% 500 에러)
// ──────────────────────────────────────────────────
const simulateApiCall = async (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.15) resolve();
      else reject(new Error('Network Error 500 (Internal Server Error)'));
    }, 1200);
  });
};

// ──────────────────────────────────────────────────
// 토스트 컴포넌트
// ──────────────────────────────────────────────────
interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({ message, type }) => (
  <div
    className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl border text-xs font-mono font-semibold tracking-wide flex items-center gap-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] animate-fade-in z-[60] ${
      type === 'success'
        ? 'bg-[#05110d]/90 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
        : 'bg-[#110508]/90 border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
    }`}
  >
    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px]">
      {type === 'success' ? '✔' : '✕'}
    </span>
    <span>{message}</span>
  </div>
);

// ──────────────────────────────────────────────────
// 위협 콘솔 로그 아이템
// ──────────────────────────────────────────────────
const LogLine: React.FC<{ log: SecurityLog }> = ({ log }) => {
  const isAlert = log.level !== 'INFO';
  return (
    <div
      className={`font-mono text-[10px] leading-relaxed px-2 py-1 rounded-lg flex gap-2 items-start ${
        isAlert
          ? 'bg-rose-950/20 border-l-2 border-rose-500'
          : 'border-l-2 border-transparent'
      }`}
    >
      {/* 타임스탬프 */}
      <span className="text-slate-600 shrink-0">{log.timestamp}</span>
      {/* 레벨 배지 */}
      {isAlert ? (
        <span className="text-rose-400 font-bold shrink-0">
          {log.level === 'SPOOFED_EMAIL' ? '[🚨 SPOOFED]' : '[🚨 TAMPERED]'}
        </span>
      ) : (
        <span className="text-emerald-600/70 shrink-0">[INFO]</span>
      )}
      {/* 메시지 */}
      <span className={isAlert ? 'text-rose-300/80' : 'text-slate-500'}>{log.message}</span>
    </div>
  );
};

// ──────────────────────────────────────────────────
// 🛡️ 메인 SecurityPage
// ──────────────────────────────────────────────────
const SecurityPage: React.FC = () => {
  const { securityLogs, addSecurityLog } = useLogBox();

  // ── 토스트 상태 ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ── 피싱 분석 패널 상태 ──
  const [spoofedDetected] = useState<boolean>(true); // 데모: 위조 메일 감지 상태
  const [linkIsolation, setLinkIsolation] = useState<boolean>(false);
  const [isolationLoading, setIsolationLoading] = useState<boolean>(false);

  const handleIsolationToggle = useCallback(async () => {
    if (isolationLoading) return;
    setIsolationLoading(true);
    const next = !linkIsolation;
    try {
      await simulateApiCall();
      setLinkIsolation(next);
      showToast(
        next ? '악성 URL 격리가 활성화되었습니다.' : '링크 격리가 해제되었습니다.',
        'success',
      );
    } catch {
      showToast('서버 통신에 실패했습니다. (500)', 'error');
    } finally {
      setIsolationLoading(false);
    }
  }, [isolationLoading, linkIsolation, showToast]);

  // ── 위협 콘솔: 5초 타이머 기반 로그 생성 ──
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const INFO_MESSAGES = [
    'Packet integrity check passed.',
    'Auth token validated.',
    'TLS handshake OK.',
    'Session heartbeat ACK.',
    'DNS query resolved.',
    'Firewall rule applied.',
    'Geo-fence boundary OK.',
    'Device fingerprint matched.',
    'Rate limit check passed.',
    'Encryption layer nominal.',
  ];

  const generateLog = useCallback((): SecurityLog => {
    const rand = Math.random();
    const now = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (rand < 0.15) {
      return { id, timestamp: now, level: 'SPOOFED_EMAIL', message: 'Spoofed sender detected via DKIM mismatch.' };
    }
    if (rand < 0.30) {
      return { id, timestamp: now, level: 'TOKEN_TAMPERED', message: 'JWT signature verification failed — replay attack suspected.' };
    }
    const msg = INFO_MESSAGES[Math.floor(Math.random() * INFO_MESSAGES.length)];
    return { id, timestamp: now, level: 'INFO', message: msg };
  }, []);

  // 마운트 시 즉시 첫 로그 + 5초마다 생성, 언마운트 후에도 Context에 영속
  useEffect(() => {
    // 기존 로그가 없을 때만 초기 로그 생성
    if (securityLogs.length === 0) {
      addSecurityLog(generateLog());
    }

    intervalRef.current = setInterval(() => {
      addSecurityLog(generateLog());
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [addSecurityLog, generateLog]);

  // 새 로그 추가 시 스크롤 최상단 유지 (최신 로그 상단)
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollTop = 0;
    }
  }, [securityLogs.length]);

  return (
    <div className="min-h-screen bg-[#05070a] text-white font-sans select-none pb-28">
      {/* ── 최상단 배지 ── */}
      <div className="flex items-center justify-center pt-5 pb-3 px-4">
        <div className="flex items-center gap-2 bg-[#1a0a1a]/80 border border-rose-500/30 rounded-full px-4 py-1.5 shadow-[0_0_16px_rgba(244,63,94,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(244,63,94,1)]" />
          <span className="text-[11px] font-mono font-bold tracking-widest text-rose-400 uppercase">
            Security Admin Only
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(244,63,94,1)]" />
        </div>
      </div>

      {/* ── 2분할 메인 패널 ── */}
      <div className="px-3 flex flex-col gap-3 lg:flex-row lg:gap-4 lg:px-5">

        {/* ════════════════════════════════════
            좌측 패널: 피싱 분석
            ════════════════════════════════════ */}
        <section
          className="flex-1 bg-[#0d0f14]/90 border border-slate-800/60 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
          aria-label="피싱 분석 패널"
        >
          {/* 패널 헤더 */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-rose-950/40 border border-rose-500/30 flex items-center justify-center">
              <span className="text-rose-400 text-sm">📧</span>
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-200 tracking-wide">피싱 분석</h2>
              <p className="text-[10px] text-slate-500 font-mono">Email Threat Intelligence</p>
            </div>
          </div>

          {/* SPOOFED 경고 배너 */}
          {spoofedDetected && (
            <div
              className="mb-4 px-3 py-2.5 rounded-xl border border-rose-500/50 bg-rose-950/20 shadow-[0_0_16px_rgba(244,63,94,0.15)]"
              style={{ animation: 'spoofedPulse 1.6s ease-in-out infinite' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-rose-400 text-sm shrink-0">⚠️</span>
                <div>
                  <p className="text-[11px] font-bold font-mono text-rose-400 tracking-widest uppercase">
                    SPOOFED (위조됨)
                  </p>
                  <p className="text-[10px] text-rose-300/70 mt-0.5">
                    발신자 도메인 불일치 · DKIM 서명 위조 감지
                  </p>
                </div>
              </div>
              <div className="mt-2 text-[9px] font-mono text-slate-500 space-y-0.5">
                <p>FROM: no-reply@g00gle-security.net</p>
                <p>SPF: <span className="text-rose-400">FAIL</span> · DKIM: <span className="text-rose-400">FAIL</span> · DMARC: <span className="text-rose-400">FAIL</span></p>
              </div>
            </div>
          )}

          {/* 링크 격리 토글 */}
          <div className="bg-[#111417]/80 border border-slate-800/50 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-200">LINK ISOLATION</p>
                <p className="text-[10px] text-slate-500 font-mono">악성 URL 자동 격리 차단</p>
              </div>
              {/* 토글 스위치 */}
              <button
                id="link-isolation-toggle"
                onClick={handleIsolationToggle}
                disabled={isolationLoading}
                aria-checked={linkIsolation}
                role="switch"
                className={`relative w-11 h-6 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 active:scale-95 ${
                  linkIsolation
                    ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${
                    linkIsolation
                      ? 'left-5 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                      : 'left-0.5 bg-slate-500'
                  }`}
                >
                  {isolationLoading && (
                    <span className="w-2 h-2 border border-white/60 border-t-transparent rounded-full animate-spin" />
                  )}
                </span>
              </button>
            </div>
            <div
              className={`text-[10px] font-mono rounded-lg px-2 py-1.5 ${
                linkIsolation
                  ? 'text-emerald-400 bg-emerald-950/30 border border-emerald-500/20'
                  : 'text-slate-500 bg-slate-900/50 border border-slate-800'
              }`}
            >
              {linkIsolation
                ? '✔ 격리 활성 — 모든 링크가 샌드박스 검사 후 전달됩니다.'
                : '○ 격리 비활성 — 링크가 필터링 없이 전달됩니다.'}
            </div>
          </div>

          {/* 법적 안내문 */}
          <div className="bg-[#0a0c10]/60 border border-slate-800/30 rounded-xl p-3">
            <p className="text-[9px] font-mono text-slate-600 leading-relaxed">
              <span className="text-slate-500 font-bold">⚖ 법적 고지 (Legal Notice)</span><br />
              본 격리 기능은 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제48조에 따라
              악성 콘텐츠 접근 차단 목적으로만 사용됩니다. 무단 콘텐츠 수집·분석 행위는
              동법 제49조 위반에 해당하며 민·형사상 책임이 발생할 수 있습니다.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════
            우측 패널: 위협 콘솔
            ════════════════════════════════════ */}
        <section
          className="flex-1 bg-[#060809]/95 border border-slate-800/60 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md flex flex-col"
          aria-label="위협 콘솔 패널"
        >
          {/* 콘솔 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                <span className="text-emerald-400 text-sm">⌨</span>
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-200 tracking-wide">위협 콘솔</h2>
                <p className="text-[10px] text-slate-500 font-mono">Real-time Threat Stream</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_rgba(52,211,153,1)]" />
              <span className="text-[10px] font-mono text-emerald-400/80">LIVE</span>
            </div>
          </div>

          {/* 터미널 콘솔 */}
          <div
            ref={consoleBottomRef}
            className="flex-1 bg-[#020304] border border-slate-900 rounded-xl p-3 overflow-y-auto max-h-[300px] min-h-[180px] space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
          >
            {/* 터미널 헤더 줄 */}
            <div className="text-[10px] font-mono text-slate-700 mb-2 pb-2 border-b border-slate-900">
              logbox-threat-stream v2.4.1 · 5s interval · max 100 entries
            </div>
            {securityLogs.length === 0 ? (
              <div className="text-[10px] text-slate-700 font-mono animate-pulse">
                초기화 중...
              </div>
            ) : (
              securityLogs.map((log) => <LogLine key={log.id} log={log} />)
            )}
          </div>

          {/* 콘솔 하단 상태 바 */}
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[9px] font-mono text-slate-700">
              {securityLogs.length} / 100 entries
            </span>
            <span className="text-[9px] font-mono text-slate-700">
              위협: {securityLogs.filter(l => l.level !== 'INFO').length}건
            </span>
          </div>
        </section>
      </div>

      {/* 토스트 */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* 네온 펄스 애니메이션 인젝션 */}
      <style>{`
        @keyframes spoofedPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(244,63,94,0.15); border-color: rgba(244,63,94,0.4); }
          50% { box-shadow: 0 0 20px rgba(244,63,94,0.4); border-color: rgba(244,63,94,0.7); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default SecurityPage;
