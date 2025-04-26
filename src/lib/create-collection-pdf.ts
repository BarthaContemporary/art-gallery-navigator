
import { Collection } from "@/hooks/use-collections";
import { generatePDFFromHTML } from "./pdf/pdf-utils";
import { generateCollectionHTML } from './pdf/generateCollectionHTML';

export async function createCollectionPDF(
  collection: Collection,
  templateStyle: string = 'classic',
  useStationery: boolean = true
): Promise<string> {
  console.log("Creating PDF for collection:", collection.name);
  
  // Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const safeCollectionName = collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName = `collection_${safeCollectionName}_${timestamp}_${randomStr}.pdf`;
  
  // Generate HTML content - this is async
  const htmlContent = await generateCollectionHTML(collection, templateStyle, useStationery);
  
  // Generate and return PDF
  return generatePDFFromHTML({
    html: htmlContent,
    fileName,
    entityType: 'collection',
    entityId: collection.id,
    entityTitle: collection.name,
    description: `Overview document for ${collection.name}`
  });
}

