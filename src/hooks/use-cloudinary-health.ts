/**
 * Phase 3: Cloudinary Health Monitor Hook
 * 
 * Monitors Cloudinary service health and automatically adjusts image resolution strategy.
 */

import { useState, useEffect, useCallback } from "react";
import { CloudinaryImageService } from "@/services/cloudinary-image-service";
import { logger } from "@/lib/logger";

interface CloudinaryHealthStatus {
  isConfigured: boolean;
  isHealthy: boolean;
  responseTime: number | null;
  lastChecked: Date | null;
  errorCount: number;
  consecutiveErrors: number;
}

interface UseCloudinaryHealthReturn {
  health: CloudinaryHealthStatus;
  checkHealth: () => Promise<void>;
  shouldUseCloudinary: boolean;
  reportError: () => void;
  reportSuccess: () => void;
}

const MAX_CONSECUTIVE_ERRORS = 3;
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

export function useCloudinaryHealth(): UseCloudinaryHealthReturn {
  const [health, setHealth] = useState<CloudinaryHealthStatus>({
    isConfigured: CloudinaryImageService.isCloudinaryConfigured(),
    isHealthy: true,
    responseTime: null,
    lastChecked: null,
    errorCount: 0,
    consecutiveErrors: 0
  });

  const checkHealth = useCallback(async () => {
    if (!health.isConfigured) {
      return;
    }

    try {
      const startTime = performance.now();
      
      // Test with a simple Cloudinary fetch URL
      const testUrl = CloudinaryImageService.getOptimizedUrl(
        '/placeholder.svg',
        'thumbnail'
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const isHealthy = response.ok && responseTime < 3000; // Consider healthy if < 3s

      setHealth(prev => ({
        ...prev,
        isHealthy,
        responseTime,
        lastChecked: new Date(),
        consecutiveErrors: isHealthy ? 0 : prev.consecutiveErrors + 1
      }));

      if (isHealthy) {
        logger.debug('Cloudinary health check passed', { responseTime });
      } else {
        logger.warn('Cloudinary health check failed', { 
          status: response.status,
          responseTime 
        });
      }

    } catch (error) {
      logger.warn('Cloudinary health check error:', error);
      
      setHealth(prev => ({
        ...prev,
        isHealthy: false,
        responseTime: null,
        lastChecked: new Date(),
        consecutiveErrors: prev.consecutiveErrors + 1,
        errorCount: prev.errorCount + 1
      }));
    }
  }, [health.isConfigured]);

  const reportError = useCallback(() => {
    setHealth(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1,
      consecutiveErrors: prev.consecutiveErrors + 1,
      isHealthy: prev.consecutiveErrors + 1 < MAX_CONSECUTIVE_ERRORS
    }));
  }, []);

  const reportSuccess = useCallback(() => {
    setHealth(prev => ({
      ...prev,
      consecutiveErrors: 0,
      isHealthy: true
    }));
  }, []);

  // Periodic health checks
  useEffect(() => {
    if (!health.isConfigured) return;

    // Initial health check
    checkHealth();

    // Set up periodic checks
    const intervalId = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [health.isConfigured, checkHealth]);

  // Determine if we should use Cloudinary
  const shouldUseCloudinary = health.isConfigured && 
                              health.isHealthy && 
                              health.consecutiveErrors < MAX_CONSECUTIVE_ERRORS;

  return {
    health,
    checkHealth,
    shouldUseCloudinary,
    reportError,
    reportSuccess
  };
}