import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";
interface StatCardData {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  change: string;
}
interface StatsSummaryCardsProps {
  isLoading: boolean;
  statsCardsData: StatCardData[];
}
export const StatsSummaryCards = ({
  isLoading,
  statsCardsData
}: StatsSummaryCardsProps) => {
  return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {statsCardsData.map((stat, index) => <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-normal">
              {stat.title}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              {stat.icon}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.change}
              </p>
            </>}
          </CardContent>
        </Card>)}
    </div>;
};