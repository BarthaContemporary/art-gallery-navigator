
import React from 'react';
import { format } from 'date-fns';
import { ChatMessage } from '@/hooks/chat/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const isMobile = useIsMobile();
  
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${isMobile ? 'max-w-[85%]' : ''}`}>
        <div
          className={`rounded-lg px-3 py-2 ${
            isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content || message.encrypted_content}
          </p>
        </div>
        <div className={`mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
          <span className="text-xs text-gray-500">
            {format(new Date(message.created_at), 'HH:mm')}
          </span>
        </div>
      </div>
    </div>
  );
}
