
import React, { useState } from 'react';
import { ChatTabNavigation } from './ChatTabNavigation';
import { ChatRoomsList } from './ChatRoomsList';
import { OnlineUsersList } from './OnlineUsersList';
import { ChatInterface } from './ChatInterface';
import { useSimpleChat } from '@/hooks/chat/chat-context/SimpleChatContext';
import { ChatRoom } from '@/hooks/chat/chat-context/types';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ChatLayoutProps {
  onClose?: () => void;
}

export function ChatLayout({ onClose }: ChatLayoutProps) {
  const [currentView, setCurrentView] = useState<'rooms' | 'online'>('rooms');
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  
  const { 
    roomsList,
    onlineUsersList,
    activeRoom, 
    roomMessages, 
    state,
    startChatWithUser,
    setActiveRoom,
    sendMessage: sendChatMessage,
    fetchRooms
  } = useSimpleChat();

  const handleSelectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room);
    await setActiveRoom(room.id);
  };

  const handleStartChat = async (userId: string) => {
    const room = await startChatWithUser(userId);
    if (room) {
      setSelectedRoom(room);
      await setActiveRoom(room.id);
      await fetchRooms();
    }
  };

  const handleBackToList = () => {
    setSelectedRoom(null);
  };

  // Show chat interface if a room is selected
  if (selectedRoom && activeRoom) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between pl-4 pr-2 py-2 border-b bg-white">
          <h2 className="font-semibold">B_c Chat</h2>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <ChatInterface
          room={activeRoom}
          messages={roomMessages}
          loading={state.loading.messages}
          sending={state.loading.sending}
          onSendMessage={sendChatMessage}
          onBack={handleBackToList}
        />
      </div>
    );
  }

  // Show room/user list
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between pl-4 pr-2 py-2 border-b bg-white">
        <h2 className="font-semibold">B_c Chat</h2>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <ChatTabNavigation 
        currentView={currentView} 
        onViewChange={setCurrentView}
        roomsCount={roomsList.length}
        onlineCount={onlineUsersList.length}
      />
      
      <div className="flex-1 overflow-hidden">
        {currentView === 'rooms' ? (
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
