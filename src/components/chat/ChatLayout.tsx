
import React from 'react';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { SimpleChatLayout } from './SimpleChatLayout';

interface ChatLayoutProps {
  isPopup?: boolean;
}

export function ChatLayout({ isPopup = false }: ChatLayoutProps) {
  return (
    <ChatErrorBoundary>
      <SimpleChatLayout isPopup={isPopup} />
    </ChatErrorBoundary>
  );
}
