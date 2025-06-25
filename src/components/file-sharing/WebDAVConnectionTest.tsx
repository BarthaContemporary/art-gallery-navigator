
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, TestTube, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export function WebDAVConnectionTest() {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ [key: string]: { status: string; message: string } }>({});

  // Get the correct WebDAV URL based on current domain
  const getWebDAVUrl = () => {
    if (typeof window !== 'undefined') {
      const currentOrigin = window.location.origin;
      
      // Check if we're on a custom domain (not supabase.co)
      if (!currentOrigin.includes('.supabase.co')) {
        // Custom domain - construct the edge function URL
        return `${currentOrigin}/functions/v1/webdav/`;
      }
    }
    
    // Default to Supabase URL
    return "https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/";
  };

  const webdavUrl = getWebDAVUrl();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);
    setTestResults({});

    const results: { [key: string]: { status: string; message: string } } = {};

    try {
      console.log('Testing WebDAV connection to:', webdavUrl);
      
      // Test 1: Basic connectivity (OPTIONS)
      try {
        const optionsResponse = await fetch(webdavUrl, {
          method: 'OPTIONS',
        });

        if (optionsResponse.ok) {
          const davHeader = optionsResponse.headers.get('DAV');
          results.connectivity = { 
            status: 'success', 
            message: `Server is reachable and supports WebDAV${davHeader ? ` (DAV: ${davHeader})` : ''}`
          };
        } else {
          results.connectivity = { 
            status: 'warning', 
            message: `Server responded with ${optionsResponse.status} ${optionsResponse.statusText}` 
          };
        }
      } catch (error) {
        results.connectivity = { 
          status: 'error', 
          message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }

      // Test 2: Authentication without credentials (should return 401)
      try {
        const authResponse = await fetch(webdavUrl, {
          method: 'PROPFIND',
        });

        if (authResponse.status === 401) {
          const authHeader = authResponse.headers.get('WWW-Authenticate');
          results.authentication = { 
            status: 'success', 
            message: `Server correctly requests authentication${authHeader ? ` (${authHeader})` : ''}`
          };
        } else {
          results.authentication = { 
            status: 'warning', 
            message: `Unexpected response: ${authResponse.status} ${authResponse.statusText}` 
          };
        }
      } catch (error) {
        results.authentication = { 
          status: 'error', 
          message: `Auth test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }

      // Test 3: Test with invalid credentials (should return 401)
      try {
        const invalidAuthResponse = await fetch(webdavUrl, {
          method: 'PROPFIND',
          headers: {
            'Authorization': 'Basic ' + btoa('test:invalid-token')
          }
        });

        if (invalidAuthResponse.status === 401) {
          results.invalidAuth = { 
            status: 'success', 
            message: 'Server correctly rejects invalid credentials' 
          };
        } else {
          results.invalidAuth = { 
            status: 'warning', 
            message: `Unexpected response to invalid auth: ${invalidAuthResponse.status}` 
          };
        }
      } catch (error) {
        results.invalidAuth = { 
          status: 'error', 
          message: `Invalid auth test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }

      // Test 4: Check CORS headers
      try {
        const corsResponse = await fetch(webdavUrl, {
          method: 'OPTIONS',
        });

        const accessControlOrigin = corsResponse.headers.get('Access-Control-Allow-Origin');
        const accessControlMethods = corsResponse.headers.get('Access-Control-Allow-Methods');

        if (accessControlOrigin && accessControlMethods) {
          results.cors = { 
            status: 'success', 
            message: 'CORS headers are properly configured' 
          };
        } else {
          results.cors = { 
            status: 'warning', 
            message: 'CORS headers may not be properly configured' 
          };
        }
      } catch (error) {
        results.cors = { 
          status: 'error', 
          message: `CORS test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }

      // Test 5: Test WebDAV-specific headers
      try {
        const davResponse = await fetch(webdavUrl, {
          method: 'OPTIONS',
        });

        const davHeader = davResponse.headers.get('DAV');
        const msAuthorVia = davResponse.headers.get('MS-Author-Via');

        if (davHeader) {
          results.webdavHeaders = { 
            status: 'success', 
            message: `WebDAV headers present (DAV: ${davHeader}${msAuthorVia ? ', MS-Author-Via: ' + msAuthorVia : ''})` 
          };
        } else {
          results.webdavHeaders = { 
            status: 'warning', 
            message: 'WebDAV-specific headers not found' 
          };
        }
      } catch (error) {
        results.webdavHeaders = { 
          status: 'error', 
          message: `WebDAV headers test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }

      setTestResults(results);

      // Overall assessment
      const successCount = Object.values(results).filter(r => r.status === 'success').length;
      const totalTests = Object.keys(results).length;

      if (successCount === totalTests) {
        setConnectionResult("✅ All tests passed! WebDAV server is working correctly. You can now create a token and connect with a WebDAV client.");
      } else if (successCount >= totalTests / 2) {
        setConnectionResult("⚠️ Some tests passed. WebDAV server is partially working. Check the details below and create a token to test with real credentials.");
      } else {
        setConnectionResult("❌ Most tests failed. There may be issues with the WebDAV server configuration.");
      }

    } catch (error) {
      console.error('WebDAV connection test error:', error);
      setConnectionResult(`❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
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
              <code className="flex-1 text-sm">{webdavUrl}</code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(webdavUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {!webdavUrl.includes('.supabase.co') && (
              <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
                📌 Using custom domain URL - this should work with your domain setup
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h5 className="font-medium text-amber-900 mb-1">Connection Steps for macOS Finder:</h5>
                <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                  <li>Create a WebDAV token using the form below</li>
                  <li>Open Finder and press <Badge variant="outline">Cmd+K</Badge></li>
                  <li>Enter the WebDAV URL above</li>
                  <li>Click "Connect"</li>
                  <li>Username: <code>webdav</code> (can be anything)</li>
                  <li>Password: Your WebDAV token from the "Active Tokens" section</li>
                  <li>Click "Connect"</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={testConnection} 
              disabled={isTestingConnection}
              variant="outline"
            >
              {isTestingConnection ? "Testing..." : "Run Connection Tests"}
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
            <div className={`p-3 rounded-lg ${connectionResult.startsWith('✅') ? 'bg-green-50 border border-green-200' : connectionResult.startsWith('⚠️') ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-sm font-medium">{connectionResult}</p>
            </div>
          )}

          {Object.keys(testResults).length > 0 && (
            <div className="space-y-2">
              <h5 className="font-medium">Test Results:</h5>
              {Object.entries(testResults).map(([testName, result]) => (
                <div key={testName} className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}>
                  <div className="flex items-start gap-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <div className="font-medium text-sm capitalize">
                        {testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </div>
                      <div className="text-sm">{result.message}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <h5 className="font-medium text-blue-900 mb-1">Troubleshooting Tips:</h5>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>1. Run the connection tests above to verify server status</li>
            <li>2. Create a fresh WebDAV token below if you don't have one</li>
            <li>3. Copy the token immediately when it appears</li>
            <li>4. In Finder (Cmd+K), use the exact URL above</li>
            <li>5. Username: type anything (e.g., "user")</li>
            <li>6. Password: paste your copied token</li>
            <li>7. If it still fails, try Cyberduck for more detailed error messages</li>
            <li>8. Make sure your custom domain supports edge functions if using one</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
