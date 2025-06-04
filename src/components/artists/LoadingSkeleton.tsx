
import { Card, CardContent } from "@/components/ui/card";

export const LoadingSkeleton = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <Card key={n} className="animate-pulse group relative w-full">
          <div className="aspect-[4/3] w-full bg-muted/40 rounded-t-lg"></div>
          <CardContent className="p-3 sm:p-4 space-y-2">
            <div className="h-4 w-2/3 bg-muted/60 rounded mb-2"></div>
            <div className="h-3 w-1/2 bg-muted/40 rounded"></div>
            <div className="flex items-center mt-2">
              <div className="h-4 w-4 bg-muted/40 rounded mr-2"></div>
              <div className="h-3 w-24 bg-muted/40 rounded"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
