
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
  const [emails, setEmails] = useState<string[]>(initialEmails || []);
  const [currentInput, setCurrentInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // When initialEmails changes, update our state
  useEffect(() => {
    if (Array.isArray(initialEmails) && 
        JSON.stringify(initialEmails) !== JSON.stringify(emails) &&
        initialEmails.length > 0) {
      console.log("Updating emails from initialEmails:", initialEmails);
      setEmails(initialEmails);
    }
  }, [initialEmails, emails]);
  
  // When projectId is provided, try to fetch existing members
  useEffect(() => {
    async function fetchMembers() {
      if (!projectId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const { data: projectUsers, error } = await supabase
          .from('project_users')
          .select(`
            user_id,
            profiles:user_id (
              id,
              display_name,
              email:display_name
            )
          `)
          .eq('project_id', projectId);
          
        if (error) {
          console.error("Error fetching project members:", error);
          throw new Error("Failed to load team members");
        }
        
        if (projectUsers && projectUsers.length > 0) {
          // Extract email addresses from profiles
          const memberEmails = projectUsers
            .map(pu => pu.profiles?.email)
            .filter((email): email is string => !!email);
          
          if (memberEmails.length > 0) {
            setEmails(memberEmails);
            onEmailsChange(memberEmails);
          }
        }
        
        // Always include current user if they exist
        if (user && user.email) {
          setEmails(prev => {
            // Add current user if not present
            if (!prev.includes(user.email!)) {
              const updated = [...prev, user.email!];
              onEmailsChange(updated);
              return updated;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Error in fetchMembers:", err);
        setError("An error occurred loading team members");
        
        // Fallback to current user
        if (user && user.email) {
          setEmails([user.email]);
          onEmailsChange([user.email]);
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchMembers();
  }, [projectId, onEmailsChange, user]);
  
  // Update parent component when emails change
  useEffect(() => {
    onEmailsChange(emails);
  }, [emails, onEmailsChange]);
  
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addEmail();
    }
  };
  
  const addEmail = () => {
    const trimmedInput = currentInput.trim();
    
    // Skip empty inputs
    if (!trimmedInput) {
      return;
    }
    
    // Check for duplicates
    if (emails.includes(trimmedInput)) {
      toast.warning(`Email "${trimmedInput}" has already been added`);
      setCurrentInput("");
      return;
    }
    
    console.log(`Adding email: ${trimmedInput}`);
    setEmails(prev => [...(prev || []), trimmedInput]);
    setCurrentInput("");
  };
  
  const removeEmail = (emailToRemove: string) => {
    console.log(`Removing email: ${emailToRemove}`);
    setEmails(prev => (prev || []).filter(email => email !== emailToRemove));
  };
  
  const handleInputBlur = () => {
    if (currentInput.trim()) {
      addEmail();
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
          {emails && emails.map((email, index) => (
            <Badge key={`${email}-${index}`} variant="secondary" className="px-3 py-1">
              {email}
              <X 
                className="ml-2 h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => removeEmail(email)}
              />
            </Badge>
          ))}
        </div>
        
        <Input 
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          placeholder="Enter email address"
          className="w-full"
        />
        
        <p className="text-xs text-muted-foreground mt-1">
          Enter email addresses of team members to invite to this project. 
          Press Enter or click outside to add each email.
        </p>
      </div>
    </ErrorBoundary>
  );
}
