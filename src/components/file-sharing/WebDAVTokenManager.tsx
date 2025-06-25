
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Copy, Plus, Key, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WebDAVConnectionTest } from "./WebDAVConnectionTest";

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
  const queryClient = useQueryClient();

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
  });

  const createTokenMutation = useMutation({
    mutationFn: async ({ name, expiresInDays }: { name: string; expiresInDays: number }) => {
      const { data, error } = await supabase.functions.invoke("webdav-create-token", {
        body: { name, expiresInDays },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webdav-tokens"] });
      toast.success("WebDAV token created successfully");
      
      // Store the token temporarily so user can copy it
      setLastCreatedToken(data.token);
      
      // Also copy to clipboard immediately
      navigator.clipboard.writeText(data.token);
      toast.success(`Token copied to clipboard: ${data.token.substring(0, 20)}...`);
      
      setTokenName("");
    },
    onError: (error) => {
      console.error("Error creating token:", error);
      toast.error("Failed to create WebDAV token");
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

  return (
    <div className="space-y-6">
      <WebDAVConnectionTest />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            WebDAV Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCreateToken}
                disabled={createTokenMutation.isPending}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </Button>
            </div>
          </div>

          {lastCreatedToken && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Your new token was created successfully. Copy it now - you won't see it again!</span>
                <Button size="sm" variant="outline" onClick={copyLastCreatedToken}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Token
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Additional info for custom domains */}
          {!webdavUrl.includes('.supabase.co') && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <h5 className="font-medium text-blue-900 mb-1">Custom Domain Setup:</h5>
              <p className="text-sm text-blue-800">
                You're using a custom domain. Make sure your domain is properly configured to proxy 
                requests to <code>/functions/v1/*</code> to your Supabase edge functions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
