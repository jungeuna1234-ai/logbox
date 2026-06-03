// =============================================================================
// src/pages/BaseManagePage.tsx
// LogBox 거점 및 신뢰 기기 관리 — 프리미엄 다크 사이버펑크 테마 및 커스텀 모달 UI
// =============================================================================

import React, { useState, useCallback, useRef } from 'react';
import { useLogBox } from '../context/LogBoxContext';
import { TrustedDevice } from '../types';

// =============================================================================
// ① 데모 데이터 상수
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

// =============================================================================
// ② 커스텀 로그아웃 확인 모달
// =============================================================================

interface LogoutConfirmModalProps {
  device: (TrustedDevice & { ip?: string; location?: string }) | null;
  onClose: () => void;
  onConfirm: () => void;
}

const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({ device, onClose, onConfirm }) => {
  if (!device) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#12141C] border border-[#FF2E63]/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-[modalIn_0.25s_ease-out]">
        <div className="flex flex-col items-center gap-2 text-[#FF2E63] text-center">
          <span className="material-symbols-outlined text-4xl animate-pulse">warning</span>
          <h3 className="text-base font-bold tracking-wider">원격 세션 즉시 차단</h3>
        </div>
        <p className="text-xs text-slate-400 text-center">
          정말로 이 기기를 원격 로그아웃 하시겠습니까?<br />
          승인 시 해당 기기의 세션이 즉시 만료됩니다.
        </p>
        
        <div className="bg-[#0B0C10] border border-white/5 rounded-xl p-4 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">기기</span>
            <span className="text-white font-bold">{device.name}</span>
          </div>
          {device.os && (
            <div className="flex justify-between">
              <span className="text-slate-500">OS</span>
              <span className="text-slate-300">{device.os}</span>
            </div>
          )}
          {device.ip && (
            <div className="flex justify-between">
              <span className="text-slate-500">IP 주소</span>
              <span className="text-[#FF2E63] font-bold">{device.ip}</span>
            </div>
          )}
          {device.location && (
            <div className="flex justify-between">
              <span className="text-slate-500">위치</span>
              <span className="text-slate-300">🌍 {device.location}</span>
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          <button
            onClick={onClose}
            className="flex-1 bg-[#161923] border border-white/5 text-slate-300 py-2.5 rounded-xl text-xs hover:bg-[#1C202E] active:scale-95 transition-all"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-[#FF2E63] text-[#0B0C10] py-2.5 rounded-xl text-xs font-bold hover:bg-[#ff4d7c] active:scale-95 transition-all"
          >
            원격 로그아웃 승인
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// ③ 기기 카드 컴포넌트
// =============================================================================

interface DeviceCardProps {
  device: TrustedDevice & { ip?: string; location?: string; isHacker?: boolean };
  onRemoteLogout: (device: any) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onRemoteLogout }) => {
  const isHacker = device.isHacker === true;
  const ip = device.ip;
  const location = device.location;

  return (
    <div
      className={`p-6 rounded-2xl border transition-all duration-200 ${
        device.isCurrent
          ? 'border-[#00F5D4]/40 bg-[#00F5D4]/5'
          : isHacker
          ? 'border-[#FF2E63]/40 bg-[#FF2E63]/5 shadow-[0_0_15px_rgba(255,46,99,0.08)]'
          : 'border-white/5 bg-[#12141C]'
      }`}
      style={
        isHacker
          ? { animation: 'alertPulse 2.5s ease-in-out infinite' }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <span
              className={`text-sm font-bold truncate ${
                device.isCurrent ? 'text-white' : isHacker ? 'text-[#FF2E63]' : 'text-slate-200'
              }`}
            >
              {device.name}
            </span>
            {device.isCurrent && (
              <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-[#00F5D4]/20 text-[#00F5D4] border border-[#00F5D4]/30 font-bold">
                현재 기기
              </span>
            )}
            {isHacker && (
              <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-[#FF2E63]/20 text-[#FF2E63] border border-[#FF2E63]/30 font-bold animate-pulse">
                ⚠ 위험 기기
              </span>
            )}
            {device.trusted && !device.isCurrent && !isHacker && (
              <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-700">
                신뢰됨
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono">
            <span className="text-slate-500 font-medium">OS</span>
            <span className={isHacker ? 'text-[#FF2E63]/80' : 'text-slate-300'}>{device.os ?? '-'}</span>
            <span className="text-slate-500 font-medium">브라우저</span>
            <span className={isHacker ? 'text-[#FF2E63]/80' : 'text-slate-300'}>{device.browser ?? '-'}</span>
            {ip && (
              <>
                <span className="text-slate-500 font-medium">IP</span>
                <span className={isHacker ? 'text-[#FF2E63] font-bold' : 'text-slate-300'}>{ip}</span>
              </>
            )}
            {location && (
              <>
                <span className="text-slate-500 font-medium">위치</span>
                <span className={isHacker ? 'text-[#FF2E63] font-bold' : 'text-slate-300'}>🌍 {location}</span>
              </>
            )}
          </div>
        </div>

        {!device.isCurrent && (
          <button
            onClick={() => onRemoteLogout(device)}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-[11px] font-bold active:scale-95 transition-all duration-200 ${
              isHacker
                ? 'bg-[#FF2E63] text-[#0B0C10] hover:bg-[#ff4d7c] shadow-[0_2px_10px_rgba(255,46,99,0.3)]'
                : 'bg-[#161923] text-slate-300 hover:bg-[#1C202E] border border-white/5'
            }`}
          >
            원격 로그아웃
          </button>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// ④ 메인 컴포넌트: BaseManagePage
// =============================================================================

const BaseManagePage: React.FC = () => {
  const { devices: ctxDevices, addDevice, removeDevice } = useLogBox();

  const [devices, setDevices] = useState<Array<TrustedDevice & { ip?: string; location?: string; isHacker?: boolean }>>(() => {
    const currentCtxDevice = ctxDevices.find((d) => d.isCurrent);
    const currentDevice: TrustedDevice = currentCtxDevice ?? {
      id: 'current-device',
      name: 'Windows PC · Chrome (현재)',
      model: 'Desktop',
      os: 'Windows 11',
      browser: 'Chrome',
      trusted: true,
      isCurrent: true,
      lastActive: new Date().toISOString(),
    };

    // Context 기기 목록 중에서 현재 기기가 아닌 다른 기기들도 초기 상태에 추가
    const otherCtxDevices = ctxDevices.filter((d) => !d.isCurrent);

    return [
      { ...currentDevice, isCurrent: true },
      ...otherCtxDevices,
      HACKER_DEVICE_INFO,
    ];
  });

  const [newDeviceModel, setNewDeviceModel] = useState('');
  const [newDeviceOs, setNewDeviceOs] = useState('');
  const [newDeviceBrowser, setNewDeviceBrowser] = useState('');

  // 커스텀 모달 및 토스트 상태
  const [confirmLogoutDevice, setConfirmLogoutDevice] = useState<(TrustedDevice & { ip?: string; location?: string }) | null>(null);
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

  // ── [원격 로그아웃 클릭] ──
  const handleRemoteLogoutClick = useCallback((device: any) => {
    setConfirmLogoutDevice(device);
  }, []);

  // ── [원격 로그아웃 승인] ──
  const handleRemoteLogoutConfirm = useCallback(() => {
    if (!confirmLogoutDevice) return;
    
    const deviceId = confirmLogoutDevice.id;
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    removeDevice(deviceId);

    setConfirmLogoutDevice(null);
    showToast("해당 기기의 접근 세션이 성공적으로 차단되었습니다.", "success");
  }, [confirmLogoutDevice, removeDevice, showToast]);

  const handleAddTrustedDevice = useCallback(() => {
    const model = newDeviceModel.trim() || 'Unknown Device';
    const os = newDeviceOs.trim() || 'Unknown OS';
    const browser = newDeviceBrowser.trim() || 'Unknown Browser';
    const now = new Date().toISOString();

    const newDevice: TrustedDevice & { ip?: string; location?: string; isHacker?: boolean } = {
      id: `trusted-${Date.now()}`,
      name: `${model} · ${browser}`,
      model,
      os,
      browser,
      trusted: true,
      isCurrent: false,
      isHacker: false,
      lastActive: now,
      lastSeen: now,
    };

    setDevices((prev) => [...prev, newDevice]);
    addDevice(newDevice);

    setNewDeviceModel('');
    setNewDeviceOs('');
    setNewDeviceBrowser('');

    showToast("새 신뢰 기기가 성공적으로 등록되었습니다.", "success");
  }, [newDeviceModel, newDeviceOs, newDeviceBrowser, addDevice, showToast]);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white font-sans p-6 pb-28 select-none relative flex flex-col gap-6">
      <GlobalStyles />

      {/* ── 상단 헤더 ── */}
      <header className="flex justify-between items-center w-full pb-4 border-b border-white/5">
        <div>
          <h1 className="text-xl font-extrabold tracking-wider text-white">거점 및 기기 관리</h1>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            연결된 기기 권한을 제어하고 로그인 거점을 관리합니다.
          </p>
        </div>
      </header>

      {/* ── 거점·기기 관리 섹션 ── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#FF2E63]">lock_person</span>
          <div>
            <h2 className="text-base font-bold text-white tracking-wider">거점·기기 목록</h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {devices.length}개 기기 연결됨 ·{' '}
              <span className="text-[#FF2E63] font-semibold">
                {devices.filter((d) => !d.isCurrent).length}개 외부 기기
              </span>
            </p>
          </div>
        </div>

        {/* 기기 카드 목록 */}
        <div className="space-y-3">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onRemoteLogout={handleRemoteLogoutClick}
            />
          ))}

          {devices.length === 1 && devices[0].isCurrent && (
            <div className="text-center py-4 text-slate-500 text-xs font-mono border border-white/5 rounded-2xl bg-[#12141C]">
              ✅ 현재 기기만 연결되어 있습니다. 시스템 안전함.
            </div>
          )}
        </div>

        {/* 신뢰 기기 등록 폼 */}
        <div className="rounded-2xl border border-white/5 bg-[#12141C] p-6 space-y-4">
          <h3 className="text-sm font-bold text-white tracking-wider">✅ 신뢰 기기 추가</h3>
          <div className="space-y-3">
            <input
              id="new-device-model"
              value={newDeviceModel}
              onChange={(e) => setNewDeviceModel(e.target.value)}
              placeholder="모델명 (예: iPhone 15 Pro)"
              className="w-full px-4 py-3 rounded-xl bg-[#0B0C10] border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#FF2E63] transition-colors"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                id="new-device-os"
                value={newDeviceOs}
                onChange={(e) => setNewDeviceOs(e.target.value)}
                placeholder="OS (예: iOS 17)"
                className="px-4 py-3 rounded-xl bg-[#0B0C10] border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#FF2E63] transition-colors"
              />
              <input
                id="new-device-browser"
                value={newDeviceBrowser}
                onChange={(e) => setNewDeviceBrowser(e.target.value)}
                placeholder="브라우저 (예: Safari)"
                className="px-4 py-3 rounded-xl bg-[#0B0C10] border border-white/5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#FF2E63] transition-colors"
              />
            </div>
          </div>
          <button
            id="register-trusted-device-btn"
            onClick={handleAddTrustedDevice}
            className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-[#161923] border border-white/5 hover:border-[#00F5D4]/30 hover:bg-[#1C202E] active:scale-95 transition-all duration-200"
          >
            신뢰 기기 등록
          </button>
        </div>
      </section>

      {/* 🎭 로그아웃 컨펌 모달 */}
      <LogoutConfirmModal
        device={confirmLogoutDevice}
        onClose={() => setConfirmLogoutDevice(null)}
        onConfirm={handleRemoteLogoutConfirm}
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

// =============================================================================
// ⑤ 전역 애니메이션 스타일 주입
// =============================================================================

const GlobalStyles: React.FC = () => (
  <style>{`
    @keyframes alertPulse {
      0%, 100% {
        box-shadow: 0 0 16px rgba(255, 46, 99, 0.05);
        border-color: rgba(255, 46, 99, 0.3);
      }
      50% {
        box-shadow: 0 0 28px rgba(255, 46, 99, 0.2);
        border-color: rgba(255, 46, 99, 0.6);
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
  `}</style>
);

export default BaseManagePage;
