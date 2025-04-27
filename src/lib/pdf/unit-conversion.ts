
/**
 * Converts centimeters to inch fraction representation
 */
export function cmToInchFraction(cm: number): string {
  // Convert cm to inches
  const inches = cm / 2.54;
  
  // Extract whole number and decimal
  const wholeInches = Math.floor(inches);
  const decimalPart = inches - wholeInches;
  
  // Common fractions: 1/8, 1/4, 3/8, 1/2, 5/8, 3/4, 7/8
  const fractions = [
    { value: 0, display: "" },
    { value: 1/8, display: "1/8" },
    { value: 1/4, display: "1/4" },
    { value: 3/8, display: "3/8" },
    { value: 1/2, display: "1/2" },
    { value: 5/8, display: "5/8" },
    { value: 3/4, display: "3/4" },
    { value: 7/8, display: "7/8" },
    { value: 1, display: "" }
  ];
  
  // Find closest fraction
  let closestFraction = { value: 0, display: "" };
  let minDifference = 1;
  
  for (const fraction of fractions) {
    const difference = Math.abs(decimalPart - fraction.value);
    if (difference < minDifference) {
      minDifference = difference;
      closestFraction = fraction;
    }
  }
  
  // Handle full inch case
  let nextWholeInch = wholeInches;
  if (closestFraction.value === 1) {
    nextWholeInch += 1;
    closestFraction = { value: 0, display: "" };
  }
  
  // Format the result
  return closestFraction.display 
    ? `${nextWholeInch} ${closestFraction.display}` 
    : `${nextWholeInch}`;
}
