
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatMessage } from '@/hooks/chat/types';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const senderName = message.sender_profile?.display_name || 'Unknown User';
  const senderInitials = senderName.split(' ').map(n => n[0]).join('').toUpperCase();

  const isImage = message.message_type === 'image';
  const content = message.encrypted_content;

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.sender_profile?.avatar_url} />
          <AvatarFallback className="text-xs">{senderInitials}</AvatarFallback>
        </Avatar>
      )}
      
      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <span className="text-xs text-muted-foreground mb-1">
            {senderName}
          </span>
        )}
        
        <div className={`rounded-lg px-3 py-2 ${
          isOwn 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        }`}>
          {isImage ? (
            <div className="space-y-2">
              <img 
                src={content} 
                alt="Shared image" 
                className="rounded-md max-w-full h-auto max-h-64 object-contain cursor-pointer"
                onClick={() => window.open(content, '_blank')}
              />
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">
              {content}
            </p>
          )}
        </div>
        
        <span className="text-xs text-muted-foreground mt-1">
          {format(new Date(message.created_at), 'HH:mm')}
        </span>
      </div>
    </div>
  );
}
