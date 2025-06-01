
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
    toast(title, {
      description: senderName ? `${senderName}: ${message}` : message,
      duration: 5000,
      action: {
        label: 'View',
        onClick: () => {
          // This could navigate to the chat or bring focus to it
          console.log('Navigate to chat');
        },
      },
    });
  }

  async showPushNotification(title: string, message: string, data?: any) {
    if (this.registration && 'showNotification' in this.registration) {
      try {
        await this.registration.showNotification(title, {
          body: message,
          icon: '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
          badge: '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
          tag: 'chat-message',
          data: data,
          requireInteraction: true,
          actions: [
            {
              action: 'reply',
              title: 'Reply'
            },
            {
              action: 'view',
              title: 'View Chat'
            }
          ]
        });
      } catch (error) {
        console.error('Error showing push notification:', error);
      }
    }
  }

  async subscribeToPushNotifications(userId: string) {
    if (!this.registration) {
      console.error('Service Worker not registered');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          // This would be your VAPID public key - you'd need to generate this
          'your-vapid-public-key-here'
        )
      });

      // Store subscription in Supabase
      await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.getKey('p256dh') ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))) : null,
          auth: subscription.getKey('auth') ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))) : null,
        });

      return subscription;
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
