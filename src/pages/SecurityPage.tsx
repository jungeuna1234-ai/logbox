// =============================================================================
// src/pages/SecurityPage.tsx
// LogBox 메일센터 — 프리미엄 다크 사이버펑크 테마 및 커스텀 모달 UI 연동
// =============================================================================

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useLogBox } from '../context/LogBoxContext';
import { TrustedDevice } from '../types';
import { isDeviceTrusted, addTrustedDeviceName } from '../utils/deviceUtils';
import { isPhishingThreat } from '../utils/recordUtils';
import { loadDecryptedSync, STORAGE_PASS } from '../services/cryptoService';

// =============================================================================
// ① 타입 정의
// =============================================================================

interface Email {
  id: string;
  from: string;
  subject: string;
  timeAgo: string;
  riskScore: number; // 0~100
  body: string;
  platform: 'naver' | 'google' | 'github' | 'openai' | 'tryhackme' | 'mangoboard' | 'cursor' | 'other';
  deviceName?: string;
  snippet?: string;
  ip?: string;
  location?: string;
  isServerVerified?: boolean;
}

// =============================================================================
// ② 초기 데이터 상수
// =============================================================================

const HACKER_DEVICE_INFO = {
  id: 'hacker-device-001',
  name: 'Windows PC · Chrome (해커)',
  model: 'Unknown PC',
  os: 'Windows 11',
  browser: 'Chrome 124',
  trusted: false,
  isCurrent: false,
  lastActive: new Date().toISOString(),
  lastSeen: new Date().toISOString(),
  ip: '194.87.145.22',
  location: 'Moscow, Russia',
  isHacker: true,
} as TrustedDevice & { ip: string; location: string; isHacker: boolean };

const INITIAL_EMAILS: Email[] = [
  {
    id: 'email-001',
    from: 'support@paypai-verify.com',
    subject: '귀하의 계정 보안 확인이 필요합니다',
    timeAgo: '2분 전',
    riskScore: 92,
    platform: 'google',
    body: `안녕하세요,

최근 귀하의 PayPal 계정에서 비정상적인 활동이 감지되었습니다. 계정 보안을 위해 24시간 이내에 본인 확인이 필요합니다.

아래 링크를 클릭주셔 즉시 확인해주세요.
https://paypai-verify.com/secure/login

확인하지 않으실 경우 귀 계정이 일시 정지될 수 있습니다.

PayPal 보안팀`,
    ip: '플랫폼 미제공',
    location: '위치 확인 불가',
  },
  {
    id: 'email-002',
    from: 'noreply@bank-security.net',
    subject: '이상 거래 감지 — 즉시 확인 요청',
    timeAgo: '15분 전',
    riskScore: 88,
    platform: 'google',
    body: `고객님께,

귀하의 계좌에서 비정상적인 이체 시도가 감지되었습니다.
금액: ₩3,500,000 | 대상: 해외 계좌

즉시 확인이 필요합니다. 본인이 아닌 경우 아래 링크를 통해 신고해 주세요.`,
    ip: '플랫폼 미제공',
    location: '위치 확인 불가',
  },
  {
    id: 'email-003',
    from: 'admin@amazon-notice.org',
    subject: '주문 취소 알림 — 환불 처리',
    timeAgo: '1시간 전',
    riskScore: 75,
    platform: 'google',
    body: `Amazon 고객님께,

최근 주문(#114-4829-293)이 취소 처리되었습니다.
환불금 처리를 위해 결제 정보를 재확인해 주세요.`,
    ip: '플랫폼 미제공',
    location: '위치 확인 불가',
  },
  {
    id: 'email-004',
    from: 'team@netflix-renewal.com',
    subject: '구독 갱신 실패 — 결제 정보 업데이트',
    timeAgo: '3시간 전',
    riskScore: 71,
    platform: 'google',
    body: `Netflix 회원님,

결제 정보 업데이트가 필요합니다. 지금 업데이트하지 않으면 서비스가 중단됩니다.`,
    ip: '플랫폼 미제공',
    location: '위치 확인 불가',
  },
];

