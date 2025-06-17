
import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/hooks/chat/types';
import { MessageBubble } from './MessageBubble';
import { useAuth } from '@/hooks/use-auth';

interface ChatMessagesListProps {
  messages: ChatMessage[];
  loading?: boolean;
}

export function ChatMessagesList({ messages, loading }: ChatMessagesListProps) {
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  if (loading) {
    return (
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">Loading messages...</p>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
      <div className="space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender_id === user?.id}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
}
