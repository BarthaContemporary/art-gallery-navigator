
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users } from 'lucide-react';
import { useChat } from '@/contexts/chat/ChatContext';
import { NewChatRoomsList } from './NewChatRoomsList';
import { NewOnlineUsersList } from './NewOnlineUsersList';
import { NewChatInterface } from './NewChatInterface';
import { ChatRoom } from '@/services/chat/ChatService';

export function NewChatLayout() {
  const { state, setActiveRoom, startChatWithUser } = useChat();
  const [currentView, setCurrentView] = useState<'rooms' | 'online' | 'chat'>('rooms');
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);

  const handleSelectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room);
    await setActiveRoom(room.id);
    setCurrentView('chat');
  };

  const handleStartChat = async (userId: string) => {
    const room = await startChatWithUser(userId);
    if (room) {
      setSelectedRoom(room);
      await setActiveRoom(room.id);
      setCurrentView('chat');
    }
  };

  const handleBackToList = () => {
    setSelectedRoom(null);
    setCurrentView('rooms');
  };

  // Show chat interface if a room is selected
  if (currentView === 'chat' && selectedRoom) {
    return (
      <NewChatInterface 
        room={selectedRoom}
        onBack={handleBackToList}
      />
    );
  }

  // Show room/user list
  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation - Made more compact */}
      <div className="flex border-b">
        <Button
          variant={currentView === 'rooms' ? 'default' : 'ghost'}
          className="flex-1 rounded-none h-10"
          onClick={() => setCurrentView('rooms')}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Conversations
        </Button>
        
        <Button
          variant={currentView === 'online' ? 'default' : 'ghost'}
          className="flex-1 rounded-none h-10"
          onClick={() => setCurrentView('online')}
        >
          <Users className="h-4 w-4 mr-2" />
          Online
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {state.error && (
          <div className="p-3 bg-destructive/10 border-b">
            <p className="text-sm text-destructive">{state.error}</p>
          </div>
        )}
        
        {currentView === 'online' ? (
          <NewOnlineUsersList onStartChat={handleStartChat} />
        ) : (
          <NewChatRoomsList
            onSelectRoom={handleSelectRoom}
            selectedRoomId={selectedRoom?.id}
          />
        )}
      </div>
    </div>
  );
}
