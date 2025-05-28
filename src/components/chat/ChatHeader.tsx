
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft } from 'lucide-react';
import { ChatRoom } from '@/hooks/chat/use-chat';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatHeaderProps {
  room: ChatRoom;
  onBack?: () => void;
}

export function ChatHeader({ room, onBack }: ChatHeaderProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const otherParticipant = room.participant_1_id === user?.id 
    ? room.participant_2_profile 
    : room.participant_1_profile;

  return (
    <div className="p-4 border-b bg-white flex items-center space-x-3">
      {isMobile && onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      
      <Avatar className="h-8 w-8">
        <AvatarImage src={otherParticipant?.avatar_url} />
        <AvatarFallback>
          {otherParticipant?.display_name?.slice(0, 2).toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <h3 className="font-semibold text-sm">
          {otherParticipant?.display_name || 'Unknown User'}
        </h3>
        <p className="text-xs text-gray-500">Online</p>
      </div>
    </div>
  );
}
