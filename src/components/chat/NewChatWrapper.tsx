
import React from 'react';
import { ChatProvider } from '@/contexts/chat/ChatContext';
import { NewChatErrorBoundary } from './NewChatErrorBoundary';

interface NewChatWrapperProps {
  children: React.ReactNode;
}

export function NewChatWrapper({ children }: NewChatWrapperProps) {
  return (
    <NewChatErrorBoundary>
      <ChatProvider>
        {children}
      </ChatProvider>
    </NewChatErrorBoundary>
  );
}
