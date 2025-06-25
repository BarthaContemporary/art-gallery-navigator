
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, TestTube, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StatusCheck {
  name: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  details?: any;
}

interface DebugInfo {
  user_id: string;
  is_admin: boolean;
  folders_count: number;
  documents_count: number;
  artist_count: number;
  user_roles: string[];
}

export function WebDAVStatusChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [checks, setChecks] = useState<StatusCheck[]>([]);

  const runStatusChecks = async () => {
    setIsChecking(true);
    setChecks([]);
    
    const newChecks: StatusCheck[] = [];

    try {
      // Check 1: Database access functions - using direct function call instead of rpc
      try {
        console.log('Checking database access functions...');
        // Call the function directly using SQL
        const { data: debugData, error: debugError } = await supabase
          .from('debug_webdav_access')
          .select('*')
          .limit(1);
        
        if (debugError) {
          // Try alternative approach with SQL function call
          const { data: sqlResult, error: sqlError } = await supabase
            .rpc('get_user_accessible_folders');
          
          if (sqlError) {
            newChecks.push({
              name: 'Database Access',
              status: 'error',
              message: `Database function error: ${sqlError.message}`,
              details: sqlError
            });
          } else {
            newChecks.push({
              name: 'Database Access',
              status: 'success',
              message: `Functions accessible, found ${Array.isArray(sqlResult) ? sqlResult.length : 0} folders`,
              details: sqlResult
            });
          }
        } else if (Array.isArray(debugData) && debugData.length > 0) {
          const info = debugData[0] as DebugInfo;
          newChecks.push({
            name: 'Database Access',
            status: 'success',
            message: `Admin: ${info.is_admin}, Folders: ${info.folders_count}, Docs: ${info.documents_count}, Artists: ${info.artist_count}`,
            details: info
          });
        } else {
          newChecks.push({
            name: 'Database Access',
            status: 'warning',
            message: 'No debug data returned from database',
            details: debugData
          });
        }
      } catch (error) {
        newChecks.push({
          name: 'Database Access',
          status: 'error',
          message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error
        });
      }

      // Check 2: WebDAV tokens
      try {
        console.log('Checking WebDAV tokens...');
        const { data: tokens, error: tokenError } = await supabase
          .from('webdav_tokens')
          .select('*')
          .eq('is_active', true)
          .limit(5);

        if (tokenError) {
          newChecks.push({
            name: 'WebDAV Tokens',
            status: 'error',
            message: `Token fetch error: ${tokenError.message}`,
            details: tokenError
          });
        } else {
          newChecks.push({
            name: 'WebDAV Tokens',
            status: tokens && tokens.length > 0 ? 'success' : 'warning',
            message: `Found ${tokens?.length || 0} active tokens`,
            details: tokens
          });
        }
      } catch (error) {
        newChecks.push({
          name: 'WebDAV Tokens',
          status: 'error',
          message: `Token check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error
        });
      }

      // Check 3: WebDAV function accessibility
      try {
        console.log('Checking WebDAV function accessibility...');
        const webdavUrl = `${window.location.origin}/functions/v1/webdav/`;
        
        const response = await fetch(webdavUrl, {
          method: 'OPTIONS',
          headers: {
            'User-Agent': 'WebDAV-Status-Checker/1.0'
          }
        });

        if (response.ok) {
          const davHeader = response.headers.get('DAV');
          newChecks.push({
            name: 'WebDAV Function',
            status: 'success',
            message: `Function accessible (${response.status}) ${davHeader ? `DAV: ${davHeader}` : ''}`,
            details: {
              status: response.status,
              headers: Object.fromEntries(response.headers.entries())
            }
          });
        } else {
          newChecks.push({
            name: 'WebDAV Function',
            status: 'warning',
            message: `Function responded with ${response.status} ${response.statusText}`,
            details: {
              status: response.status,
              statusText: response.statusText
            }
          });
        }
      } catch (error) {
        newChecks.push({
          name: 'WebDAV Function',
          status: 'error',
          message: `Function not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error
        });
      }

      // Check 4: User roles and permissions
      try {
        console.log('Checking user roles...');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: roles, error: rolesError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          if (rolesError) {
            newChecks.push({
              name: 'User Permissions',
              status: 'error',
              message: `Roles fetch error: ${rolesError.message}`,
              details: rolesError
            });
          } else {
            const rolesList = roles?.map(r => r.role) || [];
            newChecks.push({
              name: 'User Permissions',
              status: rolesList.length > 0 ? 'success' : 'warning',
              message: `User roles: ${rolesList.length > 0 ? rolesList.join(', ') : 'No roles assigned'}`,
              details: { user_id: user.id, roles: rolesList }
            });
          }
        } else {
          newChecks.push({
            name: 'User Permissions',
            status: 'error',
            message: 'No authenticated user found',
            details: null
          });
        }
      } catch (error) {
        newChecks.push({
          name: 'User Permissions',
          status: 'error',
          message: `Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error
        });
      }

      setChecks(newChecks);
      
      const errorCount = newChecks.filter(c => c.status === 'error').length;
      const warningCount = newChecks.filter(c => c.status === 'warning').length;
      
      if (errorCount === 0 && warningCount === 0) {
        toast.success('All WebDAV status checks passed!');
      } else if (errorCount > 0) {
        toast.error(`${errorCount} critical issues found`);
      } else {
        toast.warning(`${warningCount} warnings found`);
      }

    } catch (error) {
      console.error('Status check error:', error);
      toast.error('Failed to run status checks');
    } finally {
      setIsChecking(false);
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
        return <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />;
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
          WebDAV System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={runStatusChecks} disabled={isChecking}>
            {isChecking ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Run Status Checks
              </>
            )}
          </Button>
        </div>

        {checks.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Status Results:</h4>
            {checks.map((check, index) => (
              <div key={index} className={`p-3 rounded-lg border ${getStatusColor(check.status)}`}>
                <div className="flex items-start gap-2">
                  {getStatusIcon(check.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{check.name}</span>
                      <Badge variant={check.status === 'success' ? 'default' : check.status === 'warning' ? 'secondary' : 'destructive'}>
                        {check.status}
                      </Badge>
                    </div>
                    <div className="text-sm">{check.message}</div>
                    {check.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Show details</summary>
                        <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(check.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <h5 className="font-medium text-blue-900 mb-1">Status Check Information:</h5>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Database Access:</strong> Tests if your user can access folders/documents via database functions</li>
            <li>• <strong>WebDAV Tokens:</strong> Checks if you have active WebDAV tokens created</li>
            <li>• <strong>WebDAV Function:</strong> Verifies the WebDAV edge function is accessible and responding</li>
            <li>• <strong>User Permissions:</strong> Shows your user roles and authentication status</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
