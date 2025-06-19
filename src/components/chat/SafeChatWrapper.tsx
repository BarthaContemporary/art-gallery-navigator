
import React from 'react';
import { ChatProvider, useChat } from '@/hooks/chat/chat-context/ChatContext';
import { ChatErrorBoundary } from './ChatErrorBoundary';

interface SafeChatWrapperProps {
  children: React.ReactNode;
}

function ChatContent({ children }: SafeChatWrapperProps) {
  try {
    // Test if we can access the chat context
    useChat();
    return <>{children}</>;
  } catch (error) {
    // If we can't access the context, show a simple fallback
    return (
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        Chat not available
      </div>
    );
  }
}

export function SafeChatWrapper({ children }: SafeChatWrapperProps) {
  return (
    <ChatErrorBoundary fallback={
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        Chat temporarily unavailable
      </div>
    }>
      <ChatProvider>
        <ChatContent>
          {children}
        </ChatContent>
      </ChatProvider>
    </ChatErrorBoundary>
  );
}
