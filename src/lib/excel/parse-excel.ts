import readXlsxFile from 'read-excel-file';

export interface ExcelRow {
  [key: string]: string | number | null;
}

export interface ExcelParseResult {
  headers: string[];
  rows: ExcelRow[];
  sheetNames: string[];
  totalRows: number;
}

export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  try {
    const jsonData = await readXlsxFile(file);

    if (jsonData.length === 0) {
      return {
        headers: [],
        rows: [],
        sheetNames: ['Sheet1'],
        totalRows: 0
      };
    }

    // First row is headers
    const headers = jsonData[0]
      .map(h => String(h ?? '').trim())
      .filter(h => h !== '');

    // Convert remaining rows to objects
    const rows: ExcelRow[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const rowData = jsonData[i];
      if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === '')) continue;

      const row: ExcelRow = {};
      headers.forEach((header, index) => {
        const val = rowData[index];
        row[header] = val != null ? (typeof val === 'object' ? String(val) : val as string | number) : null;
      });
      rows.push(row);
    }

    return {
      headers,
      rows,
      sheetNames: ['Sheet1'],
      totalRows: rows.length
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error('Failed to parse Excel file');
  }
}

export function findImageUrlColumn(headers: string[]): string | null {
  const imageKeywords = ['image', 'url', 'photo', 'picture', 'img', 'link', 'src'];
  
  // Exact match first
  for (const header of headers) {
    const lower = header.toLowerCase();
    if (lower === 'image_url' || lower === 'imageurl' || lower === 'image url') {
      return header;
    }
  }
  
  // Partial match
  for (const header of headers) {
    const lower = header.toLowerCase();
    if (imageKeywords.some(kw => lower.includes(kw))) {
      return header;
    }
  }
  
  return null;
}

export function findTitleColumn(headers: string[]): string | null {
  const titleKeywords = ['title', 'name', 'artwork', 'work'];
  
  for (const header of headers) {
    const lower = header.toLowerCase();
    if (lower === 'title' || lower === 'artwork title' || lower === 'work title') {
      return header;
    }
  }
  
  for (const header of headers) {
    const lower = header.toLowerCase();
    if (titleKeywords.some(kw => lower.includes(kw))) {
      return header;
    }
  }
  
  return null;
}

export function findArtistColumn(headers: string[]): string | null {
  const artistKeywords = ['artist', 'creator', 'author', 'by'];
  
  for (const header of headers) {
    const lower = header.toLowerCase();
    if (lower === 'artist' || lower === 'artist name') {
      return header;
    }
  }
  
  for (const header of headers) {
    const lower = header.toLowerCase();
    if (artistKeywords.some(kw => lower.includes(kw))) {
      return header;
    }
  }
  
  return null;
}

export function findYearColumn(headers: string[]): string | null {
  const yearKeywords = ['year', 'date', 'created'];
  
  for (const header of headers) {
    const lower = header.toLowerCase();
    if (lower === 'year' || lower === 'creation year') {
      return header;
    }
  }
  
  for (const header of headers) {
    const lower = header.toLowerCase();
    if (yearKeywords.some(kw => lower.includes(kw))) {
      return header;
    }
  }
  
  return null;
}

export function isValidImageUrl(url: string | null | number): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  
  // Check for common image URL patterns
  return (
    trimmed.startsWith('http://') || 
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//') ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(trimmed)
  );
}
