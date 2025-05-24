
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetchCollectionWebsiteById, useUpdateCollectionWebsite } from '@/hooks/collection-websites';
import { EditCollectionWebsiteForm } from '@/components/collection-websites/EditCollectionWebsiteForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { UpdateCollectionWebsitePayload } from '@/types/collection-website';

export default function EditCollectionWebsite() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();
  
  const { data: website, isLoading, error: fetchError } = useFetchCollectionWebsiteById(websiteId);
  const { mutate: updateWebsite, isPending: isUpdating } = useUpdateCollectionWebsite();

  const handleSubmit = (data: UpdateCollectionWebsitePayload) => {
    updateWebsite(data, {
      onSuccess: (updatedWebsite) => {
        toast.success(`Website "${updatedWebsite.name || updatedWebsite.slug}" updated successfully.`);
        navigate('/manage-websites');
      },
      onError: (err) => {
        toast.error(`Failed to update website: ${err.message}`);
      },
    });
  };

  const handleCancel = () => {
    navigate('/manage-websites');
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto my-4" />
        <p>Loading website details...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto text-center">
         <AlertTriangle className="h-8 w-8 text-destructive mx-auto my-4" />
        <PageHeader title="Error" description={`Failed to load website details: ${fetchError.message}`} />
        <Button onClick={() => navigate('/manage-websites')} variant="outline">Back to Websites</Button>
      </div>
    );
  }

  if (!website) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto text-center">
        <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto my-4" />
        <PageHeader title="Not Found" description="The website you are trying to edit could not be found." />
        <Button onClick={() => navigate('/manage-websites')} variant="outline">Back to Websites</Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader 
        title={`Edit Website: ${website.name || website.slug}`}
        description="Modify the details of your collection website."
      />
      <EditCollectionWebsiteForm 
        website={website} 
        onSubmit={handleSubmit} 
        isPending={isUpdating}
        onCancel={handleCancel}
      />
    </div>
  );
}
