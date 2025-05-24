
import React from 'react';
import { useParams } from 'react-router-dom';
import { useFetchPublicCollectionWebsite } from '@/hooks/collection-websites';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

export default function PublicCollectionView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: website, isLoading, error } = useFetchPublicCollectionWebsite(slug);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading website...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <PageHeader title="Error" description={`Failed to load website: ${error.message}`} />
      </div>
    );
  }

  if (!website) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <PageHeader title="Not Found" description="The requested collection website could not be found or is not active." />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <PageHeader title={website.name || `Collection: ${website.slug}`} description="Public view of the collection website." />
      
      <Card className="w-full max-w-2xl mx-auto mt-6">
        <CardHeader>
          <CardTitle>{website.name || 'Unnamed Collection Website'}</CardTitle>
          <CardDescription>Slug: {website.slug}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Status:</h3>
              <Badge variant={website.is_active ? 'default' : 'outline'} className={website.is_active ? 'bg-green-500 text-white' : ''}>
                {website.is_active ? <CheckCircle className="mr-2 h-4 w-4" /> : null}
                {website.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div>
              <h3 className="font-semibold">Prices Visible:</h3>
              <p>{website.show_prices ? 'Yes' : 'No'}</p>
            </div>
            {website.password_hash && (
              <div>
                <h3 className="font-semibold">Password Protected:</h3>
                <p>Yes</p>
              </div>
            )}
            <div className="mt-6 p-4 border rounded-md bg-muted text-muted-foreground">
              <p className="text-center">Artwork display for this collection website is not yet implemented.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
