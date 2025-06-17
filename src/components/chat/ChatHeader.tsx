
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Circle } from 'lucide-react';
import { ChatRoom } from '@/hooks/chat/types';
import { useAuth } from '@/hooks/use-auth';

interface ChatHeaderProps {
  room: ChatRoom;
  onBack?: () => void;
}

export function ChatHeader({ room, onBack }: ChatHeaderProps) {
  const { user } = useAuth();
  
  // Determine which participant is the other user
  const otherParticipant = room.participant_1_id === user?.id 
    ? room.participant_2_profile 
    : room.participant_1_profile;

  const participantName = otherParticipant?.display_name || 'Unknown User';
  const participantInitials = participantName.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="flex items-center gap-3 p-4 border-b bg-white">
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
          <Circle className="h-2 w-2 fill-green-500 text-green-500" />
          <span>Online</span>
        </div>
      </div>
    </div>
  );
}
