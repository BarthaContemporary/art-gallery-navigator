
import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImprovedChatLayout } from '@/components/chat/ImprovedChatLayout';

export default function Chat() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 border-b bg-white">
        <PageHeader title="CHAT" />
      </div>
      <div className="flex-1 min-h-0">
        <ImprovedChatLayout />
      </div>
    </div>
  );
}
