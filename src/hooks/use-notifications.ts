
import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { NotificationService } from '@/services/notification-service';

export function useNotifications() {
  const { user } = useAuth();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (user && isSupported) {
      // Initialize notification service
      const notificationService = NotificationService.getInstance();
      notificationService.initialize();
    }
  }, [user, isSupported]);

  const requestPermission = async () => {
    if (!isSupported) return false;
    
    const notificationService = NotificationService.getInstance();
    const permission = await notificationService.requestNotissionPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted' && user) {
      // Subscribe to push notifications
      await notificationService.subscribeToPushNotifications(user.id);
    }
    
    return permission === 'granted';
  };

  const showInAppNotification = (title: string, message: string, senderName?: string) => {
    const notificationService = NotificationService.getInstance();
    notificationService.showInAppNotification(title, message, senderName);
  };

  return {
    isSupported,
    notificationPermission,
    requestPermission,
    showInAppNotification,
    canShowNotifications: notificationPermission === 'granted',
  };
}
