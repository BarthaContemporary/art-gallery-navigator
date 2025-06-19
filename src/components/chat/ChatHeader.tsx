
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Circle } from 'lucide-react';
import { ChatRoom } from '@/hooks/chat/types';
import { useAuth } from '@/hooks/use-auth';
import { useChatPresence } from '@/hooks/chat/use-chat-presence';
import { format } from 'date-fns';

interface ChatHeaderProps {
  room: ChatRoom;
  onBack?: () => void;
}

export function ChatHeader({ room, onBack }: ChatHeaderProps) {
  const { user } = useAuth();
  const { onlineUsers, fetchOnlineUsers } = useChatPresence(user?.id);
  
  // Determine which participant is the other user
  const otherParticipant = room.participant_1_id === user?.id 
    ? room.participant_2_profile 
    : room.participant_1_profile;

  const otherParticipantId = room.participant_1_id === user?.id 
    ? room.participant_2_id 
    : room.participant_1_id;

  const participantName = otherParticipant?.display_name || 'Unknown User';
  const participantInitials = participantName.split(' ').map(n => n[0]).join('').toUpperCase();

  // Find the presence status of the other participant
  const presenceStatus = onlineUsers.find(u => u.user_id === otherParticipantId);
  const isOnline = presenceStatus?.is_online || false;
  const lastSeen = presenceStatus?.last_seen;

  // Refresh presence data periodically
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchOnlineUsers();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [fetchOnlineUsers]);

  const getStatusText = () => {
    if (isOnline) {
      return 'Online';
    } else if (lastSeen) {
      const lastSeenDate = new Date(lastSeen);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) {
        return 'Just now';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
      } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours}h ago`;
      } else {
        return `Last seen ${format(lastSeenDate, 'MMM d')}`;
      }
    } else {
      return 'Offline';
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 border-b bg-white">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      
      <Avatar className="h-8 w-8">
        <AvatarImage src={otherParticipant?.avatar_url} />
        <AvatarFallback className="text-xs">{participantInitials}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <h3 className="font-semibold text-sm">{participantName}</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Circle 
            className={`h-2 w-2 ${
              isOnline 
                ? 'fill-green-500 text-green-500' 
                : 'fill-gray-400 text-gray-400'
            }`} 
          />
          <span>{getStatusText()}</span>
        </div>
      </div>
    </div>
  );
}
