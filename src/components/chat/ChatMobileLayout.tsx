
import React from 'react';
import { ChatInterface } from './ChatInterface';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatRoomsList } from './ChatRoomsList';
import { ChatTabNavigation } from './ChatTabNavigation';
import { ChatRoom, ChatMessage } from '@/hooks/chat/types';

type ViewType = 'rooms' | 'online' | 'chat';

interface ChatMobileLayoutProps {
  currentView: ViewType;
  activeRoom: ChatRoom | null;
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  sending: boolean;
  loading: boolean;
  onViewChange: (view: ViewType) => void;
  onStartChat: (userId: string) => Promise<void>;
  onSelectRoom: (room: ChatRoom) => Promise<void>;
  onBackToList: () => void;
}

export function ChatMobileLayout({
  currentView,
  activeRoom,
  messages,
  onSendMessage,
  sending,
  loading,
  onViewChange,
  onStartChat,
  onSelectRoom,
  onBackToList
}: ChatMobileLayoutProps) {
  if (currentView === 'chat' && activeRoom) {
    return (
      <ChatInterface 
        room={activeRoom} 
        messages={messages}
        loading={loading}
        onSendMessage={onSendMessage}
        sending={sending}
        onBack={onBackToList} 
      />
    );
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
