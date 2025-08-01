import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";

const CACHE_PREFIX = "art_img_cache_";
const CACHE_VERSION = "v3.0";
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_ITEM_SIZE = 1 * 1024 * 1024; // Reduced to 1MB per item
const MAX_TOTAL_CACHE_SIZE = 25 * 1024 * 1024; // Reduced to 25MB total
const MEMORY_CACHE_SIZE = 50; // Reduced to 50 images in memory

export type ImageTier = 'thumbnail' | 'medium' | 'full';

export interface CachedImage {
  dataUrl: string;
  timestamp: number;
  version: string;
  tier: ImageTier;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

interface MemoryCacheItem {
  dataUrl: string;
  timestamp: number;
  accessCount: number;
}

// Memory cache for frequently accessed images
const memoryCache = new Map<string, MemoryCacheItem>();

// LRU implementation for memory cache
const accessOrder = new Map<string, number>();
let accessCounter = 0;

export function useEnhancedImageCache() {
  const [cacheStats, setCacheStats] = useState({ totalSize: 0, itemCount: 0, memoryCount: 0 });
  
  const isLocalStorageAvailable = typeof window !== "undefined" && window.localStorage;

  // Enhanced image preloading with proper cache headers and retry logic
  const preloadImageWithCache = useCallback(async (src: string, retries = 3): Promise<HTMLImageElement> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.loading = 'eager';
        
        // Add cache control headers via URL parameters for supported services
        const url = new URL(src, window.location.origin);
        if (url.hostname.includes('cloudinary.com') || url.hostname.includes('supabase.co')) {
          url.searchParams.set('cache', 'max-age=604800'); // 7 days
        }
        
        return await new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url.toString();
        });
      } catch (error) {
        if (attempt === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
    throw new Error('Failed to preload image after retries');
  }, []);

  // Generate cache key with better hashing
  const generateCacheKey = useCallback((imageUrl: string, tier: ImageTier): string => {
    try {
      const hash = btoa(imageUrl).replace(/[^a-zA-Z0-9]/g, '');
      return `${CACHE_PREFIX}${hash.substring(0, 32)}_${tier}`;
    } catch {
      return `${CACHE_PREFIX}${imageUrl.substring(0, 32)}_${tier}`;
    }
  }, []);

  // Memory cache operations
  const getFromMemoryCache = useCallback((key: string): string | null => {
    const item = memoryCache.get(key);
    if (item) {
      item.accessCount++;
      accessOrder.set(key, ++accessCounter);
      return item.dataUrl;
    }
    return null;
  }, []);

  const setInMemoryCache = useCallback((key: string, dataUrl: string) => {
    // Evict oldest items if cache is full
    if (memoryCache.size >= MEMORY_CACHE_SIZE) {
      const oldestKey = Array.from(accessOrder.entries())
        .sort(([,a], [,b]) => a - b)[0][0];
      memoryCache.delete(oldestKey);
      accessOrder.delete(oldestKey);
    }

    memoryCache.set(key, {
      dataUrl,
      timestamp: Date.now(),
      accessCount: 1
    });
    accessOrder.set(key, ++accessCounter);
  }, []);

  // Get cache statistics
  const updateCacheStats = useCallback(() => {
    if (!isLocalStorageAvailable) return;
    
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
      
      setCacheStats({
        totalSize,
        itemCount,
        memoryCount: memoryCache.size
      });
    } catch (error) {
      logger.error("Error calculating cache stats:", error);
    }
  }, [isLocalStorageAvailable]);

  // Enhanced cache cleanup with LRU eviction
  const performCacheCleanup = useCallback(() => {
    if (!isLocalStorageAvailable) return;
    
    try {
      const cacheItems: Array<{ key: string; cachedImage: CachedImage; itemSize: number }> = [];
      let removedOldVersions = 0;
      
      // Collect all cache items
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          const item = localStorage.getItem(key);
          if (item) {
            try {
              const cachedImage = JSON.parse(item) as CachedImage;
              
              // Remove old version or expired items
              if (cachedImage.version !== CACHE_VERSION || 
                  Date.now() - cachedImage.timestamp > CACHE_MAX_AGE) {
                localStorage.removeItem(key);
                removedOldVersions++;
                return;
              }
              
              cacheItems.push({
                key,
                cachedImage,
                itemSize: item.length
              });
            } catch (e) {
              localStorage.removeItem(key);
            }
          }
        }
      });
      
      // Sort by access pattern (LRU with tier priority)
      cacheItems.sort((a, b) => {
        // Prioritize keeping thumbnails and medium images
        const tierPriority = { thumbnail: 3, medium: 2, full: 1 };
        const aPriority = tierPriority[a.cachedImage.tier];
        const bPriority = tierPriority[b.cachedImage.tier];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        // Then by access count and recency
        const aScore = a.cachedImage.accessCount * 0.7 + 
                      (Date.now() - a.cachedImage.lastAccessed) * -0.3;
        const bScore = b.cachedImage.accessCount * 0.7 + 
                      (Date.now() - b.cachedImage.lastAccessed) * -0.3;
        
        return bScore - aScore;
      });
      
      // Remove items until we're under 50% of the total cache limit for better memory management
      const targetSize = MAX_TOTAL_CACHE_SIZE * 0.5;
      let currentSize = cacheItems.reduce((sum, item) => sum + item.itemSize, 0);
      let removedItems = 0;
      
      for (let i = cacheItems.length - 1; i >= 0 && currentSize > targetSize; i--) {
        const item = cacheItems[i];
        localStorage.removeItem(item.key);
        currentSize -= item.itemSize;
        removedItems++;
      }
      
      logger.info(`Cache cleanup: Removed ${removedOldVersions} old versions, ${removedItems} LRU items. Size: ${Math.round(currentSize / 1024 / 1024)}MB`);
      updateCacheStats();
    } catch (error) {
      logger.error("Error during cache cleanup:", error);
    }
  }, [isLocalStorageAvailable, updateCacheStats]);

  // Get cached image with memory cache check
  const getCachedImage = useCallback((imageUrl: string, tier: ImageTier): string | null => {
    const cacheKey = generateCacheKey(imageUrl, tier);
    
    // Check memory cache first
    const memoryResult = getFromMemoryCache(cacheKey);
    if (memoryResult) {
      logger.debug(`Memory cache hit for ${tier}: ${imageUrl}`);
      return memoryResult;
    }
    
    // Check localStorage
    if (!isLocalStorageAvailable) return null;
    
    try {
      const cachedItem = localStorage.getItem(cacheKey);
      if (!cachedItem) return null;
      
      const cachedImage = JSON.parse(cachedItem) as CachedImage;
      
      // Validate cache version and age
      if (cachedImage.version !== CACHE_VERSION || 
          Date.now() - cachedImage.timestamp > CACHE_MAX_AGE) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      // Update access stats
      cachedImage.accessCount = (cachedImage.accessCount || 0) + 1;
      cachedImage.lastAccessed = Date.now();
      localStorage.setItem(cacheKey, JSON.stringify(cachedImage));
      
      // Cache in memory for next time
      setInMemoryCache(cacheKey, cachedImage.dataUrl);
      
      logger.debug(`LocalStorage cache hit for ${tier}: ${imageUrl}`);
      return cachedImage.dataUrl;
    } catch (error) {
      logger.error("Error retrieving image from cache:", error);
      return null;
    }
  }, [generateCacheKey, getFromMemoryCache, setInMemoryCache, isLocalStorageAvailable]);

  // Set cached image with size checks and memory caching
  const setCachedImage = useCallback((imageUrl: string, dataUrl: string, tier: ImageTier) => {
    const cacheKey = generateCacheKey(imageUrl, tier);
    
    // Always cache in memory
    setInMemoryCache(cacheKey, dataUrl);
    
    if (!isLocalStorageAvailable) return;
    
    try {
      // Skip caching very large images
      if (dataUrl.length > MAX_CACHE_ITEM_SIZE) {
        logger.warn(`Image too large to cache (${Math.round(dataUrl.length / 1024 / 1024)}MB): ${imageUrl}`);
        return;
      }
      
      const cachedImage: CachedImage = {
        dataUrl,
        timestamp: Date.now(),
        version: CACHE_VERSION,
        tier,
        size: dataUrl.length,
        accessCount: 1,
        lastAccessed: Date.now()
      };
      
      const itemString = JSON.stringify(cachedImage);
      
      // Check if cleanup is needed
      if (cacheStats.totalSize + itemString.length > MAX_TOTAL_CACHE_SIZE * 0.9) {
        performCacheCleanup();
      }
      
      localStorage.setItem(cacheKey, itemString);
      logger.debug(`Cached ${tier} image: ${imageUrl.substring(0, 50)}... (${Math.round(itemString.length / 1024)}KB)`);
      updateCacheStats();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        logger.warn("LocalStorage quota exceeded, performing cleanup");
        performCacheCleanup();
      } else {
        logger.error("Error caching image:", error);
      }
    }
  }, [generateCacheKey, setInMemoryCache, isLocalStorageAvailable, cacheStats.totalSize, performCacheCleanup, updateCacheStats]);

  // Preload and cache image with optimizations
  const preloadAndCache = useCallback(async (imageUrl: string, tier: ImageTier): Promise<string> => {
    try {
      const img = await preloadImageWithCache(imageUrl);
      
      // Create optimized cached version
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        const maxDimension = tier === 'thumbnail' ? 400 : tier === 'medium' ? 1200 : 2400;
        const scale = Math.min(maxDimension / Math.max(img.width, img.height), 1);
        
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        // Use high quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const quality = tier === 'thumbnail' ? 0.8 : tier === 'medium' ? 0.9 : 0.95;
        const dataUrl = canvas.toDataURL("image/webp", quality);
        
        setCachedImage(imageUrl, dataUrl, tier);
        return dataUrl;
      }
      
      return imageUrl;
    } catch (error) {
      logger.error(`Failed to preload and cache ${tier} image:`, error);
      return imageUrl;
    }
  }, [preloadImageWithCache, setCachedImage]);

  // Clear all caches
  const clearAllCaches = useCallback(() => {
    // Clear memory cache
    memoryCache.clear();
    accessOrder.clear();
    
    // Clear localStorage cache
    if (isLocalStorageAvailable) {
      try {
        let clearedCount = 0;
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(CACHE_PREFIX)) {
            localStorage.removeItem(key);
            clearedCount++;
          }
        });
        logger.info(`Cleared ${clearedCount} items from image cache`);
      } catch (error) {
        logger.error("Error clearing image cache:", error);
      }
    }
    
    updateCacheStats();
  }, [isLocalStorageAvailable, updateCacheStats]);

  // Warm up cache with frequently accessed images
  const warmUpCache = useCallback(async (imageUrls: string[], tier: ImageTier = 'thumbnail') => {
    const promises = imageUrls.map(url => preloadAndCache(url, tier));
    await Promise.allSettled(promises);
  }, [preloadAndCache]);

  // Initialize cache stats
  useEffect(() => {
    updateCacheStats();
  }, [updateCacheStats]);

  return {
    getCachedImage,
    setCachedImage,
    preloadImageWithCache,
    preloadAndCache,
    clearAllCaches,
    warmUpCache,
    performCacheCleanup,
    cacheStats
  };
}
