import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useCallback } from 'react';
import axios from 'axios';
import { AuthToken, LogBoxRecord, SafeZoneBase, TrustedDevice, UserProfile } from '../types/index';
import { saveEncrypted, loadDecrypted, saveEncryptedSync, loadDecryptedSync, STORAGE_PASS } from '../services/cryptoService';
import { fetchSecurityEmails } from '../services/gmailService';
import { fetchGoogleUserProfile } from '../services/googleUserService';
import { getThreatLevel } from '../utils/geoUtils';
import { enrichThreatLevels } from '../utils/enrichRecords';
import { buildCurrentTrustedDevice, getCurrentDeviceFingerprint, isDeviceTrusted, addTrustedDeviceName } from '../utils/deviceUtils';
import {
  isDemoToken,
  isTokenExpired,
  mapThreatToVelocity,
  mergeRecordsById,
  stripMockRecords,
  isMockDeviceId,
} from '../utils/recordUtils';

// STORAGE_PASS is imported from cryptoService

export interface SecurityLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SPOOFED_EMAIL' | 'TOKEN_TAMPERED';
  message: string;
}

type State = {
  records: LogBoxRecord[];
  devices: TrustedDevice[];
  bases: SafeZoneBase[];
  authToken: AuthToken | null;
  userProfile: UserProfile | null;
  isDemoMode: boolean;
  isUnlocked: boolean;
  geocodingApiKey: string | null;
  isLoading: boolean;
  authReady: boolean;
  securityLogs: SecurityLog[];
};

type Action =
  | { type: 'HYDRATE_DONE' }
  | { type: 'UNLOCK' }
  | { type: 'SET_GEOCODING_KEY'; key: string | null }
  | { type: 'MERGE_RECORDS'; records: LogBoxRecord[] }
  | { type: 'SET_RECORDS'; records: LogBoxRecord[] }
  | { type: 'ADD_RECORD'; record: LogBoxRecord }
  | { type: 'DELETE_RECORD'; id: string }
  | { type: 'SET_DEVICES'; devices: TrustedDevice[] }
  | { type: 'ADD_DEVICE'; device: TrustedDevice }
  | { type: 'REMOVE_DEVICE'; id: string }
  | { type: 'ADD_BASE'; base: SafeZoneBase }
  | { type: 'REMOVE_BASE'; id: string }
  | { type: 'TOGGLE_BASE_MUTE'; id: string }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'AUTH_DEMO'; token: AuthToken }
  | { type: 'AUTH_LIVE'; token: AuthToken; userProfile: UserProfile | null; records: LogBoxRecord[]; devices: TrustedDevice[] }
  | { type: 'SIGN_OUT' }
  | { type: 'ADD_SECURITY_LOG'; log: SecurityLog }
  | { type: 'CLEAR_SECURITY_LOGS' }
  | { type: 'SET_BASES'; bases: SafeZoneBase[] }
  | { type: 'SET_SECURITY_LOGS'; logs: SecurityLog[] };

const STORAGE_KEY = 'logbox-token';
const STORAGE_PROFILE_KEY = 'logbox-user-profile';
const STORAGE_GEOCODE_KEY = 'logbox-geocode-key';

function enrichDevicesWithCurrent(devices: TrustedDevice[]): TrustedDevice[] {
  const currentId = getCurrentDeviceFingerprint();
  return devices.map((d) => ({
    ...d,
    isCurrent: d.id === currentId,
    lastActive: d.lastActive ?? d.lastSeen,
  }));
}

const parseRoute = (rawText?: string) => {
  const text = rawText || '';
  const parts = text.split(/[·•]/);
  if (parts.length >= 2) {
    const routePart = parts[1].trim();
    const arrowParts = routePart.split(/→|->/);
    if (arrowParts.length >= 2) {
      return {
        origin: arrowParts[0].trim(),
        destination: arrowParts[1].trim(),
      };
    }
  }
  const arrowParts = text.split(/→|->/);
  if (arrowParts.length >= 2) {
    return {
      origin: arrowParts[0].trim(),
      destination: arrowParts[1].trim(),
    };
  }
  return {
    origin: '알 수 없음',
    destination: '알 수 없음',
  };
};

function extractUniqueDevices(records: LogBoxRecord[], currentDevice: TrustedDevice): TrustedDevice[] {
  const map = new Map<string, TrustedDevice>();
  
  // Always include current device
  map.set(currentDevice.name.toLowerCase(), currentDevice);

  // Extract devices from records
  for (const r of records) {
    if (r.device && r.device.name) {
      const nameLower = r.device.name.toLowerCase();
      if (!map.has(nameLower)) {
        const route = parseRoute(r.raw);
        map.set(nameLower, {
          ...r.device,
          trusted: isDeviceTrusted(r.device.name),
          ip: r.ip || 'Unknown IP',
          location: route.origin || 'Unknown Location',
        });
      }
    }
  }

  return Array.from(map.values());
}

const DEMO_DATE_OFFSETS: Record<string, { daysAgo: number; hour: number; minute: number }> = {
  'rec-google-1': { daysAgo: 7, hour: 14, minute: 32 },
  'rec-naver-1': { daysAgo: 6, hour: 9, minute: 15 },
  'rec-ig-1': { daysAgo: 5, hour: 22, minute: 10 },
  'rec-discord-1': { daysAgo: 4, hour: 11, minute: 45 },
  'rec-netflix-1': { daysAgo: 3, hour: 20, minute: 5 },
  'rec-steam-1': { daysAgo: 2, hour: 18, minute: 12 },
  'rec-yt-1': { daysAgo: 1, hour: 13, minute: 50 },
  'rec-kakao-1': { daysAgo: 0, hour: 8, minute: 30 },
  'rec-cursor-1': { daysAgo: 0, hour: 10, minute: 15 },
  'rec-mangoboard-1': { daysAgo: 0, hour: 12, minute: 0 },
  'rec-openai-1': { daysAgo: 0, hour: 15, minute: 40 },
};

