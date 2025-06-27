
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite, if, lock-token, timeout, translate, range, content-length, user-agent, accept, accept-encoding, accept-language, cache-control, connection, host, pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH, HEAD',
  'Access-Control-Expose-Headers': 'dav, ms-author-via, etag, last-modified, content-length, content-type, location, lock-token, timeout',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

const webdavHeaders = {
  'DAV': '1, 2, 3, extend, access-control',
  'MS-Author-Via': 'DAV',
  'Server': 'Supabase-WebDAV/1.0',
  'Allow': 'OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH, HEAD'
};

export function getWebDAVResponseHeaders(additionalHeaders = {}) {
  return {
    ...corsHeaders,
    ...webdavHeaders,
    ...additionalHeaders
  };
}
