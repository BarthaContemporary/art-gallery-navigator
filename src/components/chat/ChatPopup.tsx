
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import { SafeChatWrapper } from './SafeChatWrapper';
import { ChatPopupLayout } from './ChatPopupLayout';

export function ChatPopup() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 bg-white border rounded-lg shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="font-semibold text-sm">B_c Chat</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 min-h-0">
        <SafeChatWrapper>
          <ChatPopupLayout />
        </SafeChatWrapper>
      </div>
    </div>
  );
}
