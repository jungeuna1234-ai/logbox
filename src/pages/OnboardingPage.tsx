import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const slides = [
  {
    title: '로그와 와이파이 보안, 한눈에 감지',
    description: 'LogBox는 1020 세대와 수험생을 위해 설계된 사이버 보안 대시보드입니다. 로그 흐름과 네트워크 상태를 트렌디하게 분석합니다.',
    highlight: '로그 보안·와이파이 상태를 지금 바로 확인하세요.',
  },
  {
    title: '2026년 보안 달력',
    description: '개인정보와 활동 로그를 날짜별로 정리합니다. 위험일수, 주의일수를 한눈에 파악하고 빠르게 대응할 수 있어요.',
    highlight: '이제 매일의 보안 상태를 시각적으로 관리하세요.',
  },
  {
    title: '네이버 아이디로 시작하기',
    description: '네이버 아이디로 간편하게 시작하고, 보안 알림과 로그 분석을 바로 경험해 보세요.',
    highlight: '네이버 로그인 후 곧바로 메인 대시보드로 이동합니다.',
  },
];

const OnboardingPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const isLastStep = activeStep === slides.length - 1;

  const handleNext = () => {
    if (isLastStep) return;
    setActiveStep((prev) => prev + 1);
  };

  const handleStart = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('onboardingSeen', 'true');
      setLoading(false);
      navigate('/', { replace: true });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070a] to-[#0a0c10] text-slate-100 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl flex-col justify-center gap-8 rounded-[32px] border border-white/5 bg-white/5 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
        <div className="space-y-4">
          <span className="inline-flex rounded-full bg-[#0f172a]/80 px-4 py-1 text-xs uppercase tracking-[0.32em] text-slate-400">
            Onboarding</span>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">LogBox와 함께하는 안전한 시작</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            로그, 와이파이, 그리고 개인정보를 세련된 네온 다크 인터페이스로 경험해 보세요. 첫 화면부터 1020 세대 감성에 맞춘 보안 구성이 자동으로 준비됩니다.
          </p>
        </div>

        <div className="grid gap-6 rounded-[28px] border border-slate-800/80 bg-slate-950/80 p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="flex items-center justify-between gap-4 rounded-3xl bg-[#11151f] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.3)]">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-[#8b95a6]">STEP {activeStep + 1}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{slides[activeStep].title}</h2>
            </div>
            <div className="rounded-3xl bg-[#112533] px-4 py-3 text-sm text-[#90f9b4] shadow-[0_0_30px_rgba(3,199,90,0.18)]">
              {isLastStep ? '마지막 단계' : '다음 단계로 이동'}
            </div>
          </div>

          <div className="space-y-5 rounded-3xl border border-slate-800/80 bg-[#0b1118] p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-[#5fd692]">미리보기</p>
            <p className="text-xl font-semibold text-white">{slides[activeStep].highlight}</p>
            <p className="max-w-2xl text-slate-400 leading-7">{slides[activeStep].description}</p>

            {activeStep === 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-[#154158] bg-[#071017]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">로그 분석</p>
                  <p className="mt-3 text-sm text-slate-300">실시간 접속 패턴과 위험 지표를 사이버틱하게 제공합니다.</p>
                </div>
                <div className="rounded-3xl border border-[#154158] bg-[#071017]/80 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">와이파이 시큐리티</p>
                  <p className="mt-3 text-sm text-slate-300">공유기 및 공용망 접속 위험도를 AI처럼 보여줍니다.</p>
                </div>
              </div>
            )}

            {activeStep === 1 && (
              <div className="rounded-3xl bg-[#071217]/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">2026 보안 캘린더</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">데이터 하루 단위 공개</h3>
                  </div>
                  <div className="rounded-full border border-[#19f88f]/30 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#7bf7b2]">
                    Sneak Peek</div>
                </div>
                <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[11px] text-slate-400">
                  {['일','월','화','수','목','금','토'].map((weekday) => (
                    <div key={weekday} className="font-semibold">{weekday}</div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-7 gap-2 text-[12px] text-slate-100">
                  {Array.from({ length: 28 }, (_, index) => (
                    <div key={index} className="rounded-2xl bg-[#101820] p-3">
                      <div className="text-sm font-semibold">{index + 1}</div>
                      <div className="mt-2 h-1 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="rounded-3xl bg-[#071217]/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">간편 시작</p>
                <div className="mt-4 rounded-3xl border border-[#03C75A]/25 bg-[#09120f] p-5">
                  <p className="text-lg font-semibold text-white">네이버 아이디로 빠르게 시작</p>
                  <p className="mt-2 text-sm text-slate-400">한 번의 로그인으로 보안 대시보드에 바로 접속합니다.</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {slides.map((_, index) => (
                <span
                  key={index}
                  className={`h-2 w-10 rounded-full transition ${index === activeStep ? 'bg-[#03C75A]' : 'bg-slate-700'}`}
                />
              ))}
            </div>
            {!isLastStep ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center justify-center rounded-full bg-[#03C75A] px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#02b652]"
              >
                다음
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-[#03C75A] px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#02b652] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? '로그인 중...' : '네이버 아이디로 시작하기'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
