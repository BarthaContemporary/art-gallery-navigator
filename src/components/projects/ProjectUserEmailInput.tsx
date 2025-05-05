
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface ProjectUserEmailInputProps {
  initialEmails?: string[];
  onEmailsChange: (emails: string[]) => void;
}

export function ProjectUserEmailInput({ 
  initialEmails = [],
  onEmailsChange
}: ProjectUserEmailInputProps) {
  const [usernames, setUsernames] = useState<string[]>(initialEmails || []);
  const [currentInput, setCurrentInput] = useState("");
  
  // Update parent component when usernames change
  useEffect(() => {
    onEmailsChange(usernames);
  }, [usernames, onEmailsChange]);
  
  // Update internal state when initialEmails changes
  useEffect(() => {
    if (JSON.stringify(initialEmails) !== JSON.stringify(usernames)) {
      setUsernames(initialEmails || []);
    }
  }, [initialEmails]);
  
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Add username on Enter, comma, or space
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addUsername();
    }
  };
  
  const addUsername = () => {
    const trimmedInput = currentInput.trim();
    
    // Skip empty inputs and duplicates
    if (trimmedInput && !usernames.includes(trimmedInput)) {
      setUsernames([...usernames, trimmedInput]);
      setCurrentInput("");
    }
  };
  
  const removeUsername = (usernameToRemove: string) => {
    setUsernames(usernames.filter(username => username !== usernameToRemove));
  };
  
  const handleInputBlur = () => {
    if (currentInput.trim()) {
      addUsername();
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {usernames.map((username, index) => (
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
        placeholder="Enter username"
        className="w-full"
      />
      
      <p className="text-xs text-muted-foreground mt-1">
        Press Enter, comma, space, or click outside to add each username
      </p>
    </div>
  );
}
