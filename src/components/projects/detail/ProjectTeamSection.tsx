import { Card, CardContent } from "@/components/ui/card"; // Removed CardHeader
import { Loader2, AlertCircle } from "lucide-react";
// Button and UserPlus for "Add Member" removed
// import { Button } from "@/components/ui/button";
// import { UserPlus } from "lucide-react";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { useAuth } from "@/hooks/use-auth"; // Added useAuth to check isAdmin for display

interface ProjectTeamSectionProps {
  projectId?: string;
  // onAddMember removed
  // userIsMember?: boolean; // This might not be relevant if only admins see this section
  // isAdmin?: boolean; // We can get this from useAuth
}

export function ProjectTeamSection({ 
  projectId,
}: ProjectTeamSectionProps) {
  const { members, isLoading, isError } = useProjectMembers(projectId);
  const { isAdmin } = useAuth();
  
  // If not admin, don't show this section or show a restricted message
  if (!isAdmin) {
    return null; // Or a message like "Team information is available to project administrators."
  }

  return (
    <Card className="mb-6">
      {/* CardHeader removed */}
      <CardContent className="pt-6"> {/* Added pt-6 to CardContent for spacing since header is removed */}
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
                  {member.is_admin && <span className="text-xs text-muted-foreground">(Admin)</span>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
