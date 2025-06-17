
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

  useEffect(() => {
    const updateUnreadCount = async () => {
      if (user?.id) {
        const count = await getTotalUnreadCount();
        setUnreadCount(count);
      }
    };

    updateUnreadCount();
    
    // Update unread count every 30 seconds
    const interval = setInterval(updateUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, [user?.id, getTotalUnreadCount]);

  return (
    <Button
      onClick={onClick}
      size="icon"
      className={`fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-40 transition-all duration-300 ${
        isOpen ? 'scale-95 opacity-75' : 'hover:scale-105'
      }`}
    >
      <MessageCircle className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
