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
export default function Publications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    data: publications,
    isLoading
  } = useQuery({
    queryKey: ['admin-publications', searchQuery],
    queryFn: async () => {
      let query = supabase.from('publications').select('*').order('created_at', {
        ascending: false
      });
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`);
      }
      const {
        data,
        error
      } = await query;
      if (error) throw error;
      return data;
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
        </Card> : <div className="grid gap-4">
          {publications?.map(pub => <Card key={pub.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-full md:w-24 h-32 md:h-24 bg-muted rounded-md flex items-center justify-center shrink-0">
                    {pub.og_image_url ? <img src={pub.og_image_url} alt={pub.title} className="w-full h-full object-cover rounded-md" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <h3 className="font-semibold truncate">{pub.title}</h3>
                      <Badge variant={getStatusColor(pub.processing_status || 'pending')}>
                        {pub.processing_status || 'pending'}
                      </Badge>
                      <Badge variant={getVisibilityColor(pub.visibility || 'private')}>
                        {pub.visibility || 'private'}
                      </Badge>
                    </div>
                    {pub.author && <p className="text-sm text-muted-foreground">By {pub.author}</p>}
                    <p className="text-sm text-muted-foreground mt-1">
                      {pub.page_count || 0} pages • Created {format(new Date(pub.created_at), 'MMM d, yyyy')}
                    </p>
                    {pub.slug && <p className="text-xs text-muted-foreground mt-1 font-mono">
                        /p/{pub.slug}
                      </p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {pub.processing_status === 'completed' && <Button variant="ghost" size="icon" asChild>
                        <Link to={`/p/${pub.slug || pub.id}`} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>}
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/admin/publications/${pub.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(pub.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>)}
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