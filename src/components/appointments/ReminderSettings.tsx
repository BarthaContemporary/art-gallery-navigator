
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BookingSettings {
  id?: string;
  email_reminders: boolean;
  reminder_hours: number;
  admin_notifications: boolean;
  notification_email: string;
  confirmation_emails: boolean;
}

export function ReminderSettings() {
  const [settings, setSettings] = useState<BookingSettings>({
    email_reminders: true,
    reminder_hours: 24,
    admin_notifications: true,
    notification_email: '',
    confirmation_emails: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('booking_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        setSettings({
          id: data.id,
          email_reminders: data.email_reminders ?? true,
          reminder_hours: data.reminder_hours ?? 24,
          admin_notifications: data.admin_notifications ?? true,
          notification_email: data.notification_email ?? '',
          confirmation_emails: data.confirmation_emails ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsData = {
        email_reminders: settings.email_reminders,
        reminder_hours: settings.reminder_hours,
        admin_notifications: settings.admin_notifications,
        notification_email: settings.notification_email,
        confirmation_emails: settings.confirmation_emails,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('booking_settings')
          .update(settingsData)
          .eq('id', settings.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('booking_settings')
          .insert(settingsData)
          .select()
          .single();
        
        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }

      toast.success("Reminder settings saved successfully");
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      const { error } = await supabase.functions.invoke('send-appointment-email', {
        body: {
          appointmentId: 'test',
          emailType: 'test',
          testEmail: settings.notification_email || 'admin@gallery.com'
        }
      });

      if (error) throw error;
      toast.success("Test email sent successfully!");
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error("Failed to send test email. Please check your email configuration.");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

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
              checked={settings.email_reminders}
              onCheckedChange={(checked) =>
                setSettings(prev => ({ ...prev, email_reminders: checked }))
              }
            />
          </div>

          {settings.email_reminders && (
            <div className="space-y-2">
              <Label htmlFor="reminder-hours">Reminder timing</Label>
              <Select
                value={settings.reminder_hours.toString()}
                onValueChange={(value) =>
                  setSettings(prev => ({ ...prev, reminder_hours: parseInt(value) }))
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
              checked={settings.confirmation_emails}
              onCheckedChange={(checked) =>
                setSettings(prev => ({ ...prev, confirmation_emails: checked }))
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
              checked={settings.admin_notifications}
              onCheckedChange={(checked) =>
                setSettings(prev => ({ ...prev, admin_notifications: checked }))
              }
            />
          </div>

          {settings.admin_notifications && (
            <div className="space-y-2">
              <Label htmlFor="notification-email">Notification email address</Label>
              <Input
                id="notification-email"
                type="email"
                value={settings.notification_email}
                onChange={(e) =>
                  setSettings(prev => ({ ...prev, notification_email: e.target.value }))
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
          <Button variant="outline" onClick={handleTestEmail}>
            Send Test Email
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
