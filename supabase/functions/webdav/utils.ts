
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

export function parseWebDAVPath(path: string): { isRoot: boolean; folderName?: string; fileName?: string } {
  // Remove the WebDAV prefix and normalize
  const normalizedPath = normalizePath(path);
  
  // Handle root directory
  if (normalizedPath === '/' || normalizedPath === '') {
    return { isRoot: true };
  }
  
  // Split path and filter out empty parts
  const pathParts = normalizedPath.split('/').filter(p => p).map(p => decodeURIComponent(p));
  
  // Skip "webdav" if it appears as the first part (Mac Finder artifact)
  const cleanParts = pathParts[0] === 'webdav' ? pathParts.slice(1) : pathParts;
  
  if (cleanParts.length === 0) {
    return { isRoot: true };
  } else if (cleanParts.length === 1) {
    return { isRoot: false, folderName: cleanParts[0] };
  } else {
    return { 
      isRoot: false, 
      folderName: cleanParts[0], 
      fileName: cleanParts[cleanParts.length - 1] 
    };
  }
}
