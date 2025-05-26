
import { useState, useEffect } from "react";

const CACHE_PREFIX = "art_img_cache_";
const CACHE_VERSION = "v1.5"; // Updated version to invalidate previous caches (was v1.4)
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export type CachedImage = {
  dataUrl: string;
  timestamp: number;
  version: string;
};

export function useImageCache() {
  // Check if localStorage is available
  const isLocalStorageAvailable = typeof window !== "undefined" && window.localStorage;

  // Get a cached image
  const getCachedImage = (imageUrl: string): CachedImage | null => {
    if (!isLocalStorageAvailable) return null;

    try {
      const cacheKey = `${CACHE_PREFIX}${btoa(imageUrl)}`;
      const cachedItem = localStorage.getItem(cacheKey);

      if (!cachedItem) return null;

      const cachedImage = JSON.parse(cachedItem) as CachedImage;

      // Validate cache version and age
      if (cachedImage.version !== CACHE_VERSION) {
        localStorage.removeItem(cacheKey); // Remove outdated cache
        return null;
      }
      if (Date.now() - cachedImage.timestamp > CACHE_MAX_AGE) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return cachedImage;
    } catch (error) {
      console.error("Error retrieving image from cache:", error);
      // Potentially clear corrupted item
      try {
        const cacheKey = `${CACHE_PREFIX}${btoa(imageUrl)}`;
        localStorage.removeItem(cacheKey);
      } catch (removeError) {
        // ignore error during cleanup
      }
      return null;
    }
  };

  // Set a cached image
  const setCachedImage = (imageUrl: string, dataUrl: string) => {
    if (!isLocalStorageAvailable) return;

    try {
      // Increased max size to 4MB (4 * 1024 * 1024 bytes)
      const MAX_CACHE_ITEM_SIZE = 4 * 1024 * 1024; 
      if (dataUrl.length > MAX_CACHE_ITEM_SIZE) {
        console.warn(`Image data URL too large to cache ( > 4MB ): ${imageUrl}, size: ${dataUrl.length}`);
        return;
      }

      const cacheKey = `${CACHE_PREFIX}${btoa(imageUrl)}`;
      const cachedImage: CachedImage = {
        dataUrl,
        timestamp: Date.now(),
        version: CACHE_VERSION
      };

      localStorage.setItem(cacheKey, JSON.stringify(cachedImage));
    } catch (error) {
      console.error("Error caching image:", error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn("LocalStorage quota exceeded. Consider clearing cache or increasing limits.");
        // Potentially implement a more sophisticated cache eviction strategy here
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

  return { getCachedImage, setCachedImage, clearImageCache };
}
