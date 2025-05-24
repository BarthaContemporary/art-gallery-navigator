
import { useFetchAllCollectionWebsites } from "@/hooks/collection-websites";
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
import { Link } from "react-router-dom";

export default function ManageAllWebsites() {
  const { data: websites, isLoading, error } = useFetchAllCollectionWebsites();

  const handleViewWebsite = (slug: string) => {
    // This would ideally open the public-facing website.
    // For now, it can be a placeholder or link to a future preview page.
    const websiteUrl = `/view-collection/${slug}`; // This route doesn't exist yet
    // window.open(websiteUrl, "_blank"); 
    toast.info(`Viewing website with slug: ${slug}. Public URL not yet implemented.`);
  };

  const handleEditWebsite = (websiteId: string) => {
    toast.info(`Editing website ID: ${websiteId}. Edit functionality not yet implemented.`);
    // Navigation to an edit page would go here, e.g., /manage-websites/${websiteId}/edit
  };

  const handleDeleteWebsite = (websiteId: string) => {
    toast.info(`Deleting website ID: ${websiteId}. Delete functionality not yet implemented.`);
    // Confirmation and call to delete mutation would go here.
  };


  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Manage All Collection Websites" />
        <p>Loading websites...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Manage All Collection Websites" />
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
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteWebsite(website.id)} className="text-destructive hover:text-destructive/90" title="Delete Website">
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
    </div>
  );
}
