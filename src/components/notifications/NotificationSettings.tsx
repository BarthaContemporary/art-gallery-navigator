
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';

export function NotificationSettings() {
  const { 
    isSupported, 
    notificationPermission, 
    requestPermission,
    canShowNotifications 
  } = useNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your browser doesn't support notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Manage how you receive notifications for new messages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="notifications">Enable Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications for new messages
            </p>
          </div>
          <Switch
            id="notifications"
            checked={canShowNotifications}
            disabled={notificationPermission === 'denied'}
          />
        </div>

        {notificationPermission === 'default' && (
          <Button onClick={requestPermission} className="w-full">
            Enable Notifications
          </Button>
        )}

        {notificationPermission === 'denied' && (
          <div className="text-sm text-muted-foreground">
            <p>Notifications are blocked. To enable them:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Click the lock icon in your browser's address bar</li>
              <li>Allow notifications for this site</li>
              <li>Refresh the page</li>
            </ol>
          </div>
        )}

        {canShowNotifications && (
          <div className="text-sm text-green-600">
            ✅ Notifications are enabled
          </div>
        )}
      </CardContent>
    </Card>
  );
}
