/**
 * Database query optimization utilities
 */

interface QueryCache {
  [key: string]: {
    data: any;
    timestamp: number;
    ttl: number;
  };
}

export class DatabaseOptimizer {
  private static cache: QueryCache = {};
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Cache query results with TTL
   */
  static cacheQuery(key: string, data: any, ttl: number = this.DEFAULT_TTL) {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    // Clean expired entries periodically
    this.cleanExpiredEntries();
  }

  /**
   * Get cached query result
   */
  static getCachedQuery(key: string): any | null {
    const cached = this.cache[key];
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      delete this.cache[key];
      return null;
    }
    
    return cached.data;
  }

  /**
   * Invalidate cache for specific pattern
   */
  static invalidateCache(pattern?: string) {
    if (!pattern) {
      this.cache = {};
      return;
    }

    Object.keys(this.cache).forEach(key => {
      if (key.includes(pattern)) {
        delete this.cache[key];
      }
    });
  }

  /**
   * Clean expired cache entries
   */
  private static cleanExpiredEntries() {
    const now = Date.now();
    Object.keys(this.cache).forEach(key => {
      const cached = this.cache[key];
      if (now - cached.timestamp > cached.ttl) {
        delete this.cache[key];
      }
    });
  }

  /**
   * Generate optimized select fields for artwork queries
   */
  static getArtworkSelectFields(): string {
    return `
      id,
      title,
      artist_id,
      year,
      medium_type,
      price,
      currency,
      status,
      width,
      height,
      depth,
      created_at,
      updated_at,
      artists!inner(full_name, surname_first_letter),
      artwork_images(
        id,
        image_url,
        is_primary,
        thumbnail_url,
        medium_url,
        processed
      )
    `.replace(/\s+/g, ' ').trim();
  }

  /**
   * Generate optimized select fields for artist queries
   */
  static getArtistSelectFields(): string {
    return `
      id,
      full_name,
      surname_first_letter,
      user_id,
      representation_status,
      image_url,
      birth_year,
      death_year
    `.replace(/\s+/g, ' ').trim();
  }

  /**
   * Batch query optimization
   */
  static optimizeBatchSize(totalItems: number, maxBatchSize: number = 100): number {
    if (totalItems <= 10) return totalItems;
    if (totalItems <= 50) return Math.min(25, maxBatchSize);
    if (totalItems <= 200) return Math.min(50, maxBatchSize);
    return Math.min(100, maxBatchSize);
  }

  /**
   * Build efficient filter query
   */
  static buildFilterQuery(filters: Record<string, any>): string {
    const conditions: string[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      if (Array.isArray(value) && value.length > 0) {
        conditions.push(`${key}.in.(${value.map(v => `"${v}"`).join(',')})`);
      } else if (typeof value === 'string') {
        conditions.push(`${key}.ilike.%${value}%`);
      } else {
        conditions.push(`${key}.eq.${value}`);
      }
    });

    return conditions.join('&');
  }

  /**
   * Get memory usage info
   */
  static getCacheInfo() {
    const entries = Object.keys(this.cache).length;
    const size = JSON.stringify(this.cache).length;
    
    return {
      entries,
      sizeBytes: size,
      sizeMB: (size / (1024 * 1024)).toFixed(2),
    };
  }
}

export default DatabaseOptimizer;