
import React from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatMessagesList } from './ChatMessagesList';
import { ChatMessageInput } from './ChatMessageInput';
import { ChatRoom, ChatMessage } from '@/hooks/chat/types';

interface ChatInterfaceProps {
  room: ChatRoom;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onSendMessage: (message: string, type?: 'text' | 'image') => Promise<void>;
  onLoadMore?: () => void;
  onBack?: () => void;
}

export function ChatInterface({ 
  room, 
  messages, 
  loading, 
  sending,
  loadingMore = false,
  hasMore = false,
  onSendMessage,
  onLoadMore,
  onBack 
}: ChatInterfaceProps) {
  return (
    <div className="flex flex-col h-full">
      <ChatHeader room={room} onBack={onBack} />
      
      <div className="flex-1 overflow-hidden">
        <ChatMessagesList 
          messages={messages} 
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
        />
      </div>
      
      <ChatMessageInput
        onSendMessage={onSendMessage}
        sending={sending}
      />
    </div>
  );
}
