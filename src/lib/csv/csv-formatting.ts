
// Helper to format CSV values properly
export const formatCSVValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  
  // Convert booleans to strings
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  
  // For strings, escape quotes and wrap in quotes if it contains commas or quotes
  if (typeof value === 'string') {
    const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\n');
    if (needsQuotes) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
  
  return String(value);
};
