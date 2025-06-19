
import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SafeChatWrapper } from '@/components/chat/SafeChatWrapper';
import { NewChatLayout } from '@/components/chat/NewChatLayout';

export default function Chat() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 border-b bg-white">
        <PageHeader title="CHAT" />
      </div>
      <div className="flex-1 min-h-0">
        <SafeChatWrapper>
          <NewChatLayout />
        </SafeChatWrapper>
      </div>
    </div>
  );
}
