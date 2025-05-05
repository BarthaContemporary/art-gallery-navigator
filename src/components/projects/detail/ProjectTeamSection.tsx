
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProjectMember } from "@/hooks/projects/types/project-types";

interface ProjectTeamSectionProps {
  projectMembers: ProjectMember[] | undefined;
}

export function ProjectTeamSection({ projectMembers }: ProjectTeamSectionProps) {
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="text-lg font-semibold">Project Team</h2>
      </CardHeader>
      <CardContent>
        {!projectMembers || projectMembers.length === 0 ? (
          <div className="text-sm text-muted-foreground">No team members assigned.</div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {projectMembers.map(member => (
              <div key={member.user_id} className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback>
                    {member.display_name?.substring(0, 2)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{member.display_name || 'User'}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
