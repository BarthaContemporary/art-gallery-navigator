
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle } from 'lucide-react';
import { useChat } from '@/hooks/chat/chat-context/ChatContext';
import { useAuth } from '@/hooks/use-auth';
import { ChatRoom } from '@/hooks/chat/chat-context/types';
import { format } from 'date-fns';

interface ChatRoomsListProps {
  onSelectRoom: (room: ChatRoom) => Promise<void>;
  selectedRoomId?: string;
}

export function ChatRoomsList({ onSelectRoom, selectedRoomId }: ChatRoomsListProps) {
  const { roomsList, state } = useChat();
  const { user } = useAuth();

  if (state.loading.rooms) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 animate-pulse">
          <MessageCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-2">Loading conversations...</h3>
      </div>
    );
  }

  if (roomsList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-2">No conversations yet</h3>
        <p className="text-sm text-muted-foreground">
          Start a conversation with someone from the online users list
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-1">
        {roomsList.map((room) => {
          const otherParticipant = room.participant_1_id === user?.id 
            ? room.participant_2_profile 
            : room.participant_1_profile;
          
          const participantName = otherParticipant?.display_name || 'Unknown User';
          const participantInitials = participantName.split(' ').map(n => n[0]).join('').toUpperCase();
          
          const lastMessage = room.last_message;
          const lastMessagePreview = lastMessage?.message_type === 'image' 
            ? '📷 Image' 
            : lastMessage?.encrypted_content || 'No messages yet';
          
          const isSelected = selectedRoomId === room.id;
          
          return (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                isSelected 
                  ? 'bg-primary/10 border border-primary/20' 
                  : 'hover:bg-muted/50'
              }`}
            >
              <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage src={otherParticipant?.avatar_url} />
                <AvatarFallback>{participantInitials}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm truncate">{participantName}</p>
                  {room.last_message_at && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(room.last_message_at), 'MMM d')}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate">
                    {lastMessagePreview}
                  </p>
                  
                  {room.unread_count && room.unread_count > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {room.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
