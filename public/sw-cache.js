// Enhanced service worker for image caching
const CACHE_NAME = 'art-gallery-images-v3';
const IMAGE_CACHE_NAME = 'art-gallery-images-dynamic-v3';
const MAX_CACHE_SIZE = 100; // Maximum number of cached images
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// URLs that should be cached
const CACHE_URLS = [
  '/',
  '/placeholder.svg'
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => 
              cacheName !== CACHE_NAME && 
              cacheName !== IMAGE_CACHE_NAME
            )
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle image requests with caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle image requests
  if (request.destination === 'image' || 
      url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
      url.hostname.includes('cloudinary.com') ||
      url.hostname.includes('supabase.co')) {
    
    event.respondWith(handleImageRequest(request));
  }
});

async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Return cached response if available and not expired
  if (cachedResponse) {
    const cachedDate = cachedResponse.headers.get('sw-cached-date');
    if (cachedDate && (Date.now() - parseInt(cachedDate)) < MAX_AGE) {
      return cachedResponse;
    }
  }
  
  try {
    // Fetch from network
    const response = await fetch(request);
    
    // Only cache successful responses
    if (response.ok) {
      // Clone response for caching
      const responseToCache = response.clone();
      
      // Add cache timestamp
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-date', Date.now().toString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      // Cache the response
      await cacheWithSizeLimit(cache, request, cachedResponse);
    }
    
    return response;
  } catch (error) {
    // Return cached response if network fails
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return placeholder if available
    const placeholderCache = await caches.open(CACHE_NAME);
    const placeholder = await placeholderCache.match('/placeholder.svg');
    if (placeholder) {
      return placeholder;
    }
    
    throw error;
  }
}

async function cacheWithSizeLimit(cache, request, response) {
  try {
    // Get current cache keys
    const keys = await cache.keys();
    
    // Remove oldest entries if cache is full
    if (keys.length >= MAX_CACHE_SIZE) {
      // Sort by cache date (oldest first)
      const keyDates = await Promise.all(
        keys.map(async (key) => {
          const cachedResponse = await cache.match(key);
          const cachedDate = cachedResponse?.headers.get('sw-cached-date');
          return {
            key,
            date: cachedDate ? parseInt(cachedDate) : 0
          };
        })
      );
      
      keyDates.sort((a, b) => a.date - b.date);
      
      // Remove oldest entries
      const toRemove = keyDates.slice(0, keys.length - MAX_CACHE_SIZE + 1);
      await Promise.all(toRemove.map(({ key }) => cache.delete(key)));
    }
    
    // Cache the new response
    await cache.put(request, response);
  } catch (error) {
    console.error('Error caching image:', error);
  }
}

// Background sync for cache cleanup
self.addEventListener('sync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupExpiredCache());
  }
});

async function cleanupExpiredCache() {
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const keys = await cache.keys();
    
    for (const key of keys) {
      const cachedResponse = await cache.match(key);
      const cachedDate = cachedResponse?.headers.get('sw-cached-date');
      
      if (cachedDate && (Date.now() - parseInt(cachedDate)) > MAX_AGE) {
        await cache.delete(key);
      }
    }
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
}