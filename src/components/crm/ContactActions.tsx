
import { Mail, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ContactActionsProps {
  email?: string;
  phone?: string;
}

export function ContactActions({ email, phone }: ContactActionsProps) {
  const handleMailClick = () => {
    if (email) {
      window.open(`mailto:${email}`, '_blank');
    }
  };

  const handlePhoneClick = () => {
    if (phone) {
      window.open(`tel:${phone}`, '_blank');
    }
  };

  const handleSMSClick = () => {
    if (phone) {
      window.open(`sms:${phone}`, '_blank');
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {email && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMailClick}
                className="h-6 w-6 p-0"
              >
                <Mail className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send Email</TooltipContent>
          </Tooltip>
        )}
        
        {phone && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePhoneClick}
                  className="h-6 w-6 p-0"
                >
                  <Phone className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Call</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSMSClick}
                  className="h-6 w-6 p-0"
                >
                  <MessageSquare className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send SMS</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
