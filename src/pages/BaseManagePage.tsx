import React, { useMemo, useState } from 'react';
import { useLogBox } from '../context/LogBoxContext';
import { SafeZoneBase, TrustedDevice } from '../types';
import { buildCurrentTrustedDevice, formatDeviceLabel, getDeviceLastActive } from '../utils/deviceUtils';
import { formatRecordDateTime } from '../utils/recordUtils';

type TabId = 'bases' | 'devices';

const BaseManagePage: React.FC = () => {
  const { bases, addBase, removeBase, toggleBaseMute, devices, addDevice, removeDevice } = useLogBox();
  const [tab, setTab] = useState<TabId>('bases');
  const [newBaseName, setNewBaseName] = useState('');
  const [newDeviceModel, setNewDeviceModel] = useState('');
  const [newDeviceOs, setNewDeviceOs] = useState('');
  const [newDeviceBrowser, setNewDeviceBrowser] = useState('');

  const currentDevice = useMemo(() => buildCurrentTrustedDevice(), []);

  const uniqueDevices = useMemo(() => {
    const seen = new Set<string>();
    const list = devices.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    return list.map((d) => ({
      ...d,
      isCurrent: d.id === currentDevice.id,
      lastActive: getDeviceLastActive(d),
    }));
  }, [devices, currentDevice.id]);

  const trustedDevices = useMemo(() => uniqueDevices.filter((d) => d.trusted), [uniqueDevices]);
  const otherDevices = useMemo(() => uniqueDevices.filter((d) => !d.trusted), [uniqueDevices]);

  const handleAddBase = (): void => {
    if (!newBaseName.trim()) return;
    const b: SafeZoneBase = {
      id: `base-${Date.now()}`,
      name: newBaseName.trim(),
      center: { lat: 37.5665, lng: 126.9780 },
      radiusKm: 5,
      muted: false,
    };
    addBase(b);
    setNewBaseName('');
  };

  const handleAddDevice = (): void => {
    const model = newDeviceModel.trim() || 'Unknown';
    const os = newDeviceOs.trim() || 'Unknown OS';
    const browser = newDeviceBrowser.trim() || 'Browser';
    const now = new Date().toISOString();
    const d: TrustedDevice = {
      id: `device-${Date.now()}`,
      name: `${model} · ${browser}`,
      model,
      os,
      browser,
      trusted: true,
      isCurrent: false,
      lastActive: now,
      lastSeen: now,
    };
    addDevice(d);
    setNewDeviceModel('');
    setNewDeviceOs('');
    setNewDeviceBrowser('');
  };

  const handleTrustCurrent = (): void => {
    addDevice({ ...currentDevice, trusted: true, isCurrent: true });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <h2 className="text-lg font-bold">거점·기기 관리</h2>

      <div className="flex rounded-xl bg-[#0f0f10] border border-gray-800 p-1">
        <button
          type="button"
          onClick={() => setTab('bases')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'bases' ? 'bg-[color:var(--accent)] text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          거점 관리
        </button>
        <button
          type="button"
          onClick={() => setTab('devices')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'devices' ? 'bg-[color:var(--accent)] text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          신뢰 기기 관리
        </button>
      </div>

      {tab === 'bases' ? (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">화이트리스트 거점 — 이 반경 안에서는 알림을 유예할 수 있습니다.</p>
          {bases.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 거점이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {bases.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-800 bg-[#0f0f10]"
                >
                  <div>
                    <div className="text-sm font-medium">{b.name}</div>
                    <div className="text-xs muted mt-0.5">
                      {b.center.lat.toFixed(4)}, {b.center.lng.toFixed(4)} · 반경 {b.radiusKm} km
                      {b.muted ? ' · 알림 유예' : ''}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => toggleBaseMute(b.id)} className="px-3 py-1 rounded-lg bg-gray-800 text-xs">
                      {b.muted ? '유예 해제' : '유예'}
                    </button>
                    <button type="button" onClick={() => removeBase(b.id)} className="px-3 py-1 rounded-lg bg-red-700/90 text-xs">
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newBaseName}
              onChange={(e) => setNewBaseName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBase()}
              placeholder="거점 이름 (예: 집, 회사)"
              className="flex-1 p-3 rounded-xl bg-[#0b0b0c] border border-gray-800 text-sm"
            />
            <button type="button" onClick={handleAddBase} className="px-5 py-3 btn-accent text-sm shrink-0">
              추가
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 현재 접속 기기 */}
          <div className="rounded-2xl border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/5 p-4">
            <div className="text-xs text-[color:var(--accent)] font-semibold mb-2">현재 접속 중인 기기</div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">{formatDeviceLabel(currentDevice)}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span>모델</span>
                  <span className="text-gray-200">{currentDevice.model}</span>
                  <span>OS</span>
                  <span className="text-gray-200">{currentDevice.os}</span>
                  <span>브라우저</span>
                  <span className="text-gray-200">{currentDevice.browser}</span>
                  <span>마지막 활동</span>
                  <span className="text-gray-200">{formatRecordDateTime(currentDevice.lastActive)}</span>
                </div>
              </div>
              <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">이 기기</span>
            </div>
            {!uniqueDevices.some((d) => d.id === currentDevice.id && d.trusted) ? (
              <button type="button" onClick={handleTrustCurrent} className="mt-4 w-full py-2.5 rounded-xl bg-gray-800 text-sm text-white hover:bg-gray-700">
                이 기기를 신뢰 목록에 추가
              </button>
            ) : null}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-2">신뢰 등록된 기기</h3>
            {trustedDevices.length === 0 ? (
              <p className="text-sm text-gray-500">신뢰 기기가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {trustedDevices.map((d) => (
                  <DeviceRow key={d.id} device={d} onRemove={() => removeDevice(d.id)} />
                ))}
              </ul>
            )}
          </div>

          {otherDevices.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">기타 기기</h3>
              <ul className="space-y-2">
                {otherDevices.map((d) => (
                  <DeviceRow key={d.id} device={d} onRemove={() => removeDevice(d.id)} muted />
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-800 bg-[#0f0f10] p-4 space-y-3">
            <div className="text-sm font-medium">신뢰 기기 수동 추가</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                value={newDeviceModel}
                onChange={(e) => setNewDeviceModel(e.target.value)}
                placeholder="모델 (예: iPhone 15)"
                className="p-2.5 rounded-lg bg-[#0b0b0c] border border-gray-800 text-sm"
              />
              <input
                value={newDeviceOs}
                onChange={(e) => setNewDeviceOs(e.target.value)}
                placeholder="OS (예: iOS)"
                className="p-2.5 rounded-lg bg-[#0b0b0c] border border-gray-800 text-sm"
              />
              <input
                value={newDeviceBrowser}
                onChange={(e) => setNewDeviceBrowser(e.target.value)}
                placeholder="브라우저 (예: Safari)"
                className="p-2.5 rounded-lg bg-[#0b0b0c] border border-gray-800 text-sm"
              />
            </div>
            <button type="button" onClick={handleAddDevice} className="w-full py-2.5 btn-accent text-sm">
              신뢰 기기 추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DeviceRow: React.FC<{
  device: TrustedDevice;
  onRemove: () => void;
  muted?: boolean;
}> = ({ device, onRemove, muted }) => (
  <li
    className={`flex items-center justify-between p-3 rounded-xl border ${
      muted ? 'border-gray-800 bg-gray-900/50' : 'border-gray-800 bg-[#0f0f10]'
    }`}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium truncate">{formatDeviceLabel(device)}</span>
        {device.isCurrent ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 shrink-0">현재</span>
        ) : null}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {device.os ?? '-'} · {device.browser ?? '-'} · {formatRecordDateTime(getDeviceLastActive(device))}
      </div>
    </div>
    <button type="button" onClick={onRemove} className="shrink-0 ml-2 px-3 py-1 rounded-lg bg-red-700/80 text-xs">
      삭제
    </button>
  </li>
);

export default BaseManagePage;
