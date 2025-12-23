import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Save, 
  Upload, 
  Loader2, 
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

interface PublicationFormData {
  title: string;
  subtitle: string;
  author: string;
  description: string;
  slug: string;
  visibility: 'public' | 'unlisted' | 'private';
  theme: 'light' | 'dark' | 'auto';
  cover_page: number;
  download_gate_enabled: boolean;
  mailing_list_default_opt_in: boolean;
  seo: {
    title?: string;
    description?: string;
    canonical?: string;
    noindex?: boolean;
  };
}

export default function PublicationEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [formData, setFormData] = useState<PublicationFormData>({
    title: '',
    subtitle: '',
    author: '',
    description: '',
    slug: '',
    visibility: 'private',
    theme: 'auto',
    cover_page: 1,
    download_gate_enabled: true,
    mailing_list_default_opt_in: false,
    seo: {},
  });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch existing publication
  const { data: publication, isLoading } = useQuery({
    queryKey: ['publication-edit', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('publications')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  // Fetch pages for page count display
  const { data: pages } = useQuery({
    queryKey: ['publication-pages-edit', id],
    queryFn: async () => {
      if (isNew) return [];
      const { data, error } = await supabase
        .from('publication_pages')
        .select('page_number, render_low_url')
        .eq('publication_id', id)
        .order('page_number', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !isNew && !!publication,
  });

  // Fetch leads count
  const { data: leadsCount } = useQuery({
    queryKey: ['publication-leads-count', id],
    queryFn: async () => {
      if (isNew) return 0;
      const { count, error } = await supabase
        .from('publication_leads')
        .select('*', { count: 'exact', head: true })
        .eq('publication_id', id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (publication) {
      setFormData({
        title: publication.title || '',
        subtitle: publication.subtitle || '',
        author: publication.author || '',
        description: publication.description || '',
        slug: publication.slug || '',
        visibility: (publication.visibility as any) || 'private',
        theme: (publication.theme as any) || 'auto',
        cover_page: publication.cover_page || 1,
        download_gate_enabled: publication.download_gate_enabled ?? true,
        mailing_list_default_opt_in: publication.mailing_list_default_opt_in ?? false,
        seo: (publication.seo as any) || {},
      });
    }
  }, [publication]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: PublicationFormData) => {
      const payload = {
        title: data.title,
        subtitle: data.subtitle || null,
        author: data.author || null,
        description: data.description || null,
        slug: data.slug || null,
        visibility: data.visibility,
        theme: data.theme,
        cover_page: data.cover_page,
        download_gate_enabled: data.download_gate_enabled,
        mailing_list_default_opt_in: data.mailing_list_default_opt_in,
        seo: data.seo,
      };

      if (isNew) {
        const { data: created, error } = await supabase
          .from('publications')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return created;
      } else {
        const { data: updated, error } = await supabase
          .from('publications')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return updated;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['publication-edit'] });
      queryClient.invalidateQueries({ queryKey: ['admin-publications'] });
      toast.success(isNew ? 'Publication created' : 'Publication saved');
      if (isNew) {
        navigate(`/admin/publications/${data.id}`);
      }
    },
    onError: (error) => {
      toast.error('Failed to save publication');
      console.error(error);
    },
  });

  // File upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // First save the publication if new
      let publicationId = id;
      if (isNew) {
        const { data: created, error: createError } = await supabase
          .from('publications')
          .insert({
            title: formData.title || 'Untitled Publication',
            processing_status: 'pending',
          })
          .select()
          .single();
        
        if (createError) throw createError;
        publicationId = created.id;
        navigate(`/admin/publications/${publicationId}`, { replace: true });
      }

      // Upload PDF to storage
      const fileName = `${publicationId}/${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('publications')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('publications')
        .getPublicUrl(fileName);

      // Update publication with PDF URL and trigger processing
      const { error: updateError } = await supabase
        .from('publications')
        .update({
          pdf_url: urlData.publicUrl,
          processing_status: 'processing',
        })
        .eq('id', publicationId);

      if (updateError) throw updateError;

      // Trigger edge function for processing
      const { error: processError } = await supabase.functions.invoke('process-publication-pdf', {
        body: { publicationId },
      });

      if (processError) {
        console.error('Processing error:', processError);
        toast.error('PDF uploaded but processing failed. You can retry later.');
      } else {
        toast.success('PDF uploaded and processing started');
      }

      queryClient.invalidateQueries({ queryKey: ['publication-edit'] });
      queryClient.invalidateQueries({ queryKey: ['admin-publications'] });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  }, [id, isNew, formData.title, navigate, queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/publications')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {isNew ? 'New Publication' : 'Edit Publication'}
          </h1>
          {publication && (
            <div className="flex items-center gap-2 mt-1">
              {getStatusIcon(publication.processing_status || 'pending')}
              <span className="text-sm text-muted-foreground capitalize">
                {publication.processing_status || 'pending'}
              </span>
              {publication.page_count && (
                <span className="text-sm text-muted-foreground">
                  • {publication.page_count} pages
                </span>
              )}
              {leadsCount !== undefined && leadsCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  • {leadsCount} leads
                </span>
              )}
            </div>
          )}
        </div>
        <Button 
          onClick={() => saveMutation.mutate(formData)}
          disabled={saveMutation.isPending || !formData.title}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save
        </Button>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="pdf">PDF Upload</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publication Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter publication title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Optional subtitle"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Author name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the publication"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Custom URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/p/</span>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') 
                    }))}
                    placeholder="my-publication"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to use the auto-generated slug
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>PDF Document</CardTitle>
              <CardDescription>
                Upload a multi-page PDF to create the flipbook
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                  uploading && "opacity-50 cursor-not-allowed"
                )}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <div className="space-y-2">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground">Uploading PDF...</p>
                  </div>
                ) : isDragActive ? (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 mx-auto text-primary" />
                    <p>Drop the PDF here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p>Drag and drop a PDF file, or click to select</p>
                    <p className="text-sm text-muted-foreground">Only PDF files are accepted</p>
                  </div>
                )}
              </div>

              {publication?.pdf_url && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Current PDF</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {publication.pdf_url}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={publication.pdf_url} target="_blank" rel="noopener noreferrer">
                      Download
                    </a>
                  </Button>
                </div>
              )}

              {publication?.processing_status === 'failed' && publication.processing_error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Processing Failed</p>
                    <p className="text-sm">{publication.processing_error}</p>
                  </div>
                </div>
              )}

              {pages && pages.length > 0 && (
                <div className="space-y-2">
                  <Label>Page Previews</Label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-64 overflow-y-auto">
                    {pages.map((page) => (
                      <div 
                        key={page.page_number}
                        className="aspect-[3/4] bg-muted rounded overflow-hidden"
                      >
                        {page.render_low_url ? (
                          <img 
                            src={page.render_low_url} 
                            alt={`Page ${page.page_number}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            {page.page_number}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visibility & Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, visibility: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Visible to everyone, indexed by search engines</SelectItem>
                    <SelectItem value="unlisted">Unlisted - Accessible via link, not indexed</SelectItem>
                    <SelectItem value="private">Private - Only visible to admins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Theme</Label>
                <Select
                  value={formData.theme}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, theme: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto - Match system preference</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cover_page">Cover Page Number</Label>
                <Input
                  id="cover_page"
                  type="number"
                  min={1}
                  value={formData.cover_page}
                  onChange={(e) => setFormData(prev => ({ ...prev, cover_page: parseInt(e.target.value) || 1 }))}
                />
                <p className="text-xs text-muted-foreground">
                  Which page to use as the cover/thumbnail
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Download Gate</CardTitle>
              <CardDescription>
                Require users to provide their information before downloading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Download Gate</Label>
                  <p className="text-sm text-muted-foreground">
                    Collect name and email before PDF download
                  </p>
                </div>
                <Switch
                  checked={formData.download_gate_enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, download_gate_enabled: checked }))}
                />
              </div>

              {formData.download_gate_enabled && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Default Mailing List Opt-in</Label>
                    <p className="text-sm text-muted-foreground">
                      Pre-check the mailing list checkbox
                    </p>
                  </div>
                  <Switch
                    checked={formData.mailing_list_default_opt_in}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, mailing_list_default_opt_in: checked }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>
                Override the default meta tags for search engines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seo_title">Meta Title</Label>
                <Input
                  id="seo_title"
                  value={formData.seo.title || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    seo: { ...prev.seo, title: e.target.value } 
                  }))}
                  placeholder={formData.title || 'Leave empty to use publication title'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo_description">Meta Description</Label>
                <Textarea
                  id="seo_description"
                  value={formData.seo.description || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    seo: { ...prev.seo, description: e.target.value } 
                  }))}
                  placeholder="Leave empty to use publication description"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 150-160 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo_canonical">Canonical URL</Label>
                <Input
                  id="seo_canonical"
                  value={formData.seo.canonical || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    seo: { ...prev.seo, canonical: e.target.value } 
                  }))}
                  placeholder="https://example.com/publications/my-publication"
                />
                <p className="text-xs text-muted-foreground">
                  Override the default canonical URL
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>No Index</Label>
                  <p className="text-sm text-muted-foreground">
                    Tell search engines not to index this publication
                  </p>
                </div>
                <Switch
                  checked={formData.seo.noindex || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    seo: { ...prev.seo, noindex: checked } 
                  }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
