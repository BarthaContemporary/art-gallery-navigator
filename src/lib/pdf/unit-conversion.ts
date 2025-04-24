
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

