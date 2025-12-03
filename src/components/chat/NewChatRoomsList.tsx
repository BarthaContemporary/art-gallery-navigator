
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { useChat } from '@/contexts/chat/ChatContext';
import { useAuth } from '@/hooks/use-auth';
import { ChatRoom } from '@/services/chat/ChatService';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface NewChatRoomsListProps {
  onSelectRoom: (room: ChatRoom) => void;
  selectedRoomId?: string;
}

export function NewChatRoomsList({ onSelectRoom, selectedRoomId }: NewChatRoomsListProps) {
  const { state } = useChat();
  const { user } = useAuth();

  if (state.loading.rooms) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (state.rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="h-12 w-12 rounded bg-muted/30 flex items-center justify-center mb-3 border border-border/50">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-xs font-medium mb-1">No conversations</h3>
        <p className="text-[10px] text-muted-foreground font-mono">
          Start chatting from the Users tab
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-1.5 space-y-0.5">
        {state.rooms.map((room) => {
          const otherParticipant = room.participant_1_id === user?.id 
            ? room.participant_2_profile 
            : room.participant_1_profile;
          
          const isSelected = room.id === selectedRoomId;
          
          return (
            <button
              key={room.id}
              className={cn(
                "w-full flex items-center gap-2.5 p-2 text-left transition-all",
                "hover:bg-muted/50 group",
                isSelected && "bg-primary/5 border-l-2 border-primary"
              )}
              onClick={() => onSelectRoom(room)}
            >
              <div className="relative flex-shrink-0">
                <div className="h-8 w-8 rounded bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-border/50">
                  <span className="text-xs font-medium">
                    {otherParticipant?.display_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">
                    {otherParticipant?.display_name || 'Unknown User'}
                  </span>
                  {room.last_message_at && (
                    <span className="text-[9px] font-mono text-muted-foreground flex-shrink-0">
                      {format(new Date(room.last_message_at), 'MMM d')}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {room.last_message_at ? 'Tap to continue' : 'New conversation'}
                </p>
              </div>

              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
