import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bell, Send, Users, BarChart3, Settings, Calendar, Target } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationCampaign {
  id: string;
  title: string;
  message: string;
  target_audience: 'all' | 'artists' | 'clients' | 'custom';
  scheduled_at?: string;
  sent_at?: string;
  status: 'draft' | 'scheduled' | 'sent';
  click_count: number;
  delivery_count: number;
  created_at: string;
}

export function PushNotificationManager() {
  const { isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');

  // Campaign creation form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    target_audience: 'all',
    scheduled_at: '',
    icon_url: '',
    action_url: ''
  });

  useEffect(() => {
    if (isAdmin) {
      loadCampaigns();
    }
  }, [isAdmin]);

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast.error('Failed to load notification campaigns');
    }
  };

  const createCampaign = async () => {
    if (!formData.title || !formData.message) {
      toast.error('Title and message are required');
      return;
    }

    setLoading(true);
    try {
      const campaignData = {
        title: formData.title,
        message: formData.message,
        target_audience: formData.target_audience,
        scheduled_at: formData.scheduled_at || null,
        status: formData.scheduled_at ? 'scheduled' : 'draft',
        icon_url: formData.icon_url || null,
        action_url: formData.action_url || null,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { error } = await supabase
        .from('notification_campaigns')
        .insert([campaignData]);

      if (error) throw error;

      toast.success('Campaign created successfully');
      setFormData({
        title: '',
        message: '',
        target_audience: 'all',
        scheduled_at: '',
        icon_url: '',
        action_url: ''
      });
      loadCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const sendCampaign = async (campaignId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: { campaignId }
      });

      if (error) throw error;

      toast.success('Push notification sent successfully');
      loadCampaigns();
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send push notification');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      scheduled: 'outline',
      sent: 'default'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getAudienceLabel = (audience: string) => {
    const labels = {
      all: 'All Users',
      artists: 'Artists Only',
      clients: 'Clients Only',
      custom: 'Custom Audience'
    };
    return labels[audience as keyof typeof labels] || audience;
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Admin access required to manage push notifications</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Push Notification Manager</h1>
          <p className="text-muted-foreground">
            Manage and send push notifications to your website users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            barthacontemporary.com
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Create
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Create New Notification Campaign
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Notification Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter notification title..."
                    maxLength={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.title.length}/50 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target">Target Audience</Label>
                  <Select
                    value={formData.target_audience}
                    onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          All Users
                        </div>
                      </SelectItem>
                      <SelectItem value="artists">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Artists Only
                        </div>
                      </SelectItem>
                      <SelectItem value="clients">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Clients Only
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Enter your notification message..."
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.message.length}/200 characters
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Schedule (Optional)</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="action_url">Action URL (Optional)</Label>
                  <Input
                    id="action_url"
                    value={formData.action_url}
                    onChange={(e) => setFormData({ ...formData, action_url: e.target.value })}
                    placeholder="https://barthacontemporary.com/..."
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFormData({
                  title: '',
                  message: '',
                  target_audience: 'all',
                  scheduled_at: '',
                  icon_url: '',
                  action_url: ''
                })}>
                  Clear
                </Button>
                <Button 
                  onClick={createCampaign} 
                  disabled={loading || !formData.title || !formData.message}
                >
                  {loading ? 'Creating...' : 'Create Campaign'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No campaigns created yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold">{campaign.title}</h3>
                          <p className="text-sm text-muted-foreground">{campaign.message}</p>
                        </div>
                        {getStatusBadge(campaign.status)}
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>Target: {getAudienceLabel(campaign.target_audience)}</span>
                          {campaign.delivery_count > 0 && (
                            <span>Delivered: {campaign.delivery_count}</span>
                          )}
                          {campaign.click_count > 0 && (
                            <span>Clicks: {campaign.click_count}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {campaign.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(campaign.scheduled_at).toLocaleDateString()}
                            </span>
                          )}
                          {campaign.status === 'draft' && (
                            <Button
                              size="sm"
                              onClick={() => sendCampaign(campaign.id)}
                              disabled={loading}
                            >
                              Send Now
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">
                      {campaigns.filter(c => c.status === 'sent').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Campaigns Sent</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">
                      {campaigns.reduce((sum, c) => sum + (c.delivery_count || 0), 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Deliveries</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">
                      {campaigns.reduce((sum, c) => sum + (c.click_count || 0), 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Clicks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Notification Icon</Label>
                <Input 
                  placeholder="https://barthacontemporary.com/icon.png"
                  value={formData.icon_url}
                  onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Website Integration</Label>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Add this script to your Webflow site:</p>
                  <code className="block text-xs bg-background p-2 rounded border">
                    {`<script>
// Add to Webflow before </body> tag
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
</script>`}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}