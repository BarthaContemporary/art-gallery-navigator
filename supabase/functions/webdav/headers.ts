
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
  'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH',
  // Critical Mac Finder headers
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Accept-Encoding, User-Agent',
  'Accept-Ranges': 'bytes',
  // Additional Mac compatibility headers
  'X-WebDAV-Server': 'Supabase-DAV',
  'X-Mac-Finder-Compatible': 'true',
  'X-WebDAV-Version': '2.0'
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
    'X-Mac-Finder-Compatible': 'true',
    'Accept-Ranges': 'bytes',
    'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH'
  };
}

export function getAuthenticationChallengeHeaders() {
  return {
    ...getWebDAVResponseHeaders(),
    ...getMacFinderHeaders(),
    'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': '0'
  };
}
