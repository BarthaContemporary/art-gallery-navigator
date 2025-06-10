
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BookingSettings {
  id: string;
  advance_booking_days: number;
  buffer_time_minutes: number;
  auto_confirm: boolean;
  business_hours_start: string;
  business_hours_end: string;
  working_days: number[];
  notification_email?: string;
  booking_instructions?: string;
}

export function BookingSettings() {
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['booking-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data as BookingSettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<BookingSettings>) => {
      if (!settings) return;
      
      const { data, error } = await supabase
        .from('booking_settings')
        .update(updates)
        .eq('id', settings.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update settings: ' + error.message);
    },
  });

  const [formData, setFormData] = useState<Partial<BookingSettings>>({});

  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate(formData);
  };

  if (isLoading) {
    return <div className="p-6">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="p-6">No settings found</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="advance-booking">Advance Booking Days</Label>
              <Input
                id="advance-booking"
                type="number"
                value={formData.advance_booking_days || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  advance_booking_days: parseInt(e.target.value)
                })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                How many days in advance clients can book
              </p>
            </div>
            
            <div>
              <Label htmlFor="buffer-time">Buffer Time (minutes)</Label>
              <Input
                id="buffer-time"
                type="number"
                value={formData.buffer_time_minutes || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  buffer_time_minutes: parseInt(e.target.value)
                })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum time between appointments
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="auto-confirm"
              checked={formData.auto_confirm || false}
              onCheckedChange={(checked) => setFormData({
                ...formData,
                auto_confirm: checked
              })}
            />
            <Label htmlFor="auto-confirm">Auto-confirm appointments</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={formData.business_hours_start || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  business_hours_start: e.target.value
                })}
              />
            </div>
            
            <div>
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={formData.business_hours_end || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  business_hours_end: e.target.value
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="notification-email">Notification Email</Label>
            <Input
              id="notification-email"
              type="email"
              value={formData.notification_email || ''}
              onChange={(e) => setFormData({
                ...formData,
                notification_email: e.target.value
              })}
              placeholder="admin@gallery.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email address to receive booking notifications
            </p>
          </div>

          <div>
            <Label htmlFor="booking-instructions">Booking Instructions</Label>
            <Textarea
              id="booking-instructions"
              value={formData.booking_instructions || ''}
              onChange={(e) => setFormData({
                ...formData,
                booking_instructions: e.target.value
              })}
              placeholder="Special instructions for clients when booking..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={updateSettings.isPending}>
        {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
      </Button>
    </form>
  );
}
