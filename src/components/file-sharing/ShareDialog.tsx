
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Share2, Copy, Check } from "lucide-react";
import { useCreateSharedLink, getSharedLinkUrl } from "@/hooks/use-shared-links";
import { toast } from "sonner";

interface ShareDialogProps {
  fileId?: string;
  folderId?: string;
  fileName?: string;
  folderName?: string;
}

export function ShareDialog({ fileId, folderId, fileName, folderName }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<'view' | 'download' | 'edit'>('view');
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [hasDownloadLimit, setHasDownloadLimit] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createSharedLink = useCreateSharedLink();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await createSharedLink.mutateAsync({
        fileId,
        folderId,
        permissions,
        expiresAt: hasExpiry ? expiresAt : undefined,
        password: hasPassword ? password : undefined,
        maxDownloads: hasDownloadLimit ? parseInt(maxDownloads) : undefined,
      });

      const shareUrl = getSharedLinkUrl(result.token);
      setGeneratedLink(shareUrl);
    } catch (error) {
      console.error("Failed to create shared link:", error);
    }
  };

  const copyToClipboard = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setPermissions('view');
    setExpiresAt("");
    setPassword("");
    setMaxDownloads("");
    setHasExpiry(false);
    setHasPassword(false);
    setHasDownloadLimit(false);
    setGeneratedLink(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share {fileName || folderName}</DialogTitle>
          <DialogDescription>
            Create a shareable link with custom permissions and restrictions.
          </DialogDescription>
        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-sm font-medium">Shareable Link</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input value={generatedLink} readOnly className="flex-1" />
                <Button size="sm" onClick={copyToClipboard}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="permissions" className="text-right">
                  Permissions
                </Label>
                <Select value={permissions} onValueChange={(value: any) => setPermissions(value)}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View only</SelectItem>
                    <SelectItem value="download">View & Download</SelectItem>
                    <SelectItem value="edit">View, Download & Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="expiry"
                  checked={hasExpiry}
                  onCheckedChange={setHasExpiry}
                />
                <Label htmlFor="expiry">Set expiration date</Label>
              </div>

              {hasExpiry && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="expiresAt" className="text-right">
                    Expires at
                  </Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="password"
                  checked={hasPassword}
                  onCheckedChange={setHasPassword}
                />
                <Label htmlFor="password">Require password</Label>
              </div>

              {hasPassword && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="passwordInput" className="text-right">
                    Password
                  </Label>
                  <Input
                    id="passwordInput"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="col-span-3"
                    placeholder="Enter password"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="downloadLimit"
                  checked={hasDownloadLimit}
                  onCheckedChange={setHasDownloadLimit}
                />
                <Label htmlFor="downloadLimit">Limit downloads</Label>
              </div>

              {hasDownloadLimit && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="maxDownloads" className="text-right">
                    Max downloads
                  </Label>
                  <Input
                    id="maxDownloads"
                    type="number"
                    value={maxDownloads}
                    onChange={(e) => setMaxDownloads(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g. 10"
                    min="1"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSharedLink.isPending}>
                {createSharedLink.isPending ? "Creating..." : "Create Link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
