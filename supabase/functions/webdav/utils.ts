
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
  
  // Handle various Mac Finder path variations and edge cases
  if (normalizedPath === '/webdav/' || normalizedPath === '/webdav' || normalizedPath === '') {
    normalizedPath = '/';
  }
  
  // Clean up path - remove double slashes, handle trailing slashes properly
  normalizedPath = normalizedPath.replace(/\/+/g, '/');
  
  // For root, keep the trailing slash, for others remove it unless it's a folder request
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
  isFolder?: boolean;
} {
  const normalizedPath = normalizePath(path);
  
  // Handle root directory
  if (normalizedPath === '/' || normalizedPath === '') {
    return { isRoot: true, isFolder: true };
  }
  
  // Split path and clean, handle URL encoding properly
  const pathParts = normalizedPath.split('/').filter(p => p).map(p => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p; // fallback if decode fails
    }
  });
  
  if (pathParts.length === 0) {
    return { isRoot: true, isFolder: true };
  }
  
  // CRITICAL FIX: Handle the webdav mount point properly
  // If the first part is "webdav", treat it as part of the mount point, not a folder
  let actualPathParts = pathParts;
  if (pathParts[0] === 'webdav') {
    actualPathParts = pathParts.slice(1);
    // If after removing 'webdav' we have no parts, it's the root
    if (actualPathParts.length === 0) {
      return { isRoot: true, isFolder: true };
    }
  }
  
  const lastPart = actualPathParts[actualPathParts.length - 1];
  
  // Enhanced system file detection
  const isSystemFile = lastPart.startsWith('._') || 
                      lastPart === '.DS_Store' || 
                      lastPart.startsWith('.') ||
                      lastPart === 'desktop.ini' ||
                      lastPart === 'Thumbs.db' ||
                      lastPart === '.localized' ||
                      lastPart === '.fseventsd';
  
  // Determine if this is likely a folder or file
  const hasFileExtension = lastPart.includes('.') && !lastPart.startsWith('.') && !isSystemFile;
  const isLikelyFolder = !hasFileExtension || isSystemFile;
  
  if (actualPathParts.length === 1) {
    // Single part after removing webdav mount point
    return { 
      isRoot: false, 
      folderName: actualPathParts[0],
      isSystemFile: isSystemFile,
      isFolder: isLikelyFolder
    };
  } else {
    // Multiple parts - first is folder, last is file
    return { 
      isRoot: false, 
      folderName: actualPathParts[0], 
      fileName: lastPart,
      isSystemFile: isSystemFile,
      isFolder: false
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

// Enhanced folder name matching for case-insensitive and encoding-aware comparison
export function matchesFolderName(pathName: string, dbFolderName: string): boolean {
  // Direct match
  if (pathName === dbFolderName) return true;
  
  // Case-insensitive match
  if (pathName.toLowerCase() === dbFolderName.toLowerCase()) return true;
  
  // Try URL decoding variations
  try {
    const decodedPath = decodeURIComponent(pathName);
    if (decodedPath === dbFolderName || decodedPath.toLowerCase() === dbFolderName.toLowerCase()) {
      return true;
    }
  } catch {
    // Ignore decode errors
  }
  
  // Handle apostrophe variations (smart quotes, etc.)
  const normalizedPath = pathName.replace(/[''"]/g, "'");
  const normalizedDb = dbFolderName.replace(/[''"]/g, "'");
  
  return normalizedPath.toLowerCase() === normalizedDb.toLowerCase();
}
