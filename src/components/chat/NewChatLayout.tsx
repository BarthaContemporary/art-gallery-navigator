
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users, Radio } from 'lucide-react';
import { useChat } from '@/contexts/chat/ChatContext';
import { NewChatRoomsList } from './NewChatRoomsList';
import { NewOnlineUsersList } from './NewOnlineUsersList';
import { NewChatInterface } from './NewChatInterface';
import { ChatRoom } from '@/services/chat/ChatService';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Radio className="h-3 w-3 text-green-500 animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {state.connected ? 'Connected' : 'Offline'}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {state.onlineUsers.length} online
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border/50">
        <button
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all",
            "border-b-2 -mb-[2px]",
            currentView === 'rooms' 
              ? "border-primary text-foreground bg-primary/5" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
          onClick={() => setCurrentView('rooms')}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="uppercase tracking-wide">Chats</span>
          {state.rooms.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded">
              {state.rooms.length}
            </span>
          )}
        </button>
        
        <button
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all",
            "border-b-2 -mb-[2px]",
            currentView === 'online' 
              ? "border-primary text-foreground bg-primary/5" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
          onClick={() => setCurrentView('online')}
        >
          <Users className="h-3.5 w-3.5" />
          <span className="uppercase tracking-wide">Users</span>
          {state.onlineUsers.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-green-500/10 text-green-600 rounded">
              {state.onlineUsers.length}
            </span>
          )}
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {state.error && (
          <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20">
            <p className="text-xs text-destructive font-mono">{state.error}</p>
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
