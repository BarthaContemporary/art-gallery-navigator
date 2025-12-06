import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useViewerEmbedDomains, useAddEmbedDomain, useDeleteEmbedDomain } from '@/hooks/viewer/useViewerEmbedDomains';

export default function ViewerSettingsPage() {
  const navigate = useNavigate();
  const { data: domains, isLoading } = useViewerEmbedDomains();
  const addDomain = useAddEmbedDomain();
  const deleteDomain = useDeleteEmbedDomain();

  const [newDomain, setNewDomain] = useState('');

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    await addDomain.mutateAsync(newDomain);
    setNewDomain('');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/viewer')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Viewer Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure embedding and security settings
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Allowed Embed Domains
          </CardTitle>
          <CardDescription>
            Specify which domains can embed the artwork viewer. Leave empty to allow all domains.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
            />
            <Button onClick={handleAddDomain} disabled={!newDomain.trim() || addDomain.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : domains?.length ? (
            <div className="space-y-2">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded"
                >
                  <span className="font-mono text-sm">{domain.domain}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteDomain.mutate(domain.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No domain restrictions. The viewer can be embedded on any website.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