function getDemoRecordTime(id: string): string {
  const config = DEMO_DATE_OFFSETS[id];
  const date = new Date();
  if (config) {
    date.setDate(date.getDate() - config.daysAgo);
    date.setHours(config.hour, config.minute, 0, 0);
  }
  return date.toISOString();
}

const DEMO_RECORDS: LogBoxRecord[] = [
  {
    id: 'rec-google-1',
    platform: 'google',
    ip: '203.0.113.1',
    latitude: 37.5665,
    longitude: 126.9780,
    device: { id: 'd1', name: 'Google/Chrome on Android', model: 'Pixel', os: 'Android', browser: 'Chrome', trusted: false, lastActive: '' },
    timeISO: '',
    threatLevel: 3,
    raw: '[구글 계정] 로그인 감지 · 서울 → 뉴욕',
    subject: '[구글 계정] 새로운 기기 로그인 감지',
    body: '구글 계정이 평소와 다른 기기(Google/Chrome on Android)에서 비정상적인 위치(서울 → 뉴욕)로 이동하며 로그인되었습니다. 본인의 로그인인지 신속히 확인해 주세요.',
    from: 'no-reply@accounts.google.com',
    isServerVerified: false,
    authMode: 'TypeA',
  },
  {
    id: 'rec-naver-1',
    platform: 'naver',
    ip: '198.51.100.5',
    latitude: 35.1796,
    longitude: 129.0756,
    device: { id: 'd2', name: 'Naver/iOS', model: 'iPhone', os: 'iOS', browser: 'Safari', trusted: false, lastActive: '' },
    timeISO: '',
    threatLevel: 1,
    raw: '[네이버] 로그인 감지 · 부산 → 서울',
    subject: '[네이버] 새로운 기기에서 로그인되었습니다.',
    body: '네이버 계정이 부산 지역의 새로운 기기(iPhone)에서 로그인되었습니다. 본인이 아닌 경우 비밀번호 변경 등 보안 조치를 적용해 주세요.',
    from: 'no-reply@mail.naver.com',
    isServerVerified: false,
    authMode: 'TypeA',
  },
  {
    id: 'rec-ig-1',
    platform: 'instagram',
    ip: '157.240.24.174',
    latitude: 37.7749,
    longitude: -122.4194,
    device: { id: 'd-ig-1', name: 'Instagram/iOS', model: 'iPhone', os: 'iOS', browser: 'Safari', trusted: false, lastActive: '' },
    timeISO: '',
    threatLevel: 3,
    raw: '[인스타그램] 로그인 감지 · 샌프란시스코 → 서울',
    subject: '[인스타그램] 로그인 감지',
    body: '새로운 기기에서 인스타그램 계정에 접속한 것이 회원님이 맞으신가요?',
    from: 'security@mail.instagram.com',
    isServerVerified: false,
    authMode: 'TypeA',
  },
  {
    id: 'rec-discord-1',
    platform: 'discord',
    ip: '104.16.58.37',
    latitude: 51.5074,
    longitude: -0.1278,
    device: { id: 'd-dc-1', name: 'Discord/Windows', model: 'Desktop', os: 'Windows', browser: 'Discord App', trusted: false, lastActive: '' },
    timeISO: '',
    threatLevel: 2,
    raw: '[디스코드] 로그인 감지 · 런던 → 서울',
    subject: '[디스코드] 새로운 위치에서 로그인 감지',
    body: '이전과는 다른 IP 주소나 장치에서 디스코드 계정에 로그인하려는 시도가 감지되었습니다. 보안 코드를 입력해 주세요.',
    from: 'noreply@discord.com',
    isServerVerified: false,
    authMode: 'TypeA',
  },
  {
    id: 'rec-netflix-1',
    platform: 'netflix',
    ip: '45.57.90.1',
    latitude: 34.0522,
    longitude: -118.2437,
    device: { id: 'd-nf-1', name: 'Netflix/SmartTV', model: 'SmartTV', os: 'WebOS', browser: 'Chrome', trusted: false, lastActive: '' },
    timeISO: '',
    threatLevel: 2,
    raw: '[넷플릭스] 로그인 감지 · 로스앤젤레스 → 서울',
    subject: '[넷플릭스] 새로운 기기에서 로그인 감지',
    body: '회원님의 넷플릭스 계정이 로스앤젤레스의 새로운 스마트 TV에서 활성화되었습니다.',
    from: 'info@netflix.com',
    isServerVerified: false,
    authMode: 'TypeA',
  },
  {
    id: 'rec-steam-1',
    platform: 'steam',
    ip: '162.254.195.44',
    latitude: 47.6062,
    longitude: -122.3321,
    device: { id: 'd-steam-1', name: 'Steam/Desktop', model: 'Desktop', os: 'Windows', browser: 'Steam Client', trusted: false, lastActive: '' },
    timeISO: '',
    threatLevel: 3,
    raw: '[스팀] 로그인 감지 · 시애틀 → 서울',
    subject: '[스팀] 계정 접속 알림',
    body: '스팀 계정에 미국 시애틀의 신규 장비로 로그인이 시도되었습니다. 모바일 스팀 가드를 활성화하여 계정을 잠그십시오.',
    from: 'noreply@steampowered.com',
    isServerVerified: false,
    authMode: 'TypeA',
  },
  {
    id: 'rec-yt-1',
    platform: 'google',
    ip: '192.0.2.7',
    latitude: 37.5665,
    longitude: 126.9780,
    device: { id: 'd3', name: 'YouTube/Desktop', model: 'Desktop', os: 'Windows', browser: 'Chrome', trusted: true, lastActive: '' },
    timeISO: '',
    threatLevel: 0,
    raw: '[구글 계정] 로그인 감지 · 서울 → 서울',
    subject: 'Google 로그인 보안 확인 알림',
    body: '귀하의 Google 계정이 정상적인 본인 신뢰 기기에서 로그인 상태를 유지하고 있습니다.',
    from: 'no-reply@accounts.google.com',
    isServerVerified: false,
    authMode: 'TypeA',
  },
  {
    id: 'rec-kakao-1',
    platform: 'kakao',
    ip: '198.51.100.9',
    latitude: 37.4563,
    longitude: 126.7052,
    device: { id: 'd4', name: 'Kakao/Web', model: 'Desktop', os: 'Windows', browser: 'Edge', trusted: true, lastActive: '' },
    timeISO: '',
    threatLevel: 1,
    raw: '[카카오] 로그인 알림 · 인천 → 서울',
    subject: '[카카오] 로그인 알림',
    body: '카카오 계정에 새로운 기기 로그인 알림입니다. 인천에서 서울 거점을 경유한 접속이 맞는지 확인하세요.',
    from: 'notification@mail.kakao.com',
    isServerVerified: false,
    authMode: 'TypeA',
  },
  {
    id: 'rec-cursor-1',
    platform: 'cursor',
    ip: '182.21.34.88',
    latitude: 35.1796,
    longitude: 129.0756,
    device: { id: 'd-cs-1', name: 'Cursor/Windows', model: 'Desktop', os: 'Windows', browser: 'Cursor App', trusted: false, lastActive: '' },
    timeISO: '',
    threatLevel: 3,
    raw: '[Cursor] 로그인 감지 · 부산 → 서울',
    subject: '[Cursor] New Login Detected',
    body: 'A new login was detected from your Cursor account. IP: 182.21.34.88. Device: Cursor/Windows. Location: Busan',
    from: 'noreply@cursor.sh',
    isServerVerified: false,
    authMode: 'TypeA',
  },
  {
    id: 'rec-mangoboard-1',
    platform: 'mangoboard',
    ip: '52.79.231.111',
    latitude: 37.4563,
    longitude: 126.7052,
    device: { id: 'd-mb-1', name: 'MangoBoard Mail Server', model: 'SMTP Server', os: 'Linux', browser: 'SMTP Server', trusted: true, lastActive: '' },
    timeISO: '',
    threatLevel: 1,
    raw: '[망고보드] 로그인 알림 · 인천 → 서울',
    subject: '[망고보드] 계정 로그인 인증 성공',
    body: '망고보드 계정 로그인이 성공했습니다. 이 메일은 망고보드 공식 메일 서버(52.79.231.111)에서 발송되었습니다.',
    from: 'no-reply@mangoboard.net',
    isServerVerified: true,
    authMode: 'TypeB',
  },
  {
    id: 'rec-openai-1',
    platform: 'openai',
    ip: '104.18.2.14',
    latitude: 34.0522,
    longitude: -118.2437,
    device: { id: 'd-oa-1', name: 'OpenAI Notification Server', model: 'SMTP Server', os: 'Linux', browser: 'SMTP Server', trusted: true, lastActive: '' },
    timeISO: '',
    threatLevel: 2,
    raw: '[OpenAI] 로그인 알림 · 로스앤젤레스 → 서울',
    subject: '[OpenAI] 계정 로그인 감지',
    body: '계정에 성공적으로 로그인했습니다. 발신 서버: 104.18.2.14.',
    from: 'noreply@tm.openai.com',
    isServerVerified: true,
    authMode: 'TypeB',
  },
];

