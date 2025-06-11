
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFetchPublicCollectionWebsite } from '@/hooks/collection-websites';
import { useFetchCollectionById } from '@/hooks/collections';
import { useFetchArtworksByCollectionId } from '@/hooks/artworks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle as ShadcnAlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Info } from 'lucide-react';
import { PasswordProtectView } from '@/components/public-collection/PasswordProtectView';
import { OptimizedArtworkImage } from '@/components/artworks/OptimizedArtworkImage';

const LOGO_SRC = "https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg";

export default function PublicCollectionView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: website, isLoading: isWebsiteLoading, error: websiteError } = useFetchPublicCollectionWebsite(slug);
  
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const collectionId = website?.collection_id;
  const { data: collection, isLoading: isCollectionLoading, error: collectionError } = useFetchCollectionById(collectionId);
  const { data: artworks, isLoading: isArtworksLoading, error: artworksError } = useFetchArtworksByCollectionId(collectionId);

  useEffect(() => {
    if (!isWebsiteLoading && website) {
      console.log("[PublicCollectionView] Fetched website data:", website);
      console.log("[PublicCollectionView] Website collection_id:", website.collection_id);
    }
    if (collectionId && !isCollectionLoading && collection) {
      console.log("[PublicCollectionView] Fetched collection data:", collection);
    }
    if (collectionId && !isArtworksLoading && artworks) {
      console.log("[PublicCollectionView] Artworks data from hook:", artworks);
      // Log image URLs to verify Cloudinary usage
      artworks.forEach(artwork => {
        if (artwork.artwork_images && artwork.artwork_images.length > 0) {
          console.log(`[PublicCollectionView] Artwork "${artwork.title}" images:`, 
            artwork.artwork_images.map(img => ({
              id: img.id,
              url: img.image_url,
              isCloudinary: img.image_url?.includes('res.cloudinary.com')
            }))
          );
        }
      });
    }
  }, [website, isWebsiteLoading, collection, isCollectionLoading, artworks, isArtworksLoading, collectionId]);

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

  const handleArtworkClick = (artworkId: string) => {
    // For public view, we can just log the click or implement a simple modal
    console.log(`[PublicCollectionView] Artwork clicked: ${artworkId}`);
  };

  if (isWebsiteLoading || !sessionChecked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <img src={LOGO_SRC} alt="Gallery Logo" className="mb-8 h-auto" style={{ maxWidth: '250px' }} />
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading website...</p>
      </div>
    );
  }

  if (websiteError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <img src={LOGO_SRC} alt="Gallery Logo" className="mb-8 h-auto" style={{ maxWidth: '250px' }} />
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <PageHeader title="Error" description={`Failed to load website: ${websiteError.message}`} />
      </div>
    );
  }

  if (!website) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <img src={LOGO_SRC} alt="Gallery Logo" className="mb-8 h-auto" style={{ maxWidth: '250px' }} />
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <PageHeader title="Not Found" description="The requested collection website could not be found or is not active." />
      </div>
    );
  }

  if (website.password_hash && !isPasswordVerified) {
    return (
      <div className="flex flex-col items-center justify-start min-h-screen p-4 pt-10">
        <img src={LOGO_SRC} alt="Gallery Logo" className="mb-8 h-auto" style={{ maxWidth: '250px' }} />
        <PasswordProtectView websiteSlug={website.slug} onVerified={handlePasswordVerified} />
      </div>
    );
  }
  
  let pageHeaderDescription = "This website is not currently associated with a specific collection.";
  if (website.collection_id) {
    if (isCollectionLoading) {
      pageHeaderDescription = "Loading collection information...";
    } else if (collectionError) {
      pageHeaderDescription = `Error loading collection: ${collectionError.message}`;
    } else if (collection) {
      pageHeaderDescription = `${collection.name}${collection.description ? `: ${collection.description}` : ''}`;
    } else {
      pageHeaderDescription = "Attached collection details are currently unavailable.";
    }
  }

  // Debug logs before rendering the artworks section
  console.log('[PublicCollectionView Debug] State before rendering artworks section:');
  console.log('[PublicCollectionView Debug] Slug:', slug);
  console.log('[PublicCollectionView Debug] Website data:', website);
  console.log('[PublicCollectionView Debug] Collection ID from website:', website?.collection_id);
  console.log('[PublicCollectionView Debug] Derived collectionId variable:', collectionId);
  console.log('[PublicCollectionView Debug] Collection data:', collection);
  console.log('[PublicCollectionView Debug] Is Collection Loading:', isCollectionLoading);
  console.log('[PublicCollectionView Debug] Collection Error:', collectionError);
  console.log('[PublicCollectionView Debug] Artworks data:', artworks);
  console.log('[PublicCollectionView Debug] Is Artworks Loading:', isArtworksLoading);
  console.log('[PublicCollectionView Debug] Artworks Error:', artworksError);

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex justify-start mb-6 sm:mb-8">
        <img 
          src={LOGO_SRC} 
          alt="Gallery Logo" 
          className="h-auto"
          style={{ maxWidth: '250px' }}
        />
      </div>

      <PageHeader 
        title={website.name || `Collection Website: ${website.slug}`} 
        description={pageHeaderDescription}
      />
      
      {website.collection_id && collection && !isCollectionLoading && !collectionError && (
        <div className="my-6 text-left border-t pt-6">
          {/* Content here is minimal as details are in PageHeader */}
        </div>
      )}
      
      {website.collection_id && !collection && !isCollectionLoading && !collectionError && (
        <Alert variant="default" className="my-6">
          <Info className="h-5 w-5" />
          <ShadcnAlertTitle>Collection Information</ShadcnAlertTitle>
          <AlertDescription>The associated collection details could not be loaded.</AlertDescription>
        </Alert>
      )}
      
      {website.collection_id ? (
        <div className="mt-8">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Artworks</h2>
          {isArtworksLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <p className="text-muted-foreground">Loading artworks...</p>
            </div>
          )}
          {artworksError && (
            <Alert variant="destructive" className="my-6">
              <AlertTriangle className="h-5 w-5" />
              <ShadcnAlertTitle>Error Loading Artworks</ShadcnAlertTitle>
              <AlertDescription>
                Failed to load artworks: {artworksError.message}
              </AlertDescription>
            </Alert>
          )}
          {!isArtworksLoading && !artworksError && artworks && artworks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
              {artworks.map(artwork => {
                const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
                const imageUrl = primaryImage?.image_url || "/placeholder.svg";
                
                return (
                  <div key={artwork.id} className="group cursor-pointer">
                    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
                      <OptimizedArtworkImage
                        imageUrl={imageUrl}
                        title={artwork.title || 'Untitled'}
                        onClick={() => handleArtworkClick(artwork.id)}
                      />
                      <div className="p-4">
                        <h3 className="font-medium text-lg mb-1 text-gray-900">
                          {artwork.title || 'Untitled'}
                        </h3>
                        {artwork.artist && (
                          <p className="text-sm text-gray-600 mb-2">
                            {artwork.artist.name}
                          </p>
                        )}
                        {artwork.year_created && (
                          <p className="text-sm text-gray-500">
                            {artwork.year_created}
                          </p>
                        )}
                        {artwork.medium && (
                          <p className="text-xs text-gray-400 mt-1">
                            {artwork.medium}
                          </p>
                        )}
                        {website.show_prices && artwork.price && (
                          <p className="text-sm font-medium text-gray-900 mt-2">
                            ${artwork.price.toLocaleString()}
                          </p>
                        )}
                        {/* Show Cloudinary indicator for transparency */}
                        {imageUrl.includes('res.cloudinary.com') && (
                          <div className="text-xs text-green-600 mt-1 opacity-70">
                            ✓ Cloudinary Optimized
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!isArtworksLoading && !artworksError && (!artworks || artworks.length === 0) && (
             <div className="mt-6 p-6 border rounded-md bg-muted/50 text-muted-foreground flex flex-col items-center text-center">
               <Info className="h-10 w-10 mb-3 text-primary" />
               <p className="text-lg font-medium">No Artworks to Display</p>
               <p className="text-sm">
                 { collectionId ? "This collection currently has no artworks, or they could not be loaded." : "No collection is linked to this website, so no artworks can be displayed."}
               </p>
             </div>
          )}
        </div>
      ) : (
        <div className="mt-8 text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2 text-primary" />
          <p>Artworks cannot be displayed as no collection is linked to this website.</p>
        </div>
      )}
    </div>
  );
}
