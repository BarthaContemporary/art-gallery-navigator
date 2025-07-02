import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  ExternalLink, 
  Apple, 
  Monitor,
  Key,
  TestTube,
  ChevronDown,
  HelpCircle,
  Wifi
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SimpleWebDAVTokenManager } from "./SimpleWebDAVTokenManager";

interface TestResult {
  success: boolean;
  status?: number;
  message: string;
  details?: any;
}

export function WebDAVAccessPanel() {
  const [testToken, setTestToken] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

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
      const credentials = btoa(`webdav:${testToken.trim()}`);
      
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
        setTestResult({
          success: true,
          status: response.status,
          message: "✅ Connection successful! You can now mount this in your file manager.",
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
          message: `❌ Connection failed: ${response.status} ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          }
        });
        toast.error("WebDAV connection test failed");
      }
    } catch (error: any) {
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
      {/* Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            File Server Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertDescription>
              Access your files directly through your operating system's file manager using WebDAV. 
              First create a token, then use it to connect to the file server.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Tokens
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Test Connection
          </TabsTrigger>
          <TabsTrigger value="setup-mac" className="flex items-center gap-2">
            <Apple className="h-4 w-4" />
            Mac Setup
          </TabsTrigger>
          <TabsTrigger value="setup-other" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Other Clients
          </TabsTrigger>
        </TabsList>

        {/* Token Management Tab */}
        <TabsContent value="overview" className="space-y-4">
          <SimpleWebDAVTokenManager />
        </TabsContent>

        {/* Connection Test Tab */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test Your Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {userTokens.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">Your Recent Tokens:</div>
                    <div className="space-y-1">
                      {userTokens.map((token) => (
                        <div key={token.id} className="text-sm">
                          • {token.name} (created {new Date(token.created_at).toLocaleDateString()})
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
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
                    <div className="mt-1 text-xs text-muted-foreground">
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
                  {isLoading ? "Testing..." : "Test Connection"}
                </Button>
              </div>

              {testResult && (
                <Alert variant={testResult.success ? "default" : "destructive"}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="font-medium">{testResult.message}</span>
                  </div>
                  {testResult.status && (
                    <Badge variant={testResult.success ? "default" : "destructive"} className="mt-2">
                      Status: {testResult.status}
                    </Badge>
                  )}
                  {testResult.details && (
                    <Collapsible className="mt-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-auto">
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Technical Details
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                          {JSON.stringify(testResult.details, null, 2)}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mac Setup Tab */}
        <TabsContent value="setup-mac" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                macOS Finder Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  First create and test your token in the previous tabs before following these steps.
                </AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Server URL:</h4>
                <div className="flex items-center gap-2 p-2 bg-background border rounded">
                  <code className="flex-1 text-sm font-mono">{webdavUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(webdavUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Step-by-Step Instructions:</h4>
                <ol className="space-y-2 text-sm list-decimal list-inside pl-4">
                  <li>Open Finder and press <kbd className="bg-muted px-2 py-1 rounded text-xs">⌘ + K</kbd></li>
                  <li>Enter the server URL: <code className="bg-muted px-1 rounded">{webdavUrl}</code></li>
                  <li>Click "Connect"</li>
                  <li>Select "Registered User"</li>
                  <li>Enter credentials:
                    <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                      <li><strong>Name:</strong> <code>webdav</code></li>
                      <li><strong>Password:</strong> Your WebDAV token</li>
                    </ul>
                  </li>
                  <li>Check "Remember this password in my keychain" (optional)</li>
                  <li>Click "Connect"</li>
                </ol>
              </div>

              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Troubleshooting:</div>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Test your token first using the Test Connection tab</li>
                    <li>Make sure you're using the exact URL with trailing slash</li>
                    <li>Try creating a new token if connection fails</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other Clients Tab */}
        <TabsContent value="setup-other" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Alternative WebDAV Clients
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If your system's built-in file manager doesn't work, try these professional WebDAV clients:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="justify-start h-auto p-4"
                  onClick={() => window.open("https://cyberduck.io/", "_blank")}
                >
                  <div className="text-left">
                    <div className="font-medium">Cyberduck</div>
                    <div className="text-xs text-muted-foreground">Free, cross-platform</div>
                  </div>
                  <ExternalLink className="h-4 w-4 ml-auto" />
                </Button>
                
                <Button 
                  variant="outline" 
                  className="justify-start h-auto p-4"
                  onClick={() => window.open("https://mountainduck.io/", "_blank")}
                >
                  <div className="text-left">
                    <div className="font-medium">Mountain Duck</div>
                    <div className="text-xs text-muted-foreground">Mounts as network drive</div>
                  </div>
                  <ExternalLink className="h-4 w-4 ml-auto" />
                </Button>
              </div>

              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Connection Settings for Third-Party Clients:</div>
                  <ul className="text-sm space-y-1">
                    <li><strong>Server:</strong> {webdavUrl}</li>
                    <li><strong>Username:</strong> webdav (or any username)</li>
                    <li><strong>Password:</strong> Your WebDAV token</li>
                    <li><strong>Protocol:</strong> WebDAV (HTTPS)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
