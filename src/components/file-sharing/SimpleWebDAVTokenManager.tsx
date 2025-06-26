
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface WebDAVToken {
  id: string;
  name: string;
  token_hash: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export function SimpleWebDAVTokenManager() {
  const [tokenName, setTokenName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  
  const queryClient = useQueryClient();
  const webdavUrl = "https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/";

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["webdav-tokens"],
    queryFn: async (): Promise<WebDAVToken[]> => {
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
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke("webdav-create-token", {
        body: { name, expiresInDays: 0 } // Never expires by default
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webdav-tokens"] });
      setNewToken(data.token);
      setTokenName("");
      toast.success("Access token created successfully!");
    },
    onError: (error) => {
      console.error("Error creating WebDAV token:", error);
      toast.error("Failed to create access token");
    },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("webdav_tokens")
        .update({ is_active: false })
        .eq("id", tokenId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webdav-tokens"] });
      toast.success("Access token deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting WebDAV token:", error);
      toast.error("Failed to delete access token");
    },
  });

  const handleCreateToken = async () => {
    const name = tokenName.trim() || `Access Token ${new Date().toLocaleDateString()}`;
    setIsCreating(true);
    try {
      await createTokenMutation.mutateAsync(name);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            File Server Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Setup */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Quick Setup</h3>
            <p className="text-sm text-blue-800 mb-3">
              Create an access token to connect your Mac's Finder to the file server.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Token name (optional)"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleCreateToken} disabled={isCreating} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                {isCreating ? "Creating..." : "Create Access Token"}
              </Button>
            </div>
          </div>

          {/* New Token Display */}
          {newToken && (
            <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-green-800">✅ Your Access Token</h4>
                <Button size="sm" onClick={() => setNewToken(null)} variant="outline">
                  Dismiss
                </Button>
              </div>
              
              <div className="bg-white rounded border p-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Password/Token:</Label>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono break-all bg-gray-50 p-2 rounded">
                    {showToken ? newToken : '•'.repeat(64)}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(newToken)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded border p-3 space-y-2">
                <h5 className="font-medium text-green-800">Mac Finder Connection:</h5>
                <div className="text-sm text-green-700 space-y-1">
                  <p>1. Press <kbd className="bg-green-100 px-1.5 py-0.5 rounded text-xs">⌘ + K</kbd> in Finder</p>
                  <p>2. Enter server address: <code className="bg-green-100 px-1 rounded text-xs">{webdavUrl}</code></p>
                  <p>3. Username: <code className="bg-green-100 px-1 rounded text-xs">webdav</code></p>
                  <p>4. Password: Use the token above</p>
                </div>
              </div>
            </div>
          )}

          {/* Server Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Server Information</h4>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Address:</span>
              <code className="bg-gray-200 px-2 py-1 rounded text-xs">{webdavUrl}</code>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(webdavUrl)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Active Tokens */}
          <div>
            <h4 className="font-medium mb-3">Your Access Tokens</h4>
            {isLoading ? (
              <div className="text-center py-4 text-gray-500">Loading tokens...</div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No access tokens yet</p>
                <p className="text-sm">Create one above to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tokens.map((token) => (
                  <div key={token.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                    <div>
                      <div className="font-medium">{token.name}</div>
                      <div className="text-sm text-gray-500">
                        Created {formatDate(token.created_at)}
                        {token.last_used_at && ` • Last used ${formatDate(token.last_used_at)}`}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTokenMutation.mutate(token.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
