
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle } from 'lucide-react';

interface ChatPopupButtonProps {
  onClick: () => void;
  unreadCount?: number;
  isOpen: boolean;
}

export function ChatPopupButton({ onClick, unreadCount = 0, isOpen }: ChatPopupButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40 transition-all duration-300 ${
        isOpen ? 'scale-95 opacity-75' : 'hover:scale-105'
      }`}
    >
      <MessageCircle className="h-6 w-6" />
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
