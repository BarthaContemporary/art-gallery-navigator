
import React from 'react';
import { useSimpleChat } from '@/hooks/chat/chat-context/SimpleChatContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChatInterface } from './ChatInterface';
import { ChatRoomsList } from './ChatRoomsList';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatTabNavigation } from './ChatTabNavigation';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatStatusBar } from './ChatStatusBar';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function NewChatLayout() {
  const chat = useSimpleChat();
  const isMobile = useIsMobile();
  
  const {
    state,
    activeRoom,
    roomMessages,
    onlineUsersList,
    roomsList,
    setCurrentView,
    setActiveRoom,
    startChatWithUser,
    sendMessage,
    fetchMessages,
    clearCache,
    retryConnection,
  } = chat;

  const handleStartChat = async (userId: string) => {
    const room = await startChatWithUser(userId);
    if (room) {
      await setActiveRoom(room.id);
      if (isMobile) {
        setCurrentView('chat');
      }
    }
  };

  const handleSelectRoom = async (room: any) => {
    await setActiveRoom(room.id);
    if (isMobile) {
      setCurrentView('chat');
    }
  };

  const handleBackToList = () => {
    setCurrentView('rooms');
  };

  const handleLoadMore = async () => {
    if (activeRoom) {
      await fetchMessages(activeRoom.id);
    }
  };

  const handleSendMessage = async (message: string, type?: 'text' | 'image') => {
    await sendMessage(message, type);
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <ChatStatusBar 
          connected={state.connected} 
          error={state.error} 
          loading={state.loading.rooms || state.loading.messages}
        />
        
        {state.error && (
          <Alert className="m-4 border-red-200 bg-red-50">
            <AlertDescription className="flex items-center justify-between">
              <span className="text-red-800">{state.error}</span>
              <Button variant="outline" size="sm" onClick={retryConnection}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {state.currentView === 'chat' && activeRoom ? (
          <ChatInterface 
            room={activeRoom} 
            messages={roomMessages}
            loading={state.loading.messages}
            sending={state.loading.sending}
            loadingMore={false}
            hasMore={false}
            onSendMessage={handleSendMessage}
            onLoadMore={handleLoadMore}
            onBack={handleBackToList} 
          />
        ) : (
          <>
            <ChatTabNavigation 
              currentView={state.currentView as 'rooms' | 'online'} 
              onViewChange={setCurrentView}
              roomsCount={roomsList.length}
              onlineCount={onlineUsersList.length}
            />
            
            <div className="flex-1">
              {state.currentView === 'online' ? (
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b bg-gray-50">
        <ChatStatusBar 
          connected={state.connected} 
          error={state.error} 
          loading={state.loading.rooms || state.loading.messages}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={retryConnection}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
          <Button variant="outline" size="sm" onClick={clearCache}>
            <Trash2 className="h-3 w-3 mr-1" />
            Clear Cache
          </Button>
        </div>
      </div>

      {state.error && (
        <Alert className="m-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {state.error}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex h-full">
        <div className="w-1/3 min-w-[300px] flex flex-col">
          <div className="border-r">
            <ChatTabNavigation 
              currentView={state.currentView as 'rooms' | 'online'} 
              onViewChange={setCurrentView}
              roomsCount={roomsList.length}
              onlineCount={onlineUsersList.length}
            />
          </div>

          <div className="flex-1">
            {state.currentView === 'online' ? (
              <OnlineUsersList onStartChat={handleStartChat} />
            ) : (
              <ChatRoomsList
                onSelectRoom={handleSelectRoom}
                selectedRoomId={activeRoom?.id}
              />
            )}
          </div>
        </div>

        <div className="flex-1">
          {activeRoom ? (
            <ChatInterface 
              room={activeRoom} 
              messages={roomMessages}
              loading={state.loading.messages}
              sending={state.loading.sending}
              loadingMore={false}
              hasMore={false}
              onSendMessage={handleSendMessage}
              onLoadMore={handleLoadMore}
            />
          ) : (
            <ChatEmptyState 
              onlineUsers={onlineUsersList}
              onStartChat={handleStartChat}
            />
          )}
        </div>
      </div>
    </div>
  );
}
