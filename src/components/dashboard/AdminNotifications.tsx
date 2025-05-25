
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, FileUp } from "lucide-react";
import { Link } from "react-router-dom";

interface AdminNotificationsProps {
  isLoading: boolean;
  pendingDeletionsCount: number | undefined;
  newUploadsCount: number | undefined;
}

export const AdminNotifications = ({ isLoading, pendingDeletionsCount, newUploadsCount }: AdminNotificationsProps) => {
  return (
    <div className="mt-8 mb-8">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Link to="/documents" className="no-underline">
          <Card className={pendingDeletionsCount ? "border-amber-300 hover:border-amber-400 transition-colors" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Pending Deletion Requests
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : <>
                <div className="text-2xl font-bold">
                  {pendingDeletionsCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingDeletionsCount ? "Items awaiting review" : "No items awaiting review"}
                </p>
              </>}
            </CardContent>
          </Card>
        </Link>

        <Link to="/file-transfer" className="no-underline">
          <Card className={newUploadsCount ? "border-blue-300 hover:border-blue-400 transition-colors" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Recent File Uploads
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <FileUp className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : <>
                <div className="text-2xl font-bold">
                  {newUploadsCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {newUploadsCount ? "New files in last 7 days" : "No new files in last 7 days"}
                </p>
              </>}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};
