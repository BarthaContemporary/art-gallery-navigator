
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, TestTube } from "lucide-react";
import { toast } from "sonner";

export function WebDAVConnectionTest() {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<string | null>(null);

  // Get the correct WebDAV URL
  const webdavUrl = `${window.location.protocol}//${window.location.host}/webdav/`;
  const supabaseWebdavUrl = "https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);

    try {
      // Test if the WebDAV endpoint responds
      const response = await fetch(supabaseWebdavUrl, {
        method: 'OPTIONS',
        headers: {
          'Authorization': 'Basic ' + btoa('test:test')
        }
      });

      if (response.status === 401) {
        setConnectionResult("✅ WebDAV server is running and responding (401 Unauthorized is expected without valid token)");
      } else if (response.ok) {
        setConnectionResult("✅ WebDAV server is running and accessible");
      } else {
        setConnectionResult(`❌ WebDAV server responded with status: ${response.status}`);
      }
    } catch (error) {
      setConnectionResult(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          WebDAV Connection Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2">Correct WebDAV URL for macOS Finder:</h4>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-sm">{supabaseWebdavUrl}</code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(supabaseWebdavUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Use this URL in Finder (Cmd+K → Connect to Server)
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-2">Connection Steps for macOS:</h4>
            <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
              <li>Open Finder and press <Badge variant="outline">Cmd+K</Badge></li>
              <li>Enter the WebDAV URL above</li>
              <li>Click "Connect"</li>
              <li>Username: <code>webdav</code> (can be anything)</li>
              <li>Password: Your WebDAV token from the "Active Tokens" section</li>
              <li>Click "Connect"</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={testConnection} 
              disabled={isTestingConnection}
              variant="outline"
            >
              {isTestingConnection ? "Testing..." : "Test Connection"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.open("https://cyberduck.io/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Try Cyberduck (Alternative)
            </Button>
          </div>

          {connectionResult && (
            <div className={`p-3 rounded-lg ${connectionResult.startsWith('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-sm">{connectionResult}</p>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <h5 className="font-medium text-blue-900 mb-1">Troubleshooting Tips:</h5>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Make sure you have an active WebDAV token created above</li>
            <li>• Use the full Supabase Edge Function URL (not localhost or IP)</li>
            <li>• Try using HTTPS if HTTP doesn't work</li>
            <li>• If macOS Finder fails, try Cyberduck or another WebDAV client</li>
            <li>• Check that your token hasn't expired</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
