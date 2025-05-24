
export interface PageOptions {
  header?: string;
  footer?: string;
  pageNumber?: number;
  totalPages?: number;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter' | 'legal';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface MultiPagePDFOptions {
  fileName: string;
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  defaultMargins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  onProgress?: (message: string, percentage?: number) => void;
}
