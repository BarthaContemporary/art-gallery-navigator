import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Track if we've already processed the callback to prevent double-execution
  const callbackProcessedRef = useRef(false);

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

  const connect = useCallback(async () => {
    if (!user) return;
    
    setIsConnecting(true);
    try {
      // Use current page path for redirect - supports both /crm/settings and /admin/integrations
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      console.log('Google OAuth: Starting connection with redirect URI:', redirectUri);
      
      const response = await supabase.functions.invoke('google-oauth', {
        body: {
          action: 'get-auth-url',
          redirectUri,
          state: user.id,
        },
      });

      if (response.error) throw response.error;
      
      // Store state for callback - use sessionStorage for better reliability across page loads
      sessionStorage.setItem('google_oauth_state', user.id);
      sessionStorage.setItem('google_oauth_redirect', redirectUri);
      
      console.log('Google OAuth: Stored session state, redirecting to Google...');
      
      // Open Google OAuth in same window
      window.location.href = response.data.authUrl;
    } catch (error: any) {
      console.error('Error initiating Google OAuth:', error);
      toast.error('Failed to connect Google Workspace');
      setIsConnecting(false);
    }
  }, [user]);

  const handleOAuthCallback = useCallback(async (code: string): Promise<void> => {
    // Prevent double-execution (React Strict Mode, etc.)
    if (callbackProcessedRef.current) {
      console.log('Google OAuth: Callback already processed, skipping');
      return;
    }
    callbackProcessedRef.current = true;
    
    // Read values from sessionStorage (more reliable than localStorage for full page reloads)
    const state = sessionStorage.getItem('google_oauth_state');
    const redirectUri = sessionStorage.getItem('google_oauth_redirect');
    
    console.log('Google OAuth: Processing callback', { 
      hasCode: !!code, 
      hasState: !!state, 
      hasRedirectUri: !!redirectUri,
      redirectUri 
    });

    if (!state || !redirectUri) {
      // Reset the ref so user can try again
      callbackProcessedRef.current = false;
      const errorMsg = 'OAuth session expired. Please try connecting again.';
      console.error('Google OAuth:', errorMsg);
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    setIsConnecting(true);
    try {
      console.log('Google OAuth: Exchanging code for tokens...');
      
      const response = await supabase.functions.invoke('google-oauth', {
        body: {
          action: 'exchange-code',
          code,
          redirectUri,
        },
      });

      if (response.error) {
        console.error('Google OAuth: Edge function error:', response.error);
        throw response.error;
      }

      console.log('Google OAuth: Token exchange successful!');
      
      // Only clear storage AFTER successful exchange
      sessionStorage.removeItem('google_oauth_state');
      sessionStorage.removeItem('google_oauth_redirect');

      toast.success('Google Workspace connected successfully!');
      await fetchConfig();
    } catch (error: any) {
      console.error('Error exchanging OAuth code:', error);
      toast.error(error.message || 'Failed to complete Google connection');
      // Reset the ref so user can try again
      callbackProcessedRef.current = false;
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [fetchConfig]);

  const disconnect = useCallback(async () => {
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
  }, []);

  const updateSettings = useCallback(async (settings: { autoSyncContacts?: boolean; autoLogEmails?: boolean }) => {
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
  }, [user?.id, config.autoSyncContacts, config.autoLogEmails]);

  const fetchGoogleContacts = useCallback(async () => {
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
  }, []);

  const importGoogleContacts = useCallback(async (contacts: any[]) => {
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
  }, []);

  const searchGmailThreads = useCallback(async (contactEmail: string) => {
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
  }, []);

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
