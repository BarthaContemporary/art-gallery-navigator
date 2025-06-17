
import { useState, useEffect } from "react";

const CACHE_PREFIX = "art_img_cache_";
const CACHE_VERSION = "v2.2"; // Updated version for better cache management
const CACHE_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
const MAX_CACHE_ITEM_SIZE_MB = 5; // Reduced from 25MB to 5MB per item
const MAX_CACHE_ITEM_SIZE = MAX_CACHE_ITEM_SIZE_MB * 1024 * 1024;
const MAX_TOTAL_CACHE_SIZE_MB = 50; // Reduced from 200MB to 50MB total
const MAX_TOTAL_CACHE_SIZE = MAX_TOTAL_CACHE_SIZE_MB * 1024 * 1024;

export type CachedImage = {
  dataUrl: string;
  timestamp: number;
  version: string;
  tier: 'thumbnail' | 'medium' | 'full';
  size: number;
};

export function useImageCache() {
  const isLocalStorageAvailable = typeof window !== "undefined" && window.localStorage;

  // Get cache usage statistics
  const getCacheStats = () => {
    if (!isLocalStorageAvailable) return { totalSize: 0, itemCount: 0 };
    
    let totalSize = 0;
    let itemCount = 0;
    
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          const item = localStorage.getItem(key);
          if (item) {
            totalSize += item.length;
            itemCount++;
          }
        }
      });
    } catch (error) {
      console.error("Error calculating cache stats:", error);
    }
    
    return { totalSize, itemCount };
  };

  // Enhanced cache cleanup with better logging
  const performCacheCleanup = () => {
    if (!isLocalStorageAvailable) return;
    
    try {
      const cacheItems: Array<{ key: string; timestamp: number; size: number; tier: string }> = [];
      let removedOldVersions = 0;
      
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          const item = localStorage.getItem(key);
          if (item) {
            try {
              const cachedImage = JSON.parse(item) as CachedImage;
              // Remove old version items immediately
              if (cachedImage.version !== CACHE_VERSION) {
                localStorage.removeItem(key);
                removedOldVersions++;
                return;
              }
              cacheItems.push({
                key,
                timestamp: cachedImage.timestamp,
                size: item.length,
                tier: cachedImage.tier
              });
            } catch (e) {
              // Remove corrupted items
              localStorage.removeItem(key);
            }
          }
        }
      });
      
      console.log(`Cache cleanup: Removed ${removedOldVersions} old version items`);
      
      // Sort by timestamp (oldest first) and tier priority (full images first to remove)
      cacheItems.sort((a, b) => {
        if (a.tier === 'full' && b.tier !== 'full') return -1;
        if (b.tier === 'full' && a.tier !== 'full') return 1;
        return a.timestamp - b.timestamp;
      });
      
      // Remove items until we're under 60% of the total cache limit
      const targetSize = MAX_TOTAL_CACHE_SIZE * 0.6;
      let currentSize = cacheItems.reduce((sum, item) => sum + item.size, 0);
      let removedItems = 0;
      
      for (const item of cacheItems) {
        if (currentSize <= targetSize) break;
        localStorage.removeItem(item.key);
        currentSize -= item.size;
        removedItems++;
      }
      
      console.log(`Cache cleanup completed. Removed ${removedItems} cache items. Total size: ${Math.round(currentSize / 1024 / 1024)}MB`);
    } catch (error) {
      console.error("Error during cache cleanup:", error);
      // If cleanup fails, clear all cache to prevent further issues
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(CACHE_PREFIX)) {
            localStorage.removeItem(key);
          }
        });
        console.log("Emergency cache clear completed");
      } catch (clearError) {
        console.error("Failed to clear cache:", clearError);
      }
    }
  };

  // Get a cached image with enhanced error handling
  const getCachedImage = (imageUrl: string, tier?: 'thumbnail' | 'medium' | 'full'): CachedImage | null => {
    if (!isLocalStorageAvailable) return null;

    try {
      const cacheKey = `${CACHE_PREFIX}${btoa(imageUrl)}${tier ? `_${tier}` : ''}`;
      const cachedItem = localStorage.getItem(cacheKey);

      if (!cachedItem) return null;

      const cachedImage = JSON.parse(cachedItem) as CachedImage;

      // Validate cache version and age
      if (cachedImage.version !== CACHE_VERSION) {
        localStorage.removeItem(cacheKey);
        console.log(`Removed outdated cache item: ${cacheKey}`);
        return null;
      }
      if (Date.now() - cachedImage.timestamp > CACHE_MAX_AGE) {
        localStorage.removeItem(cacheKey);
        console.log(`Removed expired cache item: ${cacheKey}`);
        return null;
      }

      // Update timestamp for LRU (but don't save to avoid quota issues)
      cachedImage.timestamp = Date.now();

      return cachedImage;
    } catch (error) {
      console.error("Error retrieving image from cache:", error);
      try {
        const cacheKey = `${CACHE_PREFIX}${btoa(imageUrl)}${tier ? `_${tier}` : ''}`;
        localStorage.removeItem(cacheKey);
      } catch (removeError) {
        // ignore error during cleanup
      }
      return null;
    }
  };

  // Set a cached image with enhanced size management and logging
  const setCachedImage = (imageUrl: string, dataUrl: string, tier: 'thumbnail' | 'medium' | 'full' = 'thumbnail') => {
    if (!isLocalStorageAvailable) return;

    try {
      // Skip caching very large images
      if (dataUrl.length > MAX_CACHE_ITEM_SIZE) {
        console.warn(`Image too large to cache (${Math.round(dataUrl.length / 1024 / 1024)}MB > ${MAX_CACHE_ITEM_SIZE_MB}MB): ${imageUrl}`);
        return;
      }

      // Check if we need to do cleanup before adding
      const { totalSize } = getCacheStats();
      const newItemSize = JSON.stringify({
        dataUrl,
        timestamp: Date.now(),
        version: CACHE_VERSION,
        tier,
        size: dataUrl.length
      }).length;
      
      if (totalSize + newItemSize > MAX_TOTAL_CACHE_SIZE * 0.8) {
        console.log("Cache approaching limit, performing cleanup...");
        performCacheCleanup();
      }

      const cacheKey = `${CACHE_PREFIX}${btoa(imageUrl)}_${tier}`;
      const cachedImage: CachedImage = {
        dataUrl,
        timestamp: Date.now(),
        version: CACHE_VERSION,
        tier,
        size: dataUrl.length
      };

      localStorage.setItem(cacheKey, JSON.stringify(cachedImage));
      console.log(`Cached ${tier} image: ${imageUrl.substring(0, 50)}... (${Math.round(newItemSize / 1024)}KB)`);
    } catch (error) {
      console.error("Error caching image:", error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn("LocalStorage quota exceeded. Performing aggressive cleanup...");
        performCacheCleanup();
        // Don't retry - just skip caching this image
      }
    }
  };

  // Clear all cached images
  const clearImageCache = () => {
    if (!isLocalStorageAvailable) return;

    try {
      let clearedCount = 0;
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
          clearedCount++;
        }
      });
      console.log(`Cleared ${clearedCount} items from image cache.`);
    } catch (error) {
      console.error("Error clearing image cache:", error);
    }
  };

  return { 
    getCachedImage, 
    setCachedImage, 
    clearImageCache, 
    getCacheStats,
    performCacheCleanup
  };
}
