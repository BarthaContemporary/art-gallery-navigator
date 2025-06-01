
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChatPopupLayout } from './ChatPopupLayout';
import { ChatPopupButton } from './ChatPopupButton';
import { useIsMobile } from '@/hooks/use-mobile';

export function ChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <ChatPopupButton 
        onClick={toggleChat} 
        unreadCount={0} 
        isOpen={isOpen}
      />
      
      {isOpen && (
        <Card className={`fixed z-50 shadow-2xl border transition-all duration-300 ${
          isMobile 
            ? 'bottom-0 left-4 right-4 top-24 rounded-t-lg rounded-b-none max-w-sm mx-auto' 
            : 'bottom-24 right-6 w-80 h-[450px] rounded-lg'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-white rounded-t-lg">
            <h3 className="font-semibold text-sm">Chat</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleChat}
              className="h-6 w-6"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Chat Content */}
          <div className="flex-1 overflow-hidden h-[calc(100%-49px)]">
            <ChatPopupLayout />
          </div>
        </Card>
      )}
      
      {/* Backdrop for mobile */}
      {isOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={toggleChat}
        />
      )}
    </>
  );
}
