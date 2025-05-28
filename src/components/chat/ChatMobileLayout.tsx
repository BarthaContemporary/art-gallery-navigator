
import React from 'react';
import { ChatInterface } from './ChatInterface';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatRoomsList } from './ChatRoomsList';
import { ChatTabNavigation } from './ChatTabNavigation';
import { ChatRoom } from '@/hooks/chat/use-chat';

type ViewType = 'rooms' | 'online' | 'chat';

interface ChatMobileLayoutProps {
  currentView: ViewType;
  activeRoom: ChatRoom | null;
  onViewChange: (view: ViewType) => void;
  onStartChat: (userId: string) => Promise<void>;
  onSelectRoom: (room: ChatRoom) => Promise<void>;
  onBackToList: () => void;
}

export function ChatMobileLayout({
  currentView,
  activeRoom,
  onViewChange,
  onStartChat,
  onSelectRoom,
  onBackToList
}: ChatMobileLayoutProps) {
  if (currentView === 'chat' && activeRoom) {
    return <ChatInterface room={activeRoom} onBack={onBackToList} />;
  }

  return (
    <div className="flex flex-col h-full">
      <ChatTabNavigation 
        currentView={currentView as 'rooms' | 'online'} 
        onViewChange={onViewChange} 
      />
      
      <div className="flex-1">
        {currentView === 'online' ? (
          <OnlineUsersList onStartChat={onStartChat} />
        ) : (
          <ChatRoomsList
            onSelectRoom={onSelectRoom}
            selectedRoomId={activeRoom?.id}
          />
        )}
      </div>
    </div>
  );
}
