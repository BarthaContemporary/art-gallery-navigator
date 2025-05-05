
import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProjectUserEmailInputProps {
  onEmailsChange: (emails: string[]) => void;
  initialEmails?: string[];
}

export function ProjectUserEmailInput({ 
  onEmailsChange, 
  initialEmails = [] 
}: ProjectUserEmailInputProps) {
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Update parent component when emails change
  useEffect(() => {
    onEmailsChange(emails);
  }, [emails, onEmailsChange]);

  // Update local state when initialEmails prop changes
  useEffect(() => {
    if (JSON.stringify(initialEmails) !== JSON.stringify(emails)) {
      setEmails(initialEmails);
    }
  }, [initialEmails]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = () => {
    if (!currentEmail.trim()) {
      setError("Please enter an email address");
      return;
    }

    if (!validateEmail(currentEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    if (emails.includes(currentEmail)) {
      setError("This email has already been added");
      return;
    }

    setEmails([...emails, currentEmail]);
    setCurrentEmail("");
    setError(null);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Enter email address"
          value={currentEmail}
          onChange={(e) => {
            setCurrentEmail(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button 
          type="button" 
          size="sm"
          onClick={handleAddEmail}
          variant="secondary"
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      
      {error && <p className="text-sm text-red-500">{error}</p>}
      
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {emails.map((email, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              {email}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => handleRemoveEmail(email)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
