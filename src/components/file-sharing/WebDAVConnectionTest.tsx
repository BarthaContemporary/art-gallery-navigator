
import { useState } from "react";
import { getEdgeFunctionUrl } from '@/lib/supabase-url';
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
      
      // Check if we're on a custom domain (not supabase.co and not lovableproject.com)
      if (!currentOrigin.includes('.supabase.co') && !currentOrigin.includes('.lovableproject.com')) {
        // Custom domain - construct the edge function URL
        return `${currentOrigin}/functions/v1/webdav/`;
      }
    }
    
    // Default to Supabase URL
    return getEdgeFunctionUrl('webdav') + '/';
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
          mode: 'cors',
          headers: {
            'User-Agent': 'WebDAV-Test-Client/1.0'
          }
        });

        console.log('OPTIONS response:', optionsResponse.status, optionsResponse.statusText);
        console.log('OPTIONS headers:', Object.fromEntries(optionsResponse.headers.entries()));

        if (optionsResponse.ok) {
          const davHeader = optionsResponse.headers.get('DAV');
          const allowedMethods = optionsResponse.headers.get('Allow');
          const accessControlOrigin = optionsResponse.headers.get('Access-Control-Allow-Origin');
          results.connectivity = { 
            status: 'success', 
            message: `Server reachable${davHeader ? ` (DAV: ${davHeader})` : ''}${allowedMethods ? ` (Methods: ${allowedMethods})` : ''}${accessControlOrigin ? ` (CORS: ${accessControlOrigin})` : ''}`
          };
        } else {
          results.connectivity = { 
            status: 'warning', 
            message: `Server responded with ${optionsResponse.status} ${optionsResponse.statusText}` 
          };
        }
      } catch (error) {
        console.error('OPTIONS request failed:', error);
        results.connectivity = { 
          status: 'error', 
          message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}. This might be a network issue or the server is not accessible.` 
        };
      }

      // Test 2: Authentication without credentials (should return 401)
      try {
        const authResponse = await fetch(webdavUrl, {
          method: 'PROPFIND',
          mode: 'cors',
          headers: {
            'User-Agent': 'WebDAV-Test-Client/1.0',
            'Depth': '0'
          }
        });

        console.log('PROPFIND (no auth) response:', authResponse.status, authResponse.statusText);

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
        console.error('PROPFIND request failed:', error);
        results.authentication = { 
          status: 'warning', 
          message: `Auth test failed due to CORS: ${error instanceof Error ? error.message : 'Unknown error'}. This is expected in some browsers.` 
        };
      }

      // Test 3: Test with invalid credentials (should return 401) - Skip if CORS is blocking
      if (results.authentication?.status !== 'warning') {
        try {
          const invalidAuthResponse = await fetch(webdavUrl, {
            method: 'PROPFIND',
            mode: 'cors',
            headers: {
              'Authorization': 'Basic ' + btoa('test:invalid-token'),
              'User-Agent': 'WebDAV-Test-Client/1.0',
              'Depth': '0'
            }
          });

          console.log('PROPFIND (invalid auth) response:', invalidAuthResponse.status, invalidAuthResponse.statusText);

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
          console.error('Invalid auth test failed:', error);
          results.invalidAuth = { 
            status: 'warning', 
            message: `Invalid auth test failed due to CORS restrictions. This is normal in browsers.` 
          };
        }
      } else {
        results.invalidAuth = { 
          status: 'warning', 
          message: 'Skipped due to CORS restrictions (normal in browsers)' 
        };
      }

      // Test 4: Check CORS headers with proper preflight
      try {
        const corsResponse = await fetch(webdavUrl, {
          method: 'OPTIONS',
          mode: 'cors',
          headers: {
            'Origin': window.location.origin,
            'Access-Control-Request-Method': 'PROPFIND',
            'Access-Control-Request-Headers': 'authorization,depth'
          }
        });

        const accessControlOrigin = corsResponse.headers.get('Access-Control-Allow-Origin');
        const accessControlMethods = corsResponse.headers.get('Access-Control-Allow-Methods');
        const accessControlHeaders = corsResponse.headers.get('Access-Control-Allow-Headers');

        if (accessControlOrigin && accessControlMethods && accessControlHeaders) {
          results.cors = { 
            status: 'success', 
            message: `CORS properly configured (Origin: ${accessControlOrigin}, Methods: ${accessControlMethods}, Headers: ${accessControlHeaders})` 
          };
        } else {
          results.cors = { 
            status: 'warning', 
            message: `CORS partially configured. Missing: ${!accessControlOrigin ? 'Origin ' : ''}${!accessControlMethods ? 'Methods ' : ''}${!accessControlHeaders ? 'Headers' : ''}` 
          };
        }
      } catch (error) {
        console.error('CORS test failed:', error);
        results.cors = { 
          status: 'warning', 
          message: `CORS preflight test failed: ${error instanceof Error ? error.message : 'Unknown error'}. WebDAV clients may still work.` 
        };
      }

      // Test 5: Test WebDAV-specific headers
      try {
        const davResponse = await fetch(webdavUrl, {
          method: 'OPTIONS',
          mode: 'cors',
          headers: {
            'User-Agent': 'WebDAV-Test-Client/1.0'
          }
        });

        const davHeader = davResponse.headers.get('DAV');
        const msAuthorVia = davResponse.headers.get('MS-Author-Via');
        const serverHeader = davResponse.headers.get('Server');

        if (davHeader) {
          results.webdavHeaders = { 
            status: 'success', 
            message: `WebDAV headers present (DAV: ${davHeader}${msAuthorVia ? ', MS-Author-Via: ' + msAuthorVia : ''}${serverHeader ? ', Server: ' + serverHeader : ''})` 
          };
        } else {
          results.webdavHeaders = { 
            status: 'warning', 
            message: 'WebDAV-specific headers not found - may impact client compatibility' 
          };
        }
      } catch (error) {
        console.error('WebDAV headers test failed:', error);
        results.webdavHeaders = { 
          status: 'error', 
          message: `WebDAV headers test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }

      setTestResults(results);

      // Overall assessment
      const successCount = Object.values(results).filter(r => r.status === 'success').length;
      const warningCount = Object.values(results).filter(r => r.status === 'warning').length;
      const totalTests = Object.keys(results).length;

      if (successCount >= 3) {
        setConnectionResult("✅ WebDAV server is working correctly! Some CORS warnings are normal in browsers - WebDAV clients should work fine. Create a token below to test with real credentials.");
      } else if (successCount >= 2) {
        setConnectionResult("⚠️ WebDAV server is partially working. Some tests failed due to browser CORS restrictions, but desktop WebDAV clients should work. Create a token to test with real credentials.");
      } else {
        setConnectionResult("❌ WebDAV server may have configuration issues. Check the details below and try creating a token to test with real credentials.");
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
            {!webdavUrl.includes('.supabase.co') && !webdavUrl.includes('.lovableproject.com') && (
              <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
                📌 Using custom domain URL - this should work with your domain setup
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h5 className="font-medium text-amber-900 mb-1">Important Notes:</h5>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Browser CORS restrictions are normal - WebDAV desktop clients will work fine</li>
                  <li>• Some tests may show warnings in browsers but work perfectly in file managers</li>
                  <li>• Create a token below and test with Finder/Explorer for real verification</li>
                </ul>
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
          <h5 className="font-medium text-blue-900 mb-1">Next Steps:</h5>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Create a WebDAV token using the form below</li>
            <li>Open your file manager (Finder: Cmd+K, Windows: Map Network Drive)</li>
            <li>Connect to: <code className="bg-blue-100 px-1 rounded">{webdavUrl}</code></li>
            <li>Username: <code className="bg-blue-100 px-1 rounded">webdav</code> (any value works)</li>
            <li>Password: Your WebDAV token</li>
            <li>Browse your folders based on your access permissions</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
