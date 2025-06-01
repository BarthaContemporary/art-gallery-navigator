
import React, { useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChatRoom, useChat } from '@/hooks/chat/use-chat';
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';

interface ChatRoomsListProps {
  onSelectRoom: (room: ChatRoom) => Promise<void>;
  selectedRoomId?: string;
}

export function ChatRoomsList({ onSelectRoom, selectedRoomId }: ChatRoomsListProps) {
  const { user } = useAuth();
  const { chatRooms, fetchChatRooms } = useChat();

  useEffect(() => {
    if (user) {
      fetchChatRooms();
    }
  }, [user, fetchChatRooms]);

  const getOtherParticipant = (room: ChatRoom) => {
    if (room.participant_1_id === user?.id) {
      return room.participant_2_profile;
    }
    return room.participant_1_profile;
  };

  const formatLastMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  if (chatRooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-gray-500 text-sm">No conversations yet</p>
          <p className="text-gray-400 text-xs mt-1">Start chatting with someone online!</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        {chatRooms.map((room) => {
          const otherParticipant = getOtherParticipant(room);
          const isSelected = selectedRoomId === room.id;
          const hasUnread = (room.unread_count || 0) > 0;

          return (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className={`
                p-3 rounded-lg cursor-pointer transition-colors mb-2
                ${isSelected 
                  ? 'bg-blue-100 border border-blue-200' 
                  : 'hover:bg-gray-50 border border-transparent'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={otherParticipant?.avatar_url} />
                  <AvatarFallback>
                    {otherParticipant?.display_name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <h3 className={`font-medium text-sm truncate ${hasUnread ? 'font-semibold' : ''}`}>
                        {otherParticipant?.display_name || 'Unknown User'}
                      </h3>
                      {room.last_message_at && (
                        <span className="text-xs text-gray-500 mt-0.5">
                          {formatLastMessageTime(room.last_message_at)}
                        </span>
                      )}
                    </div>
                    {hasUnread && (
                      <Badge variant="default" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs ml-2">
                        {room.unread_count}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1">
                    {room.last_message ? (
                      <p className={`text-sm text-gray-600 truncate ${hasUnread ? 'font-medium' : ''}`}>
                        {room.last_message.message_type === 'text' 
                          ? (room.last_message.encrypted_content ? 'New message' : 'Message')
                          : `${room.last_message.message_type} message`
                        }
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Start the conversation...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