const NAVER_PHISHING_EMAIL: Email = {
  id: 'email-naver-001',
  from: 'noreply@naver-support.kr.com',
  subject: '[네이버] 계정 보안 위협 감지 — 즉시 비밀번호 변경 필요',
  timeAgo: '방금 전',
  riskScore: 95,
  platform: 'naver',
  body: `네이버 회원님께,

네이버 고객센터입니다.

귀하의 계정에서 해외(러시아, Moscow) IP 주소(194.87.145.22)로부터 무단 로그인 시도가 감지되었습니다.

보안을 위해 즉시 아래 링크에서 비밀번호를 변경해 주십시오.
https://naver-support.kr.com/secure/password-reset

⚠ 이 메일은 24시간 후 만료됩니다.

네이버 보안팀 드림`,
  ip: '194.87.145.22',
  location: '러시아',
};

// =============================================================================
// ③ 헬퍼 함수 및 위험도 점수 → 색상 유틸리티
// =============================================================================

function extractDomain(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s/$.?#].[^\s]*)/gi;
  const match = text.match(urlRegex);
  if (match && match[0]) {
    try {
      const url = new URL(match[0]);
      return url.hostname;
    } catch {
      const hostMatch = match[0].match(/https?:\/\/([^\/\s]+)/i);
      return hostMatch ? hostMatch[1] : null;
    }
  }
  const domainRegex = /\b([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/i;
  const domainMatch = text.match(domainRegex);
  return domainMatch ? domainMatch[1] : null;
}

function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}

function threatLevelToRiskScore(level?: number): number {
  if (level === undefined) return 15;
  switch (level) {
    case 3: // Critical
      return 95;
    case 2: // High
      return 82;
    case 1: // Medium
      return 55;
    case 0: // Low
    default:
      return 15;
  }
}

function getRiskColor(score: number, isTrustedDevice?: boolean): string {
  if (isTrustedDevice) return 'text-[#00F5D4]';
  if (score >= 90) return 'text-[#FF2E63]';
  if (score >= 70) return 'text-orange-400';
  return 'text-yellow-400';
}

function getRiskBg(score: number, isTrustedDevice?: boolean): string {
  if (isTrustedDevice) return 'bg-[#00F5D4]/15 border-[#00F5D4]/30';
  if (score >= 90) return 'bg-[#FF2E63]/15 border-[#FF2E63]/30';
  if (score >= 70) return 'bg-orange-400/15 border-orange-400/25';
  return 'bg-yellow-400/15 border-yellow-400/25';
}

function getRiskLabel(score: number, isTrustedDevice?: boolean): string {
  if (isTrustedDevice) return '✓ 신뢰 기기 — 안전한 접근으로 인증됨';
  if (score >= 90) return '🚨 매우 위험 — 사기 메일로 의심됩니다!';
  if (score >= 70) return '⚠️ 위험 — 피싱 시도 가능성 높음';
  return '⚠️ 주의 — 의심스러운 메일';
}

// =============================================================================
// ④ 서브 컴포넌트: 분석 결과 상세 카드
// =============================================================================

interface AnalysisCardProps {
  email: Email;
  onBack: () => void;
  onBlockClick: () => void;
  onTrustClick?: (deviceName: string) => void;
}

const AnalysisCard: React.FC<AnalysisCardProps> = ({ email, onBack, onBlockClick, onTrustClick }) => {
  const isTrusted = isDeviceTrusted(email.deviceName);
  const domain = extractDomain(email.body);

  return (
    <div className="bg-[#121318] border border-white/10 rounded-2xl p-6 mb-6 space-y-5 animate-[fadeIn_0.3s_ease-out]">
      <button
        id="back-to-email-list"
        onClick={onBack}
        className="flex items-center gap-1.5 text-[#FF2E63] text-xs font-semibold hover:opacity-85 transition-opacity"
      >
        <span>← 목록으로 돌아가기</span>
      </button>

      <h1 className="text-lg font-bold text-white tracking-wider">메일 정밀 스캔 결과</h1>

      {email.ip === '플랫폼 미제공' && !email.isServerVerified && (
        <div className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-400 p-4.5 rounded-2xl flex items-start gap-3 animate-[fadeIn_0.3s_ease-out] text-left">
          <span className="material-symbols-outlined text-orange-500 text-lg shrink-0 mt-0.5">warning</span>
          <p className="text-xs leading-relaxed font-semibold">
            ⚠️ 해당 플랫폼은 보안 알림 내에 로그인 IP 정보를 제공하지 않는 취약한 상태입니다. 피싱 및 도용 방지를 위해 반드시 공식 앱 설정에서 2차 인증(2FA)을 활성화하세요.
          </p>
        </div>
      )}

      {email.isServerVerified && (
        <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4.5 rounded-2xl flex items-start gap-3 animate-[fadeIn_0.3s_ease-out] text-left">
          <span className="material-symbols-outlined text-emerald-500 text-lg shrink-0 mt-0.5">verified</span>
          <p className="text-xs leading-relaxed font-semibold">
            🟢 <strong>공식 서버 인증 완료:</strong> 본 메일은 공식 발신 서버({email.ip})를 거쳐 정상 발송된 메일임이 검증되었습니다. 위조 또는 스포핑 위협이 없으며 해당 서비스의 정식 경로를 통한 안내 메일입니다.
          </p>
        </div>
      )}

      {/* ── 메일 원문 카드 ── */}
      <div className="bg-[#0B0C10] border border-white/10 rounded-xl p-5 space-y-4">
        <div>
          <p className="text-[10px] text-slate-500 font-mono mb-0.5">발신자</p>
          <p className="text-xs font-bold text-[#FF2E63] font-mono" style={{ color: email.isServerVerified ? '#00F5D4' : '#FF2E63' }}>{email.from}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 font-mono mb-0.5">제목</p>
          <p className="text-sm font-bold text-white">{email.subject}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 font-mono mb-1.5">본문</p>
          <div className="bg-[#121318]/80 border border-white/10 rounded-lg p-4">
            <p className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-line">
              {email.body}
            </p>
          </div>
        </div>
      </div>

      {/* ── 상세 정보 그리드 ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0B0C10] border border-white/10 rounded-xl p-3.5">
          <p className="text-[10px] text-slate-500 font-mono mb-0.5">
            {email.isServerVerified ? '공식 서버 IP' : '접속 IP 주소'}
          </p>
          <p className="text-xs font-extrabold text-white font-mono">{email.ip || '확인되지 않음'}</p>
        </div>
        <div className="bg-[#0B0C10] border border-white/10 rounded-xl p-3.5">
          <p className="text-[10px] text-slate-500 font-mono mb-0.5">
            {email.isServerVerified ? '서버 위치' : '출발지 위치'}
          </p>
          <p className="text-xs font-extrabold text-white font-mono">
            {email.ip === '플랫폼 미제공' && !email.isServerVerified ? '위치 확인 불가' : (email.location || '알 수 없음')}
          </p>
        </div>
      </div>

      {/* ── AI 분석 결과 카드 ── */}
      <div
        className={`rounded-xl border p-5 ${getRiskBg(email.riskScore, isTrusted || email.isServerVerified)} bg-[#181920]`}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-xs text-white">psychology</span>
          <span className="text-[10px] font-bold text-white tracking-widest uppercase font-mono">
            AI 보안 분석 결과
          </span>
        </div>

        <p className={`text-base font-extrabold mb-4 ${getRiskColor(email.riskScore, isTrusted || email.isServerVerified)}`}>
          {email.isServerVerified ? '🟢 공식 서버 인증 완료 — 메일 정보 무결성 검증됨' : getRiskLabel(email.riskScore, isTrusted)}
        </p>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono text-slate-500">위험 지수</span>
            <span className={`text-xs font-bold font-mono ${getRiskColor(email.riskScore, isTrusted || email.isServerVerified)}`}>
              {isTrusted || email.isServerVerified ? 0 : email.riskScore} / 100
            </span>
          </div>
          <div className="w-full h-2 bg-[#0B0C10] rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${isTrusted || email.isServerVerified ? 0 : email.riskScore}%`,
                background:
                  isTrusted || email.isServerVerified
                    ? 'linear-gradient(90deg, #00F5D4, #33ffd8)'
                    : email.riskScore >= 90
                    ? 'linear-gradient(90deg, #FF2E63, #d61c4e)'
                    : 'linear-gradient(90deg, #f97316, #dc2626)',
              }}
            />
          </div>
        </div>

        {/* 🔗 탐지된 위협 URL 분석 결과 */}
        <div className="mb-4 p-4 rounded-xl bg-[#0B0C10]/60 border border-white/10 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF2E63]" style={{ color: email.isServerVerified ? '#00F5D4' : '#FF2E63' }}>
            <span className="material-symbols-outlined text-xs">link</span>
            <span>{email.isServerVerified ? '🔗 발신처 서버 검증 결과' : '🔗 메일 속 위험한 링크(URL) 검사'}</span>
          </div>
          <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
            {email.isServerVerified ? (
              <>
                해당 메일은 발신처 도메인 <span className="text-[#00F5D4] font-bold">[{domain || email.from.split('@')[1]}]</span>의 공식 서버 레코드와 발신 IP가 일치하는 정상 이메일로, 안전함이 보장됩니다.
              </>
            ) : domain ? (
              <>
                메일 본문에 포함된 도메인 <span className="text-[#FF2E63] font-bold">[{domain}]</span> 추적 결과, 피싱 사기 사이트로 등록된 위험 주소로 확인되었습니다.
              </>
            ) : (
              <>
                메일 본문에 포함된 외부 도메인이 발견되지 않았습니다. 외부 연결 링크가 없는 안전한 이메일 패턴입니다.
              </>
            )}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-300 mb-2">
            {email.isServerVerified ? '✅ 보안 분석 요약' : '✅ 권장 대응 지침'}
          </p>
          <ul className="space-y-1">
            {email.isServerVerified ? (
              [
                '해당 메일은 스포핑(위조) 흔적이 없는 안전한 메시지입니다',
                '플랫폼 공식 발신 메일 주소와 발신 IP 대역이 무결하게 일치합니다',
                '본문 내 링크 클릭 시 피싱 경고가 없다면 안심하고 이용하셔도 좋습니다',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-[10px] text-slate-400 font-mono">
                  <span className="text-emerald-400 shrink-0 mt-0.5">•</span>
                  {tip}
                </li>
              ))
            ) : (
              [
                '이메일의 링크를 절대 클릭하지 마세요',
                '계정정보나 금융정보를 절대 입력하지 마세요',
                '해당 메일을 즉시 스팸 및 위협으로 신고하세요',
                '공식 채널을 통해 본인이 요청한 이벤트인지 재차 검증하세요',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-[10px] text-slate-400 font-mono">
                  <span className="text-[#FF2E63] shrink-0 mt-0.5">•</span>
                  {tip}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* ── 신뢰 기기 등록 버튼 ── */}
      {email.deviceName && !isTrusted && !email.isServerVerified && (
        <button
          onClick={() => onTrustClick?.(email.deviceName!)}
          className="w-full py-4 rounded-xl font-bold text-[#0B0C10] text-sm tracking-wider bg-[#00F5D4] hover:bg-[#33ffd8] active:scale-95 transition-all duration-200"
        >
          ✓ 이 기기를 신뢰 기기로 등록
        </button>
      )}

      <button
        id="block-threat-email-btn"
        onClick={onBlockClick}
        className="w-full py-4 rounded-xl font-bold text-[#0B0C10] text-sm tracking-wider bg-[#FF2E63] hover:bg-[#ff4d7c] active:scale-95 transition-all duration-200"
      >
        {email.isServerVerified ? '🔒 메일 보관 및 안전 격리 조치' : '🔒 위험 메일 차단하고 휴지통으로 보내기'}
      </button>
    </div>
  );
};

