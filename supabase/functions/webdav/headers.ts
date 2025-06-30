
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite, if, lock-token, timeout, translate, range, content-length, user-agent, accept, accept-encoding, accept-language, cache-control, connection, host, pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH, HEAD',
  'Access-Control-Expose-Headers': 'dav, ms-author-via, etag, last-modified, content-length, content-type, location, lock-token, timeout',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

// Enhanced WebDAV headers for maximum Mac Finder compatibility
const webdavHeaders = {
  'DAV': '1, 2, 3, extend, access-control',
  'MS-Author-Via': 'DAV',
  'Server': 'Supabase-WebDAV/2.0',
  'Allow': 'OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH, HEAD',
  // Mac Finder specific headers
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Accept-Encoding, User-Agent',
  'Accept-Ranges': 'bytes',
  // Additional Mac compatibility headers
  'X-WebDAV-Server': 'Supabase',
  'X-Mac-Compatible': 'true'
};

export function getWebDAVResponseHeaders(additionalHeaders = {}) {
  return {
    ...corsHeaders,
    ...webdavHeaders,
    ...additionalHeaders
  };
}

export function getMacFinderHeaders() {
  return {
    'DAV': '1, 2, 3, extend, access-control',
    'MS-Author-Via': 'DAV',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Mac-Finder': 'compatible',
    'Accept-Ranges': 'bytes'
  };
}
