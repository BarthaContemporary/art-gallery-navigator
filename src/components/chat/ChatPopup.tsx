
import React, { useState } from 'react';
import { OptimizedChatPopupButton } from './OptimizedChatPopupButton';
import { ChatLayout } from './ChatLayout';
import { useAuth } from '@/hooks/use-auth';

export const ChatPopup = React.memo(function ChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  if (!user) return null;

  return (
    <>
      <OptimizedChatPopupButton 
        onClick={() => setIsOpen(!isOpen)} 
        isOpen={isOpen}
      />
      
      {isOpen && (
        <div className="fixed inset-0 z-50 md:inset-auto md:bottom-20 md:right-6 md:w-96 md:h-[600px]">
          <div className="w-full h-full bg-white border border-gray-200 rounded-none md:rounded-lg shadow-xl">
            <ChatLayout onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
});
