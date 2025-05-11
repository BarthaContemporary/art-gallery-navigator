
import { useState, useEffect } from "react";
import { UserPlus, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember } from "@/hooks/projects/types/member-types";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ProjectMemberSelectProps {
  projectId?: string;
  initialMembers?: ProjectMember[];
  onMembersChange?: (members: ProjectMember[]) => void;
  readOnly?: boolean;
}

export function ProjectMemberSelect({ 
  projectId,
  initialMembers = [],
  onMembersChange,
  readOnly = false
}: ProjectMemberSelectProps) {
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers);
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Update members when initialMembers changes
  useEffect(() => {
    if (Array.isArray(initialMembers) && 
        JSON.stringify(initialMembers) !== JSON.stringify(members) &&
        initialMembers.length > 0) {
      setMembers(initialMembers);
    }
  }, [initialMembers, members]);
  
  // Fetch members when projectId is available
  useEffect(() => {
    if (!projectId || !user || readOnly) return;
    
    async function fetchProjectMembers() {
      setLoading(true);
      setError(null);
      
      try {
        const { data: projectUsers, error } = await supabase
          .from('project_users')
          .select(`
            user_id,
            project_id,
            profiles:user_id (
              id,
              display_name,
              avatar_url
            )
          `)
          .eq('project_id', projectId);
          
        if (error) {
          throw new Error("Failed to load team members");
        }
        
        const fetchedMembers: ProjectMember[] = [];
        
        // Process members from database
        if (projectUsers && projectUsers.length > 0) {
          projectUsers.forEach(pu => {
            const profile = pu.profiles || {};
            fetchedMembers.push({
              user_id: pu.user_id,
              project_id: projectId,
              display_name: profile.display_name || 'Unknown User',
              avatar_url: profile.avatar_url || null,
              email: profile.display_name || null // Using display_name as email
            });
          });
        }
        
        // Add current user if not present
        const currentUserInMembers = fetchedMembers.some(m => m.user_id === user.id);
        
        if (!currentUserInMembers && user.email) {
          fetchedMembers.push({
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email
          });
        }
        
        if (fetchedMembers.length > 0) {
          setMembers(fetchedMembers);
          onMembersChange?.(fetchedMembers);
        }
      } catch (err) {
        console.error("Error loading project members:", err);
        setError("Failed to load team members");
        
        // Fallback to current user
        if (user.email) {
          const currentUserMember: ProjectMember = {
            user_id: user.id,
            project_id: projectId,
            display_name: user.email,
            avatar_url: null,
            email: user.email
          };
          setMembers([currentUserMember]);
          onMembersChange?.([currentUserMember]);
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchProjectMembers();
  }, [projectId, user, onMembersChange, readOnly]);
  
  const handleAddMember = async () => {
    const email = emailInput.trim();
    
    if (!email) return;
    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }
    
    // Check for duplicates
    if (members.some(m => m.email?.toLowerCase() === email.toLowerCase())) {
      toast.warning(`${email} is already added to the project`);
      setEmailInput("");
      return;
    }
    
    setLoading(true);
    
    try {
      // Find user profile by email (display_name field)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('display_name', email)
        .single();
      
      if (profileError) {
        if (profileError.code === 'PGRST116') {
          toast.warning(`No user found with email ${email}`);
        } else {
          toast.error("Error finding user");
          console.error("Error finding user:", profileError);
        }
        setLoading(false);
        setEmailInput("");
        return;
      }
      
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('project_users')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', profile.id)
        .single();
        
      if (existingMember) {
        toast.info(`${email} is already a member of this project`);
        setLoading(false);
        setEmailInput("");
        return;
      }
      
      // Add the member
      const { error: addError } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: profile.id
        });
        
      if (addError) {
        throw addError;
      }
      
      // Create member object
      const newMember: ProjectMember = {
        user_id: profile.id,
        project_id: projectId,
        display_name: profile.display_name || email,
        avatar_url: profile.avatar_url || null,
        email: email
      };
      
      // Update state
      const updatedMembers = [...members, newMember];
      setMembers(updatedMembers);
      onMembersChange?.(updatedMembers);
      
      toast.success(`Added ${email} to the project`);
    } catch (err) {
      console.error("Error adding team member:", err);
      toast.error("Failed to add team member");
    } finally {
      setLoading(false);
      setEmailInput("");
    }
  };
  
  const handleRemoveMember = async (memberId: string) => {
    if (!projectId || readOnly) return;
    
    // Don't allow removing the last member
    if (members.length <= 1) {
      toast.warning("Projects must have at least one member");
      return;
    }
    
    // Don't allow removing yourself
    if (memberId === user?.id) {
      toast.warning("You cannot remove yourself from the project");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', memberId);
        
      if (error) throw error;
      
      // Update state
      const updatedMembers = members.filter(m => m.user_id !== memberId);
      setMembers(updatedMembers);
      onMembersChange?.(updatedMembers);
      
      toast.success("Team member removed");
    } catch (err) {
      console.error("Error removing team member:", err);
      toast.error("Failed to remove team member");
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddMember();
    }
  };
  
  return (
    <ErrorBoundary fallback={
      <div className="text-red-500 p-2 border border-red-300 rounded">
        Error loading member selection
      </div>
    }>
      <div className="space-y-3">
        {loading && !members.length ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 mr-2 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading members...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : (
          <>
            {/* Members List */}
            <div className="flex flex-wrap gap-2 mb-2">
              {members.map(member => {
                // Get initials for avatar fallback
                const nameParts = member.display_name?.split(' ') || [];
                const initials = nameParts.length > 1 
                  ? `${nameParts[0]?.charAt(0) || ''}${nameParts[1]?.charAt(0) || ''}`
                  : member.display_name?.substring(0, 2) || 'U';
                
                return (
                  <Badge 
                    key={member.user_id} 
                    variant="secondary" 
                    className="px-2 py-1 flex items-center gap-1.5"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {initials.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{member.display_name}</span>
                    {!readOnly && member.user_id !== user?.id && (
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer hover:text-destructive" 
                        onClick={() => handleRemoveMember(member.user_id)}
                      />
                    )}
                  </Badge>
                );
              })}
            </div>
            
            {/* Add Member Input */}
            {!readOnly && (
              <div className="flex gap-2">
                <Input
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Enter email address"
                  disabled={loading}
                  className="flex-1"
                />
                <Button 
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddMember}
                  disabled={!emailInput.trim() || loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-1" />
                      <span>Add</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
        
        {!readOnly && (
          <p className="text-xs text-muted-foreground">
            Enter email addresses of team members to invite to this project.
          </p>
        )}
      </div>
    </ErrorBoundary>
  );
}
