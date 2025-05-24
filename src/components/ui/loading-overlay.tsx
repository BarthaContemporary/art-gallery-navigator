
import { useLoading } from "@/contexts/loading-context";
// Removed Loader import as it's no longer used

export function LoadingOverlay() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  // Return null even when isLoading is true to remove the visual preloader.
  // The page will simply wait for content to load without a visual indicator from this overlay.
  return null; 
}