const initialMock = (): State => {
  const now = new Date().toISOString();
  const current = buildCurrentTrustedDevice();

  const hasGmailToken = typeof window !== 'undefined' && !!localStorage.getItem('gmail_token');

  let records: LogBoxRecord[] = [];
  let devices: TrustedDevice[] = [];

  if (hasGmailToken) {
    try {
      const cachedRecs = loadDecryptedSync<LogBoxRecord[]>('gmail_records_cache', STORAGE_PASS);
      if (cachedRecs) {
        records = stripMockRecords(cachedRecs);
      }
    } catch (e) {
      console.error('[LogBox] Failed to parse cached records', e);
    }
    try {
      const cachedDevs = loadDecryptedSync<TrustedDevice[]>('gmail_devices_cache', STORAGE_PASS);
      if (cachedDevs) {
        devices = cachedDevs.filter((d: TrustedDevice) => !isMockDeviceId(d.id));
      }
    } catch (e) {
      console.error('[LogBox] Failed to parse cached devices', e);
    }
    if (devices.length === 0) {
      devices = [current];
    }
  } else {
    records = DEMO_RECORDS.map((r) => {
      const recordISO = getDemoRecordTime(r.id);
      return {
        ...r,
        timeISO: recordISO,
        device: r.device ? { ...r.device, lastActive: recordISO, lastSeen: recordISO } : undefined,
      };
    });
    devices = enrichDevicesWithCurrent([
      current,
      ...records.map((r) => r.device).filter((d): d is TrustedDevice => Boolean(d)),
      {
        id: 'hacker-device-001',
        name: 'Windows PC · Chrome (해커)',
        model: 'Unknown PC',
        os: 'Windows 11',
        browser: 'Chrome 124',
        trusted: false,
        lastActive: now,
        lastSeen: now,
      }
    ]);
  }

  const bases: SafeZoneBase[] = [
    { id: 'base-1', name: '집', center: { lat: 37.5665, lng: 126.9780 }, radiusKm: 5, muted: false },
  ];

  return {
    records,
    devices,
    bases,
    authToken: null,
    userProfile: null,
    isDemoMode: !hasGmailToken,
    isUnlocked: false,
    geocodingApiKey: null,
    isLoading: false,
    authReady: false,
    securityLogs: [],
  };
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE_DONE':
      return { ...state, authReady: true };
    case 'UNLOCK':
      return { ...state, isUnlocked: true };
    case 'SET_GEOCODING_KEY':
      return { ...state, geocodingApiKey: action.key };
    case 'MERGE_RECORDS': {
      const merged = mergeRecordsById(state.records, action.records);
      return { ...state, records: state.isDemoMode ? merged : stripMockRecords(merged) };
    }
    case 'SET_RECORDS':
      return { ...state, records: state.isDemoMode ? action.records : stripMockRecords(action.records) };
    case 'ADD_RECORD': {
      const merged = mergeRecordsById(state.records, [action.record]);
      return { ...state, records: state.isDemoMode ? merged : stripMockRecords(merged) };
    }
    case 'DELETE_RECORD':
      return { ...state, records: state.records.filter((r) => r.id !== action.id) };
    case 'SET_DEVICES':
      return { ...state, devices: enrichDevicesWithCurrent(state.isDemoMode ? (action.devices || []) : (Array.isArray(action.devices) ? action.devices.filter(d => !isMockDeviceId(d.id)) : [])) };
    case 'ADD_DEVICE':
      return { ...state, devices: enrichDevicesWithCurrent(state.isDemoMode ? [action.device, ...state.devices] : [action.device, ...state.devices].filter(d => !isMockDeviceId(d.id))) };
    case 'REMOVE_DEVICE':
      return { ...state, devices: state.devices.filter((d) => d.id !== action.id) };
    case 'ADD_BASE':
      return { ...state, bases: [action.base, ...state.bases] };
    case 'REMOVE_BASE':
      return { ...state, bases: state.bases.filter((b) => b.id !== action.id) };
    case 'TOGGLE_BASE_MUTE':
      return {
        ...state,
        bases: state.bases.map((b) => (b.id === action.id ? { ...b, muted: !b.muted } : b)),
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.value };
    case 'AUTH_DEMO':
      return {
        ...state,
        authToken: action.token,
        userProfile: null,
        isDemoMode: true,
        isUnlocked: true,
      };
    case 'AUTH_LIVE':
      return {
        ...state,
        authToken: action.token,
        userProfile: action.userProfile,
        isDemoMode: false,
        isUnlocked: true,
        records: stripMockRecords(action.records),
        devices: enrichDevicesWithCurrent(Array.isArray(action.devices) ? action.devices.filter(d => !isMockDeviceId(d.id)) : []),
      };
    case 'SIGN_OUT':
      return {
        ...initialMock(),
        authReady: true,
        geocodingApiKey: state.geocodingApiKey,
        securityLogs: state.securityLogs,
      };
    case 'ADD_SECURITY_LOG':
      return {
        ...state,
        securityLogs: [action.log, ...state.securityLogs].slice(0, 100),
      };
    case 'CLEAR_SECURITY_LOGS':
      return { ...state, securityLogs: [] };
    case 'SET_BASES':
      return { ...state, bases: action.bases };
    case 'SET_SECURITY_LOGS':
      return { ...state, securityLogs: action.logs };
    default:
      return state;
  }
}

