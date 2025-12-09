import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Mail, 
  Shield, 
  Download, 
  Database,
  ChevronDown,
  FileText,
  Image,
  Users,
  Calendar,
  FileSpreadsheet,
  Check,
  Loader2,
  RefreshCw,
  Globe,
  Plus,
  Trash2
} from "lucide-react";
import { useViewerEmbedDomains, useAddEmbedDomain, useDeleteEmbedDomain } from '@/hooks/viewer/useViewerEmbedDomains';
import { exportData } from "@/lib/backup";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGoogleIntegration } from "@/hooks/crm/use-google-integration";
import { GoogleContactsImportDialog } from "@/components/crm/settings/GoogleContactsImportDialog";

export default function SettingsPage() {
  const { toast: toastHook } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const callbackHandledRef = useRef(false);
  
  const {
    config,
    isLoading: isGoogleLoading,
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
      handleOAuthCallback(code)
        .then(() => {
          setSearchParams({});
        })
        .catch(() => {
          setSearchParams({});
          callbackHandledRef.current = false;
        });
    }
  }, [searchParams, handleOAuthCallback, setSearchParams]);

  const scopeFeatures = [
    { scope: 'contacts', icon: Users, label: 'Contacts', description: 'Import & sync', enabled: config.scopes?.some(s => s.includes('contacts')) },
    { scope: 'gmail', icon: Mail, label: 'Gmail', description: 'View threads', enabled: config.scopes?.some(s => s.includes('gmail')) },
    { scope: 'calendar', icon: Calendar, label: 'Calendar', description: 'Log meetings', enabled: config.scopes?.some(s => s.includes('calendar')) },
    { scope: 'sheets', icon: FileSpreadsheet, label: 'Sheets', description: 'Export data', enabled: config.scopes?.some(s => s.includes('spreadsheets')) },
  ];

  const handleExport = async (type: 'full' | 'data-only' | 'media-only') => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      await exportData(type, (progress) => {
        setExportProgress(progress);
      });

      toastHook({
        title: "Export completed",
        description: `Your ${type} backup has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toastHook({
        title: "Export failed",
        description: "There was an error creating your backup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">System Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure general system settings and preferences
        </p>
      </div>

      <div className="grid gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              Basic gallery information and configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="gallery-name">Gallery Name</Label>
                <Input 
                  id="gallery-name"
                  placeholder="Your Gallery Name"
                  defaultValue="Bartha Contemporary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Primary Contact Email</Label>
                <Input 
                  id="contact-email"
                  type="email"
                  placeholder="contact@gallery.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select 
                  id="timezone"
                  className="w-full h-10 px-3 border border-input bg-background text-sm"
                  defaultValue="Europe/London"
                >
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Europe/Paris">Europe/Paris (CET)</option>
                  <option value="America/New_York">America/New York (EST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                </select>
              </div>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Settings
            </CardTitle>
            <CardDescription>
              Configure default email sender information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="from-name">Default "From" Name</Label>
                <Input 
                  id="from-name"
                  placeholder="Gallery Team"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-email">Default "From" Email</Label>
                <Input 
                  id="from-email"
                  type="email"
                  placeholder="noreply@gallery.com"
                />
              </div>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Toggles</CardTitle>
            <CardDescription>
              Enable or disable major features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>CRM Module</Label>
                <p className="text-xs text-muted-foreground">
                  Contact management and campaigns
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Projects Module</Label>
                <p className="text-xs text-muted-foreground">
                  Project management and kanban boards
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Appointments</Label>
                <p className="text-xs text-muted-foreground">
                  Online booking system
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Chat</Label>
                <p className="text-xs text-muted-foreground">
                  Internal messaging system
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>
              Security and access control options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require email confirmation</Label>
                <p className="text-xs text-muted-foreground">
                  Users must confirm email before accessing the system
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Session timeout (hours)</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically log out inactive users
                </p>
              </div>
              <Input 
                type="number" 
                defaultValue="24"
                className="w-20"
                min="1"
                max="168"
              />
            </div>
          </CardContent>
        </Card>

        {/* Backup & Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Backup & Export
            </CardTitle>
            <CardDescription>
              Export your data and media files for backup purposes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={isExporting} className="w-full sm:w-auto justify-between">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      {isExporting ? "Exporting..." : "Create Backup"}
                    </div>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Backup Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleExport('full')}
                    disabled={isExporting}
                    className="cursor-pointer"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Full Backup
                    <span className="ml-auto text-xs text-muted-foreground">Data + Media</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleExport('data-only')}
                    disabled={isExporting}
                    className="cursor-pointer"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Data Only
                    <span className="ml-auto text-xs text-muted-foreground">CSV + JSON</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleExport('media-only')}
                    disabled={isExporting}
                    className="cursor-pointer"
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Media Only
                    <span className="ml-auto text-xs text-muted-foreground">Images + Files</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {isExporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Export Progress</span>
                    <span>{Math.round(exportProgress)}%</span>
                  </div>
                  <Progress value={exportProgress} className="w-full" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CRM / Google Workspace Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
                  CRM - Google Workspace
                </CardTitle>
                <CardDescription>Connect Gmail, Contacts, Calendar, and Sheets for CRM</CardDescription>
              </div>
              {isGoogleLoading ? (
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {scopeFeatures.map((feature) => (
                <div 
                  key={feature.scope}
                  className={`flex items-center gap-2 p-2 border ${feature.enabled ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30'}`}
                >
                  <feature.icon className={`h-4 w-4 ${feature.enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs">{feature.label}</p>
                  </div>
                  {feature.enabled && <Check className="h-3 w-3 text-green-600" />}
                </div>
              ))}
            </div>

            {config.isConnected && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-sync">Auto-sync contacts</Label>
                      <p className="text-xs text-muted-foreground">Automatically import new Google contacts</p>
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
                      <p className="text-xs text-muted-foreground">Track email interactions automatically</p>
                    </div>
                    <Switch
                      id="auto-log"
                      checked={config.autoLogEmails}
                      onCheckedChange={(checked) => updateSettings({ autoLogEmails: checked })}
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                    <Download className="h-4 w-4 mr-2" />
                    Import Contacts
                  </Button>
                  <Button variant="outline" size="sm" onClick={connect} disabled={isConnecting}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconnect
                  </Button>
                  <Button variant="destructive" size="sm" onClick={disconnect}>
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
                <Button className="w-full" onClick={connect} disabled={isConnecting || isGoogleLoading}>
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

        {/* Image Viewer Embed Settings */}
        <ImageViewerEmbedSettings />
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

function ImageViewerEmbedSettings() {
  const { data: domains, isLoading } = useViewerEmbedDomains();
  const addDomain = useAddEmbedDomain();
  const deleteDomain = useDeleteEmbedDomain();
  const [newDomain, setNewDomain] = useState('');

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    await addDomain.mutateAsync(newDomain);
    setNewDomain('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Image Viewer - Embed Domains
        </CardTitle>
        <CardDescription>
          Specify which domains can embed the artwork viewer. Leave empty to allow all domains.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
          />
          <Button onClick={handleAddDomain} disabled={!newDomain.trim() || addDomain.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2 max-w-md">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : domains?.length ? (
          <div className="space-y-2 max-w-md">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded"
              >
                <span className="font-mono text-sm">{domain.domain}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteDomain.mutate(domain.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            No domain restrictions. The viewer can be embedded on any website.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
