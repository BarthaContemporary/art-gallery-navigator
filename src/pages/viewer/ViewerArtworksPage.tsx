import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ExternalLink, Trash2, Settings2, Image as ImageIcon, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useViewerArtworks, useCreateViewerArtwork, useDeleteViewerArtwork } from '@/hooks/viewer/useViewerArtworks';
import { ViewerImageOptimizer } from '@/services/viewer/image-optimizer';
import type { ViewerArtwork } from '@/types/viewer';

export default function ViewerArtworksPage() {
  const navigate = useNavigate();
  const { data: artworks, isLoading } = useViewerArtworks();
  const createArtwork = useCreateViewerArtwork();
  const deleteArtwork = useDeleteViewerArtwork();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ViewerArtwork | null>(null);
  const [formData, setFormData] = useState({ artist_name: '', title: '', year: '' });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Group artworks by artist name
  const groupedArtworks = useMemo(() => {
    if (!artworks) return [];
    
    const groups: Record<string, ViewerArtwork[]> = {};
    artworks.forEach((artwork) => {
      const artistName = artwork.artist_name || 'Unknown Artist';
      if (!groups[artistName]) {
        groups[artistName] = [];
      }
      groups[artistName].push(artwork);
    });

    // Sort artist names alphabetically, with surname-first sorting
    return Object.entries(groups)
      .sort(([a], [b]) => {
        const getSortKey = (name: string) => {
          const parts = name.trim().split(' ');
          return parts.length > 1 ? parts[parts.length - 1] : name;
        };
        return getSortKey(a).localeCompare(getSortKey(b));
      })
      .map(([artistName, works]) => ({
        artistName,
        artworks: works.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [artworks]);

  const toggleFolder = (artistName: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(artistName)) {
        next.delete(artistName);
      } else {
        next.add(artistName);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!formData.artist_name || !formData.title) return;
    
    const result = await createArtwork.mutateAsync(formData);
    setCreateOpen(false);
    setFormData({ artist_name: '', title: '', year: '' });
    navigate(`/viewer/${result.id}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteArtwork.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const openViewer = (id: string) => {
    window.open(`/w/${id}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Image Viewer</h1>
          <p className="text-sm text-muted-foreground">
            Manage embeddable high-resolution artwork viewers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/viewer/settings')}>
            <Settings2 className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Artwork
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Artwork</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="artist_name">Artist Name</Label>
                  <Input
                    id="artist_name"
                    value={formData.artist_name}
                    onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                    placeholder="Artist name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Artwork title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year (optional)</Label>
                  <Input
                    id="year"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="e.g. 2024"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.artist_name || !formData.title || createArtwork.isPending}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!artworks?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">No artworks yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first embeddable artwork viewer
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Artwork
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedArtworks.map(({ artistName, artworks: artistArtworks }) => {
            const isCollapsed = collapsedFolders.has(artistName);
            return (
              <div key={artistName} className="border rounded bg-card">
                <button
                  onClick={() => toggleFolder(artistName)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="font-medium flex-1 truncate">{artistName}</span>
                  <span className="text-sm text-muted-foreground">
                    {artistArtworks.length} work{artistArtworks.length !== 1 ? 's' : ''}
                  </span>
                </button>
                
                {!isCollapsed && (
                  <div className="px-4 pb-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {artistArtworks.map((artwork) => (
                        <Card
                          key={artwork.id}
                          className="group cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate(`/viewer/${artwork.id}`)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1 min-w-0 flex-1">
                                <CardTitle className="text-base truncate">{artwork.title}</CardTitle>
                                <p className="text-sm text-muted-foreground truncate">
                                  {artwork.year || 'No year'}
                                </p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openViewer(artwork.slug);
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget(artwork);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {artwork.images?.length ? (
                              <div className="aspect-video bg-muted rounded overflow-hidden">
                                <img
                                  src={ViewerImageOptimizer.getOptimizedUrl(artwork.images[0], 'small')}
                                  alt={artwork.images[0].alt_text || artwork.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className="aspect-video bg-muted rounded flex items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              {artwork.images?.length || 0} image{(artwork.images?.length || 0) !== 1 ? 's' : ''}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artwork?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.title}" and all its images.
              Any embeds using this artwork will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
