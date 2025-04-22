
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  artworks_count: number;
  artists_count: number;
  locations_count: number;
  recent_activities: Array<{
    type: 'artwork' | 'artist' | 'location';
    title: string;
    timestamp: string;
    color: 'blue' | 'green' | 'purple';
  }>;
  inventory_statuses: Record<string, number>;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      // Fetch total counts
      const [artworksResult, artistsResult, locationsResult] = await Promise.all([
        supabase.from('artworks').select('*', { count: 'exact', head: true }),
        supabase.from('artists').select('*', { count: 'exact', head: true }),
        supabase.from('locations').select('*', { count: 'exact', head: true })
      ]);

      // Fetch recent activities (latest updates across tables)
      const { data: recentArtworks } = await supabase
        .from('artworks')
        .select('title, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      // Fetch inventory statuses (excluding sold, as per the old logic)
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
        recent_activities,
        inventory_statuses: statuses,
      };
    }
  });
}
