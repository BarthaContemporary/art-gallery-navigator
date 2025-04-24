interface TemplateStyles {
  basic: string;
  basicWithPrice: string;
  complete: string;
  collection: string;
}

export const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
  
  body { 
    font-family: 'Source Sans 3', sans-serif; 
    margin: 0;
    padding: 0;
    color: #333;
    line-height: 1.6;
  }
  
  .detail-label {
    font-weight: 600;
    color: #18465a;
    margin-right: 8px;
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Source Sans 3', sans-serif;
  }
  
  @media print {
    body { margin: 0; padding: 0; }
  }
`;

// Plain paper styles with specified margins
export const plainPaperStyles = `
  .content-wrapper {
    padding: 3cm 3cm 3.5cm 3cm;
    font-family: 'Source Sans 3', sans-serif;
  }
  
  .artwork-image {
    max-height: 6cm;
    width: auto;
    display: block;
    margin-bottom: 1.5cm;
  }
  
  .artist-name {
    font-weight: 700;
    margin-bottom: 0.5cm;
  }
  
  .artwork-title {
    font-style: italic;
    margin-bottom: 0.5cm;
  }
  
  .materials {
    margin-bottom: 0.5cm;
  }
  
  .edition-details {
    margin-bottom: 0.5cm;
  }
  
  .dimensions {
    margin-bottom: 0.3cm;
  }
  
  .frame-dimensions {
    margin-bottom: 0.5cm;
  }
  
  .price {
    font-weight: 600;
    margin-top: 1cm;
  }
`;

// Stationery styles with adjusted positioning
export const stationeryStyles = `
  .content-wrapper {
    padding-top: 11cm;
    padding-left: 4cm;
    padding-right: 3cm;
    padding-bottom: 3.5cm;
    position: relative;
    font-family: 'Source Sans 3', sans-serif;
    font-size: 12px;
  }
  
  .artwork-image {
    max-height: 6cm;
    width: auto;
    display: block;
    margin-bottom: 1.5cm;
  }
  
  .artist-name {
    font-weight: 700;
    margin-bottom: 0.5cm;
  }
  
  .artist-name-header {
    position: absolute;
    top: 6cm;
    right: 4cm;
    font-weight: 700;
    text-transform: uppercase;
  }
  
  .artwork-title {
    font-style: italic;
    margin-bottom: 0.5cm;
  }
  
  .materials {
    margin-bottom: 0.5cm;
  }
  
  .edition-details {
    margin-bottom: 0.5cm;
  }
  
  .dimensions {
    margin-bottom: 0.3cm;
  }
  
  .frame-dimensions {
    margin-bottom: 0.5cm;
  }
  
  .price {
    font-weight: 600;
    margin-top: 1cm;
  }
  
  .collection-name {
    position: absolute;
    top: 6cm;
    left: 4cm;
    font-weight: 700;
    font-size: 14px;
    font-family: 'Source Sans 3', sans-serif;
  }
  
  .collection-items {
    margin-top: 1cm;
    font-size: 12px;
  }
  
  .collection-description {
    margin-bottom: 1cm;
    font-size: 12px;
  }
  
  .collection-item {
    display: flex;
    margin-bottom: 0.6cm;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.4cm;
    font-size: 11px;
  }
  
  .collection-item-image {
    width: 2cm;
    height: 2cm;
    object-fit: cover;
    margin-right: 0.6cm;
  }
  
  .collection-item-details {
    flex: 1;
    font-size: 11px;
  }
`;

// Create background stationery style with 100% opacity
export function getStationeryStyle(useStationery: boolean): string {
  return useStationery ? `
    body {
      background-image: url('/lovable-uploads/55e90a54-96c5-47d5-8767-03b4347e6942.png');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      position: relative;
      /* Using opacity 1 (100%) */
    }
  ` : '';
}

// Helper function to convert centimeters to inches with fractions
export function cmToInchFraction(cm: number): string {
  if (!cm) return '';
  
  const inches = cm / 2.54;
  const wholeInches = Math.floor(inches);
  const fraction = inches - wholeInches;
  
  // Convert to closest 1/8th fraction
  const denominator = 8;
  const nearestFraction = Math.round(fraction * denominator);
  
  if (nearestFraction === 0) {
    return `${wholeInches}"`;
  } else if (nearestFraction === denominator) {
    return `${wholeInches + 1}"`;
  } else {
    // Simplify the fraction
    let num = nearestFraction;
    let den = denominator;
    
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(num, den);
    
    num = num / divisor;
    den = den / divisor;
    
    return `${wholeInches} ${num}/${den}"`;
  }
}
