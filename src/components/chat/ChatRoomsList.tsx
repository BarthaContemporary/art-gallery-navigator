
import React from 'react';
import { useSimpleChat } from '@/hooks/chat/chat-context/SimpleChatContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { ChatRoom } from '@/hooks/chat/chat-context/types';

interface ChatRoomsListProps {
  onSelectRoom: (room: ChatRoom) => void;
  selectedRoomId?: string;
}

export function ChatRoomsList({ onSelectRoom, selectedRoomId }: ChatRoomsListProps) {
  const { user } = useAuth();
  const { roomsList, state } = useSimpleChat();

  if (state.loading.rooms) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading conversations...</div>
      </div>
    );
  }

  if (roomsList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-sm text-muted-foreground mb-2">No conversations yet</div>
        <div className="text-xs text-muted-foreground">
          Start a conversation with someone online
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {roomsList.map((room) => {
        const otherParticipant = room.participant_1_id === user?.id 
          ? room.participant_2_profile 
          : room.participant_1_profile;
        
        const participantName = otherParticipant?.display_name || 'Unknown User';
        const participantInitials = participantName
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        const isSelected = selectedRoomId === room.id;
        const hasUnreadMessages = room.unread_count && room.unread_count > 0;

        return (
          <div
            key={room.id}
            onClick={() => onSelectRoom(room)}
            className={`flex items-center gap-3 p-4 cursor-pointer border-b hover:bg-muted/50 transition-colors ${
              isSelected ? 'bg-muted' : ''
            }`}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={otherParticipant?.avatar_url} />
              <AvatarFallback>{participantInitials}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className={`font-medium truncate ${hasUnreadMessages ? 'font-semibold' : ''}`}>
                  {participantName}
                </h4>
                {room.last_message_at && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatDistanceToNow(new Date(room.last_message_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              
              {room.last_message && (
                <p className={`text-sm truncate mt-1 ${
                  hasUnreadMessages ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}>
                  {room.last_message.encrypted_content || 'No messages yet'}
                </p>
              )}
            </div>
            
            {hasUnreadMessages && (
              <Badge variant="default" className="ml-2">
                {room.unread_count}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
