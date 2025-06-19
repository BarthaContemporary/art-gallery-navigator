
import React from 'react';
import { useChat } from '@/hooks/chat/chat-context/ChatContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface OnlineUsersListProps {
  onStartChat: (userId: string) => void;
}

export function OnlineUsersList({ onStartChat }: OnlineUsersListProps) {
  const { onlineUsersList } = useChat();

  if (onlineUsersList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-sm text-muted-foreground mb-2">No users online</div>
        <div className="text-xs text-muted-foreground">
          Check back later for active users
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {onlineUsersList.map((presence) => {
        const userName = presence.profile?.display_name || 'Unknown User';
        const userInitials = userName
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <div
            key={presence.user_id}
            className="flex items-center gap-3 p-4 border-b hover:bg-muted/50 transition-colors"
          >
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={presence.profile?.avatar_url} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{userName}</h4>
              <p className="text-sm text-muted-foreground">Online</p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStartChat(presence.user_id)}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
