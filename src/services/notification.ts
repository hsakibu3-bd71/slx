import { soundEffects } from './sound';

class NotificationService {
  private hasPermission: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      this.hasPermission = true;
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch (err) {
      return false;
    }
  }

  show(title: string, body: string, icon: string = '/icon.svg') {
    // 1. Play sound chime
    soundEffects.playMessageReceived();

    // 2. Mobile haptic vibration feedback
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {}
    }

    // 3. System / OS Display Notification (even if backgrounded or minimized)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon,
          badge: '/icon.svg',
          tag: 'nexus-chat',
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        // Fallback for Service Worker notification if standalone
        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon,
              badge: '/icon.svg',
              tag: 'nexus-chat',
            });
          });
        }
      }
    }
  }
}

export const notificationService = new NotificationService();