async function loadGeocodingKey(): Promise<string | undefined> {
  try {
    const geok = await loadDecrypted<string>(STORAGE_GEOCODE_KEY, STORAGE_PASS);
    return geok ?? undefined;
  } catch {
    return undefined;
  }
}

type ContextValue = State & {
  isGoogleConnected: boolean;
  unlock: () => void;
  setToken: (token: AuthToken | null) => Promise<void>;
  setGeocodingKey: (key: string | null) => Promise<void>;
  syncGmail: () => Promise<void>;
  addRecord: (r: LogBoxRecord) => void;
  deleteRecord: (id: string) => void;
  addDevice: (d: TrustedDevice) => void;
  removeDevice: (id: string) => void;
  addBase: (b: SafeZoneBase) => void;
  removeBase: (id: string) => void;
  toggleBaseMute: (id: string) => void;
  speed: number;
  syncTime: string | null;
  logs: LogBoxRecord[];
  blockAccessHandler: (id?: string) => void;
  whitelistHandler: (id?: string) => void;
  addSecurityLog: (log: SecurityLog) => void;
  clearSecurityLogs: () => void;
};

const LogBoxContext = createContext<ContextValue | undefined>(undefined);

async function syncGmailFromToken(token: AuthToken, geocodingKey?: string | null): Promise<LogBoxRecord[]> {
  if (isDemoToken(token)) return [];
  const fetched = await fetchSecurityEmails(token.accessToken, geocodingKey ?? undefined);
  if (fetched.length === 0) return [];
  return enrichThreatLevels(fetched);
}

