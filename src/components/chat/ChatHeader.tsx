
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { ChatRoom } from '@/hooks/chat/chat-context/types';
import { useAuth } from '@/hooks/use-auth';

interface ChatHeaderProps {
  room: ChatRoom;
  onBack?: () => void;
}

export function ChatHeader({ room, onBack }: ChatHeaderProps) {
  const { user } = useAuth();
  
  const otherParticipant = room.participant_1_id === user?.id 
    ? room.participant_2_profile 
    : room.participant_1_profile;
  
  const participantName = otherParticipant?.display_name || 'Unknown User';
  const participantInitials = participantName.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="flex items-center gap-3 p-4 border-b bg-white">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      
      <Avatar className="h-10 w-10">
        <AvatarImage src={otherParticipant?.avatar_url} />
        <AvatarFallback>{participantInitials}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <h3 className="font-medium">{participantName}</h3>
        <p className="text-sm text-muted-foreground">Online</p>
      </div>
      
      <Button variant="ghost" size="sm">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}