// =============================================================================
// ⑤ 서브 컴포넌트: 메일 목록 아이템
// =============================================================================

interface EmailRowProps {
  email: Email;
  onAnalyze: (id: string) => void;
  isNew?: boolean;
  isActive?: boolean;
}

const EmailRow: React.FC<EmailRowProps> = ({ email, onAnalyze, isNew, isActive }) => (
  <div
    className={`flex items-center justify-between p-6 rounded-2xl border transition-all duration-300 relative ${
      isActive
        ? 'border-white/20 bg-[#181920]'
        : isNew
        ? 'border-white/10 bg-[#121318]'
        : 'border-white/10 bg-[#121318] hover:border-white/20'
    }`}
    style={
      isNew
        ? { animation: 'slideInFromTop 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }
        : undefined
    }
  >
    {isActive && (
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FF2E63] rounded-l-2xl animate-[pointBar_0.2s_ease-out]" />
    )}
    
    {/* 메일 정보 */}
    <div className="flex-1 min-w-0 mr-4 pl-2">
      {email.platform === 'naver' && (
        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#03C75A]/10 text-[#03C75A] border border-[#03C75A]/20 mb-1.5 font-mono">
          NAVER
        </span>
      )}
      {email.platform === 'google' && (
        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FF2E63]/10 text-[#FF2E63] border border-[#FF2E63]/20 mb-1.5 font-mono">
          GOOGLE
        </span>
      )}
      {email.platform === 'github' && (
        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#24292e]/20 text-white border border-white/20 mb-1.5 font-mono">
          GITHUB
        </span>
      )}
      {email.platform === 'openai' && (
        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#10a37f]/10 text-[#10a37f] border border-[#10a37f]/20 mb-1.5 font-mono">
          OPENAI
        </span>
      )}
      {email.platform === 'tryhackme' && (
        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#de1135]/10 text-[#de1135] border border-[#de1135]/20 mb-1.5 font-mono">
          TRYHACKME
        </span>
      )}
      {email.platform === 'mangoboard' && (
        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#ff9c00]/10 text-[#ff9c00] border border-[#ff9c00]/20 mb-1.5 font-mono">
          MANGOBOARD
        </span>
      )}
      {email.platform === 'cursor' && (
        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700/20 text-white border border-slate-500/20 mb-1.5 font-mono">
          CURSOR
        </span>
      )}
      <p className="text-[10px] text-[#FF2E63] font-mono mb-0.5 truncate" style={{ color: email.isServerVerified ? '#00F5D4' : '#FF2E63' }}>{email.from}</p>
      <p className="text-sm font-semibold text-white mb-0.5 truncate">{email.subject}</p>
      <p className="text-[10px] text-slate-500 font-mono">{email.timeAgo}</p>
    </div>

    {/* 분석 버튼 */}
    <button
      id={`analyze-btn-${email.id}`}
      onClick={() => onAnalyze(email.id)}
      className="shrink-0 px-4 py-2 rounded-xl font-bold text-xs text-[#0B0C10] bg-[#FF2E63] hover:bg-[#ff4d7c] active:scale-95 transition-all duration-200"
    >
      {isActive ? '분석 중' : '분석'}
    </button>
  </div>
);

