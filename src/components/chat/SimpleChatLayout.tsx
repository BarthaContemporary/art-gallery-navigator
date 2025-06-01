
import React, { useState } from 'react';
import { ChatRoom } from '@/hooks/chat/use-chat';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSimpleChat } from '@/hooks/chat/use-simple-chat';
import { ChatMobileLayout } from './ChatMobileLayout';
import { ChatDesktopLayout } from './ChatDesktopLayout';
import { ChatPopupLayout } from './ChatPopupLayout';
import { ChatStatusBar } from './ChatStatusBar';
import { ImprovedChatClearCacheButton } from './ImprovedChatClearCacheButton';
import { useLocation } from 'react-router-dom';

type ViewType = 'rooms' | 'online' | 'chat';

interface SimpleChatLayoutProps {
  isPopup?: boolean;
}

export function SimpleChatLayout({ isPopup = false }: SimpleChatLayoutProps) {
  const chat = useSimpleChat();
  const [currentView, setCurrentView] = useState<ViewType>('rooms');
  const isMobile = useIsMobile();
  const location = useLocation();

  // Use popup layout if this is a popup or if we're on a mobile device in popup mode
  if (isPopup || (location.pathname !== '/chat' && !isMobile)) {
    return <ChatPopupLayout />;
  }

  const handleStartChat = async (userId: string) => {
    const room = await chat.startChatWithUser(userId);
    if (room) {
      await chat.setActiveRoomAndFetchMessages(room);
      setCurrentView('chat');
    }
  };

  const handleSelectRoom = async (room: ChatRoom) => {
    await chat.setActiveRoomAndFetchMessages(room);
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

  const handleSendMessage = async (message: string) => {
    if (!chat.activeRoom) return;
    await chat.sendMessage(message, chat.activeRoom.id);
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <ChatStatusBar connected={chat.connected} error={chat.error} loading={chat.loading} />
        <ChatMobileLayout
          currentView={currentView}
          activeRoom={chat.activeRoom}
          messages={chat.messages}
          onSendMessage={handleSendMessage}
          sending={chat.sending}
          onViewChange={handleViewChange}
          onStartChat={handleStartChat}
          onSelectRoom={handleSelectRoom}
          onBackToList={handleBackToList}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b bg-gray-50">
        <ChatStatusBar connected={chat.connected} error={chat.error} loading={chat.loading} />
        <ImprovedChatClearCacheButton onClear={chat.clearAllChatCache} />
      </div>
      <ChatDesktopLayout
        currentView={currentView as 'rooms' | 'online'}
        activeRoom={chat.activeRoom}
        messages={chat.messages}
        onSendMessage={handleSendMessage}
        sending={chat.sending}
        onViewChange={handleViewChange}
        onStartChat={handleStartChat}
        onSelectRoom={handleSelectRoom}
      />
    </div>
  );
}
