
import React from 'react';
import { SimpleChatProvider } from '@/hooks/chat/chat-context/SimpleChatContext';
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
      <SimpleChatProvider>
        {children}
      </SimpleChatProvider>
    </ChatErrorBoundary>
  );
}
