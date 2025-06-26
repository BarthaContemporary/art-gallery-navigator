
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bug, Copy, TestTube, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export function WebDAVDebugPanel() {
  const [testUsername, setTestUsername] = useState("webdav");
  const [testToken, setTestToken] = useState("");
  const [debugResult, setDebugResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const webdavDebugUrl = "https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/debug-token";
  const webdavBaseUrl = "https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/";

  const testBasicConnectivity = async () => {
    setConnectionStatus('testing');
    try {
      const response = await fetch(webdavBaseUrl, {
        method: 'OPTIONS',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        setConnectionStatus('success');
        toast.success("Basic connectivity test passed");
        return true;
      } else {
        setConnectionStatus('error');
        toast.error(`Connectivity test failed: ${response.status}`);
        return false;
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error("Network connectivity failed");
      console.error("Connectivity test error:", error);
      return false;
    }
  };

  const testTokenAuthentication = async () => {
    if (!testToken.trim()) {
      toast.error("Please enter a token to test");
      return;
    }

    setIsLoading(true);
    setDebugResult(null);

    try {
      // First test basic connectivity
      const connectivityOk = await testBasicConnectivity();
      if (!connectivityOk) {
        setDebugResult({
          error: "Basic connectivity failed",
          details: "Cannot reach WebDAV server endpoint"
        });
        setIsLoading(false);
        return;
      }

      // Create Basic Auth header
      const credentials = `${testUsername}:${testToken}`;
      const base64Credentials = btoa(credentials);
      
      console.log("Testing with credentials:", {
        username: testUsername,
        tokenLength: testToken.length,
        base64Length: base64Credentials.length
      });

      const response = await fetch(webdavDebugUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${base64Credentials}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        const textResponse = await response.text();
        result = {
          error: "Invalid JSON response",
          details: textResponse,
          responseText: textResponse
        };
      }

      setDebugResult({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
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
        details: error.message,
        errorType: error.name,
        timestamp: new Date().toISOString()
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

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'testing':
        return <TestTube className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
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
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">WebDAV Server Status</span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={testBasicConnectivity}
            disabled={connectionStatus === 'testing'}
          >
            Test Connection
          </Button>
        </div>

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
            {testToken && (
              <div className="mt-1 text-xs text-gray-600">
                Token length: {testToken.length} characters
                {testToken.length !== 64 && (
                  <span className="text-red-600 ml-2">⚠ Expected 64 characters</span>
                )}
              </div>
            )}
          </div>
          <Button 
            onClick={testTokenAuthentication} 
            disabled={isLoading || !testToken}
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
                {debugResult.status || 'No Status'} {debugResult.statusText || ''}
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
                {debugResult.errorType && (
                  <p className="text-xs text-red-600 mt-1">Type: {debugResult.errorType}</p>
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
            <li>• Base URL: <code className="bg-blue-100 px-1 rounded text-xs">{webdavBaseUrl}</code></li>
            <li>• Debug URL: <code className="bg-blue-100 px-1 rounded text-xs">{webdavDebugUrl}</code></li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
          <h5 className="font-medium text-yellow-900 mb-1">Troubleshooting Steps</h5>
          <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
            <li>Test basic connectivity first (use "Test Connection" button)</li>
            <li>Create a new WebDAV token if you don't have one</li>
            <li>Ensure the token is exactly 64 characters long</li>
            <li>Test the token with this debug panel</li>
            <li>If successful here, try connecting with macOS Finder</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
