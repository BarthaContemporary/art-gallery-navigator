import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useFetchPublicCollectionWebsite } from '@/hooks/collection-websites';
import { useFetchCollectionById } from '@/hooks/collections';
import { useFetchArtworksByCollectionId, type PublicArtwork } from '@/hooks/artworks/useFetchArtworksByCollectionId';
import { PasswordProtectView } from '@/components/public-collection/PasswordProtectView';
import { PublicArtworkDialog } from '@/components/artworks/public/PublicArtworkDialog';
import { PublicPageStatusDisplay } from '@/components/public-collection/PublicPageStatusDisplay';
import { PublicCollectionHeaderDisplay } from '@/components/public-collection/PublicCollectionHeaderDisplay';
import { ArtworksSection } from '@/components/public-collection/ArtworksSection';

const LOGO_SRC = "https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg";
const INITIAL_ARTWORKS_COUNT = 12;
const ARTWORKS_INCREMENT = 12;

export default function PublicCollectionView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: website, isLoading: isWebsiteLoading, error: websiteError } = useFetchPublicCollectionWebsite(slug);
  
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState<PublicArtwork | null>(null);
  const [isArtworkDialogOpen, setIsArtworkDialogOpen] = useState(false);
  const [displayedArtworksCount, setDisplayedArtworksCount] = useState(INITIAL_ARTWORKS_COUNT);

  const collectionId = website?.collection_id;
  const { data: collection, isLoading: isCollectionLoading, error: collectionError } = useFetchCollectionById(collectionId);
  const { data: allArtworks, isLoading: isArtworksLoading, error: artworksError } = useFetchArtworksByCollectionId(collectionId);

  useEffect(() => {
    if (!isWebsiteLoading && website) {
      console.log("[PublicCollectionView] Fetched website data:", website);
      console.log("[PublicCollectionView] Website collection_id:", website.collection_id);
    }
    if (collectionId && !isCollectionLoading && collection) {
      console.log("[PublicCollectionView] Fetched collection data:", collection);
    }
    if (collectionId && !isArtworksLoading && allArtworks) {
      console.log("[PublicCollectionView] Artworks data from hook:", allArtworks);
      allArtworks.forEach(artwork => {
        if (artwork.artwork_images && artwork.artwork_images.length > 0) {
          console.log(`[PublicCollectionView] Artwork "${artwork.title}" images:`, 
            artwork.artwork_images.map(img => ({
              id: img.id,
              url: img.image_url,
              isCloudinary: img.image_url?.includes('res.cloudinary.com'),
              thumbnail_url: img.thumbnail_url, 
              medium_url: img.medium_url,       
            }))
          );
        }
      });
    }
  }, [website, isWebsiteLoading, collection, isCollectionLoading, allArtworks, isArtworksLoading, collectionId]);

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

  const handleArtworkClick = (artwork: PublicArtwork) => {
    console.log(`[PublicCollectionView] Artwork clicked: ${artwork.id}`);
    setSelectedArtwork(artwork);
    setIsArtworkDialogOpen(true);
  };

  const handleLoadMoreArtworks = useCallback(() => {
    setDisplayedArtworksCount(prevCount => prevCount + ARTWORKS_INCREMENT);
  }, []);

  if (isWebsiteLoading || !sessionChecked) {
    return <PublicPageStatusDisplay logoSrc={LOGO_SRC} status="loading" />;
  }

  if (websiteError) {
    return <PublicPageStatusDisplay logoSrc={LOGO_SRC} status="websiteError" errorMessage={websiteError.message} />;
  }

  if (!website) {
    return <PublicPageStatusDisplay logoSrc={LOGO_SRC} status="websiteNotFound" />;
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
  
  const visibleArtworks = allArtworks?.slice(0, displayedArtworksCount);
  const hasMoreArtworks = !!allArtworks && displayedArtworksCount < allArtworks.length;

  return (
    <>
      <div className="container mx-auto p-4 sm:p-6">
        <PublicCollectionHeaderDisplay
          logoSrc={LOGO_SRC}
          website={website}
          pageHeaderDescription={pageHeaderDescription}
        />
        
        <ArtworksSection
          collectionId={website.collection_id}
          artworks={visibleArtworks}
          isArtworksLoading={isArtworksLoading}
          artworksError={artworksError}
          showPrices={website.show_prices}
          onArtworkClick={handleArtworkClick}
          onLoadMore={handleLoadMoreArtworks}
          hasMoreArtworks={hasMoreArtworks}
        />
      </div>

      <PublicArtworkDialog
        artwork={selectedArtwork}
        open={isArtworkDialogOpen}
        onOpenChange={setIsArtworkDialogOpen}
        showPrices={website.show_prices}
      />
    </>
  );
}
