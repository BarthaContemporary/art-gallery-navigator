
import React, { useState } from 'react';
import { useSimpleChat } from '@/hooks/chat/chat-context/SimpleChatContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChatInterface } from './ChatInterface';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatRoomsList } from './ChatRoomsList';
import { ChatTabNavigation } from './ChatTabNavigation';
import { ChatRoom } from '@/hooks/chat/chat-context/types';

type ViewType = 'rooms' | 'online' | 'chat';

export function ChatPopupLayout() {
  const { 
    roomMessages, 
    state, 
    startChatWithUser, 
    setActiveRoom, 
    sendMessage,
    activeRoom,
    roomsList,
    onlineUsersList
  } = useSimpleChat();
  const [currentView, setCurrentView] = useState<ViewType>('rooms');
  const isMobile = useIsMobile();

  const handleStartChat = async (userId: string) => {
    const room = await startChatWithUser(userId);
    if (room) {
      await setActiveRoom(room.id);
      setCurrentView('chat');
    }
  };

  const handleSelectRoom = async (room: ChatRoom) => {
    await setActiveRoom(room.id);
    setCurrentView('chat');
  };

  const handleBackToList = () => {
    setCurrentView('rooms');
  };

  const handleViewChange = (view: 'rooms' | 'online') => {
    setCurrentView(view);
  };

  if (currentView === 'chat' && activeRoom) {
    return (
      <ChatInterface 
        room={activeRoom} 
        messages={roomMessages}
        loading={state.loading.messages}
        onSendMessage={sendMessage}
        sending={state.loading.sending}
        onBack={handleBackToList} 
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ChatTabNavigation 
        currentView={currentView as 'rooms' | 'online'} 
        onViewChange={handleViewChange}
        roomsCount={roomsList.length}
        onlineCount={onlineUsersList.length}
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
