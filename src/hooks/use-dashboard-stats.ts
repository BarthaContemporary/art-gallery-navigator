
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
  recent_activities: Array<{
    type: 'artwork' | 'artist' | 'location';
    title: string;
    timestamp: string;
    color: 'blue' | 'green' | 'purple';
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

      if (isAdmin) {
        const [deletionsResult, uploadsResult] = await Promise.all([
          supabase
            .from('deletion_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('uploads')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        ]);

        pendingDeletionsCount = deletionsResult.count || 0;
        newUploadsCount = uploadsResult.count || 0;
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

      // Format recent activities
      const recent_activities = (recentArtworks || []).map(artwork => ({
        type: 'artwork' as const,
        title: artwork.title,
        timestamp: new Date(artwork.created_at).toISOString(),
        color: 'blue' as const,
      }));

      return {
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
    },
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true
  });
}
