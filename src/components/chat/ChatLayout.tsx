
import React, { useState } from 'react';
import { ChatRoom, useChat } from '@/hooks/chat/use-chat';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChatMobileLayout } from './ChatMobileLayout';
import { ChatDesktopLayout } from './ChatDesktopLayout';
import { ChatPopupLayout } from './ChatPopupLayout';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { ImprovedChatLayout } from './ImprovedChatLayout';
import { useLocation } from 'react-router-dom';

type ViewType = 'rooms' | 'online' | 'chat';

interface ChatLayoutProps {
  isPopup?: boolean;
}

export function ChatLayout({ isPopup = false }: ChatLayoutProps) {
  return (
    <ChatErrorBoundary>
      <ImprovedChatLayout isPopup={isPopup} />
    </ChatErrorBoundary>
  );
}
