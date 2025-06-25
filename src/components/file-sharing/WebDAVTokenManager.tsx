
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Copy, Plus, Key, AlertCircle, CheckCircle, User, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WebDAVConnectionTest } from "./WebDAVConnectionTest";
import { WebDAVStatusChecker } from "./WebDAVStatusChecker";

interface WebDAVToken {
  id: string;
  name: string;
  token_hash: string;
  expires_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export function WebDAVTokenManager() {
  const [tokenName, setTokenName] = useState("");
  const [expiresIn, setExpiresIn] = useState<number>(30); // days
  const [lastCreatedToken, setLastCreatedToken] = useState<string | null>(null);
  const [creationStatus, setCreationStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const queryClient = useQueryClient();

  // Check authentication status
  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      console.log('WebDAV: Checking authentication status...');
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('WebDAV: Auth check error:', error);
        setAuthStatus('unauthenticated');
        return null;
      }
      
      console.log('WebDAV: Current user:', user?.email, 'ID:', user?.id?.substring(0, 8) + '...');
      setAuthStatus(user ? 'authenticated' : 'unauthenticated');
      return user;
    },
  });

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

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["webdav-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webdav_tokens")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WebDAVToken[];
    },
    enabled: authStatus === 'authenticated',
  });

  const createTokenMutation = useMutation({
    mutationFn: async ({ name, expiresInDays }: { name: string; expiresInDays: number }) => {
      setCreationStatus('creating');
      setDebugInfo(null);
      
      console.log('WebDAV: Creating token with params:', { name, expiresInDays });
      console.log('WebDAV: Current user:', user?.email);
      console.log('WebDAV: Auth status:', authStatus);

      // Check authentication first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('WebDAV: Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        console.error('WebDAV: No active session found');
        throw new Error('No active session. Please log in again.');
      }

      console.log('WebDAV: Session valid, access token present:', !!session.access_token);
      console.log('WebDAV: Session expires at:', session.expires_at);

      try {
        console.log('WebDAV: Calling edge function...');
        const { data, error } = await supabase.functions.invoke("webdav-create-token", {
          body: { name, expiresInDays },
        });

        console.log('WebDAV: Edge function response:', { data, error });
        
        if (error) {
          console.error('WebDAV: Edge function error:', error);
          setDebugInfo({ 
            type: 'edge_function_error',
            error: error,
            session_valid: !!session,
            user_id: user?.id,
            timestamp: new Date().toISOString()
          });
          throw new Error(`Edge function error: ${error.message || 'Unknown error'}`);
        }

        console.log('WebDAV: Token created successfully:', data);
        setDebugInfo({ 
          type: 'success',
          data: data,
          timestamp: new Date().toISOString()
        });
        
        return data;
      } catch (functionError) {
        console.error('WebDAV: Function invocation failed:', functionError);
        setDebugInfo({ 
          type: 'invocation_error',
          error: functionError,
          session_valid: !!session,
          user_id: user?.id,
          timestamp: new Date().toISOString()
        });
        throw functionError;
      }
    },
    onSuccess: (data) => {
      setCreationStatus('success');
      queryClient.invalidateQueries({ queryKey: ["webdav-tokens"] });
      
      // Store the token temporarily so user can copy it
      setLastCreatedToken(data.token);
      
      // Also copy to clipboard immediately
      navigator.clipboard.writeText(data.token);
      toast.success(`Token created successfully! Copied to clipboard.`);
      
      setTokenName("");
    },
    onError: (error) => {
      setCreationStatus('error');
      console.error("WebDAV: Token creation failed:", error);
      toast.error(`Failed to create WebDAV token: ${error.message}`);
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("webdav_tokens")
        .update({ is_active: false })
        .eq("id", tokenId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webdav-tokens"] });
      toast.success("WebDAV token revoked");
    },
    onError: (error) => {
      console.error("Error revoking token:", error);
      toast.error("Failed to revoke WebDAV token");
    },
  });

  const handleCreateToken = () => {
    if (!tokenName.trim()) {
      toast.error("Please enter a token name");
      return;
    }

    if (authStatus !== 'authenticated') {
      toast.error("Please log in to create WebDAV tokens");
      return;
    }

    setCreationStatus('idle');
    createTokenMutation.mutate({ name: tokenName, expiresInDays: expiresIn });
  };

  const copyWebDAVUrl = () => {
    navigator.clipboard.writeText(webdavUrl);
    toast.success("WebDAV URL copied to clipboard");
  };

  const copyLastCreatedToken = () => {
    if (lastCreatedToken) {
      navigator.clipboard.writeText(lastCreatedToken);
      toast.success("Token copied to clipboard");
    }
  };

  const handleTokenLost = () => {
    toast.info("Create a new token to replace the lost one. Old tokens cannot be recovered for security reasons.");
  };

  const refreshAuth = async () => {
    setAuthStatus('checking');
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Auth refresh error:', error);
      setAuthStatus('unauthenticated');
      toast.error('Authentication refresh failed. Please log in again.');
    } else {
      setAuthStatus('authenticated');
      toast.success('Authentication refreshed successfully');
    }
  };

  return (
    <div className="space-y-6">
      <WebDAVStatusChecker />
      <WebDAVConnectionTest />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            WebDAV Access Tokens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Authentication Status */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            {authStatus === 'checking' ? (
              <>
                <AlertCircle className="h-4 w-4 animate-spin" />
                <span className="text-sm">Checking authentication...</span>
              </>
            ) : authStatus === 'authenticated' ? (
              <>
                <User className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Authenticated as: {user?.email}
                </span>
                <Button size="sm" variant="outline" onClick={refreshAuth}>
                  Refresh Auth
                </Button>
              </>
            ) : (
              <>
                <UserX className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700">
                  Not authenticated - please log in to create tokens
                </span>
                <Button size="sm" variant="outline" onClick={refreshAuth}>
                  Retry Auth
                </Button>
              </>
            )}
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              WebDAV allows you to access your files directly from file managers and applications.
              {!webdavUrl.includes('.supabase.co') && (
                <span className="block mt-1 text-blue-600 font-medium">
                  Using custom domain URL for enhanced compatibility.
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-background px-2 py-1 rounded text-sm flex-1">
                {webdavUrl}
              </code>
              <Button size="sm" variant="outline" onClick={copyWebDAVUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="tokenName">Token Name</Label>
              <Input
                id="tokenName"
                placeholder="e.g., My Desktop"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                disabled={createTokenMutation.isPending || authStatus !== 'authenticated'}
              />
            </div>
            <div>
              <Label htmlFor="expiresIn">Expires In (Days)</Label>
              <Input
                id="expiresIn"
                type="number"
                min="1"
                max="365"
                value={expiresIn}
                onChange={(e) => setExpiresIn(parseInt(e.target.value) || 30)}
                disabled={createTokenMutation.isPending || authStatus !== 'authenticated'}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCreateToken}
                disabled={createTokenMutation.isPending || authStatus !== 'authenticated'}
                className="w-full"
              >
                {createTokenMutation.isPending ? (
                  <>Creating...</>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Token
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Creation Status Feedback */}
          {creationStatus === 'creating' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Creating your WebDAV token... This may take a moment.
              </AlertDescription>
            </Alert>
          )}

          {creationStatus === 'success' && lastCreatedToken && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-green-800">
                  Token created successfully! Copy it now - you won't see it again.
                </span>
                <Button size="sm" variant="outline" onClick={copyLastCreatedToken}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Token
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {creationStatus === 'error' && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to create token. Please check the debug information below or try refreshing authentication.
              </AlertDescription>
            </Alert>
          )}

          {/* Debug Information */}
          {debugInfo && (
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Debug Information:</h5>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}

          {/* Connection Instructions */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-1">Connection Instructions:</h5>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Create a WebDAV token using the form above</li>
              <li>Open your file manager (Finder, Windows Explorer, etc.)</li>
              <li>Connect to: <code className="bg-blue-100 px-1 rounded">{webdavUrl}</code></li>
              <li>Username: <code className="bg-blue-100 px-1 rounded">webdav</code> (or any value)</li>
              <li>Password: Your WebDAV token from below</li>
              <li>You'll see folders based on your access level (artist folders or all folders for admins)</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {authStatus !== 'authenticated' ? (
            <div className="text-center py-8 text-muted-foreground">
              Please log in to view your WebDAV tokens.
            </div>
          ) : isLoading ? (
            <div className="text-center py-4">Loading tokens...</div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active WebDAV tokens. Create one above to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.name}</span>
                      {token.expires_at && new Date(token.expires_at) < new Date() && (
                        <Badge variant="destructive">Expired</Badge>
                      )}
                      {token.last_used_at && (
                        <Badge variant="secondary">Recently Used</Badge>
                      )}
                      {token.is_active && (
                        <Badge variant="default">Active</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(token.created_at).toLocaleDateString()}
                      {token.expires_at && (
                        <span> • Expires: {new Date(token.expires_at).toLocaleDateString()}</span>
                      )}
                      {token.last_used_at && (
                        <span> • Last used: {new Date(token.last_used_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTokenLost}
                      title="Token lost? Create a new one"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeTokenMutation.mutate(token.id)}
                      disabled={revokeTokenMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
