
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UsersList } from "@/components/auth/UsersList";
import { UploadedFilesList } from "@/components/auth/UploadedFilesList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeletionRequestsTable } from "@/components/auth/DeletionRequestsTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Database, Download, FileSpreadsheet as ExcelIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exportDatabaseAsJson, exportAllMediaAsZip, exportDataAsCsvZip } from '@/lib/backup';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';
import { toast } from "sonner";
import { FileUploader } from "@/components/uploads/FileUploader";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function UserSignup() {
  const { isAdmin } = useAuth();
  const { toast: hookToast } = useToast();
  
  // User Management State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"gallery_admin" | "artist" | "external">("artist");
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Backup & Export State
  const [isJsonExporting, setIsJsonExporting] = useState(false);
  const [isMediaExporting, setIsMediaExporting] = useState(false);
  const [isCsvZipExporting, setIsCsvZipExporting] = useState(false);
  const [enableJsonDateFilter, setEnableJsonDateFilter] = useState(false);
  const [jsonStartDate, setJsonStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [jsonEndDate, setJsonEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  if (!isAdmin) {
    return <div className="flex h-full items-center justify-center">
        <p className="text-xl font-semibold text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>;
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupError(null);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/email-confirmation'
        }
      });
      
      if (error) {
        throw error;
      }
      
      const userId = data.user?.id;
      if (userId) {
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: userId,
          role
        });
        if (roleError) {
          throw roleError;
        }
      }
      
      hookToast({
        title: "User created",
        description: `The user ${email} was created successfully.`,
        variant: "default"
      });
      
      setEmail("");
      setPassword("");
      setRole("artist");
    } catch (error: any) {
      console.error("User signup error:", error);
      setSignupError(error.message || "An unknown error occurred.");
      hookToast({
        title: "Error",
        description: error.message || "An unknown error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJsonExport = async () => {
    setIsJsonExporting(true);
    if (enableJsonDateFilter) {
      if (!jsonStartDate || !jsonEndDate) {
        toast.error("Please select both start and end dates for incremental backup.");
        setIsJsonExporting(false);
        return;
      }
      if (new Date(jsonStartDate) > new Date(jsonEndDate)) {
        toast.error("Start date cannot be after end date.");
        setIsJsonExporting(false);
        return;
      }
      await exportDatabaseAsJson(jsonStartDate, jsonEndDate);
    } else {
      await exportDatabaseAsJson();
    }
    setIsJsonExporting(false);
  };

  const handleMediaExport = async () => {
    setIsMediaExporting(true);
    await exportAllMediaAsZip();
    setIsMediaExporting(false);
  };

  const handleCsvZipExport = async () => {
    setIsCsvZipExporting(true);
    await exportDataAsCsvZip();
    setIsCsvZipExporting(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">
      <PageHeader title="SETTINGS" />
      
      {/* User Management Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">User Management</h2>
        
        <div className="mb-6">
          <form onSubmit={handleSignup} className="flex flex-wrap gap-2 max-w-3xl">
            <Input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              className="flex-1 min-w-[200px]" 
              inputMode="email" 
              autoComplete="email" 
            />
            
            <Input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              className="flex-1 min-w-[200px]" 
              autoComplete="new-password" 
            />
            
            <select 
              value={role} 
              onChange={e => setRole(e.target.value as "gallery_admin" | "artist" | "external")}
              className="h-10 px-3 rounded-md border border-input bg-background text-base sm:text-sm min-w-[120px]"
            >
              <option value="artist">Artist</option>
              <option value="gallery_admin">Admin</option>
              <option value="external">External</option>
            </select>
            
            <Button type="submit" className="whitespace-nowrap" disabled={isLoading}>
              {isLoading ? "Creating..." : "Add User"}
            </Button>
          </form>
          
          {signupError && (
            <Alert variant="destructive" className="mt-2 max-w-3xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{signupError}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="-mx-4 sm:mx-0">
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="deletion-requests">Deletion</TabsTrigger>
              <TabsTrigger value="uploads">Uploads</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="border rounded-md overflow-x-auto">
              <UsersList />
            </TabsContent>
            
            <TabsContent value="deletion-requests" className="border rounded-md overflow-x-auto">
              <DeletionRequestsTable />
            </TabsContent>

            <TabsContent value="uploads" className="border rounded-md overflow-x-auto">
              <UploadedFilesList />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Backup & Export Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Backup & Export Data</h2>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" />
                Full Database Export (JSON)
              </CardTitle>
              <CardDescription>
                Export all your application data as a single JSON file. This includes all tables and their content.
                Optionally, filter by date range for an incremental backup (based on record update/creation time).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="jsonDateFilter"
                  checked={enableJsonDateFilter}
                  onCheckedChange={(checked) => setEnableJsonDateFilter(Boolean(checked))}
                />
                <Label htmlFor="jsonDateFilter" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Enable Date Filter (Incremental Backup)
                </Label>
              </div>

              {enableJsonDateFilter && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-md">
                  <div>
                    <Label htmlFor="jsonStartDate">Start Date</Label>
                    <Input
                      type="date"
                      id="jsonStartDate"
                      value={jsonStartDate}
                      onChange={(e) => setJsonStartDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="jsonEndDate">End Date</Label>
                    <Input
                      type="date"
                      id="jsonEndDate"
                      value={jsonEndDate}
                      onChange={(e) => setJsonEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              <Button onClick={handleJsonExport} disabled={isJsonExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isJsonExporting 
                  ? (enableJsonDateFilter ? 'Exporting Filtered JSON...' : 'Exporting Full JSON...') 
                  : (enableJsonDateFilter ? 'Export Filtered JSON' : 'Export Database as JSON')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Download className="mr-2 h-5 w-5" />
                Media Files Export (ZIP)
              </CardTitle>
              <CardDescription>
                Download all uploaded media files (images, documents, etc.) as a single ZIP archive.
                This includes original files stored in your application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleMediaExport} disabled={isMediaExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isMediaExporting ? 'Exporting Media...' : 'Export All Media as ZIP'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ExcelIcon className="mr-2 h-5 w-5" />
                Data Tables Export (CSV in ZIP)
              </CardTitle>
              <CardDescription>
                Export key data tables as individual CSV files, bundled into a single ZIP archive.
                These CSV files can be easily opened with Excel or other spreadsheet software.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleCsvZipExport} disabled={isCsvZipExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isCsvZipExporting ? 'Exporting CSVs...' : 'Export Data as CSVs'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upload Assets Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Upload Assets</h2>
        
        <div className="bg-card rounded-lg shadow">
          <ErrorBoundary>
            <FileUploader />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
