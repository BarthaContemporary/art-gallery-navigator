
import React from 'react';
import { useChat } from '@/hooks/chat/chat-context/ChatContext';
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
  // Safely try to access chat context
  let chat;
  try {
    chat = useChat();
  } catch (error) {
    console.warn('NewChatLayout: Chat context not available');
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div className="text-sm text-muted-foreground">
          Chat service temporarily unavailable
        </div>
      </div>
    );
  }

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
    if (activeRoom && state.pagination[activeRoom.id]?.hasMore) {
      await fetchMessages(activeRoom.id, true);
    }
  };

  const handleSendMessage = async (message: string, type?: 'text' | 'image') => {
    await sendMessage(message, type);
  };

  // Error display
  const hasErrors = Object.keys(state.errors).length > 0;
  const isConnected = state.connection.status === 'connected';
  const isLoading = state.loading.rooms || state.loading.sending;

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <ChatStatusBar 
          connected={isConnected} 
          error={hasErrors ? Object.values(state.errors)[0] : null} 
          loading={isLoading}
        />
        
        {hasErrors && (
          <Alert className="m-4 border-red-200 bg-red-50">
            <AlertDescription className="flex items-center justify-between">
              <span className="text-red-800">Connection issues detected</span>
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
            loading={state.loading.messages[activeRoom.id] || false}
            sending={state.loading.sending}
            loadingMore={state.loading.loadingMore[activeRoom.id] || false}
            hasMore={state.pagination[activeRoom.id]?.hasMore || false}
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
          connected={isConnected} 
          error={hasErrors ? Object.values(state.errors)[0] : null} 
          loading={isLoading}
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

      {hasErrors && (
        <Alert className="m-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {Object.values(state.errors).join(', ')}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex h-full">
        {/* Left sidebar - 1/3 width */}
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

        {/* Right content - 2/3 width */}
        <div className="flex-1">
          {activeRoom ? (
            <ChatInterface 
              room={activeRoom} 
              messages={roomMessages}
              loading={state.loading.messages[activeRoom.id] || false}
              sending={state.loading.sending}
              loadingMore={state.loading.loadingMore[activeRoom.id] || false}
              hasMore={state.pagination[activeRoom.id]?.hasMore || false}
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
