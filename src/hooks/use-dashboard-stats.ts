
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

interface DashboardStats {
  artworks_count: number;
  artists_count: number;
  locations_count: number;
  projects_count: number;
  collections_count: number;
  pending_deletions_count: number;
  new_uploads_count: number;
  // CRM data (admin only)
  total_clients_count?: number;
  active_clients_count?: number;
  prospects_count?: number;
  customers_count?: number;
  leads_count?: number;
  recent_client_activities?: Array<{
    type: 'client';
    name: string;
    status: string;
    timestamp: string;
    color: 'blue' | 'green' | 'yellow' | 'purple';
  }>;
  recent_activities: Array<{
    type: 'artwork' | 'artist' | 'location' | 'client';
    title: string;
    timestamp: string;
    color: 'blue' | 'green' | 'purple' | 'yellow';
  }>;
  inventory_statuses: Record<string, number>;
}

export function useDashboardStats() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['dashboard-stats', { isAdmin }],
    queryFn: async (): Promise<DashboardStats> => {
      // Fetch total counts for all users
      const [artworksResult, artistsResult, locationsResult, projectsResult, collectionsResult] = await Promise.all([
        supabase.from('artworks').select('*', { count: 'exact', head: true }),
        supabase.from('artists').select('*', { count: 'exact', head: true }),
        supabase.from('locations').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('collections').select('*', { count: 'exact', head: true })
      ]);

      // Fetch admin-only data conditionally
      let pendingDeletionsCount = 0;
      let newUploadsCount = 0;
      let totalClientsCount = 0;
      let activeClientsCount = 0;
      let prospectsCount = 0;
      let customersCount = 0;
      let leadsCount = 0;
      let recentClientActivities: Array<{
        type: 'client';
        name: string;
        status: string;
        timestamp: string;
        color: 'blue' | 'green' | 'yellow' | 'purple';
      }> = [];

      if (isAdmin) {
        const [deletionsResult, uploadsResult, clientsResult, recentClientsResult] = await Promise.all([
          supabase
            .from('deletion_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('uploads')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()), // Last 7 days
          supabase.from('clients').select('status'),
          supabase
            .from('clients')
            .select('full_name, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5)
        ]);

        pendingDeletionsCount = deletionsResult.count || 0;
        newUploadsCount = uploadsResult.count || 0;
        
        // Calculate client statistics
        const clients = clientsResult.data || [];
        totalClientsCount = clients.length;
        activeClientsCount = clients.filter(c => c.status === 'active').length;
        prospectsCount = clients.filter(c => c.status === 'prospect').length;
        customersCount = clients.filter(c => c.status === 'customer').length;
        leadsCount = clients.filter(c => c.status === 'lead').length;

        // Format recent client activities
        recentClientActivities = (recentClientsResult.data || []).map(client => ({
          type: 'client' as const,
          name: client.full_name,
          status: client.status,
          timestamp: new Date(client.created_at).toISOString(),
          color: getStatusColor(client.status),
        }));
      }

      // Fetch recent activities (latest updates across tables)
      const { data: recentArtworks } = await supabase
        .from('artworks')
        .select('title, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      // Fetch inventory statuses
      const { data: inventoryStatus } = await supabase
        .from('artworks')
        .select('status')
        .not('status', 'eq', 'sold');

      // Tally count for each distinct artwork status
      const statuses: Record<string, number> = {};
      if (Array.isArray(inventoryStatus)) {
        for (const item of inventoryStatus) {
          const status = item.status ?? 'unknown';
          statuses[status] = (statuses[status] || 0) + 1;
        }
      }

      // Format recent activities (combine artwork and client activities for admins)
      const artworkActivities = (recentArtworks || []).map(artwork => ({
        type: 'artwork' as const,
        title: artwork.title,
        timestamp: new Date(artwork.created_at).toISOString(),
        color: 'blue' as const,
      }));

      const recent_activities = isAdmin 
        ? [...artworkActivities, ...recentClientActivities].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          ).slice(0, 5)
        : artworkActivities;

      const stats: DashboardStats = {
        artworks_count: artworksResult.count || 0,
        artists_count: artistsResult.count || 0,
        locations_count: locationsResult.count || 0,
        projects_count: projectsResult.count || 0,
        collections_count: collectionsResult.count || 0,
        pending_deletions_count: pendingDeletionsCount,
        new_uploads_count: newUploadsCount,
        recent_activities,
        inventory_statuses: statuses,
      };

      // Add CRM data for admins
      if (isAdmin) {
        stats.total_clients_count = totalClientsCount;
        stats.active_clients_count = activeClientsCount;
        stats.prospects_count = prospectsCount;
        stats.customers_count = customersCount;
        stats.leads_count = leadsCount;
        stats.recent_client_activities = recentClientActivities;
      }

      return stats;
    },
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true
  });
}

function getStatusColor(status: string): 'blue' | 'green' | 'yellow' | 'purple' {
  switch (status) {
    case 'customer':
      return 'green';
    case 'prospect':
      return 'yellow';
    case 'lead':
      return 'purple';
    default:
      return 'blue';
  }
}
