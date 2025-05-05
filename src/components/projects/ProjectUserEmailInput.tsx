
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProjectUserEmailInputProps {
  projectId?: string;
  initialEmails?: string[];
  onEmailsChange: (emails: string[]) => void;
}

export function ProjectUserEmailInput({ 
  projectId,
  initialEmails = [],
  onEmailsChange
}: ProjectUserEmailInputProps) {
  const [usernames, setUsernames] = useState<string[]>(initialEmails || []);
  const [currentInput, setCurrentInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // When projectId is provided, fetch existing members
  useEffect(() => {
    async function fetchMembers() {
      if (!projectId) return;
      
      setLoading(true);
      try {
        // First fetch the project users
        const { data: projectUsers, error } = await supabase
          .from('project_users')
          .select('user_id')
          .eq('project_id', projectId);
          
        if (error) {
          console.error("Error fetching project users:", error);
          setLoading(false);
          return;
        }
        
        if (!projectUsers || projectUsers.length === 0) {
          setLoading(false);
          return;
        }
        
        // Then get the display names from profiles
        const userIds = projectUsers.map(pu => pu.user_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);
        
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          setLoading(false);
          return;
        }
        
        if (profiles && profiles.length > 0) {
          const names = profiles
            .filter(p => p.display_name)
            .map(p => p.display_name as string);
          
          setUsernames(prev => {
            // Combine with any existing names without duplicates
            const combined = [...new Set([...prev, ...names])];
            onEmailsChange(combined); // Update parent
            return combined;
          });
        }
      } catch (err) {
        console.error("Error in fetchMembers:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchMembers();
  }, [projectId, onEmailsChange]);
  
  // Update parent component when usernames change
  useEffect(() => {
    onEmailsChange(usernames);
  }, [usernames, onEmailsChange]);
  
  // Update internal state when initialEmails changes
  useEffect(() => {
    if (Array.isArray(initialEmails) && 
        JSON.stringify(initialEmails) !== JSON.stringify(usernames) &&
        initialEmails.length > 0) {
      setUsernames(initialEmails);
    }
  }, [initialEmails, usernames]);
  
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Add username on Enter, comma, or space
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addUsername();
    }
  };
  
  const addUsername = () => {
    const trimmedInput = currentInput.trim();
    
    // Skip empty inputs
    if (!trimmedInput) {
      return;
    }
    
    // Check for duplicates
    if (usernames.includes(trimmedInput)) {
      toast.warning(`Username "${trimmedInput}" has already been added`);
      setCurrentInput("");
      return;
    }
    
    setUsernames(prev => [...(prev || []), trimmedInput]);
    setCurrentInput("");
  };
  
  const removeUsername = (usernameToRemove: string) => {
    setUsernames(prev => (prev || []).filter(username => username !== usernameToRemove));
  };
  
  const handleInputBlur = () => {
    if (currentInput.trim()) {
      addUsername();
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading team members...
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {usernames && usernames.map((username, index) => (
          <Badge key={`${username}-${index}`} variant="secondary" className="px-3 py-1">
            {username}
            <X 
              className="ml-2 h-3 w-3 cursor-pointer hover:text-destructive" 
              onClick={() => removeUsername(username)}
            />
          </Badge>
        ))}
      </div>
      
      <Input 
        value={currentInput}
        onChange={(e) => setCurrentInput(e.target.value)}
        onKeyDown={handleInputKeyDown}
        onBlur={handleInputBlur}
        placeholder="Enter username (display name)"
        className="w-full"
      />
      
      <p className="text-xs text-muted-foreground mt-1">
        Enter usernames (display names) of team members to invite to this project. 
        Press Enter or click outside to add each username.
      </p>
    </div>
  );
}
