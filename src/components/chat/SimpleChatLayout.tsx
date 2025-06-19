
import React from 'react';
import { ChatProvider } from '@/hooks/chat/chat-context/ChatContext';
import { NewChatLayout } from './NewChatLayout';

export function SimpleChatLayout() {
  return (
    <ChatProvider>
      <NewChatLayout />
    </ChatProvider>
  );
}
