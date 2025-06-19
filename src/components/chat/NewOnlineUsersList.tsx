
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, MessageCircle } from 'lucide-react';
import { useChat } from '@/contexts/chat/ChatContext';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';

interface NewOnlineUsersListProps {
  onStartChat: (userId: string) => void;
}

export function NewOnlineUsersList({ onStartChat }: NewOnlineUsersListProps) {
  const { state } = useChat();
  const { user } = useAuth();

  const onlineUsers = state.onlineUsers.filter(u => u.user_id !== user?.id);

  if (onlineUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium mb-2">No one online</h3>
        <p className="text-sm text-muted-foreground">
          Check back later to see who's available to chat
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {onlineUsers.map((presence) => (
          <div
            key={presence.user_id}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50"
          >
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={presence.profile?.avatar_url} />
                <AvatarFallback>
                  {presence.profile?.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {presence.profile?.display_name || 'Unknown User'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Active {format(new Date(presence.last_seen), 'MMM d, HH:mm')}
              </p>
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStartChat(presence.user_id)}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
