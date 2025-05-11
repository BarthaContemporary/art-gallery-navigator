
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProjectMember } from "@/hooks/projects/types/project-types";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface ProjectTeamSectionProps {
  projectMembers: ProjectMember[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onAddMember?: () => void;
  userIsMember?: boolean;
  isAdmin?: boolean;
}

export function ProjectTeamSection({ 
  projectMembers, 
  isLoading, 
  isError, 
  onAddMember,
  userIsMember,
  isAdmin
}: ProjectTeamSectionProps) {
  const { user } = useAuth();
  
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
            <span>Unable to load all team members. Showing current user only.</span>
          </div>
        ) : !projectMembers || projectMembers.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {user ? `Team members: ${user.email || 'Current User'}` : 'No team members assigned.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {projectMembers.map((member, index) => (
              <div key={`${member.user_id}-${index}`} className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback>
                    {member.display_name?.substring(0, 2)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{member.display_name || 'Unknown User'}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
