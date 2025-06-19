
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle } from 'lucide-react';
import { useChatMessages } from '@/hooks/chat/use-chat-messages';
import { useAuth } from '@/hooks/use-auth';

interface ChatPopupButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function ChatPopupButton({ onClick, isOpen }: ChatPopupButtonProps) {
  const { user } = useAuth();
  const { getTotalUnreadCount } = useChatMessages(user?.id);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prevCount, setPrevCount] = useState(0);
  const [shouldPulse, setShouldPulse] = useState(false);

  useEffect(() => {
    const updateUnreadCount = async () => {
      if (user?.id) {
        const count = await getTotalUnreadCount();
        setPrevCount(unreadCount);
        setUnreadCount(count);
        
        // Trigger pulse animation when count increases
        if (count > unreadCount && count > 0) {
          setShouldPulse(true);
          setTimeout(() => setShouldPulse(false), 2000);
        }
      }
    };

    updateUnreadCount();
    
    // Update unread count every 30 seconds
    const interval = setInterval(updateUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, [user?.id, getTotalUnreadCount, unreadCount]);

  return (
    <Button
      onClick={onClick}
      size="icon"
      className={`fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-40 transition-all duration-300 ${
        isOpen ? 'scale-95 opacity-75' : 'hover:scale-105'
      } ${
        unreadCount > 0 && shouldPulse ? 'animate-pulse' : ''
      }`}
    >
      <MessageCircle className={`h-5 w-5 transition-transform duration-200 ${
        unreadCount > 0 ? 'animate-bounce' : ''
      }`} />
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className={`absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold shadow-lg border-2 border-white transition-all duration-300 ${
            shouldPulse ? 'animate-pulse scale-110' : ''
          } ${
            unreadCount > prevCount ? 'animate-bounce' : ''
          }`}
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
