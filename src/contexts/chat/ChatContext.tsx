
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { ChatService, ChatRoom, ChatMessage, UserPresence } from '@/services/chat/ChatService';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';

interface ChatState {
  rooms: ChatRoom[];
  messages: ChatMessage[];
  onlineUsers: UserPresence[];
  activeRoomId: string | null;
  loading: {
    rooms: boolean;
    messages: boolean;
    sending: boolean;
  };
  connected: boolean;
  error: string | null;
}

interface ChatContextType {
  state: ChatState;
  setActiveRoom: (roomId: string) => Promise<void>;
  sendMessage: (content: string, type?: 'text' | 'image' | 'file') => Promise<void>;
  startChatWithUser: (userId: string) => Promise<ChatRoom | null>;
  refreshRooms: () => Promise<void>;
  refreshOnlineUsers: () => Promise<void>;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const chatService = ChatService.getInstance();
  
  const [state, setState] = useState<ChatState>({
    rooms: [],
    messages: [],
    onlineUsers: [],
    activeRoomId: null,
    loading: {
      rooms: false,
      messages: false,
      sending: false,
    },
    connected: false,
    error: null,
  });

  const updateState = useCallback((updates: Partial<ChatState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const refreshRooms = useCallback(async () => {
    if (!user?.id) return;
    
    updateState({ loading: { ...state.loading, rooms: true }, error: null });
    
    try {
      const rooms = await chatService.getRooms();
      updateState({ 
        rooms, 
        loading: { ...state.loading, rooms: false }, 
        connected: true 
      });
    } catch (error) {
      console.error('Failed to refresh rooms:', error);
      updateState({ 
        loading: { ...state.loading, rooms: false },
        error: 'Failed to load conversations',
        connected: false
      });
    }
  }, [user?.id, chatService, state.loading, updateState]);

  const refreshOnlineUsers = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const users = await chatService.getOnlineUsers();
      updateState({ onlineUsers: users });
    } catch (error) {
      console.error('Failed to refresh online users:', error);
    }
  }, [user?.id, chatService, updateState]);

  const setActiveRoom = useCallback(async (roomId: string) => {
    if (!user?.id) return;
    
    updateState({ 
      activeRoomId: roomId, 
      messages: [],
      loading: { ...state.loading, messages: true }
    });
    
    try {
      const messages = await chatService.getMessages(roomId);
      updateState({ 
        messages, 
        loading: { ...state.loading, messages: false } 
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
      updateState({ 
        loading: { ...state.loading, messages: false },
        error: 'Failed to load messages'
      });
    }
  }, [user?.id, chatService, state.loading, updateState]);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'image' | 'file' = 'text') => {
    if (!user?.id || !state.activeRoomId) return;
    
    updateState({ loading: { ...state.loading, sending: true } });
    
    try {
      const message = await chatService.sendMessage(content, state.activeRoomId, type);
      if (message) {
        updateState({ 
          messages: [...state.messages, message],
          loading: { ...state.loading, sending: false }
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      updateState({ 
        loading: { ...state.loading, sending: false },
        error: 'Failed to send message'
      });
    }
  }, [user?.id, state.activeRoomId, state.messages, state.loading, chatService, updateState]);

  const startChatWithUser = useCallback(async (userId: string): Promise<ChatRoom | null> => {
    if (!user?.id) return null;
    
    try {
      const room = await chatService.createOrGetRoom(user.id, userId);
      if (room) {
        updateState({ 
          rooms: [...state.rooms.filter(r => r.id !== room.id), room]
        });
        return room;
      }
      return null;
    } catch (error) {
      console.error('Failed to start chat:', error);
      updateState({ error: 'Failed to start chat' });
      return null;
    }
  }, [user?.id, chatService, state.rooms, updateState]);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Initialize chat when user is available
  useEffect(() => {
    if (!user?.id) return;

    const initialize = async () => {
      await refreshRooms();
      await refreshOnlineUsers();
      await chatService.updatePresence(true);
    };

    initialize();

    // Update presence every 30 seconds
    const presenceInterval = setInterval(() => {
      chatService.updatePresence(true);
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(presenceInterval);
      chatService.updatePresence(false);
    };
  }, [user?.id, refreshRooms, refreshOnlineUsers, chatService]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;

    const roomsChannel = supabase
      .channel('chat-rooms')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chat_rooms' },
        () => refreshRooms()
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('chat-messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          if (payload.new.room_id === state.activeRoomId) {
            // Only add message if it's for the active room and not from current user
            if (payload.new.sender_id !== user.id) {
              setState(prev => ({
                ...prev,
                messages: [...prev.messages, payload.new as ChatMessage]
              }));
            }
          }
        }
      )
      .subscribe();

    const presenceChannel = supabase
      .channel('user-presence')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        () => refreshOnlineUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user?.id, state.activeRoomId, refreshRooms, refreshOnlineUsers]);

  const contextValue: ChatContextType = {
    state,
    setActiveRoom,
    sendMessage,
    startChatWithUser,
    refreshRooms,
    refreshOnlineUsers,
    clearError,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
