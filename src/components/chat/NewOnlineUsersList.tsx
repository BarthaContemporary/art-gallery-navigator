
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Users, MessageCircle, Circle } from 'lucide-react';
import { useChat } from '@/contexts/chat/ChatContext';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface NewOnlineUsersListProps {
  onStartChat: (userId: string) => void;
}

export function NewOnlineUsersList({ onStartChat }: NewOnlineUsersListProps) {
  const { state } = useChat();
  const { user } = useAuth();

  const onlineUsers = state.onlineUsers.filter(u => u.user_id !== user?.id);

  if (onlineUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="h-12 w-12 rounded bg-muted/30 flex items-center justify-center mb-3 border border-border/50">
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-xs font-medium mb-1">No users online</h3>
        <p className="text-[10px] text-muted-foreground font-mono">
          Check back later
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-1.5 space-y-0.5">
        {onlineUsers.map((presence) => (
          <div
            key={presence.user_id}
            className="flex items-center gap-2.5 p-2 hover:bg-muted/50 transition-colors group"
          >
            <div className="relative flex-shrink-0">
              <div className="h-8 w-8 rounded bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center border border-green-500/20">
                <span className="text-xs font-medium">
                  {presence.profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-green-500 text-green-500" />
            </div>
            
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium block truncate">
                {presence.profile?.display_name || 'Unknown User'}
              </span>
              <span className="text-[9px] font-mono text-green-600">
                online
              </span>
            </div>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
              onClick={() => onStartChat(presence.user_id)}
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
