
// Helper function to generate a robust slug
export const generateSlug = (name: string = "collection"): string => {
  const cleanedName = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric characters except hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with a single one
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  const timestamp = Date.now().toString(36); // Base36 timestamp

  const randomPart1 = Math.random().toString(36).substring(2, 10); 
  const randomPart2 = Math.random().toString(36).substring(2, 10); 
  const randomString = `${randomPart1}${randomPart2}`.slice(0, 12);

  const base = cleanedName || 'website';
  
  const maxBaseNameLength = 50; 
  const truncatedBase = base.length > maxBaseNameLength ? base.substring(0, maxBaseNameLength) : base;

  return `${truncatedBase}-${timestamp}-${randomString}`;
};
