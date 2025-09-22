
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
    // Ensure the service worker is registered
    if (!this.registration) {
      await this.initialize();
    }

    if (!this.registration) {
      console.error('Service Worker not registered');
      return null;
    }

    try {
      // Note: Full Web Push requires VAPID keys. For now, we record an in-app/browser subscription
      // so campaigns can target users while we finalize push infrastructure.
      const userAgent = navigator.userAgent || 'unknown';
      const endpoint = 'in-app';

      // Check if a subscription already exists for this user/endpoint
      const { data: existing, error: fetchErr } = await supabase
        .from('notification_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .limit(1);

      if (fetchErr) {
        console.error('Failed checking existing subscription:', fetchErr);
      }

      if (existing && existing.length > 0) {
        const { error: updateErr } = await supabase
          .from('notification_subscriptions')
          .update({ user_agent: userAgent, updated_at: new Date().toISOString() })
          .eq('id', existing[0].id);

        if (updateErr) {
          console.error('Failed to update existing subscription:', updateErr);
        } else {
          console.log('Updated existing notification subscription');
        }
        return existing[0].id;
      }

      // Insert a minimal subscription record (acts as a delivery target for campaigns)
      const { data: insertData, error: insertErr } = await supabase
        .from('notification_subscriptions')
        .insert({
          user_id: userId,
          endpoint,
          p256dh_key: 'na',
          auth_key: 'na',
          user_agent: userAgent,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('Error subscribing to push notifications (DB insert):', insertErr);
        return null;
      }

      console.log('Created notification subscription record');
      return insertData?.id ?? null;
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
