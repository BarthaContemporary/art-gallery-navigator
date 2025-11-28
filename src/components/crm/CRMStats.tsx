
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Mail, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function CRMStats() {
  const { data: stats } = useQuery({
    queryKey: ['crm-stats'],
    queryFn: async () => {
      const results = await Promise.allSettled([
        supabase.from('clients').select('status'),
        supabase.from('clients').select('created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      const clientsResult = results[0].status === 'fulfilled' ? results[0].value : { data: [] };
      const recentResult = results[1].status === 'fulfilled' ? results[1].value : { data: [] };

      const totalClients = clientsResult.data?.length || 0;
      const prospects = clientsResult.data?.filter(c => c.status === 'prospect').length || 0;
      const customers = clientsResult.data?.filter(c => c.status === 'customer').length || 0;
      const recentClients = recentResult.data?.length || 0;

      return { totalClients, prospects, customers, recentClients };
    }
  });

  const statCards = [
    {
      title: "Total Clients",
      value: stats?.totalClients || 0,
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "Prospects",
      value: stats?.prospects || 0,
      icon: UserPlus,
      color: "text-yellow-600"
    },
    {
      title: "Customers",
      value: stats?.customers || 0,
      icon: TrendingUp,
      color: "text-green-600"
    },
    {
      title: "New This Month",
      value: stats?.recentClients || 0,
      icon: Mail,
      color: "text-purple-600"
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-2">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
