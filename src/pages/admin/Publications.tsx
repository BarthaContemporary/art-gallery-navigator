import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, Eye, Pencil, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface PublicationWithTitlePage {
  id: string;
  title: string;
  author: string | null;
  slug: string | null;
  page_count: number | null;
  processing_status: string | null;
  visibility: string | null;
  created_at: string;
  og_image_url: string | null;
  title_page_url?: string | null;
}

export default function Publications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    data: publications,
    isLoading
  } = useQuery<PublicationWithTitlePage[]>({
    queryKey: ['admin-publications', searchQuery],
    queryFn: async () => {
      // First get publications
      let pubQuery = supabase.from('publications').select('*').order('created_at', { ascending: false });
      if (searchQuery) {
        pubQuery = pubQuery.or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`);
      }
      const { data: pubs, error: pubError } = await pubQuery;
      if (pubError) throw pubError;
      
      if (!pubs?.length) return [];
      
      // Get title pages (page 1) for all publications
      const { data: titlePages } = await supabase
        .from('publication_pages')
        .select('publication_id, render_low_url')
        .in('publication_id', pubs.map(p => p.id))
        .eq('page_number', 1);
      
      // Map title page URLs to publications
      const titlePageMap = new Map(titlePages?.map(tp => [tp.publication_id, tp.render_low_url]) || []);
      
      return pubs.map(pub => ({
        ...pub,
        title_page_url: titlePageMap.get(pub.id) || null
      }));
    }
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const {
        error
      } = await supabase.from('publications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-publications']
      });
      toast.success('Publication deleted');
      setDeleteId(null);
    },
    onError: error => {
      toast.error('Failed to delete publication');
      console.error(error);
    }
  });
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return 'default';
      case 'unlisted':
        return 'secondary';
      case 'private':
        return 'outline';
      default:
        return 'outline';
    }
  };
  return <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-4 mb-6">
        <Button asChild>
          <Link to="/admin/publications/new">
            <Plus className="h-4 w-4 mr-2" />
            New Publication
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search publications..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div> : publications?.length === 0 ? <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No publications yet</h3>
            <p className="text-muted-foreground mb-4">Create your first flipbook publication</p>
            <Button asChild>
              <Link to="/admin/publications/new">
                <Plus className="h-4 w-4 mr-2" />
                New Publication
              </Link>
            </Button>
          </CardContent>
        </Card> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publications?.map(pub => (
            <Card 
              key={pub.id} 
              className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30"
            >
              {/* Title Page Thumbnail */}
              <div className="relative aspect-[3/4] bg-muted overflow-hidden">
                {(pub.title_page_url || pub.og_image_url) ? (
                  <img 
                    src={pub.title_page_url || pub.og_image_url} 
                    alt={pub.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/80 ${(pub.title_page_url || pub.og_image_url) ? 'hidden' : ''}`}>
                  <FileText className="h-16 w-16 text-muted-foreground/40" />
                </div>
                
                {/* Status badges overlay */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <Badge 
                    variant={getStatusColor(pub.processing_status || 'pending')}
                    className="text-xs shadow-sm backdrop-blur-sm"
                  >
                    {pub.processing_status || 'pending'}
                  </Badge>
                  <Badge 
                    variant={getVisibilityColor(pub.visibility || 'private')}
                    className="text-xs shadow-sm backdrop-blur-sm"
                  >
                    {pub.visibility || 'private'}
                  </Badge>
                </div>

                {/* Quick actions overlay */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pub.processing_status === 'completed' && (
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="h-8 w-8 shadow-md backdrop-blur-sm bg-background/80 hover:bg-background"
                      asChild
                    >
                      <Link to={`/p/${pub.slug || pub.id}`} target="_blank">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* Content */}
              <CardContent className="p-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {pub.title}
                  </h3>
                  {pub.author && (
                    <p className="text-sm text-muted-foreground">
                      {pub.author}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <span>{pub.page_count || 0} pages</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span>{format(new Date(pub.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>

                {/* Actions footer */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/50">
                  {pub.slug && (
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                      /p/{pub.slug}
                    </span>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                      <Link to={`/admin/publications/${pub.id}`}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Link>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(pub.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Publication</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this publication and all associated pages and leads. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}