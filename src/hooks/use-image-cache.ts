
import { useState, useEffect } from "react";

const CACHE_PREFIX = "art_img_cache_";
const CACHE_VERSION = "v1.1"; // Updating version to invalidate old low-res cache
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
      if (cachedImage.version !== CACHE_VERSION) return null;
      if (Date.now() - cachedImage.timestamp > CACHE_MAX_AGE) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return cachedImage;
    } catch (error) {
      console.error("Error retrieving image from cache:", error);
      return null;
    }
  };

  // Set a cached image
  const setCachedImage = (imageUrl: string, dataUrl: string) => {
    if (!isLocalStorageAvailable) return;

    try {
      // Only cache if it's a reasonable size (under 150KB) - increased from 100KB
      if (dataUrl.length > 150000) return;

      const cacheKey = `${CACHE_PREFIX}${btoa(imageUrl)}`;
      const cachedImage: CachedImage = {
        dataUrl,
        timestamp: Date.now(),
        version: CACHE_VERSION
      };

      localStorage.setItem(cacheKey, JSON.stringify(cachedImage));
    } catch (error) {
      console.error("Error caching image:", error);
    }
  };

  // Clear all cached images
  const clearImageCache = () => {
    if (!isLocalStorageAvailable) return;

    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("Error clearing image cache:", error);
    }
  };

  return { getCachedImage, setCachedImage, clearImageCache };
}
