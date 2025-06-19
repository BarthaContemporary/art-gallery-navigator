
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';
import { useChat } from '@/contexts/chat/ChatContext';
import { useAuth } from '@/hooks/use-auth';
import { ChatRoom } from '@/services/chat/ChatService';
import { format } from 'date-fns';

interface NewChatRoomsListProps {
  onSelectRoom: (room: ChatRoom) => void;
  selectedRoomId?: string;
}

export function NewChatRoomsList({ onSelectRoom, selectedRoomId }: NewChatRoomsListProps) {
  const { state } = useChat();
  const { user } = useAuth();

  if (state.loading.rooms) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (state.rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium mb-2">No conversations yet</h3>
        <p className="text-sm text-muted-foreground">
          Start a conversation with someone from the Online tab
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {state.rooms.map((room) => {
          const otherParticipant = room.participant_1_id === user?.id 
            ? room.participant_2_profile 
            : room.participant_1_profile;
          
          const isSelected = room.id === selectedRoomId;
          
          return (
            <Button
              key={room.id}
              variant={isSelected ? "secondary" : "ghost"}
              className="w-full justify-start h-auto p-3"
              onClick={() => onSelectRoom(room)}
            >
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={otherParticipant?.avatar_url} />
                  <AvatarFallback>
                    {otherParticipant?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {otherParticipant?.display_name || 'Unknown User'}
                    </span>
                    {room.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(room.last_message_at), 'MMM d')}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground truncate">
                    {room.last_message_at ? 'Tap to view conversation' : 'New conversation'}
                  </p>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
