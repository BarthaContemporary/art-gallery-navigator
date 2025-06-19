
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { ChatRoom, ChatMessage, UserPresence } from './types';
import { useAuth } from '@/hooks/use-auth';
import { useChatAPI } from './api';
import { toast } from 'sonner';

interface SimpleChatState {
  rooms: ChatRoom[];
  messages: ChatMessage[];
  onlineUsers: UserPresence[];
  activeRoomId: string | null;
  currentView: 'rooms' | 'online' | 'chat';
  loading: {
    rooms: boolean;
    messages: boolean;
    sending: boolean;
  };
  connected: boolean;
  error: string | null;
}

interface SimpleChatContextType {
  state: SimpleChatState;
  
  // Core actions
  fetchRooms: () => Promise<void>;
  fetchMessages: (roomId: string) => Promise<void>;
  sendMessage: (content: string, type?: 'text' | 'image') => Promise<void>;
  setActiveRoom: (roomId: string) => Promise<void>;
  startChatWithUser: (userId: string) => Promise<ChatRoom | null>;
  
  // View management
  setCurrentView: (view: 'rooms' | 'online' | 'chat') => void;
  
  // Utility
  clearCache: () => void;
  retryConnection: () => void;
  
  // Computed values
  activeRoom: ChatRoom | null;
  roomMessages: ChatMessage[];
  onlineUsersList: UserPresence[];
  roomsList: ChatRoom[];
}

const SimpleChatContext = createContext<SimpleChatContextType | null>(null);

