
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
  // Enhanced path normalization for Mac Finder compatibility
  let normalizedPath = decodeURIComponent(path.replace('/functions/v1/webdav', '') || '/');
  
  // Handle various Mac Finder path variations
  if (normalizedPath === '/webdav/' || normalizedPath === '/webdav' || normalizedPath === '') {
    normalizedPath = '/';
  }
  
  // Clean up path - remove double slashes, trailing slashes (except root)
  normalizedPath = normalizedPath.replace(/\/+/g, '/');
  if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  
  // Ensure starts with /
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }
  
  return normalizedPath;
}

export function parseWebDAVPath(path: string): { 
  isRoot: boolean; 
  folderName?: string; 
  fileName?: string; 
  isSystemFile?: boolean;
} {
  const normalizedPath = normalizePath(path);
  
  // Handle root directory
  if (normalizedPath === '/' || normalizedPath === '') {
    return { isRoot: true };
  }
  
  // Split path and clean
  const pathParts = normalizedPath.split('/').filter(p => p).map(p => decodeURIComponent(p));
  
  if (pathParts.length === 0) {
    return { isRoot: true };
  }
  
  // Check for system files that Mac Finder creates
  const lastPart = pathParts[pathParts.length - 1];
  const isSystemFile = lastPart.startsWith('._') || 
                      lastPart === '.DS_Store' || 
                      lastPart.startsWith('.') ||
                      lastPart === 'desktop.ini' ||
                      lastPart === 'Thumbs.db';
  
  if (pathParts.length === 1) {
    return { 
      isRoot: false, 
      folderName: pathParts[0],
      isSystemFile: isSystemFile && !pathParts[0].includes('.')
    };
  } else {
    return { 
      isRoot: false, 
      folderName: pathParts[0], 
      fileName: lastPart,
      isSystemFile
    };
  }
}

export function generateETag(id: string, modified: string | Date): string {
  const timestamp = typeof modified === 'string' ? modified : modified.toISOString();
  return `"${id}-${Date.parse(timestamp)}"`;
}

export function formatDateForWebDAV(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toUTCString();
}

export function createWebDAVXmlResponse(content: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>\n${content}`;
}

export function createMacCompatibleHref(folderName?: string, fileName?: string): string {
  const baseUrl = '/functions/v1/webdav';
  
  if (!folderName) {
    return `${baseUrl}/`;
  }
  
  if (!fileName) {
    return `${baseUrl}/${encodeURIComponent(folderName)}/`;
  }
  
  return `${baseUrl}/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`;
}
