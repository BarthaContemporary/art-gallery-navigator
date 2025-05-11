
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { useProjectMembers } from "@/hooks/projects/use-project-members";

interface ProjectTeamSectionProps {
  projectId?: string;
  onAddMember?: () => void;
  userIsMember?: boolean;
  isAdmin?: boolean;
}

export function ProjectTeamSection({ 
  projectId,
  onAddMember,
  userIsMember,
  isAdmin
}: ProjectTeamSectionProps) {
  const { members, isLoading, isError } = useProjectMembers(projectId);
  
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="text-lg font-semibold">Project Team</h2>
        {(userIsMember || isAdmin) && onAddMember && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onAddMember}
            className="flex items-center gap-1"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Member</span>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading team members...</span>
          </div>
        ) : isError ? (
          <div className="text-sm text-orange-500 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>Unable to load team members. Please try again later.</span>
          </div>
        ) : !members || members.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No team members assigned.
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {members.map((member) => {
              // Get initials for avatar fallback
              const nameParts = member.display_name?.split(' ') || [];
              const initials = nameParts.length > 1 
                ? `${nameParts[0]?.charAt(0) || ''}${nameParts[1]?.charAt(0) || ''}`
                : member.display_name?.substring(0, 2) || member.email?.substring(0, 2)?.toUpperCase() || 'U';
              
              return (
                <div key={member.user_id} className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    {initials.toUpperCase()}
                  </div>
                  <span className="text-sm">{member.display_name || member.email || 'Unknown User'}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
