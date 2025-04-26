
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface HTMLToPDFOptions {
  html: string;
  fileName: string;
}

/**
 * Creates a temporary iframe for rendering HTML content
 * @returns HTMLIFrameElement
 */
function createTemporaryIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  return iframe;
}

/**
 * Sets up the content of the iframe with the provided HTML
 * @param iframe The iframe element to setup
 * @param html The HTML content to load
 * @param fileName The name of the file for the title
 * @returns Promise resolving to the iframe's Document
 */
async function setupIframeContent(iframe: HTMLIFrameElement, html: string, fileName: string): Promise<Document> {
  return new Promise((resolve) => {
    iframe.onload = () => {
      const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDocument) throw new Error("Could not access iframe document");
      resolve(iframeDocument);
    };
    
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${fileName}</title>
          <style>
            @page { size: A4; margin: 0; }
            @media print { body { -webkit-print-color-adjust: exact; } }
            html, body {
              margin: 0;
              padding: 0;
              width: 210mm;
              height: 297mm;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;
  });
}

/**
 * Preloads all images in the document to ensure they render correctly
 * @param document The document containing images to preload
 * @returns Promise resolving when all images are loaded
 */
async function preloadImages(document: Document): Promise<void> {
  const imgPromises = Array.from(document.images).map(img => {
    return new Promise((resolve) => {
      if (img.complete) {
        resolve(true);
      } else {
        img.onload = () => resolve(true);
        img.onerror = () => {
          console.warn(`Failed to load image: ${img.src}`);
          resolve(false);
        };
      }
    });
  });

  await Promise.all(imgPromises);
  await new Promise(resolve => setTimeout(resolve, 500)); // Additional buffer time for image processing
}

/**
 * Configures the canvas options for html2canvas
 * @param document The document to configure canvas options for
 * @returns Canvas configuration options
 */
function configureCanvas(document: Document): Parameters<typeof html2canvas>[1] {
  return {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    width: 210 * 3.78,
    height: 297 * 3.78,
    backgroundColor: null,
    imageTimeout: 30000,
    onclone: (clonedDoc) => {
      const imgs = clonedDoc.querySelectorAll('img');
      imgs.forEach(img => {
        img.style.visibility = 'visible';
        img.style.opacity = '1';
        img.crossOrigin = "Anonymous";
        
        if (img.classList.contains('stationery-background-image')) {
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
        }
        
        if (img.classList.contains('artwork-image')) {
          img.style.maxHeight = '15cm';
          img.style.maxWidth = '100%';
        }
      });
    }
  };
}

/**
 * Converts HTML content to a PDF blob
 * @param options The HTML and fileName for the PDF
 * @returns Promise resolving to a PDF Blob
 */
export async function convertHTMLToPDF({ html, fileName }: HTMLToPDFOptions): Promise<Blob> {
  const iframe = createTemporaryIframe();

  try {
    // Setup iframe and wait for content to load
    const iframeDocument = await setupIframeContent(iframe, html, fileName);
    
    // Preload all images
    await preloadImages(iframeDocument);
    
    // Generate canvas with configured options
    const canvas = await html2canvas(iframeDocument.body, configureCanvas(iframeDocument));

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    doc.addImage(
      canvas.toDataURL('image/png', 1.0),
      'PNG',
      0,
      0,
      210,
      297
    );

    return doc.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}
