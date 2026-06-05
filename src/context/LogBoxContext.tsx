import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useCallback } from 'react';
import { AuthToken, LogBoxRecord, SafeZoneBase, TrustedDevice, UserProfile } from '../types/index';
import { saveEncrypted, loadDecrypted } from '../services/cryptoService';
import { fetchSecurityEmails } from '../services/gmailService';
import { fetchGoogleUserProfile } from '../services/googleUserService';
import { getThreatLevel } from '../utils/geoUtils';
import { enrichThreatLevels } from '../utils/enrichRecords';
import { buildCurrentTrustedDevice, getCurrentDeviceFingerprint } from '../utils/deviceUtils';
import {
  isDemoToken,
  isTokenExpired,
  mapThreatToVelocity,
  mergeRecordsById,
  stripMockRecords,
} from '../utils/recordUtils';

const DEFAULT_STORAGE_PASS = 'logbox-default-passphrase';
const STORAGE_PASS = (import.meta.env.VITE_LOGBOX_STORAGE_SECRET as string | undefined)?.trim() || DEFAULT_STORAGE_PASS;
if (STORAGE_PASS === DEFAULT_STORAGE_PASS) {
  // eslint-disable-next-line no-console
  console.warn('[LogBox] VITE_LOGBOX_STORAGE_SECRET is not configured. localStorage encryption uses a fallback key.');
}

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
  | { type: 'AUTH_LIVE'; token: AuthToken; userProfile: UserProfile | null; records: LogBoxRecord[] }
  | { type: 'SIGN_OUT' }
  | { type: 'ADD_SECURITY_LOG'; log: SecurityLog }
  | { type: 'CLEAR_SECURITY_LOGS' };

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

