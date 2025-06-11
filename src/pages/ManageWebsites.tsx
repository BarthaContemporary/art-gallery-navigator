
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Globe, Eye, EyeOff, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFetchAllCollectionWebsites } from "@/hooks/collection-websites";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function ManageWebsites() {
  const navigate = useNavigate();
  const { data: websites, isLoading, error, refetch } = useFetchAllCollectionWebsites();

  const handleToggleActive = async (websiteId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('collection_websites')
        .update({ is_active: !currentStatus })
        .eq('id', websiteId);

      if (error) throw error;
      
      toast.success(`Website ${!currentStatus ? 'activated' : 'deactivated'}`);
      refetch();
    } catch (error) {
      console.error('Error toggling website status:', error);
      toast.error('Failed to update website status');
    }
  };

  const handleDeleteWebsite = async (websiteId: string) => {
    if (!confirm('Are you sure you want to delete this website? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('collection_websites')
        .delete()
        .eq('id', websiteId);

      if (error) throw error;
      
      toast.success('Website deleted successfully');
      refetch();
    } catch (error) {
      console.error('Error deleting website:', error);
      toast.error('Failed to delete website');
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="text-center">Loading websites...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="text-center text-red-500">Failed to load websites</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/collections")}
          className="mb-4 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Collections
        </Button>
        
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Manage All Websites</h1>
        </div>
        <p className="text-muted-foreground">
          Manage all collection websites across the platform
        </p>
      </div>

      {!websites || websites.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No websites found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {websites.map((website) => (
            <Card key={website.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {website.name || 'Unnamed Website'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Collection: {website.collection?.name || 'Unknown Collection'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Slug: {website.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={website.is_active ? "default" : "secondary"}>
                      {website.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant={website.password_hash ? "outline" : "secondary"}>
                      {website.password_hash ? "Protected" : "Public"}
                    </Badge>
                    <Badge variant={website.show_prices ? "outline" : "secondary"}>
                      {website.show_prices ? "Prices Shown" : "Prices Hidden"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(website.id, website.is_active)}
                  >
                    {website.is_active ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Activate
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/collections/${website.collection_id}/websites/${website.id}/edit`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteWebsite(website.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
