
import React, { useState } from 'react';
import { ChatRoom, useChat } from '@/hooks/chat/use-chat';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChatInterface } from './ChatInterface';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatRoomsList } from './ChatRoomsList';
import { ChatTabNavigation } from './ChatTabNavigation';

type ViewType = 'rooms' | 'online' | 'chat';

export function ChatPopupLayout() {
  const { messages, sending, startChatWithUser, setActiveRoomAndFetchMessages, sendMessage, activeRoom } = useChat();
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
    setCurrentView('chat');
  };

  const handleBackToList = () => {
    setCurrentView('rooms');
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  if (currentView === 'chat' && activeRoom) {
    return (
      <ChatInterface 
        room={activeRoom} 
        messages={messages}
        onSendMessage={sendMessage}
        sending={sending}
        onBack={handleBackToList} 
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ChatTabNavigation 
        currentView={currentView as 'rooms' | 'online'} 
        onViewChange={handleViewChange} 
      />
      
      <div className="flex-1 min-h-0">
        {currentView === 'online' ? (
          <OnlineUsersList onStartChat={handleStartChat} />
        ) : (
          <ChatRoomsList
            onSelectRoom={handleSelectRoom}
            selectedRoomId={activeRoom?.id}
          />
        )}
      </div>
    </div>
  );
}
