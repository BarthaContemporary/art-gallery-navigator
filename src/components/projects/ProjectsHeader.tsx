
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { ProjectDialog } from "./ProjectDialog";
import { PageHeader } from "@/components/layout/PageHeader";

export function ProjectsHeader() {
  const { isAdmin } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    // Changed justify-between to justify-start
    <div className="flex flex-wrap justify-start items-center gap-4 mb-6">
      <PageHeader title="PROJECTS" />
      
      {isAdmin && (
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}> {/* Added size="sm" */}
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

