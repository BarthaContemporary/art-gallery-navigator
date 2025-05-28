
import React, { useState } from 'react';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatRoomsList } from './ChatRoomsList';
import { ChatInterface } from './ChatInterface';
import { ChatRoom, useChat } from '@/hooks/chat/use-chat';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Users, MessageCircle } from 'lucide-react';

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

  // Mobile layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {currentView === 'chat' && activeRoom ? (
          <ChatInterface room={activeRoom} onBack={handleBackToList} />
        ) : (
          <>
            {/* Mobile header with tabs */}
            <div className="bg-white border-b">
              <div className="flex">
                <Button
                  variant={currentView === 'rooms' ? 'default' : 'ghost'}
                  className="flex-1 rounded-none"
                  onClick={() => setCurrentView('rooms')}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chats
                </Button>
                <Button
                  variant={currentView === 'online' ? 'default' : 'ghost'}
                  className="flex-1 rounded-none"
                  onClick={() => setCurrentView('online')}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Online
                </Button>
              </div>
            </div>

            {/* Mobile content */}
            <div className="flex-1">
              {currentView === 'online' ? (
                <OnlineUsersList onStartChat={handleStartChat} />
              ) : (
                <ChatRoomsList
                  onSelectRoom={handleSelectRoom}
                  selectedRoomId={activeRoom?.id}
                />
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex h-full">
      {/* Left sidebar - 1/3 width */}
      <div className="w-1/3 min-w-[300px] flex flex-col">
        {/* Tabs */}
        <div className="bg-white border-b border-r">
          <div className="flex">
            <Button
              variant={currentView === 'rooms' ? 'default' : 'ghost'}
              className="flex-1 rounded-none"
              onClick={() => setCurrentView('rooms')}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Chats
            </Button>
            <Button
              variant={currentView === 'online' ? 'default' : 'ghost'}
              className="flex-1 rounded-none"
              onClick={() => setCurrentView('online')}
            >
              <Users className="h-4 w-4 mr-2" />
              Online
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
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

      {/* Right content - 2/3 width */}
      <div className="flex-1">
        {activeRoom ? (
          <ChatInterface room={activeRoom} />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500 max-w-sm">
                Choose an existing conversation or start a new one with someone online
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
