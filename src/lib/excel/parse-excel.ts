import * as XLSX from 'xlsx';

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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with header row - use unknown first for proper type handling
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: null,
          raw: false // Convert everything to strings for easier handling
        }) as unknown as (string | number | null)[][];
        
        if (jsonData.length === 0) {
          resolve({
            headers: [],
            rows: [],
            sheetNames: workbook.SheetNames,
            totalRows: 0
          });
          return;
        }
        
        // First row is headers
        const headers = (jsonData[0] as (string | number | null)[])
          .map(h => String(h || '').trim())
          .filter(h => h !== '');
        
        // Convert remaining rows to objects
        const rows: ExcelRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const rowData = jsonData[i] as (string | number | null)[];
          if (!rowData || rowData.every(cell => cell === null || cell === '')) continue;
          
          const row: ExcelRow = {};
          headers.forEach((header, index) => {
            row[header] = rowData[index] ?? null;
          });
          rows.push(row);
        }
        
        resolve({
          headers,
          rows,
          sheetNames: workbook.SheetNames,
          totalRows: rows.length
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
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
