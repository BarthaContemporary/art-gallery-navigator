
import { Loader } from "lucide-react";
import { useLoading } from "@/contexts/loading-context";

export function LoadingOverlay() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex items-center gap-2">
        <Loader className="h-6 w-6 animate-spin" />
        <span className="text-lg font-medium">Loading...</span>
      </div>
    </div>
  );
}
