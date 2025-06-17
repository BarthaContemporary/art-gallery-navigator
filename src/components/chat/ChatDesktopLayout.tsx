
import React from 'react';
import { ChatInterface } from './ChatInterface';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatRoomsList } from './ChatRoomsList';
import { ChatTabNavigation } from './ChatTabNavigation';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatRoom, ChatMessage } from '@/hooks/chat/types';

type ViewType = 'rooms' | 'online';

interface ChatDesktopLayoutProps {
  currentView: ViewType;
  activeRoom: ChatRoom | null;
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  sending: boolean;
  loading: boolean;
  onViewChange: (view: ViewType) => void;
  onStartChat: (userId: string) => Promise<void>;
  onSelectRoom: (room: ChatRoom) => Promise<void>;
}

export function ChatDesktopLayout({
  currentView,
  activeRoom,
  messages,
  onSendMessage,
  sending,
  loading,
  onViewChange,
  onStartChat,
  onSelectRoom
}: ChatDesktopLayoutProps) {
  return (
    <div className="flex h-full">
      {/* Left sidebar - 1/3 width */}
      <div className="w-1/3 min-w-[300px] flex flex-col">
        <div className="border-r">
          <ChatTabNavigation 
            currentView={currentView} 
            onViewChange={onViewChange} 
          />
        </div>

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

      {/* Right content - 2/3 width */}
      <div className="flex-1">
        {activeRoom ? (
          <ChatInterface 
            room={activeRoom} 
            messages={messages}
            loading={loading}
            onSendMessage={onSendMessage}
            sending={sending}
          />
        ) : (
          <ChatEmptyState />
        )}
      </div>
    </div>
  );
}
