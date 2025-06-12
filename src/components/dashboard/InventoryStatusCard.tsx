import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
const STATUS_COLORS: Record<string, string> = {
  "available": "bg-green-500",
  "on hold": "bg-amber-500",
  "in transit": "bg-blue-500",
  "sold": "bg-blue-500",
  "consigned": "bg-purple-500",
  "not for sale": "bg-gray-500",
  "returned": "bg-black",
  "unknown": "bg-gray-300"
};
function getStatusLabel(status: string) {
  return status.split(' ').map(str => str.charAt(0).toUpperCase() + str.slice(1)).join(' ');
}
interface InventoryStatusCardProps {
  isLoading: boolean;
  orderedStatuses: [string, number][];
}
export const InventoryStatusCard = ({
  isLoading,
  orderedStatuses
}: InventoryStatusCardProps) => {
  return <Card>
      <CardHeader>
        <CardTitle className="text-lg font-normal">Inventory Status</CardTitle>
        
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="space-y-3">
            {[1, 2, 3, 4].map(n => <div key={n} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-8" />
              </div>)}
          </div> : <div className="space-y-4">
            {orderedStatuses.length > 0 ? orderedStatuses.map(([status, count]) => <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${STATUS_COLORS[status] || "bg-gray-400"}`}></div>
                    <span className="text-sm font-light">{getStatusLabel(status)}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>) : <div className="text-muted-foreground text-sm">No inventory works found.</div>}
          </div>}
      </CardContent>
    </Card>;
};