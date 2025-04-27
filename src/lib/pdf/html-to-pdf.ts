
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface HTMLToPDFOptions {
  html: string;
  fileName: string;
  onProgress?: (message: string) => void;
}

/**
 * Converts HTML content to a PDF document
 */
export async function convertHTMLToPDF({ 
  html, 
  fileName,
  onProgress = () => {}
}: HTMLToPDFOptions): Promise<Blob> {
  onProgress("Creating document container...");
  console.log("Starting PDF conversion process");
  
  // Create a temporary container outside the viewport
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '210mm'; // A4 width
  container.style.height = '297mm'; // A4 height
  container.style.backgroundColor = 'white';
  container.style.overflow = 'hidden';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    // Add the HTML content to the container
    onProgress("Setting up content...");
    container.innerHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
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
    
    // Force layout calculation
    container.offsetHeight; 
    
    // Wait for fonts and images
    onProgress("Loading resources...");
    await waitForResources(container);
    onProgress("Rendering document...");
    
    // Setup html2canvas with optimal settings
    const canvas = await html2canvas(container, {
      scale: 2, // Higher scale for better quality
      useCORS: true, 
      allowTaint: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      onclone: (clonedDoc) => {
        console.log("Processing document clone");
        const images = clonedDoc.querySelectorAll('img');
        console.log(`Found ${images.length} images in document`);
        
        // Process each image
        images.forEach((img) => {
          img.crossOrigin = "Anonymous";
          img.style.maxWidth = '100%';
          
          // Make images visible
          img.style.opacity = '1';
          img.style.display = 'block';
          img.style.visibility = 'visible';
        });
      }
    });
    
    // Create PDF
    onProgress("Creating PDF file...");
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    // Add canvas to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    
    // Return the PDF as a blob
    const blob = pdf.output('blob');
    console.log(`PDF created successfully: ${blob.size} bytes`);
    
    return blob;
  } catch (error) {
    console.error("Error creating PDF:", error);
    toast.error(`Failed to create PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Waits for all resources (images, fonts) to load
 */
async function waitForResources(container: HTMLElement): Promise<void> {
  console.log("Waiting for resources to load");
  
  // Wait for images
  const images = Array.from(container.querySelectorAll('img'));
  if (images.length === 0) {
    console.log("No images to wait for");
    return;
  }
  
  console.log(`Waiting for ${images.length} images to load`);
  
  // Preload each image with proper CORS settings
  const imagePromises = images.map((img) => {
    // If image is already loaded, no need to wait
    if (img.complete && img.naturalHeight !== 0) {
      console.log(`Image already loaded: ${img.src}`);
      return Promise.resolve();
    }
    
    return new Promise<void>((resolve) => {
      // Handle successful load
      img.onload = () => {
        console.log(`Image loaded: ${img.src.substring(0, 50)}...`);
        resolve();
      };
      
      // Handle failed load
      img.onerror = () => {
        console.warn(`Failed to load image: ${img.src.substring(0, 50)}...`);
        // Resolve anyway to continue with PDF generation
        resolve();
      };
      
      // Set CORS attribute
      img.crossOrigin = "Anonymous";
      
      // Reload the image to trigger the events
      const currentSrc = img.src;
      img.src = "";
      img.src = currentSrc;
    });
  });
  
  // Wait for all images to load or fail
  await Promise.all(imagePromises);
  
  // Additional wait for fonts and layout
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log("All resources loaded");
}
