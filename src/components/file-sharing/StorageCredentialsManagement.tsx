import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Cloud,
  Users,
  Key,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

interface ArtistStorageCredentials {
  id: string;
  artist_id: string;
  bucket_name: string;
  access_key: string;
  secret_key: string;
  endpoint_url: string;
  region: string;
  created_at: string;
  updated_at: string;
  artists: {
    full_name: string;
  };
}

interface SharedStorageCredentials {
  id: string;
  name: string;
  bucket_name: string;
  access_key: string;
  secret_key: string;
  endpoint_url: string;
  region: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function StorageCredentialsManagement() {
  const [artistCredentials, setArtistCredentials] = useState<ArtistStorageCredentials[]>([]);
  const [sharedCredentials, setSharedCredentials] = useState<SharedStorageCredentials[]>([]);
  const [artists, setArtists] = useState<Array<{ id: string; full_name: string; }>>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sharedDialogOpen, setSharedDialogOpen] = useState(false);
  const [selectedCredentials, setSelectedCredentials] = useState<ArtistStorageCredentials | null>(null);
  const [selectedSharedCredentials, setSelectedSharedCredentials] = useState<SharedStorageCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const { isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    artist_id: '',
    bucket_name: '',
    access_key: '',
    secret_key: '',
    endpoint_url: 'https://s3.idrivee2.com',
    region: 'us-east-1',
  });

  const [sharedFormData, setSharedFormData] = useState({
    name: 'Gallery Shared Storage',
    bucket_name: 'gallerysharedbuckets',
    access_key: '',
    secret_key: '',
    endpoint_url: 'https://s3.idrivee2.com',
    region: 'us-east-1',
    is_active: true,
  });

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load artist credentials
      const { data: artistCreds, error: artistError } = await supabase
        .from('artist_storage_credentials')
        .select(`
          *,
          artists!inner(full_name)
        `)
        .order('created_at', { ascending: false });

      if (artistError) throw artistError;
      setArtistCredentials(artistCreds || []);

      // Load shared credentials (optional - table might not exist yet)
      try {
        const { data: sharedCreds, error: sharedError } = await supabase
          .from('shared_storage_credentials' as any)
          .select('*')
          .order('created_at', { ascending: false });

        // Only set valid credentials if query succeeded and returned valid data
        if (!sharedError && Array.isArray(sharedCreds)) {
          const validCredentials = sharedCreds.filter((item: any) => 
            item && 
            typeof item === 'object' && 
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.bucket_name === 'string'
          ) as unknown as SharedStorageCredentials[];
          setSharedCredentials(validCredentials);
        } else {
          setSharedCredentials([]);
        }
      } catch (error) {
        console.error('Shared credentials table not available:', error);
        setSharedCredentials([]);
      }

      // Load artists without credentials
      const { data: allArtists, error: artistsError } = await supabase
        .from('artists')
        .select('id, full_name')
        .order('full_name');

      if (artistsError) throw artistsError;
      setArtists(allArtists || []);

    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load storage credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCredentials = async () => {
    try {
      setLoading(true);

      if (selectedCredentials) {
        // Update existing
        const { error } = await supabase
          .from('artist_storage_credentials')
          .update({
            bucket_name: formData.bucket_name,
            access_key: formData.access_key,
            secret_key: formData.secret_key,
            endpoint_url: formData.endpoint_url,
            region: formData.region,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedCredentials.id);

        if (error) throw error;
        toast.success('Credentials updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('artist_storage_credentials')
          .insert({
            artist_id: formData.artist_id,
            bucket_name: formData.bucket_name,
            access_key: formData.access_key,
            secret_key: formData.secret_key,
            endpoint_url: formData.endpoint_url,
            region: formData.region,
          });

        if (error) throw error;
        toast.success('Credentials created successfully');
      }

      setEditDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to save credentials:', error);
      toast.error('Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSharedCredentials = async () => {
    try {
      setLoading(true);

      if (selectedSharedCredentials) {
        // Update existing
        const { error } = await supabase
          .from('shared_storage_credentials' as any)
          .update({
            name: sharedFormData.name,
            bucket_name: sharedFormData.bucket_name,
            access_key: sharedFormData.access_key,
            secret_key: sharedFormData.secret_key,
            endpoint_url: sharedFormData.endpoint_url,
            region: sharedFormData.region,
            is_active: sharedFormData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedSharedCredentials.id);

        if (error) throw error;
        toast.success('Shared credentials updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('shared_storage_credentials' as any)
          .insert({
            name: sharedFormData.name,
            bucket_name: sharedFormData.bucket_name,
            access_key: sharedFormData.access_key,
            secret_key: sharedFormData.secret_key,
            endpoint_url: sharedFormData.endpoint_url,
            region: sharedFormData.region,
            is_active: sharedFormData.is_active,
          });

        if (error) throw error;
        toast.success('Shared credentials created successfully');
      }

      setSharedDialogOpen(false);
      resetSharedForm();
      loadData();
    } catch (error) {
      console.error('Failed to save shared credentials:', error);
      toast.error('Failed to save shared credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCredentials = async (id: string) => {
    if (!confirm('Are you sure you want to delete these credentials?')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('artist_storage_credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Credentials deleted successfully');
      loadData();
    } catch (error) {
      console.error('Failed to delete credentials:', error);
      toast.error('Failed to delete credentials');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      artist_id: '',
      bucket_name: '',
      access_key: '',
      secret_key: '',
      endpoint_url: 'https://s3.idrivee2.com',
      region: 'us-east-1',
    });
    setSelectedCredentials(null);
  };

  const resetSharedForm = () => {
    setSharedFormData({
      name: 'Gallery Shared Storage',
      bucket_name: 'gallerysharedbuckets',
      access_key: '',
      secret_key: '',
      endpoint_url: 'https://s3.idrivee2.com',
      region: 'us-east-1',
      is_active: true,
    });
    setSelectedSharedCredentials(null);
  };

  const openEditDialog = (credentials?: ArtistStorageCredentials) => {
    if (credentials) {
      setSelectedCredentials(credentials);
      setFormData({
        artist_id: credentials.artist_id,
        bucket_name: credentials.bucket_name,
        access_key: credentials.access_key,
        secret_key: credentials.secret_key,
        endpoint_url: credentials.endpoint_url,
        region: credentials.region,
      });
    } else {
      resetForm();
    }
    setEditDialogOpen(true);
  };

  const openSharedDialog = (credentials?: SharedStorageCredentials) => {
    if (credentials) {
      setSelectedSharedCredentials(credentials);
      setSharedFormData({
        name: credentials.name,
        bucket_name: credentials.bucket_name,
        access_key: credentials.access_key,
        secret_key: credentials.secret_key,
        endpoint_url: credentials.endpoint_url,
        region: credentials.region,
        is_active: credentials.is_active,
      });
    } else {
      resetSharedForm();
    }
    setSharedDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shared Storage Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Shared Storage Credentials
            </CardTitle>
            <Dialog open={sharedDialogOpen} onOpenChange={setSharedDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openSharedDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Shared Storage
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {selectedSharedCredentials ? 'Edit' : 'Add'} Shared Storage Credentials
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="shared-name">Display Name</Label>
                    <Input
                      id="shared-name"
                      value={sharedFormData.name}
                      onChange={(e) => setSharedFormData({...sharedFormData, name: e.target.value})}
                      placeholder="Gallery Shared Storage"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shared-bucket">Bucket Name</Label>
                    <Input
                      id="shared-bucket"
                      value={sharedFormData.bucket_name}
                      onChange={(e) => setSharedFormData({...sharedFormData, bucket_name: e.target.value})}
                      placeholder="gallerysharedbuckets"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shared-access-key">Access Key</Label>
                    <Input
                      id="shared-access-key"
                      value={sharedFormData.access_key}
                      onChange={(e) => setSharedFormData({...sharedFormData, access_key: e.target.value})}
                      placeholder="Access Key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shared-secret-key">Secret Key</Label>
                    <Input
                      id="shared-secret-key"
                      type="password"
                      value={sharedFormData.secret_key}
                      onChange={(e) => setSharedFormData({...sharedFormData, secret_key: e.target.value})}
                      placeholder="Secret Key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shared-endpoint">Endpoint URL</Label>
                    <Input
                      id="shared-endpoint"
                      value={sharedFormData.endpoint_url}
                      onChange={(e) => setSharedFormData({...sharedFormData, endpoint_url: e.target.value})}
                      placeholder="https://s3.idrivee2.com"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSharedDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveSharedCredentials} disabled={loading}>
                      {selectedSharedCredentials ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {sharedCredentials.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No shared storage credentials configured
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sharedCredentials.map((creds) => (
                  <TableRow key={creds.id}>
                    <TableCell className="font-medium">{creds.name}</TableCell>
                    <TableCell>{creds.bucket_name}</TableCell>
                    <TableCell>
                      <Badge variant={creds.is_active ? 'default' : 'secondary'}>
                        {creds.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(creds.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSharedDialog(creds)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Artist Storage Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Artist Storage Credentials
            </CardTitle>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openEditDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Artist Storage
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {selectedCredentials ? 'Edit' : 'Add'} Artist Storage Credentials
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="artist">Artist</Label>
                    <Select
                      value={formData.artist_id}
                      onValueChange={(value) => setFormData({ ...formData, artist_id: value })}
                      disabled={!!selectedCredentials}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an artist" />
                      </SelectTrigger>
                      <SelectContent>
                        {artists.map((artist) => (
                          <SelectItem key={artist.id} value={artist.id}>
                            {artist.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="bucket">Bucket Name</Label>
                    <Input
                      id="bucket"
                      value={formData.bucket_name}
                      onChange={(e) => setFormData({...formData, bucket_name: e.target.value})}
                      placeholder="artist-bucket-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="access-key">Access Key</Label>
                    <Input
                      id="access-key"
                      value={formData.access_key}
                      onChange={(e) => setFormData({...formData, access_key: e.target.value})}
                      placeholder="Access Key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="secret-key">Secret Key</Label>
                    <Input
                      id="secret-key"
                      type="password"
                      value={formData.secret_key}
                      onChange={(e) => setFormData({...formData, secret_key: e.target.value})}
                      placeholder="Secret Key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endpoint">Endpoint URL</Label>
                    <Input
                      id="endpoint"
                      value={formData.endpoint_url}
                      onChange={(e) => setFormData({...formData, endpoint_url: e.target.value})}
                      placeholder="https://s3.idrivee2.com"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveCredentials} disabled={loading}>
                      {selectedCredentials ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {artistCredentials.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No artist storage credentials configured
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artist</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artistCredentials.map((creds) => (
                  <TableRow key={creds.id}>
                    <TableCell className="font-medium">{creds.artists.full_name}</TableCell>
                    <TableCell>{creds.bucket_name}</TableCell>
                    <TableCell>{creds.region}</TableCell>
                    <TableCell>{new Date(creds.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(creds)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCredentials(creds.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}