/**
 * Phase 3: Enhanced Cloudinary URL Resolution with Health Monitoring
 * 
 * Provides intelligent URL resolution with automatic fallbacks and health monitoring.
 */

import { logger } from "@/lib/logger";
import { CloudinaryUrlOptimizer } from "./url-optimizer";
import { CloudinaryStorageUtils } from "./storage-utils";
import { CloudinaryBestUrlResolver } from "./best-url-resolver";
import type { ImageTier } from "./types";

interface UrlResolutionResult {
  url: string;
  source: 'supabase' | 'cloudinary' | 'optimized-cloudinary' | 'fallback' | 'placeholder';
  tier: ImageTier;
  confidence: number; // 0-1 score indicating quality/reliability
  processingStatus?: 'ready' | 'processing' | 'failed';
}

interface HealthMetrics {
  cloudinaryAvailable: boolean;
  lastHealthCheck: Date | null;
  errorRate: number;
  avgResponseTime: number;
  consecutiveErrors: number;
}

export class EnhancedCloudinaryResolver {
  private static healthMetrics: HealthMetrics = {
    cloudinaryAvailable: true,
    lastHealthCheck: null,
    errorRate: 0,
    avgResponseTime: 0,
    consecutiveErrors: 0
  };

  private static cache = new Map<string, { result: UrlResolutionResult; timestamp: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_CONSECUTIVE_ERRORS = 3;

  /**
   * Get the best available image URL with comprehensive health checks
   */
  static async resolveImageUrl(
    imageRecord: any,
    tier: ImageTier,
    preferCloudinary: boolean = false
  ): Promise<UrlResolutionResult> {
    const cacheKey = `${imageRecord?.id || 'unknown'}-${tier}-${preferCloudinary}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    try {
      const result = await this._resolveWithFallbacks(imageRecord, tier, preferCloudinary);
      
      // Cache successful results
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      
      // Update health metrics on success
      if (result.source.includes('cloudinary')) {
        this.updateHealthMetrics(true);
      }
      
      return result;
    } catch (error) {
      logger.error('Enhanced URL resolution failed:', error);
      
      // Update health metrics on error
      this.updateHealthMetrics(false);
      
      // Return placeholder as last resort
      return {
        url: '/placeholder.svg',
        source: 'placeholder',
        tier,
        confidence: 0,
        processingStatus: 'failed'
      };
    }
  }

  private static async _resolveWithFallbacks(
    imageRecord: any,
    tier: ImageTier,
    preferCloudinary: boolean
  ): Promise<UrlResolutionResult> {
    if (!imageRecord) {
      return this.createPlaceholderResult(tier);
    }

    // Strategy 1: Try Supabase storage URLs first (most reliable)
    if (!preferCloudinary) {
      const supabaseResult = await this.trySupabaseUrls(imageRecord, tier);
      if (supabaseResult.confidence > 0.8) {
        return supabaseResult;
      }
    }

    // Strategy 2: Try Cloudinary if healthy and configured
    if (this.shouldUseCloudinary()) {
      const cloudinaryResult = await this.tryCloudinaryUrls(imageRecord, tier);
      if (cloudinaryResult.confidence > 0.7) {
        return cloudinaryResult;
      }
    }

    // Strategy 3: Fallback to original URLs
    const fallbackResult = await this.tryFallbackUrls(imageRecord, tier);
    if (fallbackResult.confidence > 0.5) {
      return fallbackResult;
    }

    // Strategy 4: Last resort - placeholder
    return this.createPlaceholderResult(tier);
  }

  private static async trySupabaseUrls(
    imageRecord: any,
    tier: ImageTier
  ): Promise<UrlResolutionResult> {
    try {
      // Try processed storage URLs first
      const optimizedUrl = CloudinaryStorageUtils.getOptimizedStorageUrl(imageRecord, tier);
      if (optimizedUrl && optimizedUrl !== '/placeholder.svg') {
        const isAccessible = await this.verifyUrlAccessibility(optimizedUrl);
        if (isAccessible) {
          return {
            url: optimizedUrl,
            source: 'supabase',
            tier,
            confidence: 0.95,
            processingStatus: 'ready'
          };
        }
      }

      // Try original storage path
      if (imageRecord.original_storage_path) {
        const originalUrl = CloudinaryStorageUtils.getSupabaseStorageUrl(
          imageRecord.original_storage_path,
          'artwork-images-original'
        );
        if (originalUrl && originalUrl !== '/placeholder.svg') {
          const isAccessible = await this.verifyUrlAccessibility(originalUrl);
          if (isAccessible) {
            return {
              url: originalUrl,
              source: 'supabase',
              tier: 'full', // Original is always full quality
              confidence: 0.85,
              processingStatus: 'ready'
            };
          }
        }
      }
    } catch (error) {
      logger.debug('Supabase URL resolution failed:', error);
    }

    return { url: '', source: 'placeholder', tier, confidence: 0 };
  }

  private static async tryCloudinaryUrls(
    imageRecord: any,
    tier: ImageTier
  ): Promise<UrlResolutionResult> {
    try {
      if (!CloudinaryUrlOptimizer.isCloudinaryConfigured()) {
        return { url: '', source: 'placeholder', tier, confidence: 0 };
      }

      // Try existing processed Cloudinary URLs
      const existingUrl = CloudinaryBestUrlResolver.getBestAvailableUrl(imageRecord, tier);
      if (existingUrl && existingUrl !== '/placeholder.svg' && !existingUrl.includes('processing')) {
        const isAccessible = await this.verifyUrlAccessibility(existingUrl);
        if (isAccessible) {
          return {
            url: existingUrl,
            source: 'cloudinary',
            tier,
            confidence: 0.9,
            processingStatus: 'ready'
          };
        }
      }

      // Try optimizing original URL through Cloudinary
      if (imageRecord.image_url && 
          imageRecord.image_url !== 'processing' && 
          imageRecord.image_url !== '/placeholder.svg') {
        const optimizedUrl = CloudinaryUrlOptimizer.getOptimizedUrl(imageRecord.image_url, tier);
        if (optimizedUrl && !optimizedUrl.includes('processing')) {
          const isAccessible = await this.verifyUrlAccessibility(optimizedUrl);
          if (isAccessible) {
            return {
              url: optimizedUrl,
              source: 'optimized-cloudinary',
              tier,
              confidence: 0.8,
              processingStatus: 'ready'
            };
          }
        }
      }
    } catch (error) {
      logger.debug('Cloudinary URL resolution failed:', error);
      this.updateHealthMetrics(false);
    }

    return { url: '', source: 'placeholder', tier, confidence: 0 };
  }

  private static async tryFallbackUrls(
    imageRecord: any,
    tier: ImageTier
  ): Promise<UrlResolutionResult> {
    try {
      // Try original image URL if valid
      if (imageRecord.image_url && 
          imageRecord.image_url !== 'processing' && 
          imageRecord.image_url !== '/placeholder.svg') {
        const isAccessible = await this.verifyUrlAccessibility(imageRecord.image_url);
        if (isAccessible) {
          return {
            url: imageRecord.image_url,
            source: 'fallback',
            tier: 'full', // Original is full quality
            confidence: 0.6,
            processingStatus: 'ready'
          };
        }
      }
    } catch (error) {
      logger.debug('Fallback URL resolution failed:', error);
    }

    return { url: '', source: 'placeholder', tier, confidence: 0 };
  }

  private static createPlaceholderResult(tier: ImageTier): UrlResolutionResult {
    return {
      url: '/placeholder.svg',
      source: 'placeholder',
      tier,
      confidence: 0,
      processingStatus: 'failed'
    };
  }

  private static async verifyUrlAccessibility(url: string): Promise<boolean> {
    try {
      if (url === '/placeholder.svg') return true;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const startTime = performance.now();
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;

      // Update response time metrics
      this.healthMetrics.avgResponseTime = 
        (this.healthMetrics.avgResponseTime + responseTime) / 2;

      return response.ok;
    } catch (error) {
      logger.debug(`URL accessibility check failed for ${url}:`, error);
      return false;
    }
  }

  private static shouldUseCloudinary(): boolean {
    return CloudinaryUrlOptimizer.isCloudinaryConfigured() &&
           this.healthMetrics.cloudinaryAvailable &&
           this.healthMetrics.consecutiveErrors < this.MAX_CONSECUTIVE_ERRORS;
  }

  private static updateHealthMetrics(success: boolean): void {
    if (success) {
      this.healthMetrics.consecutiveErrors = 0;
      this.healthMetrics.cloudinaryAvailable = true;
    } else {
      this.healthMetrics.consecutiveErrors++;
      if (this.healthMetrics.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
        this.healthMetrics.cloudinaryAvailable = false;
      }
    }
    
    this.healthMetrics.lastHealthCheck = new Date();
    
    // Calculate error rate (simplified)
    this.healthMetrics.errorRate = success ? 
      Math.max(0, this.healthMetrics.errorRate - 0.1) : 
      Math.min(1, this.healthMetrics.errorRate + 0.1);
  }

  /**
   * Get current health status
   */
  static getHealthStatus(): HealthMetrics {
    return { ...this.healthMetrics };
  }

  /**
   * Clear URL cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Preload image for better performance
   */
  static async preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  }
}