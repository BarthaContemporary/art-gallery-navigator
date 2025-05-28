
import React, { useState } from 'react';
import { ChatRoom, useChat } from '@/hooks/chat/use-chat';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChatMobileLayout } from './ChatMobileLayout';
import { ChatDesktopLayout } from './ChatDesktopLayout';

type ViewType = 'rooms' | 'online' | 'chat';

export function ChatLayout() {
  const { startChatWithUser, setActiveRoomAndFetchMessages, activeRoom } = useChat();
  const [currentView, setCurrentView] = useState<ViewType>('rooms');
  const isMobile = useIsMobile();

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
      onViewChange={handleViewChange}
      onStartChat={handleStartChat}
      onSelectRoom={handleSelectRoom}
    />
  );
}
