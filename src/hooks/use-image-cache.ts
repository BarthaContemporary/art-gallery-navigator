
import { useState, useEffect } from "react";

const CACHE_PREFIX = "art_img_cache_";
const CACHE_VERSION = "v2.0"; // Updated version for enhanced caching
const CACHE_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
const MAX_CACHE_ITEM_SIZE_MB = 25; // Increased for higher quality images
const MAX_CACHE_ITEM_SIZE = MAX_CACHE_ITEM_SIZE_MB * 1024 * 1024;
const MAX_TOTAL_CACHE_SIZE_MB = 200; // Total cache limit
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

  // LRU cache eviction
  const evictOldestItems = (requiredSpace: number) => {
    if (!isLocalStorageAvailable) return;
    
    try {
      const cacheItems: Array<{ key: string; timestamp: number; size: number }> = [];
      
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          const item = localStorage.getItem(key);
          if (item) {
            try {
              const cachedImage = JSON.parse(item) as CachedImage;
              cacheItems.push({
                key,
                timestamp: cachedImage.timestamp,
                size: item.length
              });
            } catch (e) {
              // Remove corrupted items
              localStorage.removeItem(key);
            }
          }
        }
      });
      
      // Sort by timestamp (oldest first)
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);
      
      let freedSpace = 0;
      for (const item of cacheItems) {
        if (freedSpace >= requiredSpace) break;
        localStorage.removeItem(item.key);
        freedSpace += item.size;
      }
      
      console.log(`Evicted ${freedSpace} bytes from image cache`);
    } catch (error) {
      console.error("Error during cache eviction:", error);
    }
  };

  // Get a cached image
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
        return null;
      }
      if (Date.now() - cachedImage.timestamp > CACHE_MAX_AGE) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Update timestamp for LRU
      cachedImage.timestamp = Date.now();
      localStorage.setItem(cacheKey, JSON.stringify(cachedImage));

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

  // Set a cached image with enhanced storage
  const setCachedImage = (imageUrl: string, dataUrl: string, tier: 'thumbnail' | 'medium' | 'full' = 'thumbnail') => {
    if (!isLocalStorageAvailable) return;

    try {
      if (dataUrl.length > MAX_CACHE_ITEM_SIZE) {
        console.warn(`Image data URL too large to cache (${Math.round(dataUrl.length / 1024 / 1024)}MB > ${MAX_CACHE_ITEM_SIZE_MB}MB): ${imageUrl}`);
        return;
      }

      const cacheKey = `${CACHE_PREFIX}${btoa(imageUrl)}_${tier}`;
      const cachedImage: CachedImage = {
        dataUrl,
        timestamp: Date.now(),
        version: CACHE_VERSION,
        tier,
        size: dataUrl.length
      };

      // Check total cache size and evict if necessary
      const { totalSize } = getCacheStats();
      const newItemSize = JSON.stringify(cachedImage).length;
      
      if (totalSize + newItemSize > MAX_TOTAL_CACHE_SIZE) {
        evictOldestItems(newItemSize + (MAX_TOTAL_CACHE_SIZE * 0.1)); // Free 10% extra space
      }

      localStorage.setItem(cacheKey, JSON.stringify(cachedImage));
      console.log(`Cached ${tier} image: ${imageUrl} (${Math.round(newItemSize / 1024)}KB)`);
    } catch (error) {
      console.error("Error caching image:", error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn("LocalStorage quota exceeded. Attempting cache cleanup...");
        evictOldestItems(JSON.stringify({ dataUrl, timestamp: Date.now(), version: CACHE_VERSION, tier, size: dataUrl.length }).length);
        // Retry once after cleanup
        try {
          const cacheKey = `${CACHE_PREFIX}${btoa(imageUrl)}_${tier}`;
          const cachedImage: CachedImage = { dataUrl, timestamp: Date.now(), version: CACHE_VERSION, tier, size: dataUrl.length };
          localStorage.setItem(cacheKey, JSON.stringify(cachedImage));
        } catch (retryError) {
          console.error("Failed to cache image even after cleanup:", retryError);
        }
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
    getCacheStats 
  };
}
