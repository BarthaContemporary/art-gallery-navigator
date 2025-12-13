/**
 * Address Labels Template Generator
 * Generates HTML for Avery L7165 format (8 labels per A4 page, 2 columns × 4 rows)
 */

interface AddressContact {
  full_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  // Legacy field support
  address?: string;
}

export function generateAddressLabelsHTML(contacts: AddressContact[]): string {
  const labelsPerPage = 8;
  const pages: string[] = [];
  
  // Filter contacts with addresses
  const contactsWithAddress = contacts.filter(c => 
    c.address || c.address_line1 || c.city
  );

  // Split into pages
  for (let i = 0; i < contactsWithAddress.length; i += labelsPerPage) {
    const pageContacts = contactsWithAddress.slice(i, i + labelsPerPage);
    const labels = pageContacts.map(contact => generateLabel(contact)).join('');
    
    // Add empty labels to complete the page grid
    const emptyLabels = Array(labelsPerPage - pageContacts.length)
      .fill('<div class="label"></div>')
      .join('');
    
    pages.push(`<div class="page"><div class="label-grid">${labels}${emptyLabels}</div></div>`);
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: A4;
      margin: 10mm;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
    }
    
    .page {
      width: 190mm;
      height: 277mm;
      page-break-after: always;
    }
    
    .page:last-child {
      page-break-after: avoid;
    }
    
    .label-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(4, 1fr);
      gap: 3mm;
      height: 100%;
    }
    
    .label {
      width: 93mm;
      height: 67mm;
      padding: 8mm;
      border: 0.5px solid #e0e0e0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .label-name {
      font-weight: bold;
      font-size: 12pt;
      margin-bottom: 4mm;
    }
    
    .label-address {
      font-size: 11pt;
    }
    
    .label-address-line {
      margin-bottom: 1mm;
    }
    
    @media print {
      .label {
        border: none;
      }
    }
  </style>
</head>
<body>
  ${pages.join('')}
</body>
</html>
  `.trim();
}

function generateLabel(contact: AddressContact): string {
  const addressLines: string[] = [];
  
  // Build address from structured fields or legacy address
  if (contact.address_line1) {
    addressLines.push(contact.address_line1);
  }
  if (contact.address_line2) {
    addressLines.push(contact.address_line2);
  }
  
  // City, State, Postal Code line
  const cityLine = [
    contact.city,
    contact.state,
    contact.postal_code
  ].filter(Boolean).join(', ');
  
  if (cityLine) {
    addressLines.push(cityLine);
  }
  
  if (contact.country) {
    addressLines.push(contact.country);
  }
  
  // Fallback to legacy address field
  if (addressLines.length === 0 && contact.address) {
    // Split legacy address by newlines or commas
    const parts = contact.address.split(/[\n,]/).map(p => p.trim()).filter(Boolean);
    addressLines.push(...parts);
  }
  
  const addressHTML = addressLines
    .map(line => `<div class="label-address-line">${escapeHtml(line)}</div>`)
    .join('');

  return `
    <div class="label">
      <div class="label-name">${escapeHtml(contact.full_name || '')}</div>
      <div class="label-address">${addressHTML}</div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => htmlEntities[char] || char);
}
