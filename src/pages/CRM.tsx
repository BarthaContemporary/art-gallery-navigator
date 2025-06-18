
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Users, Phone, Mail, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";
import { ClientsList } from "@/components/crm/ClientsList";
import { CreateClientDialog } from "@/components/crm/CreateClientDialog";
import { CreateClientListDialog } from "@/components/crm/CreateClientListDialog";
import { ClientListsSection } from "@/components/crm/ClientListsSection";

export default function CRM() {
  const { isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedListId, setSelectedListId] = useState<string | undefined>();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-screen">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto pb-40">
        <div className="space-y-6">
          <div className="mb-4 md:mb-6 flex gap-2">
            <CreateClientDialog />
            <CreateClientListDialog />
          </div>
          
          <Card>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={statusFilter === "prospect" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("prospect")}
                  >
                    Prospects
                  </Button>
                  <Button
                    variant={statusFilter === "customer" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("customer")}
                  >
                    Customers
                  </Button>
                </div>
              </div>
              
              <ClientsList 
                searchTerm={searchTerm} 
                statusFilter={statusFilter}
                selectedListId={selectedListId}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Anchored ClientListsSection at the bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-10">
        <div className="max-w-7xl mx-auto">
          <ClientListsSection 
            selectedListId={selectedListId}
            onListSelect={setSelectedListId}
          />
        </div>
      </div>
    </div>
  );
}
