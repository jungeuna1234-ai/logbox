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
