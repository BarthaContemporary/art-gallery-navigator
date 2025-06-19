
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle } from 'lucide-react';
import { UserPresence } from '@/hooks/chat/chat-context/types';

interface ChatEmptyStateProps {
  onlineUsers: UserPresence[];
  onStartChat: (userId: string) => void;
}

export function ChatEmptyState({ onlineUsers, onStartChat }: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <MessageCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-medium mb-2">Welcome to Chat</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        Select a conversation from the sidebar or start a new chat with someone online.
      </p>
      
      {onlineUsers.length > 0 && (
        <div className="w-full max-w-md">
          <h4 className="text-sm font-medium mb-3">Start a conversation</h4>
          <div className="space-y-2">
            {onlineUsers.slice(0, 3).map((user) => {
              const userName = user.profile?.display_name || 'Unknown User';
              const userInitials = userName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div 
                  key={user.user_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.profile?.avatar_url} />
                      <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{userName}</span>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => onStartChat(user.user_id)}
                  >
                    Chat
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
