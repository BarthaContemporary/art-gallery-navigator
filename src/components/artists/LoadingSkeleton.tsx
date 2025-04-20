
import { Card, CardContent } from "@/components/ui/card";

export const LoadingSkeleton = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((n) => (
        <Card key={n} className="animate-pulse">
          <div className="aspect-[3/2] w-full bg-muted"></div>
          <CardContent className="p-4">
            <div className="h-4 w-2/3 bg-muted rounded mb-2"></div>
            <div className="h-3 w-1/2 bg-muted rounded"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
