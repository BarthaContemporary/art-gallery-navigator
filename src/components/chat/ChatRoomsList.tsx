
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle } from 'lucide-react';
import { ChatRoom, useChat } from '@/hooks/use-chat';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';

interface ChatRoomsListProps {
  onSelectRoom: (room: ChatRoom) => void;
  selectedRoomId?: string;
}

export function ChatRoomsList({ onSelectRoom, selectedRoomId }: ChatRoomsListProps) {
  const { chatRooms } = useChat();
  const { user } = useAuth();

  const getOtherParticipant = (room: ChatRoom) => {
    if (room.participant_1_id === user?.id) {
      return room.participant_2_profile;
    }
    return room.participant_1_profile;
  };

  if (chatRooms.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white border-r">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Chats</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start a chat with someone online</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-r">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Chats</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {chatRooms.map((room) => {
            const otherParticipant = getOtherParticipant(room);
            const isSelected = selectedRoomId === room.id;
            
            return (
              <Button
                key={room.id}
                variant={isSelected ? "secondary" : "ghost"}
                className="w-full p-3 h-auto justify-start mb-1 hover:bg-gray-50"
                onClick={() => onSelectRoom(room)}
              >
                <div className="flex items-center space-x-3 w-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={otherParticipant?.avatar_url} />
                    <AvatarFallback>
                      {otherParticipant?.display_name?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">
                        {otherParticipant?.display_name || 'Unknown User'}
                      </p>
                      {room.last_message_at && (
                        <span className="text-xs text-gray-500">
                          {format(new Date(room.last_message_at), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {room.last_message?.decrypted_content || 'No messages yet'}
                    </p>
                  </div>
                  
                  {room.unread_count && room.unread_count > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {room.unread_count}
                    </Badge>
                  )}
                </div>
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
