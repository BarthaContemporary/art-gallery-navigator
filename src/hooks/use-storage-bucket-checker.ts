
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export function useStorageBucketChecker() {
  useEffect(() => {
    const checkBuckets = async () => {
      try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        
        if (error) {
          logger.error('[StorageBucketChecker] Error listing buckets:', error);
          return;
        }

        const bucketNames = buckets?.map(b => b.name) || [];
        logger.log('[StorageBucketChecker] Available buckets:', bucketNames);

        // Check for required buckets
        const requiredBuckets = ['artwork-images-original', 'artwork-images-processed'];
        const missingBuckets = requiredBuckets.filter(name => !bucketNames.includes(name));

        if (missingBuckets.length > 0) {
          logger.warn('[StorageBucketChecker] Missing buckets:', missingBuckets);
        } else {
          logger.log('[StorageBucketChecker] All required buckets are available');
        }

        // Test public access to processed bucket
        if (bucketNames.includes('artwork-images-processed')) {
          try {
            const { data } = supabase.storage
              .from('artwork-images-processed')
              .getPublicUrl('test-path');
            
            if (data?.publicUrl) {
              logger.log('[StorageBucketChecker] Processed bucket public URL generation works');
            }
          } catch (error) {
            logger.error('[StorageBucketChecker] Issue with processed bucket public URL:', error);
          }
        }

      } catch (error) {
        logger.error('[StorageBucketChecker] Unexpected error:', error);
      }
    };

    checkBuckets();
  }, []);
}
