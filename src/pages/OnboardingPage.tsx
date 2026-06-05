import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const OnboardingPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (activeStep < 3) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleStart = () => {
    localStorage.setItem('onboardingSeen', 'true');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-slate-100 flex items-center justify-center py-8 px-4 overflow-y-auto font-sans">
      {/* CSS styling for radar rotation and button shimmer */}
      <style>{`
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-radar-sweep {
          transform-origin: 50px 50px;
          animation: radar-sweep 4s linear infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-150%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(150%); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>

        {/* Phone container */}
        <div className={`w-full max-w-[390px] h-[820px] rounded-[48px] border-[10px] border-slate-950 relative flex flex-col overflow-hidden my-auto select-none border-white/5 transition-colors duration-300 ${activeStep === 3 ? 'bg-[#0B0C10]' : 'bg-[#121318]'}`}>
        
        {/* Dynamic Island / Notch */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-center" />

        {/* Status Bar */}
        <div className="h-11 px-6 pt-3 flex justify-between items-center text-[11px] text-slate-400 font-semibold z-40 relative">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            {/* Signal Strength Icon */}
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M2 22h20V2z" />
            </svg>
            {/* Wifi Icon */}
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 21l-12-18h24z" />
            </svg>
            {/* Battery Icon */}
            <span className="text-[9px] font-bold">100%</span>
            <div className="w-5 h-2.5 border border-slate-400 rounded-sm p-0.5 flex items-center">
              <div className="w-full h-full bg-slate-400 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* LOGBOX Logo Header */}
        <div className="z-10 mt-2 flex items-center justify-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg border border-white/10 bg-white/5 text-white">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          </div>
          <span className="text-sm font-black tracking-widest font-mono text-white">
            LOG<span className="text-rose-500">BOX</span>
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col justify-between px-6 pb-8 pt-4 z-10 relative">
          
          {activeStep === 3 ? (
            <div className="flex-1 flex flex-col justify-center py-1.5">
              {/* Title & Badge */}
              <div className="mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[9px] font-bold text-slate-400 tracking-wider mb-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  3대 안전장치 시스템
                </span>
                <h2 className="text-[23px] font-black tracking-tight text-white leading-tight">
                  내 사생활은 안전하게,<br />
                  보안 알림만 쏙
                </h2>
              </div>

              {/* 3 Safety Cards */}
              <div className="flex flex-col gap-3">
                {/* Card 1 */}
                <div className="flex gap-3.5 items-start p-4 bg-[#121318] border border-white/10 rounded-2xl">
                  <span className="text-lg shrink-0 mt-0.5" role="img" aria-label="read-only">📥</span>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1">읽기 전용 권한</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                      메일을 수정하거나 보낼 수 없는 '읽기 전용' 권한만 안전하게 사용해요.
                    </p>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="flex gap-3.5 items-start p-4 bg-[#121318] border border-white/10 rounded-2xl">
                  <span className="text-lg shrink-0 mt-0.5" role="img" aria-label="privacy-zero">🚫</span>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1">사생활 침해 제로</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                      사적인 대화는 절대 열어보지 않고, 외부 서비스의 '보안 알림 메일'만 필터링해요.
                    </p>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="flex gap-3.5 items-start p-4 bg-[#121318] border border-white/10 rounded-2xl">
                  <span className="text-lg shrink-0 mt-0.5" role="img" aria-label="immediate-destruction">🔒</span>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1">즉시 파기 원칙</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                      수집된 로그인 신호는 분석 후 화면에만 보여지며 서버에 절대 저장되지 않아요.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Graphics Section */}
              <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
                {activeStep === 0 && (
                  <div className="w-full flex flex-col items-center">
                    {/* Radar Graphic */}
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id="radar-grad" x1="50" y1="50" x2="84.6" y2="30" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.15" />
                          </linearGradient>
                        </defs>

                        {/* Concentric rings */}
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#475569" strokeOpacity="0.25" strokeDasharray="3,3" />
                        <circle cx="50" cy="50" r="30" fill="none" stroke="#475569" strokeOpacity="0.25" strokeDasharray="3,3" />
                        <circle cx="50" cy="50" r="15" fill="none" stroke="#475569" strokeOpacity="0.25" strokeDasharray="3,3" />

                        {/* Crosshairs */}
                        <line x1="50" y1="5" x2="50" y2="95" stroke="#475569" strokeOpacity="0.2" strokeDasharray="2,2" />
                        <line x1="5" y1="50" x2="95" y2="50" stroke="#475569" strokeOpacity="0.2" strokeDasharray="2,2" />

                        {/* Sweeping Group */}
                        <g className="animate-radar-sweep">
                          <path d="M 50 50 L 50 10 A 40 40 0 0 1 84.6 30 Z" fill="url(#radar-grad)" />
                          <line x1="50" y1="50" x2="84.6" y2="30" stroke="#FFFFFF" strokeWidth="0.75" opacity="0.3" />
                        </g>

                        {/* Center point */}
                        <circle cx="50" cy="50" r="2" fill="#FFFFFF" opacity="0.8" />
                        
                        {/* Detected targets */}
                        <circle cx="32" cy="45" r="2" fill="#94A3B8" />
                        
                        <g>
                          <circle cx="68" cy="42" r="3" fill="#EF4444" />
                        </g>
                        
                        <circle cx="60" cy="35" r="1.5" fill="#EF4444" opacity="0.6" />
                        <circle cx="55" cy="68" r="1.5" fill="#94A3B8" opacity="0.5" />
                      </svg>
                    </div>

                    {/* Threat Notification Toast */}
                    <div className="flex items-center gap-3 w-full border border-white/5 bg-[#1c1d24] px-4 py-3.5 rounded-2xl shadow-lg mt-5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 shrink-0">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2L1 21h22L12 2zm0 3.99L20.53 19H3.47L12 5.99zM13 16h-2v2h2v-2zm0-6h-2v4h2v-4z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white tracking-tight">실시간 해킹 시도 차단 완료!</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate font-medium">192.168.1.xx → 해킹 위협 차단됨</p>
                      </div>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap self-start font-medium">
                        지금
                      </span>
                    </div>
                  </div>
                )}

                {activeStep === 1 && (
                  <div className="w-full px-1">
                    {/* Global Threat Map Graphic */}
                    <div className="relative w-full aspect-[16/10] border border-white/10 bg-[#1c1d24] rounded-2xl p-4 font-mono">
                      {/* Map Header */}
                      <div className="flex items-center justify-between text-[8px] text-slate-400 mb-2 font-bold">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                          실시간 해킹 지도
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-0.5 bg-red-500 inline-block" /> 해킹 시도
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block" /> 접속 지점
                          </span>
                        </span>
                      </div>
                      
                      {/* Nodes & Lines Map */}
                      <div className="relative h-[80px] w-full">
                        <svg className="w-full h-full" viewBox="0 0 100 50">
                          {/* Connection lines */}
                          <line x1="20" y1="20" x2="45" y2="18" stroke="#EF4444" strokeWidth="0.5" strokeOpacity="0.6" />
                          <line x1="45" y1="18" x2="55" y2="20" stroke="#EF4444" strokeWidth="0.5" strokeOpacity="0.6" />
                          <line x1="55" y1="20" x2="70" y2="22" stroke="#EF4444" strokeWidth="0.5" strokeOpacity="0.6" />
                          <line x1="70" y1="22" x2="80" y2="18" stroke="#EF4444" strokeWidth="0.5" strokeOpacity="0.6" />
                          
                          <line x1="20" y1="38" x2="48" y2="40" stroke="#EF4444" strokeWidth="0.5" strokeDasharray="1,1" strokeOpacity="0.3" />
                          <line x1="48" y1="40" x2="72" y2="28" stroke="#EF4444" strokeWidth="0.5" strokeOpacity="0.6" />
                          <line x1="72" y1="28" x2="82" y2="38" stroke="#EF4444" strokeWidth="0.5" strokeDasharray="1,1" strokeOpacity="0.3" />
                          
                          {/* Nodes */}
                          <circle cx="20" cy="20" r="1.5" fill="#94A3B8" />
                          <text x="20" y="14" fill="#94A3B8" fontSize="3.5" textAnchor="middle" fontWeight="bold">UTC</text>
                          
                          <circle cx="45" cy="18" r="1.5" fill="#94A3B8" />
                          <text x="45" y="12" fill="#94A3B8" fontSize="3.5" textAnchor="middle" fontWeight="bold">LON</text>

                          <circle cx="55" cy="20" r="1.5" fill="#94A3B8" />
                          <text x="55" y="14" fill="#94A3B8" fontSize="3.5" textAnchor="middle" fontWeight="bold">BER</text>
                          
                          <circle cx="70" cy="22" r="1.5" fill="#EF4444" />
                          <text x="70" y="16" fill="#EF4444" fontSize="3.5" textAnchor="middle" fontWeight="bold">MSC</text>
                          
                          <circle cx="80" cy="18" r="1.5" fill="#EF4444" />
                          <text x="80" y="12" fill="#EF4444" fontSize="3.5" textAnchor="middle" fontWeight="bold">HKG</text>
                          
                          <circle cx="20" cy="38" r="1.5" fill="#94A3B8" />
                          <text x="20" y="32" fill="#94A3B8" fontSize="3.5" textAnchor="middle" fontWeight="bold">SGP</text>
                          
                          <circle cx="48" cy="40" r="1.5" fill="#94A3B8" />
                          <text x="48" y="34" fill="#94A3B8" fontSize="3.5" textAnchor="middle" fontWeight="bold">SYD</text>

                          <circle cx="72" cy="28" r="1.5" fill="#94A3B8" />
                          <text x="72" y="22" fill="#94A3B8" fontSize="3.5" textAnchor="middle" fontWeight="bold">NYC</text>

                          <circle cx="82" cy="38" r="1.5" fill="#94A3B8" />
                          <text x="82" y="32" fill="#94A3B8" fontSize="3.5" textAnchor="middle" fontWeight="bold">LAX</text>
                        </svg>
                      </div>
                      
                      {/* Map Stats */}
                      <div className="grid grid-cols-3 border-t border-white/5 pt-2.5 text-center mt-2">
                        <div>
                          <div className="text-slate-200 font-bold text-xs tracking-tight">23</div>
                          <div className="text-slate-500 text-[8px] mt-0.5 font-bold">위험 요소</div>
                        </div>
                        <div>
                          <div className="text-red-500 font-bold text-xs tracking-tight">3</div>
                          <div className="text-slate-500 text-[8px] mt-0.5 font-bold">해킹 시도 중</div>
                        </div>
                        <div>
                          <div className="text-slate-200 font-bold text-xs tracking-tight">99.8%</div>
                          <div className="text-slate-500 text-[8px] mt-0.5 font-bold">방어율</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="w-full flex flex-col items-center">
                    {/* Shield Graphic */}
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" fill="none">
                        <path d="M50 12 L82 25 V50 C82 72 68 87 50 92 C32 87 18 72 18 50 V25 L50 12 Z" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M50 20 L76 30 V50 C76 68 64 81 50 85 C36 81 24 68 24 50 V30 L50 20 Z" stroke="#EF4444" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                      </svg>
                      <div className="z-10 text-slate-300">
                        <svg className="w-9 h-9 fill-current" viewBox="0 0 24 24">
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                        </svg>
                      </div>
                    </div>

                    {/* Status Pills */}
                    <div className="flex flex-col items-center gap-2 mt-5 w-full">
                      <div className="flex justify-center gap-2">
                        <span className="px-3 py-1 rounded-full border border-white/5 bg-[#1c1d24] text-[10px] font-bold text-slate-300 tracking-tight">
                          사기 메일 링크 차단됨
                        </span>
                        <span className="px-3 py-1 rounded-full border border-white/5 bg-[#1c1d24] text-[10px] font-bold text-slate-300 tracking-tight">
                          위험한 와이파이 차단됨
                        </span>
                      </div>
                      <span className="px-3 py-1 rounded-full border border-white/5 bg-[#1c1d24] text-[10px] font-bold text-slate-300 tracking-tight">
                        바이러스 첨부파일 차단됨
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Text and Description Section */}
              <div className="mt-4 flex flex-col items-start text-left w-full">
                {activeStep === 0 && (
                  <>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[9px] font-bold text-slate-400 tracking-wider mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      실시간 해킹 감시
                    </span>
                    <h2 className="text-[25px] font-black tracking-tight text-white leading-tight mb-3">
                      실시간 해커 침입<br />
                      <span className="text-red-500">즉시 포착</span>
                    </h2>
                    <p className="text-[12px] text-slate-400 leading-relaxed font-semibold">
                      대시보드를 켜두는 것만으로도 내 계정을 노리는 글로벌 위협 세력의 접근을 실시간 토스트 알림으로 가장 먼저 알려줍니다.
                    </p>
                  </>
                )}

                {activeStep === 1 && (
                  <>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[9px] font-bold text-slate-400 tracking-wider mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      해커 접속 추적
                    </span>
                    <h2 className="text-[25px] font-black tracking-tight text-white leading-tight mb-3">
                      글로벌 공격 거점<br />
                      <span className="text-slate-200">정밀 추적</span>
                    </h2>
                    <p className="text-[12px] text-slate-400 leading-relaxed font-semibold">
                      해외에서 내 도메인으로 우회 접속하는 해커의 진짜 위치를 풀스크린 세계 지도 위에서 시각적으로 완벽히 추적합니다.
                    </p>
                  </>
                )}

                {activeStep === 2 && (
                  <>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[9px] font-bold text-slate-400 tracking-wider mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      위험 메일 차단 및 격리
                    </span>
                    <h2 className="text-[25px] font-black tracking-tight text-white leading-tight mb-3">
                      악성 링크 차단 및<br />
                      <span className="text-red-500">안전 격리</span>
                    </h2>
                    <p className="text-[12px] text-slate-400 leading-relaxed font-semibold">
                      장학금이나 등급컷 안내로 위장한 교묘한 피싱 메일과 가짜 와이파이를 정밀 분석하고, 클릭 한 번으로 위험 요소를 영구 격리하세요.
                    </p>
                  </>
                )}
              </div>
            </>
          )}

          {/* Action Button & Route Handling for Slide 4 */}
          {activeStep === 3 && (
            <div className="w-full mt-4 flex flex-col items-center">
              <button
                type="button"
                onClick={handleStart}
                className="w-full py-4 rounded-xl bg-[#FF2E63] hover:bg-[#ff4d7c] text-[#0B0C10] font-bold text-[13px] tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(255,46,99,0.45)] hover:shadow-[0_0_35px_rgba(255,46,99,0.65)] active:scale-95 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-shimmer" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  🔒 보안 대시보드 입장하기
                </span>
              </button>
            </div>
          )}

          {/* Indicator Dot Status */}
          <div className="flex justify-center items-center gap-2 mt-4">
            {[0, 1, 2, 3].map((idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === activeStep 
                    ? 'w-5 bg-rose-600' 
                    : 'w-1.5 bg-[#2a2d37]'
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons at the Bottom */}
          <div className="mt-4 flex w-full justify-between items-center z-10 relative">
            {activeStep === 0 && (
              <button
                type="button"
                onClick={handleNext}
                className="w-full border border-white/10 text-slate-200 hover:bg-white/5 rounded-2xl py-3 font-bold text-xs transition duration-200 cursor-pointer text-center"
              >
                다음 →
              </button>
            )}

            {(activeStep === 1 || activeStep === 2) && (
              <div className="flex w-full justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="w-[40%] border border-white/5 bg-transparent text-slate-400 rounded-2xl py-3 font-bold text-xs hover:bg-white/5 transition duration-200 cursor-pointer text-center"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-[57%] border border-white/10 text-slate-200 hover:bg-white/5 rounded-2xl py-3 font-bold text-xs transition duration-200 cursor-pointer text-center"
                >
                  다음 →
                </button>
              </div>
            )}

            {activeStep === 3 && (
              <button
                type="button"
                onClick={handlePrev}
                className="w-full border border-white/5 bg-transparent text-slate-400 rounded-2xl py-3 font-bold text-xs hover:bg-white/5 transition duration-200 cursor-pointer text-center"
              >
                이전
              </button>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
