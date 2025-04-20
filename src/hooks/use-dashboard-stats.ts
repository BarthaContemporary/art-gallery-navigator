
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
  inventory_status: {
    available: number;
    on_hold: number;
    in_transit: number;
  };
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

      // Fetch inventory status
      const { data: inventoryStatus } = await supabase
        .from('artworks')
        .select('status')
        .not('status', 'eq', 'sold');

      // Calculate inventory stats
      const available = inventoryStatus?.filter(item => item.status === 'available').length || 0;
      const on_hold = inventoryStatus?.filter(item => item.status === 'on hold').length || 0;
      const in_transit = inventoryStatus?.filter(item => item.status === 'in transit').length || 0;

      // Format recent activities
      const recent_activities = (recentArtworks || []).map(artwork => ({
        type: 'artwork' as const,
        title: artwork.title,
        timestamp: new Date(artwork.created_at).toISOString(),
        color: 'blue' as const
      }));

      return {
        artworks_count: artworksResult.count || 0,
        artists_count: artistsResult.count || 0,
        locations_count: locationsResult.count || 0,
        recent_activities,
        inventory_status: {
          available,
          on_hold,
          in_transit
        }
      };
    }
  });
}
