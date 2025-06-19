
import React, { useState } from 'react';
import { ChatTabNavigation } from './ChatTabNavigation';
import { ChatRoomsList } from './ChatRoomsList';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatInterface } from './ChatInterface';
import { useChat } from '@/hooks/chat/use-chat';
import { ChatRoom } from '@/hooks/chat/types';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ChatLayoutProps {
  onClose?: () => void;
}

export function ChatLayout({ onClose }: ChatLayoutProps) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'online'>('rooms');
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  
  const { 
    chatRooms, 
    activeRoom, 
    messages, 
    onlineUsers, 
    loading, 
    sending,
    startChatWithUser,
    setActiveRoomAndFetchMessages,
    sendMessage: sendChatMessage,
    fetchChatRooms
  } = useChat();

  const handleSelectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room);
    await setActiveRoomAndFetchMessages(room);
  };

  const handleStartChat = async (userId: string) => {
    const room = await startChatWithUser(userId);
    if (room) {
      setSelectedRoom(room);
      await setActiveRoomAndFetchMessages(room);
      await fetchChatRooms();
    }
  };

  const handleBackToList = () => {
    setSelectedRoom(null);
  };

  // Show chat interface if a room is selected
  if (selectedRoom && activeRoom) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-2 border-b bg-white">
          <h2 className="font-semibold">Chat</h2>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <ChatInterface
          room={activeRoom}
          messages={messages}
          loading={loading}
          sending={sending}
          onSendMessage={sendChatMessage}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  // Show room/user list
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b bg-white">
        <h2 className="font-semibold">Chat</h2>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <ChatTabNavigation 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        roomsCount={chatRooms.length}
        onlineCount={onlineUsers.length}
      />
      
      <div className="flex-1 overflow-hidden">
        {activeTab === 'rooms' ? (
          <ChatRoomsList
            onSelectRoom={handleSelectRoom}
            selectedRoomId={selectedRoom?.id}
          />
        ) : (
          <OnlineUsersList onStartChat={handleStartChat} />
        )}
      </div>
    </div>
  );
}
