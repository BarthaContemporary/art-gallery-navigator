
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { ProjectDialog } from "./ProjectDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlusCircle } from "lucide-react";

export function ProjectsHeader() {
  const { isAdmin } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3 sm:gap-4">
      <PageHeader title="PROJECTS" />
      
      <div className="flex flex-wrap gap-2">
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="flex gap-2">
            <PlusCircle className="h-4 w-4" />
            Add Project
          </Button>
        )}
      </div>
      
      <ProjectDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
