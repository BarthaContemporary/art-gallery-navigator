import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Copy, ExternalLink, Apple, Monitor } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TestResult {
  success: boolean;
  status?: number;
  message: string;
  details?: any;
}

export function WebDAVConnectionGuide() {
  const [testToken, setTestToken] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userTokens, setUserTokens] = useState<any[]>([]);

  const webdavUrl = "https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/";

  useEffect(() => {
    fetchUserTokens();
  }, []);

  const fetchUserTokens = async () => {
    try {
      const { data, error } = await supabase
        .from("webdav_tokens")
        .select("id, name, created_at, expires_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (!error && data) {
        setUserTokens(data);
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
    }
  };

  const testWebDAVConnection = async () => {
    if (!testToken.trim()) {
      toast.error("Please enter a WebDAV token to test");
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      // Test 1: Basic OPTIONS request
      console.log("Testing WebDAV connection...");
      
      const credentials = btoa(`webdav:${testToken.trim()}`);
      
      // Test PROPFIND on root directory
      const response = await fetch(webdavUrl, {
        method: 'PROPFIND',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/xml',
          'Depth': '1',
        },
      });

      if (response.ok) {
        const responseText = await response.text();
        console.log("WebDAV Response:", responseText);
        
        setTestResult({
          success: true,
          status: response.status,
          message: "✅ WebDAV connection successful! You can now mount this in Finder.",
          details: {
            status: response.status,
            contentType: response.headers.get('content-type'),
            responseLength: responseText.length,
            hasXMLResponse: responseText.includes('<?xml')
          }
        });
        toast.success("WebDAV connection test passed!");
      } else {
        const errorText = await response.text();
        setTestResult({
          success: false,
          status: response.status,
          message: `❌ WebDAV connection failed: ${response.status} ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          }
        });
        toast.error("WebDAV connection test failed");
      }
    } catch (error: any) {
      console.error("WebDAV test error:", error);
      setTestResult({
        success: false,
        message: `❌ Connection error: ${error.message}`,
        details: {
          error: error.name,
          message: error.message
        }
      });
      toast.error("Connection test failed");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            WebDAV Connection Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {userTokens.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Your Recent Tokens:</h4>
              <div className="space-y-1">
                {userTokens.map((token) => (
                  <div key={token.id} className="text-sm text-blue-800">
                    • {token.name} (created {new Date(token.created_at).toLocaleDateString()})
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">WebDAV Token</label>
              <Input
                type="password"
                placeholder="Paste your 64-character WebDAV token here"
                value={testToken}
                onChange={(e) => setTestToken(e.target.value)}
              />
              {testToken && (
                <div className="mt-1 text-xs text-gray-600">
                  Token length: {testToken.length} characters
                  {testToken.length !== 64 && (
                    <span className="text-orange-600 ml-2">⚠ Expected 64 characters</span>
                  )}
                </div>
              )}
            </div>
            
            <Button 
              onClick={testWebDAVConnection} 
              disabled={isLoading || !testToken.trim()}
              className="w-full"
            >
              {isLoading ? "Testing..." : "Test WebDAV Connection"}
            </Button>
          </div>

          {testResult && (
            <div className={`border rounded-lg p-4 ${
              testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">{testResult.message}</span>
                </div>
                {testResult.status && (
                  <Badge variant={testResult.success ? "default" : "destructive"}>
                    Status: {testResult.status}
                  </Badge>
                )}
              </div>
              
              {testResult.details && (
                <pre className="text-xs bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mac Finder Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Apple className="h-5 w-5" />
            macOS Finder Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 border p-4 rounded-lg">
            <h4 className="font-medium mb-2">Server URL:</h4>
            <div className="flex items-center gap-2 p-2 bg-white border rounded">
              <code className="flex-1 text-sm font-mono">{webdavUrl}</code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(webdavUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Step-by-Step Instructions:</h4>
            <ol className="space-y-2 text-sm list-decimal list-inside">
              <li>First, test your token using the connection test above ☝️</li>
              <li>Open Finder and press <kbd className="bg-gray-100 px-2 py-1 rounded text-xs">⌘ + K</kbd></li>
              <li>In the "Connect to Server" dialog, enter: <code className="bg-gray-100 px-1 rounded">{webdavUrl}</code></li>
              <li>Click "Connect"</li>
              <li>Select "Registered User" when prompted</li>
              <li>Enter credentials:
                <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                  <li><strong>Name:</strong> <code>webdav</code> (any username works)</li>
                  <li><strong>Password:</strong> Your 64-character WebDAV token</li>
                </ul>
              </li>
              <li>Check "Remember this password in my keychain" (optional)</li>
              <li>Click "Connect"</li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-1">Troubleshooting Tips:</h5>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>If connection fails, first test your token above</li>
              <li>Make sure you're using the exact URL (including trailing slash)</li>
              <li>Try creating a new token if the current one doesn't work</li>
              <li>Check that your internet connection is stable</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Alternative Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Alternative WebDAV Clients
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            If macOS Finder doesn't work, try these professional WebDAV clients:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="justify-start h-auto p-3"
              onClick={() => window.open("https://cyberduck.io/", "_blank")}
            >
              <div className="text-left">
                <div className="font-medium">Cyberduck</div>
                <div className="text-xs text-gray-500">Free, cross-platform</div>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start h-auto p-3"
              onClick={() => window.open("https://mountainduck.io/", "_blank")}
            >
              <div className="text-left">
                <div className="font-medium">Mountain Duck</div>
                <div className="text-xs text-gray-500">Mounts as disk</div>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}