export const LogBoxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, undefined, initialMock);
  const hydratedRef = useRef(false);

  // Set Authorization header whenever authToken changes
  useEffect(() => {
    if (state.authToken?.accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${state.authToken.accessToken}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [state.authToken]);

  const applyLiveAuth = useCallback(async (token: AuthToken): Promise<void> => {
    dispatch({ type: 'SET_LOADING', value: true });
    try {
      // Set authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token.accessToken}`;

      const geok = await loadGeocodingKey();
      
      // Perform initial Gmail sync on client
      const gmailRecords = await syncGmailFromToken(token, geok ?? state.geocodingApiKey);
      const currentDev = buildCurrentTrustedDevice();
      const uniqueDevices = extractUniqueDevices(gmailRecords, currentDev);

      // Save initial sync data in MongoDB
      try {
        await axios.post('/api/user/sync', { records: gmailRecords, devices: uniqueDevices });
      } catch (syncErr) {
        console.warn('[LogBox] Sync during login failed (MongoDB offline)', syncErr);
      }

      // Load full user state from backend DB (creating/verifying user info as well)
      let bases: SafeZoneBase[] = [];
      let securityLogs: SecurityLog[] = [];
      let userProfile: UserProfile | null = null;
      let geocodingApiKey: string | null = null;
      let dbRecords: LogBoxRecord[] = [];
      let dbDevices: TrustedDevice[] = [];

      try {
        const res = await axios.get('/api/user');
        const data = res.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          userProfile = data.userProfile ?? null;
          geocodingApiKey = data.geocodingApiKey ?? null;
          bases = Array.isArray(data.bases) ? data.bases : [];
          securityLogs = Array.isArray(data.securityLogs) ? data.securityLogs : [];
          dbRecords = Array.isArray(data.records) ? data.records : [];
          dbDevices = Array.isArray(data.devices) ? data.devices : [];

          if (Array.isArray(data.trustedDeviceNames)) {
            saveEncryptedSync('trusted_devices', data.trustedDeviceNames, STORAGE_PASS);
          }
        } else {
          throw new Error('Invalid JSON response from server');
        }
      } catch (dbErr) {
        console.warn('[LogBox] Fetch user state from DB failed during login', dbErr);
      }

      // 실제 Gmail API에서 수집된 데이터가 존재하면 이를 최우선 바인딩 (백엔드 깡통 데이터 방지)
      const finalRecords = stripMockRecords(gmailRecords.length > 0 ? gmailRecords : dbRecords);
      const finalDevices = (gmailRecords.length > 0 ? uniqueDevices : dbDevices).filter(d => !isMockDeviceId(d.id));

      try {
        saveEncryptedSync('gmail_records_cache', finalRecords, STORAGE_PASS);
        saveEncryptedSync('gmail_devices_cache', finalDevices, STORAGE_PASS);
      } catch (err) {
        console.warn('[LogBox] Failed to save encrypted caches', err);
      }

      dispatch({
        type: 'AUTH_LIVE',
        token,
        userProfile,
        records: finalRecords,
        devices: finalDevices,
      });

      dispatch({ type: 'SET_BASES', bases });
      dispatch({ type: 'SET_SECURITY_LOGS', logs: securityLogs });
      if (geocodingApiKey) {
        dispatch({ type: 'SET_GEOCODING_KEY', key: geocodingApiKey });
      }

      try {
        await saveEncrypted(STORAGE_KEY, token, STORAGE_PASS);
      } catch (err) {
        console.warn('[LogBox] Failed to persist auth token', err);
      }
    } catch (err) {
      console.warn('[LogBox] applyLiveAuth failed', err);
      const error = err as Error & { code?: string };
      if (error.message && (error.message.includes('Network Error') || error.code === 'ERR_NETWORK')) {
        window.alert('LogBox 백엔드 서버(Port 5000) 연결에 실패했습니다.\n서버가 구동 중인지 확인해 주세요.');
      } else {
        window.alert('로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        console.error('[LogBox] Login error details:', error.message || String(err));
      }
      dispatch({ type: 'SIGN_OUT' });
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  }, [state.geocodingApiKey]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    (async () => {
      try {
        const token = await loadDecrypted<AuthToken>(STORAGE_KEY, STORAGE_PASS);
        if (!token || isTokenExpired(token)) {
          if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
          dispatch({ type: 'HYDRATE_DONE' });
          return;
        }

        // 데모 토큰일 경우 백엔드 호출을 아예 시도하지 않고 즉시 로컬 단독 로딩!
        if (isDemoToken(token)) {
          dispatch({ type: 'AUTH_DEMO', token });
          const now = new Date().toISOString();
          const current = buildCurrentTrustedDevice();
          const localDemoRecords: LogBoxRecord[] = DEMO_RECORDS.map((r) => {
            const recordISO = getDemoRecordTime(r.id);
            return {
              ...r,
              timeISO: recordISO,
              device: r.device ? { ...r.device, lastActive: recordISO, lastSeen: recordISO } : undefined,
            };
          });
          const localDemoDevices = enrichDevicesWithCurrent([
            current,
            ...(localDemoRecords.map((r) => r.device).filter(Boolean) as TrustedDevice[]),
            {
              id: 'hacker-device-001',
              name: 'Windows PC · Chrome (해커)',
              model: 'Unknown PC',
              os: 'Windows 11',
              browser: 'Chrome 124',
              trusted: false,
              lastActive: now,
              lastSeen: now,
            }
          ]);
          const localDemoBases = [
            { id: 'base-1', name: '집', center: { lat: 37.5665, lng: 126.9780 }, radiusKm: 5, muted: false },
          ];

          dispatch({ type: 'SET_RECORDS', records: localDemoRecords });
          dispatch({ type: 'SET_DEVICES', devices: localDemoDevices });
          dispatch({ type: 'SET_BASES', bases: localDemoBases });
          dispatch({ type: 'SET_SECURITY_LOGS', logs: [] });
          dispatch({ type: 'HYDRATE_DONE' });
          return;
        }

        // Set token temporarily so that the /api/user request has authorization
        axios.defaults.headers.common['Authorization'] = `Bearer ${token.accessToken}`;

        // Fetch user data from backend MongoDB
        let dbBases = [];
        let dbSecurityLogs = [];
        let userProfile = null;
        let geocodingApiKey = null;
        let dbRecords = [];
        let dbDevices = [];

        try {
          const res = await axios.get('/api/user');
          const data = res.data;
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            userProfile = data.userProfile ?? null;
            geocodingApiKey = data.geocodingApiKey ?? null;
            dbBases = Array.isArray(data.bases) ? data.bases : [];
            dbSecurityLogs = Array.isArray(data.securityLogs) ? data.securityLogs : [];
            dbRecords = Array.isArray(data.records) ? data.records : [];
            dbDevices = Array.isArray(data.devices) ? data.devices : [];

            if (Array.isArray(data.trustedDeviceNames)) {
              saveEncryptedSync('trusted_devices', data.trustedDeviceNames, STORAGE_PASS);
            }
            if (geocodingApiKey) {
              dispatch({ type: 'SET_GEOCODING_KEY', key: geocodingApiKey });
            }
          } else {
            throw new Error('Invalid JSON response from server');
          }
        } catch (dbErr) {
          console.warn('[LogBox] DB fetch failed during hydration', dbErr);
        }

        // 1차 바인딩
        dispatch({
          type: 'AUTH_LIVE',
          token,
          userProfile,
          records: dbRecords,
          devices: dbDevices,
        });

        dispatch({ type: 'SET_BASES', bases: dbBases });
        dispatch({ type: 'SET_SECURITY_LOGS', logs: dbSecurityLogs });

        // Background Sync (Only for live sessions)
        (async () => {
          try {
            const enriched = await syncGmailFromToken(token, geocodingApiKey ?? state.geocodingApiKey);
            const currentDev = buildCurrentTrustedDevice();
            const uniqueDevs = extractUniqueDevices(enriched, currentDev);

            // Send sync request to backend to save new records & devices in MongoDB
            try {
              await axios.post('/api/user/sync', { records: enriched, devices: uniqueDevs });
            } catch (syncApiErr) {
              console.warn('[LogBox] Background sync API post failed', syncApiErr);
            }

            // 실제 Gmail API 데이터 최우선 바인딩 (백엔드 깡통 데이터 덮어쓰기 방지)
            const finalRecs = stripMockRecords(enriched.length > 0 ? enriched : dbRecords);
            const finalDevs = (enriched.length > 0 ? uniqueDevs : dbDevices).filter((d: any) => !isMockDeviceId(d.id));

            try {
              saveEncryptedSync('gmail_records_cache', finalRecs, STORAGE_PASS);
              saveEncryptedSync('gmail_devices_cache', finalDevs, STORAGE_PASS);
            } catch (err) {
              console.warn('[LogBox] Failed to save encrypted caches during background sync', err);
            }

            dispatch({ type: 'SET_RECORDS', records: finalRecs });
            dispatch({ type: 'SET_DEVICES', devices: finalDevs });
          } catch (syncErr) {
            console.error('[LogBox] Background sync failed', syncErr);
          }
        })();
      } catch (err) {
        console.error('[LogBox] Hydration failed', err);
        // 데모 토큰의 경우 백엔드가 죽어 있어도 로컬 상태로 폴백 로드
        try {
          const decryptedToken = await loadDecrypted<AuthToken>(STORAGE_KEY, STORAGE_PASS);
          if (decryptedToken && isDemoToken(decryptedToken)) {
            dispatch({ type: 'AUTH_DEMO', token: decryptedToken });
            const now = new Date().toISOString();
            const current = buildCurrentTrustedDevice();
            const localDemoRecords = DEMO_RECORDS.map((r) => ({
              ...r,
              timeISO: now,
              device: r.device ? { ...r.device, lastActive: now, lastSeen: now } : undefined,
            }));
            const localDemoDevices = enrichDevicesWithCurrent([
              current,
              ...(localDemoRecords.map((r) => r.device).filter(Boolean) as TrustedDevice[]),
              {
                id: 'hacker-device-001',
                name: 'Windows PC · Chrome (해커)',
                model: 'Unknown PC',
                os: 'Windows 11',
                browser: 'Chrome 124',
                trusted: false,
                lastActive: now,
                lastSeen: now,
              }
            ]);
            const localDemoBases = [
              { id: 'base-1', name: '집', center: { lat: 37.5665, lng: 126.9780 }, radiusKm: 5, muted: false },
            ];

            dispatch({ type: 'SET_RECORDS', records: localDemoRecords });
            dispatch({ type: 'SET_DEVICES', devices: localDemoDevices });
            dispatch({ type: 'SET_BASES', bases: localDemoBases });
            dispatch({ type: 'SET_SECURITY_LOGS', logs: [] });
          }
        } catch (innerErr) {
          console.error('[LogBox] Hydration fallback failed', innerErr);
        }
      } finally {
        dispatch({ type: 'HYDRATE_DONE' });
      }
    })();
  }, []);

  const unlock = useCallback((): void => dispatch({ type: 'UNLOCK' }), []);

  const setToken = useCallback(async (token: AuthToken | null): Promise<void> => {
    if (!token) {
      dispatch({ type: 'SIGN_OUT' });
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(STORAGE_PROFILE_KEY);
          window.localStorage.removeItem('gmail_records_cache');
          window.localStorage.removeItem('gmail_devices_cache');
          window.localStorage.removeItem('gmail_token');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[LogBox] Failed to clear auth storage', err);
      }
      return;
    }

    if (isTokenExpired(token)) {
      dispatch({ type: 'SIGN_OUT' });
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem('gmail_records_cache');
          window.localStorage.removeItem('gmail_devices_cache');
          window.localStorage.removeItem('gmail_token');
        }
      } catch {
        // ignore
      }
      return;
    }

    if (isDemoToken(token)) {
      dispatch({ type: 'AUTH_DEMO', token });
      try {
        await saveEncrypted(STORAGE_KEY, token, STORAGE_PASS);
      } catch (err) {
        console.warn('[LogBox] Failed to persist demo token', err);
      }

      // 데모 모드일 때는 백엔드 API를 전혀 호출하지 않고 즉시 100% 프론트엔드 로컬 모드로 세팅!
      const now = new Date().toISOString();
      const current = buildCurrentTrustedDevice();
      const localDemoRecords: LogBoxRecord[] = DEMO_RECORDS.map((r) => ({
        ...r,
        timeISO: now,
        device: r.device ? { ...r.device, lastActive: now, lastSeen: now } : undefined,
      }));
      const localDemoDevices = enrichDevicesWithCurrent([
        current,
        ...localDemoRecords.map((r) => r.device).filter((d): d is TrustedDevice => Boolean(d)),
        {
          id: 'hacker-device-001',
          name: 'Windows PC · Chrome (해커)',
          model: 'Unknown PC',
          os: 'Windows 11',
          browser: 'Chrome 124',
          trusted: false,
          lastActive: now,
          lastSeen: now,
        }
      ]);
      const localDemoBases = [
        { id: 'base-1', name: '집', center: { lat: 37.5665, lng: 126.9780 }, radiusKm: 5, muted: false },
      ];
      
      dispatch({ type: 'SET_RECORDS', records: localDemoRecords });
      dispatch({ type: 'SET_DEVICES', devices: localDemoDevices });
      dispatch({ type: 'SET_BASES', bases: localDemoBases });
      dispatch({ type: 'SET_SECURITY_LOGS', logs: [] });
      return;
    }

    await applyLiveAuth(token);
  }, [applyLiveAuth]);

  const syncGmail = useCallback(async (): Promise<void> => {
    const token = state.authToken;
    if (!token || isDemoToken(token)) return;
    dispatch({ type: 'SET_LOADING', value: true });
    try {
      const enriched = await syncGmailFromToken(token, state.geocodingApiKey);
      const currentDev = buildCurrentTrustedDevice();
      const uniqueDevices = extractUniqueDevices(enriched, currentDev);

      // Save sync records to backend MongoDB
      await axios.post('/api/user/sync', { records: enriched, devices: uniqueDevices });

      // Fetch the merged list back
      const res = await axios.get('/api/user');
      dispatch({ type: 'SET_RECORDS', records: res.data.records });
      dispatch({ type: 'SET_DEVICES', devices: res.data.devices });
    } catch (err) {
      console.warn('[LogBox] Gmail sync failed', err);
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  }, [state.authToken, state.geocodingApiKey]);

  // [FIX-15] ──── 백그라운드 자동 동기화 (3분 주기) ────
  const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3분

  useEffect(() => {
    // 데모 모드이거나 인증 토큰이 없으면 폴링하지 않음
    if (!state.authToken || state.isDemoMode) return;
    if (isDemoToken(state.authToken)) return;

    // 초기 동기화는 Hydration에서 이미 수행했으므로, 첫 폴링은 3분 후부터 시작
    const intervalId = setInterval(async () => {
      try {
        console.log('[LogBox] Background auto-sync triggered');
        const token = state.authToken;
        if (!token || isDemoToken(token) || isTokenExpired(token)) return;

        const enriched = await syncGmailFromToken(token, state.geocodingApiKey);
        if (enriched.length === 0) return;

        const currentDev = buildCurrentTrustedDevice();
        const uniqueDevs = extractUniqueDevices(enriched, currentDev);

        // 백엔드 동기화
        try {
          await axios.post('/api/user/sync', { records: enriched, devices: uniqueDevs });
        } catch (syncErr) {
          console.warn('[LogBox] Background sync API post failed', syncErr);
        }

        // UI 상태 갱신
        const finalRecs = stripMockRecords(enriched);
        const finalDevs = uniqueDevs.filter((d: any) => !isMockDeviceId(d.id));

        dispatch({ type: 'SET_RECORDS', records: finalRecs });
        dispatch({ type: 'SET_DEVICES', devices: finalDevs });

        saveEncryptedSync('gmail_records_cache', finalRecs, STORAGE_PASS);
        saveEncryptedSync('gmail_devices_cache', finalDevs, STORAGE_PASS);
      } catch (err) {
        console.error('[LogBox] Background auto-sync failed', err);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [state.authToken, state.isDemoMode, state.geocodingApiKey]);

  const setGeocodingKey = useCallback(async (key: string | null): Promise<void> => {
    dispatch({ type: 'SET_GEOCODING_KEY', key });
    try {
      await axios.put('/api/user/geocoding-key', { geocodingApiKey: key });
      if (key) {
        await saveEncrypted(STORAGE_GEOCODE_KEY, key, STORAGE_PASS);
      } else if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_GEOCODE_KEY);
      }
    } catch (err) {
      console.error('[LogBox] Failed to update geocoding key on server', err);
    }
  }, []);

  const syncTime = useMemo(() => {
    if (state.records.length === 0) return null;
    const sorted = [...state.records].sort((a, b) => (b.timeISO ?? '').localeCompare(a.timeISO ?? ''));
    const latest = sorted[0]?.timeISO;
    if (!latest) return null;
    try {
      return new Date(latest).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return latest;
    }
  }, [state.records]);

  const speed = useMemo(() => {
    if (state.records.length === 0) return 0;
    const maxThreat = Math.max(...state.records.map((record) => record.threatLevel ?? 0));
    return mapThreatToVelocity(maxThreat);
  }, [state.records]);

  const blockAccessHandler = useCallback((id?: string) => {
    if (!id) return;
    if (state.isDemoMode) {
      dispatch({ type: 'DELETE_RECORD', id });
      dispatch({
        type: 'SET_DEVICES',
        devices: state.devices.filter(d => d.id !== id && d.name !== id)
      });
      const nowStr = new Date().toISOString();
      dispatch({
        type: 'ADD_SECURITY_LOG',
        log: {
          id: `sec-log-${Date.now()}`,
          timestamp: nowStr,
          level: 'TOKEN_TAMPERED',
          message: `해커 기기/세션(${id})의 접근이 즉시 차단되었습니다.`,
        }
      });
    } else {
      console.warn('[LogBox] blockAccessHandler invoked', { id });
    }
  }, [state.isDemoMode, state.devices]);

  const whitelistHandler = useCallback((deviceName?: string) => {
    if (!deviceName) return;
    if (state.isDemoMode) {
      addTrustedDeviceName(deviceName);
      dispatch({
        type: 'SET_DEVICES',
        devices: state.devices.map(d => d.name === deviceName ? { ...d, trusted: true } : d)
      });
      dispatch({
        type: 'SET_RECORDS',
        records: state.records.map(r => r.device?.name === deviceName ? {
          ...r,
          device: { ...r.device, trusted: true }
        } : r)
      });
      const nowStr = new Date().toISOString();
      dispatch({
        type: 'ADD_SECURITY_LOG',
        log: {
          id: `sec-log-${Date.now()}`,
          timestamp: nowStr,
          level: 'INFO',
          message: `사용자 본인 기기(${deviceName})가 신뢰 기기로 등록되었습니다.`,
        }
      });
    } else {
      console.warn('[LogBox] whitelistHandler invoked', { deviceName });
    }
  }, [state.isDemoMode, state.devices, state.records]);

  const addRecord = useCallback(async (r: LogBoxRecord): Promise<void> => {
    dispatch({ type: 'ADD_RECORD', record: r });
    if (state.isDemoMode) return;
    try {
      await axios.post('/api/user/sync', { records: [r] });
    } catch (err) {
      console.error('[LogBox] Failed to add record on server', err);
    }
  }, [state.isDemoMode]);

  const deleteRecord = useCallback(async (id: string): Promise<void> => {
    dispatch({ type: 'DELETE_RECORD', id });
    if (state.isDemoMode) return;
    try {
      await axios.delete(`/api/records/${id}`);
    } catch (err) {
      console.error('[LogBox] Failed to delete record on server', err);
    }
  }, [state.isDemoMode]);

  const addDevice = useCallback(async (d: TrustedDevice): Promise<void> => {
    dispatch({ type: 'ADD_DEVICE', device: d });
    if (state.isDemoMode) return;
    try {
      await axios.post('/api/devices', d);
    } catch (err) {
      console.error('[LogBox] Failed to add device on server', err);
    }
  }, [state.isDemoMode]);

  const removeDevice = useCallback(async (id: string): Promise<void> => {
    dispatch({ type: 'REMOVE_DEVICE', id });
    if (state.isDemoMode) return;
    try {
      await axios.delete(`/api/devices/${id}`);
    } catch (err) {
      console.error('[LogBox] Failed to remove device on server', err);
    }
  }, [state.isDemoMode]);

  const addBase = useCallback(async (b: SafeZoneBase): Promise<void> => {
    dispatch({ type: 'ADD_BASE', base: b });
    if (state.isDemoMode) return;
    try {
      await axios.post('/api/bases', b);
    } catch (err) {
      console.error('[LogBox] Failed to add base on server', err);
    }
  }, [state.isDemoMode]);

  const removeBase = useCallback(async (id: string): Promise<void> => {
    dispatch({ type: 'REMOVE_BASE', id });
    if (state.isDemoMode) return;
    try {
      await axios.delete(`/api/bases/${id}`);
    } catch (err) {
      console.error('[LogBox] Failed to remove base on server', err);
    }
  }, [state.isDemoMode]);

  const toggleBaseMute = useCallback(async (id: string): Promise<void> => {
    dispatch({ type: 'TOGGLE_BASE_MUTE', id });
    if (state.isDemoMode) return;
    try {
      const base = state.bases.find(b => b.id === id);
      if (base) {
        await axios.put(`/api/bases/${id}/mute`, { muted: !base.muted });
      }
    } catch (err) {
      console.error('[LogBox] Failed to toggle base mute on server', err);
    }
  }, [state.isDemoMode, state.bases]);

  const addSecurityLog = useCallback(async (log: SecurityLog): Promise<void> => {
    dispatch({ type: 'ADD_SECURITY_LOG', log });
    if (state.isDemoMode) return;
    try {
      await axios.post('/api/security-logs', log);
    } catch (err) {
      console.error('[LogBox] Failed to add security log on server', err);
    }
  }, [state.isDemoMode]);

  const clearSecurityLogs = useCallback(async (): Promise<void> => {
    dispatch({ type: 'CLEAR_SECURITY_LOGS' });
    if (state.isDemoMode) return;
    try {
      await axios.delete('/api/security-logs');
    } catch (err) {
      console.error('[LogBox] Failed to clear security logs on server', err);
    }
  }, [state.isDemoMode]);

  const isGoogleConnected = useMemo(() => {
    return !!state.authToken && !state.isDemoMode;
  }, [state.authToken, state.isDemoMode]);

  const value: ContextValue = useMemo(
    () => ({
      ...state,
      isGoogleConnected,
      unlock,
      setToken,
      setGeocodingKey,
      syncGmail,
      addRecord,
      deleteRecord,
      addDevice,
      removeDevice,
      addBase,
      removeBase,
      toggleBaseMute,
      speed,
      syncTime,
      logs: state.records,
      blockAccessHandler,
      whitelistHandler,
      addSecurityLog,
      clearSecurityLogs,
    }),
    [state, isGoogleConnected, unlock, setToken, setGeocodingKey, syncGmail, speed, syncTime, blockAccessHandler, whitelistHandler, addSecurityLog, clearSecurityLogs],
  );

  return <LogBoxContext.Provider value={value}>{children}</LogBoxContext.Provider>;
};

export function useLogBox(): ContextValue {
  const ctx = useContext(LogBoxContext);
  if (!ctx) throw new Error('useLogBox must be used within LogBoxProvider');
  return ctx;
}
