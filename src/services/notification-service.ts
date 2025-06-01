
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export class NotificationService {
  private static instance: NotificationService;
  private registration: ServiceWorkerRegistration | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered successfully');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    }
    return 'denied';
  }

  showInAppNotification(title: string, message: string, senderName?: string) {
    const displayMessage = senderName ? `${senderName}: ${message}` : message;
    
    toast(title, {
      description: displayMessage,
      duration: 5000,
      action: {
        label: 'View Chat',
        onClick: () => {
          // Navigate to chat page
          window.location.href = '/chat';
        },
      },
    });
  }

  async showPushNotification(title: string, message: string, data?: any) {
    // First try to show browser notification if permission is granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body: message,
          icon: '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
          badge: '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
          tag: 'chat-message',
          data: data,
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = '/chat';
          notification.close();
        };

        // Auto close after 5 seconds
        setTimeout(() => notification.close(), 5000);
        
        return;
      } catch (error) {
        console.error('Error showing browser notification:', error);
      }
    }

    // Fallback to service worker notification if available
    if (this.registration && 'showNotification' in this.registration) {
      try {
        await this.registration.showNotification(title, {
          body: message,
          icon: '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
          badge: '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
          tag: 'chat-message',
          data: data,
          requireInteraction: true,
        });
      } catch (error) {
        console.error('Error showing service worker notification:', error);
      }
    }
  }

  async subscribeToPushNotifications(userId: string) {
    if (!this.registration) {
      console.error('Service Worker not registered');
      return null;
    }

    try {
      // For now, we'll skip actual push subscription setup
      // This would require VAPID keys and a backend push service
      console.log('Push notifications would be set up for user:', userId);
      return null;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
