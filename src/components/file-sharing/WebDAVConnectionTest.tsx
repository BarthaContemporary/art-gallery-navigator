
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, TestTube, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function WebDAVConnectionTest() {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<string | null>(null);

  // Get the correct WebDAV URL
  const supabaseWebdavUrl = "https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);

    try {
      console.log('Testing WebDAV connection to:', supabaseWebdavUrl);
      
      // Test if the WebDAV endpoint responds
      const response = await fetch(supabaseWebdavUrl, {
        method: 'OPTIONS',
        headers: {
          'Authorization': 'Basic ' + btoa('test:test')
        }
      });

      console.log('WebDAV test response:', response.status, response.statusText);

      if (response.status === 401) {
        setConnectionResult("✅ WebDAV server is running and responding (401 Unauthorized is expected without valid token)");
      } else if (response.ok) {
        setConnectionResult("✅ WebDAV server is running and accessible");
      } else {
        setConnectionResult(`❌ WebDAV server responded with status: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('WebDAV connection test error:', error);
      setConnectionResult(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testWithCredentials = async () => {
    // This would need a real token to test properly
    toast.info("To test with credentials, use a token from the 'Active Tokens' section below");
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          WebDAV Connection Test & Troubleshooting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2">WebDAV Server URL:</h4>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-sm">{supabaseWebdavUrl}</code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(supabaseWebdavUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h5 className="font-medium text-amber-900 mb-1">Common 401 Unauthorized Error Causes:</h5>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• <strong>Missing or expired token:</strong> Make sure you have an active WebDAV token created below</li>
                  <li>• <strong>Wrong credentials format:</strong> Username can be anything, password must be your WebDAV token</li>
                  <li>• <strong>Token not copied correctly:</strong> Ensure the full token is copied without extra spaces</li>
                  <li>• <strong>Client cache issues:</strong> Try disconnecting and reconnecting in Finder</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Connection Steps for macOS Finder:</h4>
            <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
              <li>Open Finder and press <Badge variant="outline">Cmd+K</Badge></li>
              <li>Enter the WebDAV URL above</li>
              <li>Click "Connect"</li>
              <li>Username: <code>webdav</code> (can be anything)</li>
              <li>Password: Your WebDAV token from the "Active Tokens" section below</li>
              <li>Click "Connect"</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={testConnection} 
              disabled={isTestingConnection}
              variant="outline"
            >
              {isTestingConnection ? "Testing..." : "Test Server Availability"}
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
          <h5 className="font-medium text-blue-900 mb-1">Debug Steps for 401 Errors:</h5>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>1. Create a fresh WebDAV token below</li>
            <li>2. Copy the token immediately when it appears</li>
            <li>3. In Finder (Cmd+K), use the exact URL above</li>
            <li>4. Username: type anything (e.g., "user")</li>
            <li>5. Password: paste your copied token</li>
            <li>6. If it still fails, check the console logs or try Cyberduck</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
