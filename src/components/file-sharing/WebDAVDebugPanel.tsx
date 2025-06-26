
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bug, Copy, TestTube } from "lucide-react";
import { toast } from "sonner";

export function WebDAVDebugPanel() {
  const [testUsername, setTestUsername] = useState("webdav");
  const [testToken, setTestToken] = useState("");
  const [debugResult, setDebugResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const webdavDebugUrl = "https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/debug-token";

  const testTokenAuthentication = async () => {
    if (!testToken.trim()) {
      toast.error("Please enter a token to test");
      return;
    }

    setIsLoading(true);
    setDebugResult(null);

    try {
      // Create Basic Auth header
      const credentials = `${testUsername}:${testToken}`;
      const base64Credentials = btoa(credentials);
      
      const response = await fetch(webdavDebugUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${base64Credentials}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      setDebugResult({
        status: response.status,
        statusText: response.statusText,
        ...result
      });

      if (response.ok) {
        toast.success("Debug test completed successfully");
      } else {
        toast.error("Debug test failed - check results below");
      }
    } catch (error) {
      console.error("Debug test error:", error);
      setDebugResult({
        error: "Network error",
        details: error.message
      });
      toast.error("Failed to connect to debug endpoint");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Bug className="h-5 w-5" />
          WebDAV Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <Label htmlFor="testUsername">Test Username</Label>
            <Input
              id="testUsername"
              value={testUsername}
              onChange={(e) => setTestUsername(e.target.value)}
              placeholder="webdav"
            />
          </div>
          <div>
            <Label htmlFor="testToken">Test Token</Label>
            <Input
              id="testToken"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              placeholder="Enter your 64-character WebDAV token"
              type="password"
            />
          </div>
          <Button 
            onClick={testTokenAuthentication} 
            disabled={isLoading}
            className="w-full"
          >
            <TestTube className="h-4 w-4 mr-2" />
            {isLoading ? "Testing..." : "Test Token Authentication"}
          </Button>
        </div>

        {debugResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-orange-800">Debug Results</h4>
              <Badge variant={debugResult.status === 200 ? "default" : "destructive"}>
                {debugResult.status} {debugResult.statusText}
              </Badge>
            </div>
            
            <div className="bg-white border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Response Data</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => copyToClipboard(formatJson(debugResult))}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="text-xs overflow-auto max-h-40 bg-gray-50 p-2 rounded">
                {formatJson(debugResult)}
              </pre>
            </div>

            {debugResult.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h5 className="font-medium text-red-800 mb-1">Error Details</h5>
                <p className="text-sm text-red-700">{debugResult.error}</p>
                {debugResult.details && (
                  <p className="text-xs text-red-600 mt-1">{debugResult.details}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <h5 className="font-medium text-blue-900 mb-1">Debug Information</h5>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• This panel tests token authentication directly with the WebDAV server</li>
            <li>• It shows exactly how your credentials are being processed</li>
            <li>• Use this to debug authentication issues before trying macOS Finder</li>
            <li>• The debug endpoint: <code className="bg-blue-100 px-1 rounded text-xs">{webdavDebugUrl}</code></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
