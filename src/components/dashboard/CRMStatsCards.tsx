import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, TrendingUp, UserCheck } from "lucide-react";
import React from "react";
interface CRMStatsCardsProps {
  isLoading: boolean;
  totalClients: number;
  activeClients: number;
  prospects: number;
  customers: number;
  leads: number;
}
export const CRMStatsCards = ({
  isLoading,
  totalClients,
  activeClients,
  prospects,
  customers,
  leads
}: CRMStatsCardsProps) => {
  const crmStats = [{
    title: "Total Clients",
    value: totalClients,
    icon: <Users className="h-4 w-4" />,
    color: "text-blue-600"
  }, {
    title: "Active Clients",
    value: activeClients,
    icon: <UserCheck className="h-4 w-4" />,
    color: "text-green-600"
  }, {
    title: "Prospects",
    value: prospects,
    icon: <UserPlus className="h-4 w-4" />,
    color: "text-yellow-600"
  }, {
    title: "Customers",
    value: customers,
    icon: <TrendingUp className="h-4 w-4" />,
    color: "text-purple-600"
  }];
  return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      {crmStats.map((stat, index) => <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-base">{stat.title}</CardTitle>
            <div className={`${stat.color}`}>
              {stat.icon}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stat.value}</div>}
          </CardContent>
        </Card>)}
    </div>;
};