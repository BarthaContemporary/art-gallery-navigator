
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const ACTIVITY_COLORS: Record<string, string> = {
  "green": "bg-green-500",
  "amber": "bg-amber-500",
  "blue": "bg-blue-500",
  "purple": "bg-purple-500",
  "gray": "bg-gray-500",
  "red": "bg-red-500"
};

interface Activity {
  title: string;
  timestamp: string;
  color: string;
}

interface RecentActivityCardProps {
  isLoading: boolean;
  activities: Activity[] | undefined;
}

export const RecentActivityCard = ({ isLoading, activities }: RecentActivityCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Recent Activity</CardTitle>
        <CardDescription>Latest updates to your gallery inventory</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center gap-4">
                <Skeleton className="h-2 w-2 rounded-full" />
                <div className="w-full">
                  <Skeleton className="h-4 w-36 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {activities && activities.length > 0 ? (
              activities.map((activity, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className={`h-2 w-2 rounded-full ${ACTIVITY_COLORS[activity.color] || "bg-gray-400"}`}></div>
                  <div>
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.timestamp), "MMMM d, yyyy 'at' HH:mm")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-sm">No recent activities found.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
