import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Trash2, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WebDAVDebugPanel } from "./WebDAVDebugPanel";

interface WebDAVToken {
  id: string;
  name: string;
  token_hash: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export function WebDAVTokenManager() {
  const [tokenName, setTokenName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  // Always use the Supabase edge function URL
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
    mutationFn: async ({ name, expiresInDays }: { name: string; expiresInDays: number }) => {
      const { data, error } = await supabase.functions.invoke("webdav-create-token", {
        body: { name, expiresInDays }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webdav-tokens"] });
      setNewToken(data.token);
      setTokenName("");
      setExpiresInDays("30");
      toast.success("WebDAV token created successfully");
    },
    onError: (error) => {
      console.error("Error creating WebDAV token:", error);
      toast.error("Failed to create WebDAV token");
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
      toast.success("WebDAV token deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting WebDAV token:", error);
      toast.error("Failed to delete WebDAV token");
    },
  });

  const handleCreateToken = async () => {
    if (!tokenName.trim()) {
      toast.error("Please enter a token name");
      return;
    }

    setIsCreating(true);
    try {
      await createTokenMutation.mutateAsync({
        name: tokenName.trim(),
        expiresInDays: parseInt(expiresInDays) || 0
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Debug Panel */}
      <WebDAVDebugPanel />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            WebDAV Access Tokens
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
              <div className="mt-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                ✅ Using official Supabase edge function URL
              </div>
            </div>
          </div>

          {/* Token Creation Form */}
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">Create New Token</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tokenName">Token Name</Label>
                <Input
                  id="tokenName"
                  placeholder="e.g., My WebDAV Access"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="expiresInDays">Expires In</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Never</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreateToken} disabled={isCreating} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreating ? "Creating..." : "Create Token"}
                </Button>
              </div>
            </div>
          </div>

          {/* New Token Display */}
          {newToken && (
            <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-green-800">✅ Token Created Successfully!</h4>
              <p className="text-sm text-green-700">
                Save this token securely - you won't be able to see it again.
              </p>
              <div className="flex items-center gap-2 p-3 bg-white rounded border">
                <code className="flex-1 text-sm font-mono break-all">{newToken}</code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(newToken)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Username:</strong> <code>webdav</code> (any value works)</p>
                <p><strong>Password:</strong> The token above</p>
                <p><strong>URL:</strong> <code>{webdavUrl}</code></p>
              </div>
              <Button size="sm" onClick={() => setNewToken(null)} variant="outline">
                Dismiss
              </Button>
            </div>
          )}

          {/* Existing Tokens List */}
          <div className="space-y-3">
            <h4 className="font-medium">Active Tokens</h4>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading tokens...</div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No active tokens</div>
            ) : (
              <div className="space-y-2">
                {tokens.map((token) => (
                  <div key={token.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{token.name}</span>
                        {token.expires_at ? (
                          <Badge variant="outline">
                            Expires {formatDate(token.expires_at)}
                          </Badge>
                        ) : (
                          <Badge>Never expires</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Created {formatDate(token.created_at)}
                        {token.last_used_at && ` • Last used ${formatDate(token.last_used_at)}`}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteTokenMutation.mutate(token.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-1">macOS Finder Connection Steps:</h5>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Create a token using the form above and test it with the debug panel</li>
              <li>In Finder, press <kbd className="bg-blue-100 px-1 rounded">Cmd+K</kbd> (Connect to Server)</li>
              <li>Enter: <code className="bg-blue-100 px-1 rounded">{webdavUrl}</code></li>
              <li>Choose "Registered User" when prompted</li>
              <li>Username: <code className="bg-blue-100 px-1 rounded">webdav</code> (any value works)</li>
              <li>Password: Your WebDAV token from above</li>
              <li>The server should appear in Finder's sidebar under "Locations"</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => window.open("https://cyberduck.io/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Try Cyberduck
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
