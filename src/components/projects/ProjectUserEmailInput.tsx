
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useAuth } from "@/hooks/use-auth";

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
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // When initialEmails changes, update our state
  useEffect(() => {
    if (Array.isArray(initialEmails) && 
        JSON.stringify(initialEmails) !== JSON.stringify(usernames) &&
        initialEmails.length > 0) {
      console.log("Updating usernames from initialEmails:", initialEmails);
      setUsernames(initialEmails);
    }
  }, [initialEmails, usernames]);
  
  // When projectId is provided, try to fetch existing members
  useEffect(() => {
    async function fetchMembers() {
      if (!projectId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Just use current user to avoid RLS issues
        if (user) {
          const currentUsername = user.email || 'Current User';
          setUsernames(prev => {
            // Add current user if not present
            if (!prev.includes(currentUsername)) {
              const updated = [...prev, currentUsername];
              onEmailsChange(updated);
              return updated;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Error in fetchMembers:", err);
        setError("An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    
    fetchMembers();
  }, [projectId, onEmailsChange, user]);
  
  // Update parent component when usernames change
  useEffect(() => {
    onEmailsChange(usernames);
  }, [usernames, onEmailsChange]);
  
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
    
    console.log(`Adding username: ${trimmedInput}`);
    setUsernames(prev => [...(prev || []), trimmedInput]);
    setCurrentInput("");
  };
  
  const removeUsername = (usernameToRemove: string) => {
    console.log(`Removing username: ${usernameToRemove}`);
    setUsernames(prev => (prev || []).filter(username => username !== usernameToRemove));
  };
  
  const handleInputBlur = () => {
    if (currentInput.trim()) {
      addUsername();
    }
  };
  
  return (
    <ErrorBoundary fallback={
      <div className="text-red-500 p-2 border border-red-300 rounded">
        Error loading team member input
      </div>
    }>
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading team members...
          </div>
        ) : error ? (
          <div className="text-sm text-red-500 mb-2">{error}</div>
        ) : null}
        
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
    </ErrorBoundary>
  );
}
