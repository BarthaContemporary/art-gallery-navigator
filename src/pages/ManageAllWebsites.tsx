import React, { useState } from 'react';
import { useFetchAllCollectionWebsites, useDeleteCollectionWebsite } from "@/hooks/collection-websites";
import { PageHeader } from "@/components/layout/PageHeader";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CollectionWebsiteWithCollectionName } from '@/types/collection-website';

export default function ManageAllWebsites() {
  const { data: websites, isLoading, error, refetch } = useFetchAllCollectionWebsites();
  const navigate = useNavigate();
  const { mutate: deleteWebsiteMutation, isPending: isDeletingWebsite } = useDeleteCollectionWebsite();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [websiteToDelete, setWebsiteToDelete] = useState<CollectionWebsiteWithCollectionName | null>(null);

  const handleViewWebsite = (slug: string) => {
    const websiteUrl = `/view-collection/${slug}`;
    window.open(websiteUrl, "_blank");
  };

  const handleEditWebsite = (websiteId: string) => {
    navigate(`/manage-websites/${websiteId}/edit`);
  };

  const openDeleteDialog = (website: CollectionWebsiteWithCollectionName) => {
    setWebsiteToDelete(website);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteWebsite = () => {
    if (!websiteToDelete) return;

    deleteWebsiteMutation({ id: websiteToDelete.id, collection_id: websiteToDelete.collection_id }, {
      onSuccess: () => {
        toast.success(`Website "${websiteToDelete.name || websiteToDelete.slug}" deleted successfully.`);
        setIsDeleteDialogOpen(false);
        setWebsiteToDelete(null);
        refetch();
      },
      onError: (err) => {
        toast.error(`Failed to delete website: ${err.message}`);
        setIsDeleteDialogOpen(false);
        setWebsiteToDelete(null);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Manage All Collection Websites" description="View and manage all shareable websites created for your collections."/>
        <p>Loading websites...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Manage All Collection Websites" description="View and manage all shareable websites created for your collections."/>
        <p className="text-red-500">Error fetching websites: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="Manage All Collection Websites" description="View and manage all shareable websites created for your collections." />
      
      {websites && websites.length > 0 ? (
        <div className="mt-6 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Website Name/Slug</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {websites.map((website) => (
                <TableRow key={website.id}>
                  <TableCell className="font-medium">{website.name || website.slug}</TableCell>
                  <TableCell>
                    {website.collection ? (
                      <Link to={`/collections?open=${website.collection_id}`} className="hover:underline">
                        {website.collection.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={website.is_active ? "default" : "outline"} className={website.is_active ? "bg-green-500 text-white" : ""}>
                      {website.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(website.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleViewWebsite(website.slug)} title="View Website">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEditWebsite(website.id)} title="Edit Website">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(website)} className="text-destructive hover:text-destructive/90" title="Delete Website">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="mt-6 text-muted-foreground">No collection websites found.</p>
      )}

      {websiteToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the website 
                "{websiteToDelete.name || websiteToDelete.slug}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingWebsite}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteWebsite} 
                disabled={isDeletingWebsite}
                className="bg-destructive hover:bg-destructive/80 text-destructive-foreground"
              >
                {isDeletingWebsite ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
