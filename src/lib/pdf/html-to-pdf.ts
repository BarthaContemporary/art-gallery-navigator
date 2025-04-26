
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface HTMLToPDFOptions {
  html: string;
  fileName: string;
}

export async function convertHTMLToPDF({ html, fileName }: HTMLToPDFOptions): Promise<Blob> {
  // Create temporary iframe for rendering
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  try {
    // Wait for iframe to load
    await new Promise((resolve) => {
      iframe.onload = resolve;
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

    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDocument) throw new Error("Could not access iframe document");

    // Pre-load images
    const imgPromises = Array.from(iframeDocument.images).map(img => {
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
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate canvas
    const canvas = await html2canvas(iframeDocument.body, {
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
    });

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
