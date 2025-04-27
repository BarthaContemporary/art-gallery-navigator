
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface HTMLToPDFOptions {
  html: string;
  fileName: string;
}

/**
 * Renders HTML content into a PDF document
 */
export async function convertHTMLToPDF({ html, fileName }: HTMLToPDFOptions): Promise<Blob> {
  console.log("Starting PDF conversion process");
  
  // Create a temporary iframe to render the HTML
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.width = '210mm'; // A4 width
  iframe.style.height = '297mm'; // A4 height
  document.body.appendChild(iframe);

  try {
    // Set the iframe content
    return new Promise((resolve, reject) => {
      iframe.onload = async () => {
        try {
          console.log("Iframe loaded, preparing document");
          const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDocument) throw new Error("Cannot access iframe document");
          
          // Wait for fonts and images to load
          console.log("Waiting for resources to load");
          await waitForResources(iframeDocument);
          
          // Render the document to canvas
          console.log("Rendering document to canvas");
          const canvas = await html2canvas(iframeDocument.body, {
            scale: 2, // Higher scale for better quality
            useCORS: true, // Enable CORS for external images
            allowTaint: true, // Allow potentially tainted images
            logging: true, // Enable logging for debugging
            backgroundColor: '#FFFFFF',
            onclone: (clonedDoc) => {
              console.log("Processing cloned document");
              const images = clonedDoc.querySelectorAll('img');
              console.log(`Found ${images.length} images in document`);
              
              // Set crossOrigin attribute for all images
              images.forEach(img => {
                img.crossOrigin = "Anonymous";
                console.log(`Processing image: ${img.src.substring(0, 50)}...`);
                
                // Make sure images are visible
                img.style.visibility = 'visible';
                img.style.display = 'block';
                img.style.opacity = '1';
                
                // Apply specific styles based on image purpose
                if (img.classList.contains('stationery-background')) {
                  img.style.width = '100%';
                  img.style.height = '100%';
                  img.style.position = 'absolute';
                  img.style.top = '0';
                  img.style.left = '0';
                  img.style.zIndex = '1';
                  console.log("Enhanced stationery background image");
                }
                
                if (img.classList.contains('artwork-image')) {
                  img.style.maxWidth = '100%';
                  img.style.maxHeight = '40%';
                  img.style.zIndex = '2';
                  console.log("Enhanced artwork image");
                }
              });
            }
          });
          
          console.log("Canvas generated, creating PDF");
          
          // Create a PDF document
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
          });
          
          // Add canvas content to PDF
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
          
          console.log("PDF created successfully");
          resolve(doc.output('blob'));
        } catch (error) {
          console.error("Error in PDF generation:", error);
          reject(error);
        }
      };
      
      // Load the HTML content into the iframe
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
              body { 
                margin: 0; 
                padding: 0; 
                width: 210mm; 
                height: 297mm;
                font-family: 'Source Sans 3', sans-serif;
              }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;
    });
  } finally {
    // Clean up the iframe
    setTimeout(() => {
      document.body.removeChild(iframe);
      console.log("Iframe removed");
    }, 100);
  }
}

/**
 * Waits for all resources in the document to load
 */
async function waitForResources(document: Document): Promise<void> {
  // Wait for all images to load
  const images = Array.from(document.images);
  console.log(`Waiting for ${images.length} images to load`);
  
  if (images.length > 0) {
    await Promise.all(
      images.map(img => {
        if (img.complete) {
          console.log(`Image already loaded: ${img.src.substring(0, 50)}...`);
          return Promise.resolve();
        }
        
        return new Promise<void>((resolve, reject) => {
          img.onload = () => {
            console.log(`Image loaded: ${img.src.substring(0, 50)}...`);
            resolve();
          };
          img.onerror = () => {
            console.error(`Failed to load image: ${img.src.substring(0, 50)}...`);
            // We resolve anyway to not block the PDF generation
            resolve();
          };
        });
      })
    );
  }
  
  // Wait a bit for fonts to load
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log("Resources loaded");
}
