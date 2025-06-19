
import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ChatProvider } from '@/hooks/chat/chat-context/ChatContext';
import { NewChatLayout } from '@/components/chat/NewChatLayout';

export default function Chat() {
  return (
    <ChatProvider>
      <div className="flex flex-col h-full">
        <div className="p-4 md:p-6 border-b bg-white">
          <PageHeader title="CHAT" />
        </div>
        <div className="flex-1 min-h-0">
          <NewChatLayout />
        </div>
      </div>
    </ChatProvider>
  );
}
