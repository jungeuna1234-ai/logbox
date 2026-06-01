export const isNotificationSupported = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!isNotificationSupported()) return null;
  try {
    return await Notification.requestPermission();
  } catch {
    return null;
  }
}

export function sendNotification(title: string, options: NotificationOptions): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, options);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[LogBox] Notification failed', err);
  }
}

// ... (기존에 작성되어 있던 원래 코드들) ...

/**
 * 위도, 경도 값을 안전하게 파싱하고 유효성을 검사합니다. (자가진단 리팩토링 추가본)
 */
export const parseCoord = (lat: unknown, lng: unknown): [number, number] | null => {
  if (lat == null || lng == null) return null;
  
  const la = Number(lat);
  const lo = Number(lng);
  
  if (isNaN(la) || isNaN(lo)) return null;
  
  // 정상적인 위경도 범위를 벗어나는 기형적 데이터 방어
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  
  return [la, lo];
};


