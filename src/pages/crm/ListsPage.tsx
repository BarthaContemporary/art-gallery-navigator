import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCRMLists } from "@/hooks/crm";
import { ListsGrid } from "@/components/crm/lists/ListsGrid";
import { ListDialog } from "@/components/crm/lists/ListDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRMListType } from "@/types/crm";

export default function ListsPage() {
  const [activeTab, setActiveTab] = useState<CRMListType | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<CRMListType>("static");

  const { data: lists, isLoading } = useCRMLists({
    type: activeTab === "all" ? undefined : activeTab,
  });

  const staticLists = lists?.filter(l => l.type === "static") || [];
  const dynamicLists = lists?.filter(l => l.type === "dynamic") || [];

  const handleCreateList = (type: CRMListType) => {
    setCreateType(type);
    setIsCreateDialogOpen(true);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lists & Segments</h1>
          <p className="text-muted-foreground text-sm">
            {staticLists.length} static lists, {dynamicLists.length} dynamic segments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleCreateList("dynamic")}>
            <Plus className="h-4 w-4 mr-2" />
            New Segment
          </Button>
          <Button onClick={() => handleCreateList("static")}>
            <Plus className="h-4 w-4 mr-2" />
            New List
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CRMListType | "all")}>
        <TabsList>
          <TabsTrigger value="all">All ({lists?.length || 0})</TabsTrigger>
          <TabsTrigger value="static">Static Lists ({staticLists.length})</TabsTrigger>
          <TabsTrigger value="dynamic">Dynamic Segments ({dynamicLists.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <ListsGrid lists={lists || []} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="static" className="mt-6">
          <ListsGrid lists={staticLists} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="dynamic" className="mt-6">
          <ListsGrid lists={dynamicLists} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <ListDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultType={createType}
      />
    </div>
  );
}
