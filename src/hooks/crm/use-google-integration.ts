import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface IntegrationConfig {
  isConnected: boolean;
  scopes: string[] | null;
  lastSync: string | null;
  autoSyncContacts: boolean;
  autoLogEmails: boolean;
}

export function useGoogleIntegration() {
  const { user } = useAuth();
  const [config, setConfig] = useState<IntegrationConfig>({
    isConnected: false,
    scopes: null,
    lastSync: null,
    autoSyncContacts: false,
    autoLogEmails: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('crm_integration_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setConfig({
        isConnected: !!data?.google_access_token,
        scopes: data?.google_scopes || null,
        lastSync: data?.updated_at || null,
        autoSyncContacts: data?.auto_sync_contacts || false,
        autoLogEmails: data?.auto_log_emails || false,
      });
    } catch (error) {
      console.error('Error fetching integration config:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const connect = async () => {
    if (!user) return;
    
    setIsConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/crm/settings`;
      
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('google-oauth', {
        body: {
          action: 'get-auth-url',
          redirectUri,
          state: user.id,
        },
      });

      if (response.error) throw response.error;
      
      // Store state for callback
      localStorage.setItem('google_oauth_state', user.id);
      localStorage.setItem('google_oauth_redirect', redirectUri);
      
      // Open Google OAuth in same window
      window.location.href = response.data.authUrl;
    } catch (error: any) {
      console.error('Error initiating Google OAuth:', error);
      toast.error('Failed to connect Google Workspace');
      setIsConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    const state = localStorage.getItem('google_oauth_state');
    const redirectUri = localStorage.getItem('google_oauth_redirect');
    
    localStorage.removeItem('google_oauth_state');
    localStorage.removeItem('google_oauth_redirect');

    if (!state || !redirectUri) {
      throw new Error('Invalid OAuth state');
    }

    setIsConnecting(true);
    try {
      const response = await supabase.functions.invoke('google-oauth', {
        body: {
          action: 'exchange-code',
          code,
          redirectUri,
        },
      });

      if (response.error) throw response.error;

      toast.success('Google Workspace connected successfully!');
      await fetchConfig();
    } catch (error: any) {
      console.error('Error exchanging OAuth code:', error);
      toast.error('Failed to complete Google connection');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      const response = await supabase.functions.invoke('google-oauth', {
        body: { action: 'disconnect' },
      });

      if (response.error) throw response.error;

      setConfig({
        isConnected: false,
        scopes: null,
        lastSync: null,
        autoSyncContacts: false,
        autoLogEmails: false,
      });
      
      toast.success('Google Workspace disconnected');
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect Google Workspace');
    }
  };

  const updateSettings = async (settings: { autoSyncContacts?: boolean; autoLogEmails?: boolean }) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('crm_integration_config')
        .update({
          auto_sync_contacts: settings.autoSyncContacts ?? config.autoSyncContacts,
          auto_log_emails: settings.autoLogEmails ?? config.autoLogEmails,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setConfig(prev => ({
        ...prev,
        autoSyncContacts: settings.autoSyncContacts ?? prev.autoSyncContacts,
        autoLogEmails: settings.autoLogEmails ?? prev.autoLogEmails,
      }));

      toast.success('Settings updated');
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const fetchGoogleContacts = async () => {
    try {
      const response = await supabase.functions.invoke('google-contacts-sync', {
        body: { action: 'fetch-contacts' },
      });

      if (response.error) throw response.error;

      return response.data.contacts || [];
    } catch (error: any) {
      console.error('Error fetching Google contacts:', error);
      toast.error(error.message || 'Failed to fetch contacts');
      return [];
    }
  };

  const importGoogleContacts = async (contacts: any[]) => {
    try {
      const response = await supabase.functions.invoke('google-contacts-sync', {
        body: { action: 'import-contacts', contacts },
      });

      if (response.error) throw response.error;

      const { imported, skipped } = response.data;
      toast.success(`Imported ${imported} contacts (${skipped} skipped)`);
      
      return { imported, skipped };
    } catch (error: any) {
      console.error('Error importing contacts:', error);
      toast.error('Failed to import contacts');
      throw error;
    }
  };

  const searchGmailThreads = async (contactEmail: string) => {
    try {
      const response = await supabase.functions.invoke('google-gmail', {
        body: { action: 'search-threads', contactEmail },
      });

      if (response.error) throw response.error;

      return response.data.threads || [];
    } catch (error: any) {
      console.error('Error searching Gmail:', error);
      return [];
    }
  };

  return {
    config,
    isLoading,
    isConnecting,
    connect,
    disconnect,
    handleOAuthCallback,
    updateSettings,
    fetchGoogleContacts,
    importGoogleContacts,
    searchGmailThreads,
  };
}
