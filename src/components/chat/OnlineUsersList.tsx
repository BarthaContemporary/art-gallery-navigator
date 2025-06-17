
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Circle, MessageCircle } from 'lucide-react';
import { useChatPresence } from '@/hooks/chat/use-chat-presence';
import { format } from 'date-fns';

interface OnlineUsersListProps {
  onStartChat: (userId: string) => Promise<void>;
}

export function OnlineUsersList({ onStartChat }: OnlineUsersListProps) {
  const { onlineUsers } = useChatPresence();

  if (onlineUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-2">No users online</h3>
        <p className="text-sm text-muted-foreground">
          Check back later to see who's available to chat
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-2">
        <h3 className="font-medium text-sm text-muted-foreground mb-3">
          Online Users ({onlineUsers.length})
        </h3>
        
        {onlineUsers.map((userPresence) => {
          const userName = userPresence.profile?.display_name || 'Unknown User';
          const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase();
          const lastSeen = new Date(userPresence.last_seen);
          const isOnline = userPresence.is_online;
          
          return (
            <div key={userPresence.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userPresence.profile?.avatar_url} />
                  <AvatarFallback className="text-sm">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1">
                  <Circle 
                    className={`h-3 w-3 ${
                      isOnline 
                        ? 'fill-green-500 text-green-500' 
                        : 'fill-gray-400 text-gray-400'
                    }`} 
                  />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{userName}</p>
                <p className="text-xs text-muted-foreground">
                  {isOnline ? 'Online now' : `Last seen ${format(lastSeen, 'MMM d, HH:mm')}`}
                </p>
              </div>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStartChat(userPresence.user_id)}
                className="flex-shrink-0"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
