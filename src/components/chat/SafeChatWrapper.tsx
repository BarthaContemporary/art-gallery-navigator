
import React from 'react';
import { ChatProvider } from '@/hooks/chat/chat-context/ChatContext';
import { ChatErrorBoundary } from './ChatErrorBoundary';

interface SafeChatWrapperProps {
  children: React.ReactNode;
}

export function SafeChatWrapper({ children }: SafeChatWrapperProps) {
  return (
    <ChatErrorBoundary fallback={
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        Chat temporarily unavailable
      </div>
    }>
      <ChatProvider>
        {children}
      </ChatProvider>
    </ChatErrorBoundary>
  );
}
