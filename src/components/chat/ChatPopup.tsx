
import React, { useState } from 'react';
import { ChatPopupButton } from './ChatPopupButton';
import { ChatLayout } from './ChatLayout';
import { useAuth } from '@/hooks/use-auth';

export function ChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  if (!user) return null;

  return (
    <>
      <ChatPopupButton 
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
}
