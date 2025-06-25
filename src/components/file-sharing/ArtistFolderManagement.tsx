
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link, Unlink, Users, Folder, ArrowRight } from "lucide-react";
import { 
  useArtistFolderOverview,
  useLinkArtistToUser,
  useUnlinkArtistFromUser,
  useTransferFolderToArtist
} from "@/hooks/use-artist-management";
import { useFolders } from "@/hooks/use-folders";

interface LinkArtistDialogProps {
  onLinkArtist: (artistName: string, userEmail: string) => void;
  isLoading: boolean;
}

function LinkArtistDialog({ onLinkArtist, isLoading }: LinkArtistDialogProps) {
  const [open, setOpen] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (artistName.trim() && userEmail.trim()) {
      onLinkArtist(artistName.trim(), userEmail.trim());
      setOpen(false);
      setArtistName("");
      setUserEmail("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Link className="h-4 w-4 mr-2" />
          Link Artist to User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Artist to User Account</DialogTitle>
          <DialogDescription>
            Connect an artist to a user account to automatically create their folder and enable access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="artistName">Artist Name</Label>
            <Input
              id="artistName"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Enter artist name"
              required
            />
          </div>
          <div>
            <Label htmlFor="userEmail">User Email</Label>
            <Input
              id="userEmail"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="Enter user email"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Linking..." : "Link Artist"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ArtistFolderManagement() {
  const { data: overview = [], isLoading } = useArtistFolderOverview();
  const { data: allFolders = [] } = useFolders();
  const linkArtist = useLinkArtistToUser();
  const unlinkArtist = useUnlinkArtistFromUser();
  const transferFolder = useTransferFolderToArtist();

  const [transferDialog, setTransferDialog] = useState<{
    open: boolean;
    folderId: string;
    folderName: string;
  }>({
    open: false,
    folderId: "",
    folderName: ""
  });

  const [selectedArtistForTransfer, setSelectedArtistForTransfer] = useState("");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'linked_with_folder':
        return <Badge className="bg-green-100 text-green-800">Linked & Folder</Badge>;
      case 'linked_no_folder':
        return <Badge className="bg-yellow-100 text-yellow-800">Linked Only</Badge>;
      case 'folder_no_user':
        return <Badge className="bg-blue-100 text-blue-800">Folder Only</Badge>;
      default:
        return <Badge variant="secondary">No Connection</Badge>;
    }
  };

  const unassignedFolders = allFolders.filter(f => !f.artist_id);
  const artistsForTransfer = overview.filter(item => item.user_id);

  const handleTransferFolder = () => {
    if (transferDialog.folderId && selectedArtistForTransfer) {
      transferFolder.mutate({
        folderId: transferDialog.folderId,
        artistId: selectedArtistForTransfer
      });
      setTransferDialog({ open: false, folderId: "", folderName: "" });
      setSelectedArtistForTransfer("");
    }
  };

  const stats = {
    totalArtists: overview.length,
    linkedArtists: overview.filter(item => item.user_id).length,
    artistsWithFolders: overview.filter(item => item.folder_id).length,
    unassignedFolders: unassignedFolders.length
  };

  if (isLoading) {
    return <div className="p-4">Loading artist folder overview...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Artists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalArtists}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Linked to Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.linkedArtists}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">With Folders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.artistsWithFolders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unassigned Folders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unassignedFolders}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <LinkArtistDialog 
          onLinkArtist={(artistName, userEmail) => 
            linkArtist.mutate({ artistName, userEmail })
          }
          isLoading={linkArtist.isPending}
        />
        
        {unassignedFolders.length > 0 && (
          <Dialog 
            open={transferDialog.open} 
            onOpenChange={(open) => setTransferDialog(prev => ({ ...prev, open }))}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowRight className="h-4 w-4 mr-2" />
                Transfer Folders
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Folder to Artist</DialogTitle>
                <DialogDescription>
                  Assign unassigned folders to specific artists.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Folder</Label>
                  <Select 
                    value={transferDialog.folderId} 
                    onValueChange={(value) => {
                      const folder = unassignedFolders.find(f => f.id === value);
                      setTransferDialog({
                        open: true,
                        folderId: value,
                        folderName: folder?.name || ""
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a folder to transfer" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedFolders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Select Artist</Label>
                  <Select value={selectedArtistForTransfer} onValueChange={setSelectedArtistForTransfer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose target artist" />
                    </SelectTrigger>
                    <SelectContent>
                      {artistsForTransfer.map((item) => (
                        <SelectItem key={item.artist_id} value={item.artist_id}>
                          {item.artist_name} ({item.user_email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setTransferDialog({ open: false, folderId: "", folderName: "" })}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleTransferFolder}
                    disabled={!transferDialog.folderId || !selectedArtistForTransfer || transferFolder.isPending}
                  >
                    {transferFolder.isPending ? "Transferring..." : "Transfer"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Artist Overview Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Artist-Folder Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artist</TableHead>
                <TableHead>User Email</TableHead>
                <TableHead>Folder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.map((item) => (
                <TableRow key={item.artist_id}>
                  <TableCell className="font-medium">{item.artist_name}</TableCell>
                  <TableCell>{item.user_email || "—"}</TableCell>
                  <TableCell>
                    {item.folder_name ? (
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4" />
                        {item.folder_name}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>
                    {item.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unlinkArtist.mutate(item.artist_id)}
                        disabled={unlinkArtist.isPending}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
