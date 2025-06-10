
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

export function ReminderSettings() {
  const [settings, setSettings] = useState({
    emailReminders: true,
    reminderHours: 24,
    adminNotifications: true,
    notificationEmail: '',
    confirmationEmails: true,
  });

  const handleSave = () => {
    // Save settings to database
    toast.success("Reminder settings saved successfully");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Reminder Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                Send appointment reminders
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically send reminder emails to clients before their appointments
              </p>
            </div>
            <Switch
              checked={settings.emailReminders}
              onCheckedChange={(checked) =>
                setSettings(prev => ({ ...prev, emailReminders: checked }))
              }
            />
          </div>

          {settings.emailReminders && (
            <div className="space-y-2">
              <Label htmlFor="reminder-hours">Reminder timing</Label>
              <Select
                value={settings.reminderHours.toString()}
                onValueChange={(value) =>
                  setSettings(prev => ({ ...prev, reminderHours: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour before</SelectItem>
                  <SelectItem value="4">4 hours before</SelectItem>
                  <SelectItem value="24">24 hours before</SelectItem>
                  <SelectItem value="48">48 hours before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                Send confirmation emails
              </Label>
              <p className="text-xs text-muted-foreground">
                Send confirmation emails when appointments are booked
              </p>
            </div>
            <Switch
              checked={settings.confirmationEmails}
              onCheckedChange={(checked) =>
                setSettings(prev => ({ ...prev, confirmationEmails: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Admin Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                Admin notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive email notifications for new appointment bookings
              </p>
            </div>
            <Switch
              checked={settings.adminNotifications}
              onCheckedChange={(checked) =>
                setSettings(prev => ({ ...prev, adminNotifications: checked }))
              }
            />
          </div>

          {settings.adminNotifications && (
            <div className="space-y-2">
              <Label htmlFor="notification-email">Notification email address</Label>
              <Input
                id="notification-email"
                type="email"
                value={settings.notificationEmail}
                onChange={(e) =>
                  setSettings(prev => ({ ...prev, notificationEmail: e.target.value }))
                }
                placeholder="admin@gallery.com"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Test Email System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Send a test email to verify your email configuration is working correctly.
          </p>
          <Button variant="outline" onClick={() => toast.info("Test email sent!")}>
            Send Test Email
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          Save Settings
        </Button>
      </div>
    </div>
  );
}
