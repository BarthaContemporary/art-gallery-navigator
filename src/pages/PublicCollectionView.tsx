
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFetchPublicCollectionWebsite } from '@/hooks/collection-websites';
import { useFetchCollectionById } from '@/hooks/collections';
import { useFetchArtworksByCollectionId } from '@/hooks/artworks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Loader2, Info } from 'lucide-react';
import { PasswordProtectView } from '@/components/public-collection/PasswordProtectView';
import { ArtworkCard } from '@/components/artworks/ArtworkCard'; // Import ArtworkCard

export default function PublicCollectionView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: website, isLoading: isWebsiteLoading, error: websiteError } = useFetchPublicCollectionWebsite(slug);
  
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Fetch collection details once website data is available
  const { data: collection, isLoading: isCollectionLoading, error: collectionError } = useFetchCollectionById(website?.collection_id);

  // Fetch artworks once website data is available
  const { data: artworks, isLoading: isArtworksLoading, error: artworksError } = useFetchArtworksByCollectionId(website?.collection_id);

  useEffect(() => {
    if (website && slug) {
      const storedVerification = sessionStorage.getItem(`pwd_verified_${slug}`);
      if (storedVerification === 'true') {
        setIsPasswordVerified(true);
      }
    }
    setSessionChecked(true);
  }, [website, slug]);

  const handlePasswordVerified = () => {
    setIsPasswordVerified(true);
    if (slug) {
      sessionStorage.setItem(`pwd_verified_${slug}`, 'true');
    }
  };

  if (isWebsiteLoading || !sessionChecked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading website...</p>
      </div>
    );
  }

  if (websiteError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <PageHeader title="Error" description={`Failed to load website: ${websiteError.message}`} />
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

  if (website.password_hash && !isPasswordVerified) {
    return <PasswordProtectView websiteSlug={website.slug} onVerified={handlePasswordVerified} />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <PageHeader 
        title={website.name || `Collection: ${website.slug}`} 
        description={collection ? `Part of: ${collection.name}` : "Public view of the collection."}
      />
      
      <Card className="w-full max-w-4xl mx-auto mt-6">
        <CardHeader>
          <CardTitle>{website.name || 'Unnamed Collection Website'}</CardTitle>
          {isCollectionLoading && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading collection details...</p>}
          {collectionError && <p className="text-sm text-red-500">Error loading collection: {collectionError.message}</p>}
          {collection && <CardDescription>Collection: {collection.name}</CardDescription>}
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
            
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4">Artworks</h2>
              {isArtworksLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <p className="text-muted-foreground">Loading artworks...</p>
                </div>
              )}
              {artworksError && (
                <div className="p-4 border rounded-md bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5 inline mr-2" />
                  Failed to load artworks: {artworksError.message}
                </div>
              )}
              {!isArtworksLoading && !artworksError && artworks && artworks.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                  {artworks.map(artwork => (
                    <ArtworkCard key={artwork.id} artwork={artwork} />
                  ))}
                </div>
              )}
              {!isArtworksLoading && !artworksError && (!artworks || artworks.length === 0) && (
                 <div className="mt-6 p-4 border rounded-md bg-muted text-muted-foreground">
                   <Info className="h-5 w-5 inline mr-2" />
                   <p className="inline">No artworks found in this collection or they could not be loaded.</p>
                 </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
