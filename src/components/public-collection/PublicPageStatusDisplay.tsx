
import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface PublicPageStatusDisplayProps {
  logoSrc: string;
  status: 'loading' | 'websiteError' | 'websiteNotFound';
  errorMessage?: string;
}

export function PublicPageStatusDisplay({ logoSrc, status, errorMessage }: PublicPageStatusDisplayProps) {
  const commonDivClass = "flex flex-col items-center justify-center min-h-screen p-4";
  const commonImgClass = "mb-8 h-auto";
  const commonImgStyle = { maxWidth: '250px' };

  if (status === 'loading') {
    return (
      <div className={commonDivClass}>
        <img src={logoSrc} alt="Gallery Logo" className={commonImgClass} style={commonImgStyle} />
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading website...</p>
      </div>
    );
  }

  if (status === 'websiteError') {
    return (
      <div className={commonDivClass}>
        <img src={logoSrc} alt="Gallery Logo" className={commonImgClass} style={commonImgStyle} />
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <PageHeader title="Error" description={`Failed to load website: ${errorMessage}`} />
      </div>
    );
  }

  if (status === 'websiteNotFound') {
    return (
      <div className={commonDivClass}>
        <img src={logoSrc} alt="Gallery Logo" className={commonImgClass} style={commonImgStyle} />
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <PageHeader title="Not Found" description="The requested collection website could not be found or is not active." />
      </div>
    );
  }

  return null;
}
