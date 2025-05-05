
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
  const [emails, setEmails] = useState<string[]>(initialEmails || []);
  const [currentInput, setCurrentInput] = useState("");
  
  // Update parent component when emails change
  useEffect(() => {
    onEmailsChange(emails);
  }, [emails, onEmailsChange]);
  
  // Update internal state when initialEmails changes
  useEffect(() => {
    if (JSON.stringify(initialEmails) !== JSON.stringify(emails)) {
      setEmails(initialEmails || []);
    }
  }, [initialEmails]);
  
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Add email on Enter, comma, or space
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addEmail();
    }
  };
  
  const addEmail = () => {
    const trimmedInput = currentInput.trim();
    
    // Skip empty inputs and duplicates
    if (trimmedInput && !emails.includes(trimmedInput)) {
      setEmails([...emails, trimmedInput]);
      setCurrentInput("");
    }
  };
  
  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };
  
  const handleInputBlur = () => {
    if (currentInput.trim()) {
      addEmail();
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {emails.map((email, index) => (
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
        placeholder="Enter username or email"
        className="w-full"
      />
      
      <p className="text-xs text-muted-foreground mt-1">
        Press Enter, comma, space, or click outside to add each username
      </p>
    </div>
  );
}