export function SimpleChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const api = useChatAPI(user?.id);
  
  const [state, setState] = useState<SimpleChatState>({
    rooms: [],
    messages: [],
    onlineUsers: [],
    activeRoomId: null,
    currentView: 'rooms',
    loading: {
      rooms: false,
      messages: false,
      sending: false,
    },
    connected: false,
    error: null,
  });

  // Computed values
  const activeRoom = useMemo(() => 
    state.rooms.find(room => room.id === state.activeRoomId) || null,
    [state.rooms, state.activeRoomId]
  );

  const roomMessages = useMemo(() => state.messages, [state.messages]);
  const onlineUsersList = useMemo(() => state.onlineUsers, [state.onlineUsers]);
  const roomsList = useMemo(() => 
    [...state.rooms].sort((a, b) => 
      new Date(b.last_message_at || b.updated_at).getTime() - 
      new Date(a.last_message_at || a.updated_at).getTime()
    ),
    [state.rooms]
  );

  // Safe state updater to prevent crashes
  const safeSetState = useCallback((updater: (prev: SimpleChatState) => SimpleChatState) => {
    setState(prev => {
      try {
        return updater(prev);
      } catch (error) {
        console.error('State update error:', error);
        return prev;
      }
    });
  }, []);

  // Core actions with error handling
  const fetchRooms = useCallback(async () => {
    if (!user?.id) return;
    
    safeSetState(prev => ({ ...prev, loading: { ...prev.loading, rooms: true }, error: null }));
    
    try {
      const rooms = await api.fetchRooms();
      safeSetState(prev => ({ 
        ...prev, 
        rooms, 
        loading: { ...prev.loading, rooms: false },
        connected: true 
      }));
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      safeSetState(prev => ({ 
        ...prev, 
        loading: { ...prev.loading, rooms: false },
        error: 'Failed to load conversations',
        connected: false
      }));
    }
  }, [user?.id, api, safeSetState]);

  const fetchMessages = useCallback(async (roomId: string) => {
    if (!user?.id) return;
    
    safeSetState(prev => ({ ...prev, loading: { ...prev.loading, messages: true }, error: null }));
    
    try {
      const result = await api.fetchMessages(roomId, 50, 0);
      safeSetState(prev => ({ 
        ...prev, 
        messages: result.messages,
        loading: { ...prev.loading, messages: false },
        connected: true
      }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      safeSetState(prev => ({ 
        ...prev, 
        loading: { ...prev.loading, messages: false },
        error: 'Failed to load messages'
      }));
    }
  }, [user?.id, api, safeSetState]);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'image' = 'text') => {
    if (!user?.id || !state.activeRoomId) return;
    
    safeSetState(prev => ({ ...prev, loading: { ...prev.loading, sending: true }, error: null }));
    
    try {
      const message = await api.sendMessage(content, state.activeRoomId, type);
      safeSetState(prev => ({ 
        ...prev, 
        messages: [...prev.messages, message],
        loading: { ...prev.loading, sending: false }
      }));
      toast.success('Message sent');
    } catch (error) {
      console.error('Failed to send message:', error);
      safeSetState(prev => ({ 
        ...prev, 
        loading: { ...prev.loading, sending: false },
        error: 'Failed to send message'
      }));
      toast.error('Failed to send message');
    }
  }, [user?.id, state.activeRoomId, api, safeSetState]);

  const setActiveRoom = useCallback(async (roomId: string) => {
    safeSetState(prev => ({ ...prev, activeRoomId: roomId, messages: [] }));
    await fetchMessages(roomId);
  }, [fetchMessages, safeSetState]);

  const startChatWithUser = useCallback(async (userId: string): Promise<ChatRoom | null> => {
    if (!user?.id) return null;
    
    try {
      const room = await api.createOrGetRoom(user.id, userId);
      safeSetState(prev => ({ 
        ...prev, 
        rooms: [...prev.rooms.filter(r => r.id !== room.id), room]
      }));
      return room;
    } catch (error) {
      console.error('Failed to start chat:', error);
      toast.error('Failed to start chat');
      return null;
    }
  }, [user?.id, api, safeSetState]);

  const setCurrentView = useCallback((view: 'rooms' | 'online' | 'chat') => {
    safeSetState(prev => ({ ...prev, currentView: view }));
  }, [safeSetState]);

  const clearCache = useCallback(() => {
    safeSetState(prev => ({ 
      ...prev, 
      rooms: [],
      messages: [],
      onlineUsers: [],
      activeRoomId: null,
      error: null
    }));
  }, [safeSetState]);

  const retryConnection = useCallback(() => {
    safeSetState(prev => ({ ...prev, error: null }));
    if (user?.id) {
      fetchRooms();
    }
  }, [user?.id, fetchRooms, safeSetState]);

  // Initialize
  useEffect(() => {
    if (user?.id) {
      fetchRooms();
      
      // Fetch online users
      const fetchOnlineUsers = async () => {
        try {
          const users = await api.fetchOnlineUsers();
          safeSetState(prev => ({ ...prev, onlineUsers: users }));
        } catch (error) {
          console.error('Failed to fetch online users:', error);
        }
      };
      
      fetchOnlineUsers();
      const interval = setInterval(fetchOnlineUsers, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user?.id, fetchRooms, api, safeSetState]);

  const contextValue: SimpleChatContextType = useMemo(() => ({
    state,
    fetchRooms,
    fetchMessages,
    sendMessage,
    setActiveRoom,
    startChatWithUser,
    setCurrentView,
    clearCache,
    retryConnection,
    activeRoom,
    roomMessages,
    onlineUsersList,
    roomsList,
  }), [
    state,
    fetchRooms,
    fetchMessages,
    sendMessage,
    setActiveRoom,
    startChatWithUser,
    setCurrentView,
    clearCache,
    retryConnection,
    activeRoom,
    roomMessages,
    onlineUsersList,
    roomsList,
  ]);

  return (
    <SimpleChatContext.Provider value={contextValue}>
      {children}
    </SimpleChatContext.Provider>
  );
}

export function useSimpleChat() {
  const context = useContext(SimpleChatContext);
  if (!context) {
    throw new Error('useSimpleChat must be used within a SimpleChatProvider');
  }
  return context;
}
