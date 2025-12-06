import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Mail, 
  Calendar, 
  FileSpreadsheet, 
  Users, 
  Check, 
  Loader2,
  RefreshCw,
  Download,
  Database,
  AlertTriangle
} from "lucide-react";
import { useGoogleIntegration } from "@/hooks/crm/use-google-integration";
import { GoogleContactsImportDialog } from "@/components/crm/settings/GoogleContactsImportDialog";

export default function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const callbackHandledRef = useRef(false);
  
  const {
    config,
    isLoading,
    isConnecting,
    connect,
    disconnect,
    handleOAuthCallback,
    updateSettings,
    fetchGoogleContacts,
    importGoogleContacts,
  } = useGoogleIntegration();

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    // Prevent double-execution
    if (callbackHandledRef.current) return;
    
    if (error) {
      callbackHandledRef.current = true;
      console.error('Google OAuth error:', error, errorDescription);
      toast.error(`Google error: ${errorDescription || error}`);
      setSearchParams({});
      return;
    }
    
    if (code) {
      callbackHandledRef.current = true;
      console.log('Admin IntegrationsPage: Processing OAuth callback with code');
      
      handleOAuthCallback(code)
        .then(() => {
          console.log('Admin IntegrationsPage: OAuth callback successful');
          setSearchParams({});
        })
        .catch((err) => {
          console.error('Admin IntegrationsPage: OAuth callback failed:', err);
          setSearchParams({});
          // Reset ref so user can try again
          callbackHandledRef.current = false;
        });
    }
  }, [searchParams, handleOAuthCallback, setSearchParams]);

  const scopeFeatures = [
    { 
      scope: 'contacts', 
      icon: Users, 
      label: 'Contacts', 
      description: 'Import & sync contacts',
      enabled: config.scopes?.some(s => s.includes('contacts'))
    },
    { 
      scope: 'gmail', 
      icon: Mail, 
      label: 'Gmail', 
      description: 'View email threads',
      enabled: config.scopes?.some(s => s.includes('gmail'))
    },
    { 
      scope: 'calendar', 
      icon: Calendar, 
      label: 'Calendar', 
      description: 'Log meetings',
      enabled: config.scopes?.some(s => s.includes('calendar'))
    },
    { 
      scope: 'sheets', 
      icon: FileSpreadsheet, 
      label: 'Sheets', 
      description: 'Export to spreadsheets',
      enabled: config.scopes?.some(s => s.includes('spreadsheets'))
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground text-sm">
          Connect external services and manage API connections
        </p>
      </div>

      <div className="grid gap-6">
        {/* Google Workspace Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <img 
                    src="https://www.google.com/favicon.ico" 
                    alt="Google" 
                    className="h-5 w-5" 
                  />
                  Google Workspace
                </CardTitle>
                <CardDescription>
                  Connect Gmail, Contacts, Calendar, and Sheets
                </CardDescription>
              </div>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : config.isConnected ? (
                <Badge variant="default" className="bg-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {scopeFeatures.map((feature) => (
                <div 
                  key={feature.scope}
                  className={`flex items-center gap-3 p-3 border ${
                    feature.enabled ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30'
                  }`}
                >
                  <feature.icon className={`h-5 w-5 ${
                    feature.enabled ? 'text-green-600' : 'text-muted-foreground'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{feature.label}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                  {feature.enabled && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </div>
              ))}
            </div>

            {config.isConnected && (
              <>
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Integration Settings</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-sync">Auto-sync contacts</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically import new Google contacts
                      </p>
                    </div>
                    <Switch
                      id="auto-sync"
                      checked={config.autoSyncContacts}
                      onCheckedChange={(checked) => updateSettings({ autoSyncContacts: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-log">Auto-log emails</Label>
                      <p className="text-xs text-muted-foreground">
                        Track email interactions automatically
                      </p>
                    </div>
                    <Switch
                      id="auto-log"
                      checked={config.autoLogEmails}
                      onCheckedChange={(checked) => updateSettings({ autoLogEmails: checked })}
                    />
                  </div>
                </div>

                <Separator />
                
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowImportDialog(true)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Import Contacts
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={connect}
                    disabled={isConnecting}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconnect
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={disconnect}
                  >
                    Disconnect
                  </Button>
                </div>
                
                {config.lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {new Date(config.lastSync).toLocaleString()}
                  </p>
                )}
              </>
            )}

            {!config.isConnected && (
              <div className="mt-4">
                <Button 
                  className="w-full" 
                  onClick={connect}
                  disabled={isConnecting || isLoading}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Google Workspace'
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Securely connect your Google account to sync contacts and track emails
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Other Integrations placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Storage & Backup
            </CardTitle>
            <CardDescription>
              External storage configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-4 border bg-muted/30">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Storage credentials managed via database</p>
                <p className="text-xs text-muted-foreground">
                  Contact your system administrator for storage configuration
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <GoogleContactsImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        fetchContacts={fetchGoogleContacts}
        importContacts={importGoogleContacts}
      />
    </div>
  );
}
