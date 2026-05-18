import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { getEdgeFunctionUrl } from "@/lib/supabase-url";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `inv_${body}`;
}

export default function ApiAccessPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const endpoint = useMemo(() => getEdgeFunctionUrl("public-inventory-api"), []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_api_keys")
      .select("id, name, key_prefix, is_active, last_used_at, request_count, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setKeys((data ?? []) as ApiKey[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createKey = async () => {
    if (!newName.trim()) return toast.error("Name is required");
    setCreating(true);
    try {
      const key = generateKey();
      const hash = await sha256Hex(key);
      const prefix = key.slice(0, 12);
      const { error } = await supabase.from("inventory_api_keys").insert({
        name: newName.trim(),
        key_hash: hash,
        key_prefix: prefix,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setRevealedKey(key);
      setNewName("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (k: ApiKey) => {
    const { error } = await supabase
      .from("inventory_api_keys")
      .update({ is_active: !k.is_active })
      .eq("id", k.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (k: ApiKey) => {
    if (!confirm(`Delete API key "${k.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("inventory_api_keys").delete().eq("id", k.id);
    if (error) return toast.error(error.message);
    toast.success("Key deleted");
    load();
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <KeyRound className="h-6 w-6" /> Inventory API Access
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Public read-only REST API for your headless CMS (e.g. Sanity) to fetch artworks, prices &amp; artists.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint</CardTitle>
          <CardDescription>Base URL for all requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all">{endpoint}</code>
            <Button size="sm" variant="outline" onClick={() => copy(endpoint)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send your key in the <code>x-api-key</code> header (or <code>?api_key=</code> query for quick tests).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate new key</CardTitle>
          <CardDescription>The full key is shown only once — copy and store it securely.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g. Sanity production)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button onClick={createKey} disabled={creating}>
              Generate
            </Button>
          </div>
          {revealedKey && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium">New key (copy now — won't be shown again):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background px-3 py-2 rounded text-xs break-all">{revealedKey}</code>
                <Button size="sm" variant="outline" onClick={() => copy(revealedKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setRevealedKey(null)}>
                I've saved it
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active keys</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          ) : (
            <div className="divide-y">
              {keys.map((k) => (
                <div key={k.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium text-sm">{k.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {k.key_prefix}…  ·  {k.request_count} requests
                      {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{k.is_active ? "Active" : "Disabled"}</span>
                    <Switch checked={k.is_active} onCheckedChange={() => toggleActive(k)} />
                    <Button size="icon" variant="ghost" onClick={() => remove(k)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick start (Sanity / Node)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted rounded p-3 text-xs overflow-x-auto"><code>{`const res = await fetch("${endpoint}/artworks?status=available&limit=50", {
  headers: { "x-api-key": process.env.INVENTORY_API_KEY }
});
const { data, pagination } = await res.json();
// data[i] = { id, title, artist, price, currency, status, images, ... }`}</code></pre>
          <p className="text-xs text-muted-foreground mt-3">
            Endpoints: <code>/artworks</code>, <code>/artworks/:id</code>, <code>/artists</code>, <code>/artists/:id</code>.
            Filters: <code>status</code>, <code>artist_id</code>, <code>medium_type</code>, <code>limit</code>, <code>offset</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}