
import React, { useState } from 'react';
import { ChatRoom, useChat } from '@/hooks/chat/use-chat';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChatMobileLayout } from './ChatMobileLayout';
import { ChatDesktopLayout } from './ChatDesktopLayout';
import { ChatPopupLayout } from './ChatPopupLayout';
import { useLocation } from 'react-router-dom';

type ViewType = 'rooms' | 'online' | 'chat';

interface ChatLayoutProps {
  isPopup?: boolean;
}

export function ChatLayout({ isPopup = false }: ChatLayoutProps) {
  const { messages, sending, startChatWithUser, setActiveRoomAndFetchMessages, sendMessage, activeRoom } = useChat();
  const [currentView, setCurrentView] = useState<ViewType>('rooms');
  const isMobile = useIsMobile();
  const location = useLocation();

  // Use popup layout if this is a popup or if we're on a mobile device in popup mode
  if (isPopup || (location.pathname !== '/chat' && !isMobile)) {
    return <ChatPopupLayout />;
  }

  const handleStartChat = async (userId: string) => {
    const room = await startChatWithUser(userId);
    if (room) {
      await setActiveRoomAndFetchMessages(room);
      setCurrentView('chat');
    }
  };

  const handleSelectRoom = async (room: ChatRoom) => {
    await setActiveRoomAndFetchMessages(room);
    if (isMobile) {
      setCurrentView('chat');
    }
  };

  const handleBackToList = () => {
    setCurrentView('rooms');
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  if (isMobile) {
    return (
      <ChatMobileLayout
        currentView={currentView}
        activeRoom={activeRoom}
        messages={messages}
        onSendMessage={sendMessage}
        sending={sending}
        onViewChange={handleViewChange}
        onStartChat={handleStartChat}
        onSelectRoom={handleSelectRoom}
        onBackToList={handleBackToList}
      />
    );
  }

  return (
    <ChatDesktopLayout
      currentView={currentView as 'rooms' | 'online'}
      activeRoom={activeRoom}
      messages={messages}
      onSendMessage={sendMessage}
      sending={sending}
      onViewChange={handleViewChange}
      onStartChat={handleStartChat}
      onSelectRoom={handleSelectRoom}
    />
  );
}
