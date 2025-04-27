
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface HTMLToPDFOptions {
  html: string;
  fileName: string;
}

/**
 * Creates a temporary iframe for rendering HTML content
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
 */
async function setupIframeContent(iframe: HTMLIFrameElement, html: string, fileName: string): Promise<Document> {
  return new Promise((resolve) => {
    iframe.onload = () => {
      const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDocument) throw new Error("Could not access iframe document");
      resolve(iframeDocument);
    };
    
    // Set the iframe content with proper meta tags for PDF generation
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${fileName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page { size: A4; margin: 0; }
            @media print { body { -webkit-print-color-adjust: exact; } }
            html, body {
              margin: 0;
              padding: 0;
              width: 210mm;
              height: 297mm;
              font-family: 'Source Sans 3', sans-serif;
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
 */
async function preloadImages(document: Document): Promise<void> {
  const imgElements = Array.from(document.images);
  console.log(`Preloading ${imgElements.length} images...`);
  
  const imgPromises = imgElements.map((img, index) => {
    return new Promise((resolve) => {
      if (img.complete) {
        console.log(`Image ${index + 1}/${imgElements.length} already loaded:`, img.src);
        resolve(true);
      } else {
        console.log(`Waiting for image ${index + 1}/${imgElements.length} to load:`, img.src);
        img.onload = () => {
          console.log(`Image ${index + 1}/${imgElements.length} loaded successfully:`, img.src);
          resolve(true);
        };
        img.onerror = () => {
          console.warn(`Failed to load image ${index + 1}/${imgElements.length}:`, img.src);
          resolve(false);
        };
      }
    });
  });

  await Promise.all(imgPromises);
  // Give a little extra time for the browser to process images
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('All images preloaded');
}

/**
 * Configures the canvas options for html2canvas
 */
function configureCanvas(document: Document): Parameters<typeof html2canvas>[1] {
  return {
    scale: 2, // Higher scale for better quality
    useCORS: true, // Enable CORS for external images
    allowTaint: true, // Allow potentially tainted images
    logging: true, // Enable logging for debugging
    width: 210 * 3.78, // A4 width in pixels (72dpi)
    height: 297 * 3.78, // A4 height in pixels (72dpi)
    backgroundColor: '#FFFFFF',
    imageTimeout: 30000, // Longer timeout for images
    onclone: (clonedDoc) => {
      // Process all images in the cloned document
      const imgs = clonedDoc.querySelectorAll('img');
      console.log(`Processing ${imgs.length} images in cloned document`);
      
      imgs.forEach((img, i) => {
        // Make images visible and properly styled
        img.style.visibility = 'visible';
        img.style.opacity = '1';
        img.crossOrigin = "Anonymous";
        
        // Apply specific styles based on image purpose
        if (img.closest('.stationery-background')) {
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          console.log(`Stationery background image ${i+1} styled:`, img.src);
        }
        
        if (img.classList.contains('artwork-image')) {
          img.style.maxHeight = '15cm';
          img.style.maxWidth = '100%';
          console.log(`Artwork image ${i+1} styled:`, img.src);
        }
      });
    }
  };
}

/**
 * Converts HTML content to a PDF blob
 */
export async function convertHTMLToPDF({ html, fileName }: HTMLToPDFOptions): Promise<Blob> {
  console.log("Starting HTML to PDF conversion process");
  const iframe = createTemporaryIframe();

  try {
    console.log("Setting up iframe content");
    const iframeDocument = await setupIframeContent(iframe, html, fileName);
    
    console.log("Preloading images");
    await preloadImages(iframeDocument);
    
    console.log("Generating canvas");
    const canvas = await html2canvas(iframeDocument.body, configureCanvas(iframeDocument));
    console.log("Canvas generated successfully");

    console.log("Creating PDF document");
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    // Add the canvas as an image to the PDF
    doc.addImage(
      canvas.toDataURL('image/jpeg', 1.0),
      'JPEG',
      0,
      0,
      210,
      297
    );

    console.log("PDF created successfully");
    return doc.output('blob');
  } catch (error) {
    console.error("Error in PDF conversion:", error);
    throw error;
  } finally {
    document.body.removeChild(iframe);
    console.log("Cleanup complete");
  }
}
