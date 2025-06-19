
import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/hooks/chat/types';
import { MessageBubble } from './MessageBubble';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface ChatMessagesListProps {
  messages: ChatMessage[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function ChatMessagesList({ 
  messages, 
  loading, 
  loadingMore = false,
  hasMore = false,
  onLoadMore 
}: ChatMessagesListProps) {
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef<boolean>(true);

  // Check if user was at bottom before new messages
  const checkScrollPosition = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        wasAtBottom.current = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold
      }
    }
  };

  // Auto scroll to bottom only if user was already at bottom
  useEffect(() => {
    if (scrollAreaRef.current && wasAtBottom.current) {
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
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading messages...</p>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea 
      className="flex-1 p-4" 
      ref={scrollAreaRef}
      onScroll={checkScrollPosition}
    >
      <div className="space-y-4">
        {/* Load More Button */}
        {hasMore && messages.length > 0 && (
          <div className="text-center pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="text-xs"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Loading older messages...
                </>
              ) : (
                'Load older messages'
              )}
            </Button>
          </div>
        )}

        {/* Loading indicator for older messages */}
        {loadingMore && (
          <div className="text-center py-2">
            <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
          </div>
        )}

        {/* Messages */}
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
