
export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function normalizePath(path: string): string {
  // Enhanced path parsing with proper URL decoding and Mac Finder compatibility
  let normalizedPath = decodeURIComponent(path.replace('/functions/v1/webdav', '') || '/');
  if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
  
  // Clean up Mac Finder specific path issues
  if (normalizedPath === '/webdav/' || normalizedPath === '/webdav') {
    normalizedPath = '/';
  }
  
  // Remove any double slashes and normalize
  normalizedPath = normalizedPath.replace(/\/+/g, '/');
  
  return normalizedPath;
}
