
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
    <div className="flex flex-col items-start gap-3 md:gap-4 mb-4 md:mb-6">
      <PageHeader title="PROJECTS" />
      
      {isAdmin && (
        <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="text-xs md:text-sm">
          <PlusCircle className="mr-2 h-3 w-3 md:h-4 md:w-4" />
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
