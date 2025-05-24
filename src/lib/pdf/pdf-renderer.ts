
import html2canvas from "html2canvas";
import { PageOptions, MultiPagePDFOptions } from "./pdf-types";

interface RenderPageToImageParams {
  html: string;
  pageOptions?: PageOptions;
  pageDimensions: { width: string; height: string }; // e.g., "210mm"
  pdfBaseOptions: Pick<MultiPagePDFOptions, 'pageSize' | 'orientation' | 'defaultMargins'>;
}

/**
 * Waits for all resources (images, fonts) to load within a container
 */
async function waitForResources(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  
  const imagePromises = images.map((img) => {
    if (img.complete && img.naturalHeight !== 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => {
        console.warn(`Failed to load image: ${img.src ? img.src.substring(0, 50) + '...' : 'unknown src'}`);
        resolve(); // Resolve anyway
      };
      img.crossOrigin = "Anonymous"; // Ensure CORS is set for html2canvas
      // If src is already set, it might be enough, but re-setting can help trigger load in some cases.
      // However, be cautious if this causes images to reload unnecessarily or break data URLs.
      // For now, rely on html2canvas onclone to handle images properly.
    });
  });

  if (imagePromises.length > 0) {
    await Promise.all(imagePromises);
  }
  
  // Additional wait for fonts and layout, similar to original
  await new Promise(resolve => setTimeout(resolve, 300));
}

/**
 * Render a single page's HTML to an image (DataURL)
 */
export async function renderHTMLPageToImage({
  html,
  pageOptions,
  pageDimensions,
  pdfBaseOptions,
}: RenderPageToImageParams): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = pageDimensions.width;
  container.style.height = pageDimensions.height;
  container.style.backgroundColor = 'white';
  container.style.overflow = 'hidden';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    let fullHtml = html;
    if (pageOptions?.header) {
      fullHtml = `<div class="pdf-page-header">${pageOptions.header}</div>${fullHtml}`;
    }
    if (pageOptions?.footer || pageOptions?.pageNumber) {
      let footerContent = pageOptions.footer || '';
      if (pageOptions.pageNumber && pageOptions.totalPages) {
        footerContent += `<div class="pdf-page-number">Page ${pageOptions.pageNumber} of ${pageOptions.totalPages}</div>`;
      }
      fullHtml = `${fullHtml}<div class="pdf-page-footer">${footerContent}</div>`;
    }

    const defaultMargins = pdfBaseOptions.defaultMargins || { top: 10, right: 10, bottom: 10, left: 10 };
    const margins = pageOptions?.margins || defaultMargins;

    const pageStyles = `
      @page { size: ${pdfBaseOptions.pageSize} ${pdfBaseOptions.orientation}; margin: 0; }
      @media print { body { -webkit-print-color-adjust: exact; } }
      body { 
        margin: 0; 
        padding: 0; 
        width: ${pageDimensions.width}; 
        height: ${pageDimensions.height};
        font-family: 'Source Sans 3', sans-serif;
        position: relative;
        overflow: hidden;
      }
      .pdf-page-header {
        position: absolute;
        top: ${margins.top}mm;
        left: ${margins.left}mm;
        right: ${margins.right}mm;
        z-index: 1000;
      }
      .pdf-page-footer {
        position: absolute;
        bottom: ${margins.bottom}mm;
        left: ${margins.left}mm;
        right: ${margins.right}mm;
        z-index: 1000;
        font-size: 9pt;
      }
      .pdf-page-number {
        text-align: center;
        font-size: 8pt;
        color: #666;
      }
    `;

    container.innerHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>${pageStyles}</style>
        </head>
        <body>${fullHtml}</body>
      </html>
    `;
    
    container.offsetHeight; // Force layout calculation

    await waitForResources(container.querySelector('body')!); // Wait for resources within the body

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      onclone: (clonedDoc) => {
        const images = clonedDoc.querySelectorAll('img');
        images.forEach((img) => {
          img.crossOrigin = "Anonymous";
          // Retain original styles from collection-styles.ts for artwork images etc.
          // Avoid overriding styles that might affect layout or visibility unless necessary.
          // img.style.maxWidth = '100%'; // This might be too general
          // img.style.opacity = '1';
          // img.style.display = 'block';
          // img.style.visibility = 'visible';
        });
      }
    });
    return canvas.toDataURL('image/jpeg', 0.95);
  } finally {
    document.body.removeChild(container);
  }
}

