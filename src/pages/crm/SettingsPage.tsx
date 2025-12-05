import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, FileSpreadsheet, Users, ExternalLink } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">CRM Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure integrations and preferences
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
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 border bg-muted/30">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Gmail</p>
                  <p className="text-xs text-muted-foreground">View email threads</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border bg-muted/30">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Contacts</p>
                  <p className="text-xs text-muted-foreground">Export & sync contacts</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border bg-muted/30">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Calendar</p>
                  <p className="text-xs text-muted-foreground">Log meetings</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border bg-muted/30">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Sheets</p>
                  <p className="text-xs text-muted-foreground">Export to spreadsheets</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Button disabled className="w-full">
                Connect Google Workspace
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Google Workspace integration will be available soon
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Open external apps with contact context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              When viewing a contact, you can quickly open:
            </p>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <span><strong>Gmail</strong> - Opens search with contact's email</span>
              </li>
              <li className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <span><strong>Instagram</strong> - Opens their profile</span>
              </li>
              <li className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <span><strong>WhatsApp</strong> - Opens chat via wa.me link</span>
              </li>
              <li className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <span><strong>LinkedIn</strong> - Opens their profile</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Export Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Export Settings</CardTitle>
            <CardDescription>
              Configure default export behavior
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Exports include: Name, Email, Phone, Company, Tags, Social handles, Location, and Notes.
              Additional fields can be selected during export.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
