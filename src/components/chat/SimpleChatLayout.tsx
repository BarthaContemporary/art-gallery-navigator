
import React, { useState, useEffect } from 'react';
import { useOptimizedSimpleChat } from '@/hooks/chat/use-optimized-simple-chat';
import { ChatRoomsList } from './ChatRoomsList';
import { ChatInterface } from './ChatInterface';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatEmptyState } from './ChatEmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';

export function SimpleChatLayout() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('conversations');
  const [showMobileChat, setShowMobileChat] = useState(false);
  
  const {
    chatRooms,
    activeRoom,
    messages,
    onlineUsers,
    loading,
    sending,
    loadingMore,
    hasMore,
    connected,
    error,
    startChatWithUser,
    setActiveRoomAndFetchMessages,
    loadMoreMessages,
    sendMessage,
    fetchOnlineUsers,
    clearAllChatCache,
    cleanupOldMessages,
  } = useOptimizedSimpleChat();

  // Handle room selection
  const handleRoomSelect = async (room: any) => {
    await setActiveRoomAndFetchMessages(room);
    setShowMobileChat(true);
  };

  // Handle starting new chat
  const handleStartChat = async (targetUser: any) => {
    const room = await startChatWithUser(targetUser.user_id);
    if (room) {
      await handleRoomSelect(room);
    }
  };

  // Handle sending message
  const handleSendMessage = async (content: string, type: 'text' | 'image' = 'text') => {
    if (!activeRoom) return;
    await sendMessage(content, activeRoom.id, type);
  };

  // Handle back to rooms list on mobile
  const handleBackToRooms = () => {
    setShowMobileChat(false);
  };

  // Handle load more messages
  const handleLoadMore = () => {
    loadMoreMessages();
  };

  // Handle cleanup with custom days
  const handleCleanupMessages = async (days: number) => {
    await cleanupOldMessages(days);
  };

  // Refresh online users periodically (reduced frequency)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOnlineUsers();
    }, 60000); // Refresh every 60 seconds instead of 30

    return () => clearInterval(interval);
  }, [fetchOnlineUsers]);

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-gray-500">
          <p>Please log in to access chat</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white">
      {/* Desktop Layout */}
      <div className="hidden md:flex w-full">
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          {/* Header with Actions */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Chat</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleCleanupMessages(7)}>
                  Clean up messages (7 days)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCleanupMessages(30)}>
                  Clean up messages (30 days)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={clearAllChatCache}>
                  Clear chat cache
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mx-4 mt-2">
              <TabsTrigger value="conversations">Conversations</TabsTrigger>
              <TabsTrigger value="online">Online ({onlineUsers.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="conversations" className="flex-1 mt-0">
              <ChatRoomsList
                onSelectRoom={handleRoomSelect}
                selectedRoomId={activeRoom?.id}
              />
            </TabsContent>
            
            <TabsContent value="online" className="flex-1 mt-0">
              <OnlineUsersList
                onStartChat={handleStartChat}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {activeRoom ? (
            <ChatInterface
              room={activeRoom}
              messages={messages}
              loading={loading}
              sending={sending}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onSendMessage={handleSendMessage}
              onLoadMore={handleLoadMore}
            />
          ) : (
            <ChatEmptyState 
              onlineUsers={onlineUsers}
              onStartChat={handleStartChat}
            />
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col w-full h-full">
        {!showMobileChat ? (
          <div className="flex flex-col h-full">
            {/* Mobile Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Chat</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleCleanupMessages(7)}>
                    Clean up messages (7 days)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCleanupMessages(30)}>
                    Clean up messages (30 days)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={clearAllChatCache}>
                    Clear chat cache
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mx-4 mt-2">
                <TabsTrigger value="conversations">Conversations</TabsTrigger>
                <TabsTrigger value="online">Online ({onlineUsers.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="conversations" className="flex-1 mt-0">
                <ChatRoomsList
                  onSelectRoom={handleRoomSelect}
                  selectedRoomId={activeRoom?.id}
                />
              </TabsContent>
              
              <TabsContent value="online" className="flex-1 mt-0">
                <OnlineUsersList
                  onStartChat={handleStartChat}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          /* Mobile Chat Interface */
          activeRoom && (
            <ChatInterface
              room={activeRoom}
              messages={messages}
              loading={loading}
              sending={sending}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onSendMessage={handleSendMessage}
              onLoadMore={handleLoadMore}
              onBack={handleBackToRooms}
            />
          )
        )}
      </div>
    </div>
  );
}
