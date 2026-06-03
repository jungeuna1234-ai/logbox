import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

type Tab = { to: string; label: string; icon: string; end?: boolean; ariaLabel?: string };

const tabs: Tab[] = [
  { to: '/',         label: '홈',  icon: 'home',     end: true },
  { to: '/security', label: '보안', icon: 'shield',   ariaLabel: 'LogBox 메일센터' },
  { to: '/base',     label: '거점', icon: 'devices',  ariaLabel: '거점 기기 관리' },
  { to: '/settings', label: '설정', icon: 'settings' },
];

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#05070a] text-white flex justify-center">
      <div className="max-w-5xl w-full mx-auto flex flex-col min-h-screen">

        {/* 전역 헤더 제거 — 각 페이지가 독립 헤더 소유 (이중 헤더 충돌 해소) */}

        <main className="flex-1 w-full min-h-0 pb-[5.5rem]">
          <Outlet />
        </main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex justify-center"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(5,7,10,0.92) 18%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          aria-label="하단 메뉴"
        >
          {/* 최상단 얇은 글로우 구분선 */}
          <div
            className="absolute top-0 left-0 right-0 h-[1px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,240,255,0.18) 40%, rgba(255,59,92,0.14) 70%, transparent)' }}
          />

          <div className="w-full max-w-5xl flex justify-around items-center px-2 pt-2 pb-[max(1.1rem,env(safe-area-inset-bottom))]">
            {tabs.map(({ to, label, icon, end, ariaLabel }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={ariaLabel ?? label}
                className="flex-1 flex flex-col items-center gap-0.5 focus:outline-none group"
              >
                {({ isActive }) => (
                  <div className="flex flex-col items-center gap-0.5 w-full">
                    {/* 아이콘 pill: 활성 시 사이버 네온 배경 */}
                    <div
                      className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-300 ${
                        isActive
                          ? 'bg-[#00f0ff]/12 shadow-[0_0_14px_rgba(0,240,255,0.22)]'
                          : 'group-hover:bg-white/5'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[1.35rem] transition-all duration-300 ${
                          isActive
                            ? 'text-[#00f0ff] drop-shadow-[0_0_6px_rgba(0,240,255,0.9)]'
                            : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                        style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        {icon}
                      </span>
                      {/* 핀포인트 활성 도트 */}
                      {isActive && (
                        <span
                          className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#00f0ff] shadow-[0_0_6px_rgba(0,240,255,1)]"
                          aria-hidden
                        />
                      )}
                    </div>
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
