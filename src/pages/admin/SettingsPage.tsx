import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  Mail, 
  Shield, 
  Download, 
  Database,
  ChevronDown,
  FileText,
  Image
} from "lucide-react";
import { exportData } from "@/lib/backup";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SettingsPage() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async (type: 'full' | 'data-only' | 'media-only') => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      await exportData(type, (progress) => {
        setExportProgress(progress);
      });

      toast({
        title: "Export completed",
        description: `Your ${type} backup has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
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
    <div className="p-6 space-y-6">
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
      </div>
    </div>
  );
}
