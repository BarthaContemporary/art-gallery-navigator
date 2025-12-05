import { CRMList } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Filter } from "lucide-react";

interface ListsGridProps { lists: CRMList[]; isLoading: boolean; }

export function ListsGrid({ lists, isLoading }: ListsGridProps) {
  if (isLoading) return <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  if (lists.length === 0) return <div className="text-center py-12 text-muted-foreground">No lists yet</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {lists.map((list) => (
        <Card key={list.id} className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{list.name}</CardTitle>
              <Badge variant={list.type === "static" ? "secondary" : "outline"}>
                {list.type === "static" ? <Users className="h-3 w-3 mr-1" /> : <Filter className="h-3 w-3 mr-1" />}
                {list.type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">{list.description || "No description"}</p>
            <p className="text-sm font-medium mt-2">{list.member_count || 0} contacts</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