const initialMock = (): State => {
  const now = new Date().toISOString();
  const current = buildCurrentTrustedDevice();

  const hasGmailToken = typeof window !== 'undefined' && !!localStorage.getItem('gmail_token');

  const records: LogBoxRecord[] = hasGmailToken ? [] : [
    {
      id: 'rec-google-1',
      platform: 'google',
      ip: '203.0.113.1',
      latitude: 37.5665,
      longitude: 126.9780,
      device: { id: 'd1', name: 'Google/Chrome on Android', model: 'Pixel', os: 'Android', browser: 'Chrome', trusted: false, lastActive: now },
      timeISO: now,
      threatLevel: getThreatLevel(900),
      raw: 'Google · 서울 → 뉴욕',
    },
    {
      id: 'rec-naver-1',
      platform: 'naver',
      ip: '198.51.100.5',
      latitude: 35.1796,
      longitude: 129.0756,
      device: { id: 'd2', name: 'Naver/iOS', model: 'iPhone', os: 'iOS', browser: 'Safari', trusted: false, lastActive: now },
      timeISO: now,
      threatLevel: getThreatLevel(120),
      raw: '[네이버] 새로운 기기에서 로그인 · 부산 → 서울',
    },
    {
      id: 'rec-yt-1',
      platform: 'google',
      ip: '192.0.2.7',
      latitude: 37.5665,
      longitude: 126.9780,
      device: { id: 'd3', name: 'YouTube/Desktop', model: 'Desktop', os: 'Windows', browser: 'Chrome', trusted: true, lastActive: now },
      timeISO: now,
      threatLevel: getThreatLevel(10),
      raw: 'YouTube · 서울 → 서울',
    },
    {
      id: 'rec-kakao-1',
      platform: 'kakao',
      ip: '198.51.100.9',
      latitude: 37.4563,
      longitude: 126.7052,
      device: { id: 'd4', name: 'Kakao/Web', model: 'Desktop', os: 'Windows', browser: 'Edge', trusted: true, lastActive: now },
      timeISO: now,
      threatLevel: getThreatLevel(85),
      raw: '[Kakao] 로그인 알림 · 인천 → 서울',
    },
  ];

  const devices: TrustedDevice[] = hasGmailToken ? [current] : enrichDevicesWithCurrent([
    current,
    ...records.map((r) => r.device).filter((d): d is TrustedDevice => Boolean(d)),
  ]);

  const bases: SafeZoneBase[] = [
    { id: 'base-1', name: '집', center: { lat: 37.5665, lng: 126.9780 }, radiusKm: 5, muted: false },
  ];

  return {
    records,
    devices,
    bases,
    authToken: null,
    userProfile: null,
    isDemoMode: false,
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
    case 'MERGE_RECORDS':
      return { ...state, records: mergeRecordsById(state.records, action.records) };
    case 'SET_RECORDS':
      return { ...state, records: action.records };
    case 'ADD_RECORD':
      return { ...state, records: mergeRecordsById(state.records, [action.record]) };
    case 'DELETE_RECORD':
      return { ...state, records: state.records.filter((r) => r.id !== action.id) };
    case 'SET_DEVICES':
      return { ...state, devices: enrichDevicesWithCurrent(action.devices) };
    case 'ADD_DEVICE':
      return { ...state, devices: enrichDevicesWithCurrent([action.device, ...state.devices]) };
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
        records: action.records,
        devices: enrichDevicesWithCurrent(
          state.devices.length > 0 ? state.devices : [buildCurrentTrustedDevice()],
        ),
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

  const applyLiveAuth = useCallback(async (token: AuthToken): Promise<void> => {
    dispatch({ type: 'SET_LOADING', value: true });
    try {
      const geok = await loadGeocodingKey();
      const [profile, gmailRecords] = await Promise.all([
        fetchGoogleUserProfile(token.accessToken),
        syncGmailFromToken(token, geok ?? state.geocodingApiKey),
      ]);

      const liveRecords = gmailRecords.length > 0 ? gmailRecords : stripMockRecords(state.records);

      dispatch({
        type: 'AUTH_LIVE',
        token,
        userProfile: profile,
        records: liveRecords,
      });

      try {
        await saveEncrypted(STORAGE_KEY, token, STORAGE_PASS);
        if (profile) await saveEncrypted(STORAGE_PROFILE_KEY, profile, STORAGE_PASS);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[LogBox] Failed to persist auth token/profile', err);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[LogBox] applyLiveAuth failed', err);
      dispatch({ type: 'SIGN_OUT' });
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  }, [state.geocodingApiKey, state.records]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    (async () => {
      try {
        const geok = await loadGeocodingKey();
        if (geok) dispatch({ type: 'SET_GEOCODING_KEY', key: geok });

        const token = await loadDecrypted<AuthToken>(STORAGE_KEY, STORAGE_PASS);
        if (!token || isTokenExpired(token)) {
          if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
          dispatch({ type: 'HYDRATE_DONE' });
          return;
        }

        if (isDemoToken(token)) {
          dispatch({ type: 'AUTH_DEMO', token });
          dispatch({ type: 'HYDRATE_DONE' });
          return;
        }

        const profile = await loadDecrypted<UserProfile>(STORAGE_PROFILE_KEY, STORAGE_PASS);
        const gmailRecords = await syncGmailFromToken(token, geok ?? null);
        dispatch({
          type: 'AUTH_LIVE',
          token,
          userProfile: profile,
          records: gmailRecords.length > 0 ? gmailRecords : stripMockRecords(initialMock().records),
        });
      } catch {
        // no-op
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
        if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
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
        // eslint-disable-next-line no-console
        console.warn('[LogBox] Failed to persist demo token', err);
      }
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
      if (enriched.length > 0) {
        dispatch({ type: 'SET_RECORDS', records: mergeRecordsById(stripMockRecords(state.records), enriched) });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[LogBox] Gmail sync failed', err);
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  }, [state.authToken, state.geocodingApiKey, state.records]);

  const setGeocodingKey = useCallback(async (key: string | null): Promise<void> => {
    dispatch({ type: 'SET_GEOCODING_KEY', key });
    if (key) {
      try {
        await saveEncrypted(STORAGE_GEOCODE_KEY, key, STORAGE_PASS);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[LogBox] Failed to save geocoding key', err);
      }
    } else if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_GEOCODE_KEY);
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
    // TODO: extend with actual block access workflow in future.
    // eslint-disable-next-line no-console
    console.warn('[LogBox] blockAccessHandler invoked', { id });
  }, []);

  const whitelistHandler = useCallback((id?: string) => {
    // TODO: extend with actual whitelist workflow in future.
    // eslint-disable-next-line no-console
    console.warn('[LogBox] whitelistHandler invoked', { id });
  }, []);

  const addSecurityLog = useCallback((log: SecurityLog): void => {
    dispatch({ type: 'ADD_SECURITY_LOG', log });
  }, []);

  const clearSecurityLogs = useCallback((): void => {
    dispatch({ type: 'CLEAR_SECURITY_LOGS' });
  }, []);

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
      addRecord: (r: LogBoxRecord) => dispatch({ type: 'ADD_RECORD', record: r }),
      deleteRecord: (id: string) => dispatch({ type: 'DELETE_RECORD', id }),
      addDevice: (d: TrustedDevice) => dispatch({ type: 'ADD_DEVICE', device: d }),
      removeDevice: (id: string) => dispatch({ type: 'REMOVE_DEVICE', id }),
      addBase: (b: SafeZoneBase) => dispatch({ type: 'ADD_BASE', base: b }),
      removeBase: (id: string) => dispatch({ type: 'REMOVE_BASE', id }),
      toggleBaseMute: (id: string) => dispatch({ type: 'TOGGLE_BASE_MUTE', id }),
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
