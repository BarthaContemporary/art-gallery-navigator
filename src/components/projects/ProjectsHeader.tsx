
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { ProjectDialog } from "./ProjectDialog";
import { PageHeader } from "@/components/layout/PageHeader";

export function ProjectsHeader() {
  const { isAdmin } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-4 md:mb-6">
      <PageHeader title="PROJECTS" />
      
      {isAdmin && (
        <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="text-xs md:text-sm">
          Create Project
        </Button>
      )}
      
      <ProjectDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