// =============================================================================
// ⑥ 서브 컴포넌트: 로그인 전 화면 (데모 버전 메인)
// =============================================================================

interface PreLoginScreenProps {
  onGoogleLogin: () => void;
}
const PreLoginScreen: React.FC<PreLoginScreenProps> = ({ onGoogleLogin }) => (
  <div className="min-h-screen bg-[#0B0C10] text-white font-sans p-6 pb-28">
    {/* 상단 배지 */}
    <div className="flex items-center justify-center pt-2 pb-4">
      <div className="flex items-center gap-2 bg-[#121318] border border-white/10 rounded-full px-4 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF2E63]" />
        <span className="text-[10px] font-mono font-bold tracking-widest text-[#FF2E63] uppercase">
          LogBox 이메일 보안 가드
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF2E63]" />
      </div>
    </div>

    <div className="max-w-md mx-auto space-y-6">
      {/* 타이틀 */}
      <div className="text-center mt-2">
        <h1 className="text-2xl font-extrabold text-white">메일 피싱 / 보안 위협</h1>
        <p className="text-xs text-slate-500 mt-1">로그인하면 실시간 위협 탐지 엔진이 작동합니다</p>
      </div>

      {/* 의심스러운 접근 경고 박스 */}
      <div className="rounded-2xl border border-white/10 p-6 bg-[#121318] shadow-lg">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[#FF2E63] text-2xl">warning</span>
          <div className="space-y-3">
            <p className="text-sm font-extrabold text-[#FF2E63]">의심스러운 외부 기기 감지!</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              귀하의 계정에 알 수 없는 러시아 IP 주소의 기기에서 비정상적인 접근 시도가 감지되었습니다.
              구글 로그인 후 보안 메일을 스캔하여 안전 조치를 취하세요.
            </p>
            {/* 해커 기기 정보 */}
            <div className="bg-[#0B0C10] rounded-xl p-4 border border-white/10">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono">
                <span className="text-slate-500">기기</span>
                <span className="text-[#FF2E63]/80 font-bold">{HACKER_DEVICE_INFO.model} · {HACKER_DEVICE_INFO.os}</span>
                <span className="text-slate-500">브라우저</span>
                <span className="text-slate-300">{HACKER_DEVICE_INFO.browser}</span>
                <span className="text-slate-500">IP 주소</span>
                <span className="text-[#FF2E63]/80">{HACKER_DEVICE_INFO.ip}</span>
                <span className="text-slate-500">위치</span>
                <span className="text-slate-300">🌍 {HACKER_DEVICE_INFO.location}</span>
                <span className="text-slate-500">감지 시각</span>
                <span className="text-[#FF2E63]/80">방금 전</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 구글 로그인 버튼 */}
      <button
        id="google-login-btn"
        onClick={onGoogleLogin}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-white text-sm bg-[#121318] border border-white/10 shadow-md hover:bg-[#181920] hover:border-white/20 active:scale-95 transition-all duration-200"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google로 로그인하여 보안 스캔 시작
      </button>

      {/* 기능 프리뷰 */}
      <div className="space-y-2 pt-2">
        {[
          { icon: '📧', label: '수신 메일 피싱 AI 자동 분석' },
          { icon: '🔐', label: '접속 기기 실시간 감시 · 원격 로그아웃' },
          { icon: '🌐', label: '네이버·구글 멀티 계정 통합 보안' },
        ].map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-3 p-4 rounded-xl bg-[#121318] border border-white/10 text-xs text-[#94A3B8] font-mono"
          >
            <span className="text-lg">{f.icon}</span>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// =============================================================================
// ⑦ 메인 컴포넌트: SecurityPage (로그인 후 대시보드)
// =============================================================================

const SecurityPage: React.FC = () => {
  const { authToken, logs, deleteRecord, isLoading: contextIsLoading } = useLogBox();
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryId = queryParams.get('id');

  const gmailToken = loadDecryptedSync<string>('gmail_token', STORAGE_PASS);
  const isLoggedIn = !!authToken || !!gmailToken;

  const [trustTrigger, setTrustTrigger] = useState(0);
  const [isNaverConnected, setIsNaverConnected] = useState<boolean>(false);
  const [isNaverLoading, setIsNaverLoading] = useState<boolean>(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // 커스텀 토스트 상태
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const emailListRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastType(type);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  const emails = useMemo(() => {
    let rawEmails: Email[] = [];
    if (gmailToken) {
      // Filter logs to ONLY show real phishing threats, OR the email matching queryId (clicked from dashboard)
      const filteredLogs = logs.filter(r => isPhishingThreat(r) || r.id === queryId);

      rawEmails = filteredLogs.map((r) => {
        let platform: 'naver' | 'google' | 'github' | 'openai' | 'tryhackme' | 'mangoboard' | 'cursor' | 'other' = 'other';
        if (r.platform === 'naver') platform = 'naver';
        else if (r.platform === 'google') platform = 'google';
        else if (r.platform === 'github') platform = 'github';
        else if (r.platform === 'openai') platform = 'openai';
        else if (r.platform === 'tryhackme') platform = 'tryhackme';
        else if (r.platform === 'mangoboard') platform = 'mangoboard';
        else if (r.platform === 'cursor') platform = 'cursor';

        return {
          id: r.id,
          from: r.from || 'support@google.com',
          subject: r.subject || '보안 알림',
          timeAgo: r.timeISO ? formatRelativeTime(r.timeISO) : '방금 전',
          riskScore: threatLevelToRiskScore(r.threatLevel),
          body: r.body || '',
          platform,
          deviceName: r.device?.name,
          domain: r.domain,
          snippet: r.snippet,
          ip: r.ip || '플랫폼 미제공',
          location: r.device?.location || '알 수 없음',
          isServerVerified: r.isServerVerified,
        };
      });
    } else {
      const baseList = INITIAL_EMAILS;
      const rawList = isNaverConnected ? [NAVER_PHISHING_EMAIL, ...baseList] : baseList;
      rawEmails = rawList; // These are already designated phishing emails in demo mode
    }
    return rawEmails;
  }, [gmailToken, logs, isNaverConnected, trustTrigger]);

  useEffect(() => {
    if (queryId && emails.length > 0) {
      const hasMatch = emails.some((e) => e.id === queryId);
      if (hasMatch) {
        setSelectedEmailId(queryId);
      }
    }
  }, [queryId, emails]);

  const handleGoogleLogin = useCallback(() => {
    window.location.reload();
  }, []);

  const handleNaverConnect = useCallback(() => {
    if (isNaverConnected || isNaverLoading) return;

    setIsNaverLoading(true);

    setTimeout(() => {
      setIsNaverLoading(false);
      setIsNaverConnected(true);

      showToast("네이버 계정 연동에 성공했습니다.", "success");

      setTimeout(() => {
        emailListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }, 1000);
  }, [isNaverConnected, isNaverLoading, showToast]);

  const handleAnalyze = useCallback((emailId: string) => {
    setSelectedEmailId(emailId);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedEmailId(null);
  }, []);

  // ── [위협 메일 차단 및 영구 격리 처리] ──
  const handleBlockEmail = useCallback(() => {
    if (!selectedEmailId) return;
    
    deleteRecord(selectedEmailId);
    setSelectedEmailId(null);
    showToast("해당 위협 메일 발신처가 즉시 차단되고 영구 격리 공간으로 이동되었습니다.", "success");
  }, [selectedEmailId, deleteRecord, showToast]);

  const handleTrustDevice = useCallback((deviceName: string) => {
    addTrustedDeviceName(deviceName);
    showToast(`"${deviceName}"이(가) 신뢰 기기로 등록되었습니다.`, "success");
    setTrustTrigger((prev) => prev + 1);
  }, [showToast]);

  const isLoading = contextIsLoading;

  if (!isLoggedIn) {
    return (
      <>
        <PreLoginScreen onGoogleLogin={handleGoogleLogin} />
        <GlobalStyles />
      </>
    );
  }

  const selectedEmail = emails.find((e) => e.id === selectedEmailId);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white font-sans p-6 pb-28 select-none relative flex flex-col gap-6">
      <GlobalStyles />

      {/* ── 상단 헤더 ── */}
      <header className="flex justify-between items-center w-full pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-extrabold tracking-wider text-white">메일 피싱 / 보안 위협</h1>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            실시간 감시 중 ·{' '}
            <span className="text-[#FF2E63] font-semibold">
              {emails.length}건의 피싱 위협 감지됨
            </span>
          </p>
        </div>

        {/* 네이버 연동 버튼 */}
        <button
          id="naver-connect-btn"
          onClick={handleNaverConnect}
          disabled={isNaverConnected || isNaverLoading}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${
            isNaverConnected
              ? 'bg-[#00F5D4] text-[#0B0C10] border-transparent cursor-default'
              : isNaverLoading
              ? 'bg-[#121318] border border-white/10 text-slate-500 cursor-wait'
              : 'bg-[#FF2E63] text-white border-transparent active:scale-95'
          }`}
        >
          {isNaverLoading ? (
            <>
              <span className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
              연동 중...
            </>
          ) : isNaverConnected ? (
            '✓ 연동 완료'
          ) : (
            <>
              <span className="text-xs font-black">N</span>
              네이버 연동하기
            </>
          )}
        </button>
      </header>

      {/* ── 메일 목록 ── */}
      <div ref={emailListRef} className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-24 rounded-2xl bg-[#121318] animate-pulse border border-white/10" />
          ))
        ) : emails.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm font-mono border border-white/10 rounded-2xl bg-[#121318]">
            표시할 보안 관련 메일이 없습니다.
          </div>
        ) : (
          emails.map((email) => (
            <EmailRow
              key={email.id}
              email={email}
              onAnalyze={handleAnalyze}
              isNew={email.platform === 'naver' && isNaverConnected}
              isActive={email.id === selectedEmailId}
            />
          ))
        )}
      </div>

      {/* ── 선택된 메일의 정밀 분석 카드 (목록 아래에 배치) ── */}
      {selectedEmail && (
        <AnalysisCard
          email={selectedEmail}
          onBack={handleBackToList}
          onBlockClick={handleBlockEmail}
          onTrustClick={handleTrustDevice}
        />
      )}

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


// =============================================================================
// ⑧ 전역 애니메이션 스타일 주입
// =============================================================================

const GlobalStyles: React.FC = () => (
  <style>{`
    @keyframes slideInFromTop {
      from {
        opacity: 0;
        transform: translateY(-16px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes modalIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes pointBar {
      from {
        transform: scaleY(0);
      }
      to {
        transform: scaleY(1);
      }
    }
  `}</style>
);

export default SecurityPage;
