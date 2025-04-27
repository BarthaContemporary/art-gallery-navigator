import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UsersTable } from "./UsersTable";
import { DeletionRequestsTable } from "./DeletionRequestsTable";
import { useDeletionRequests } from "@/hooks/use-deletion-requests";
export function UsersList() {
  const {
    deletionRequests
  } = useDeletionRequests();
  return <Tabs defaultValue="users" className="w-full">
      

      <TabsContent value="users" className="border rounded-md mt-4">
        <UsersTable />
      </TabsContent>

      <TabsContent value="deletion-requests" className="border rounded-md mt-4">
        <DeletionRequestsTable />
      </TabsContent>
    </Tabs>;
}