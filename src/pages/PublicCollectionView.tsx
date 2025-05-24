import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFetchPublicCollectionWebsite } from '@/hooks/collection-websites';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { PasswordProtectView } from '@/components/public-collection/PasswordProtectView';

export default function PublicCollectionView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: website, isLoading, error } = useFetchPublicCollectionWebsite(slug);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (website && slug) {
      // Check session storage for verification status for this specific slug
      const storedVerification = sessionStorage.getItem(`pwd_verified_${slug}`);
      if (storedVerification === 'true') {
        setIsPasswordVerified(true);
      }
    }
    setSessionChecked(true); // Mark that we've checked session storage
  }, [website, slug]);

  const handlePasswordVerified = () => {
    setIsPasswordVerified(true);
    if (slug) {
      sessionStorage.setItem(`pwd_verified_${slug}`, 'true');
    }
  };

  if (isLoading || !sessionChecked) {
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

  // If website has a password hash and it's not yet verified, show password prompt
  if (website.password_hash && !isPasswordVerified) {
    return <PasswordProtectView websiteSlug={website.slug} onVerified={handlePasswordVerified} />;
  }

  // Otherwise, show the website content
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
            {/* We don't need to show "Password Protected: Yes" if they've already entered it */}
            <div className="mt-6 p-4 border rounded-md bg-muted text-muted-foreground">
              <p className="text-center">Artwork display for this collection website is not yet implemented.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
