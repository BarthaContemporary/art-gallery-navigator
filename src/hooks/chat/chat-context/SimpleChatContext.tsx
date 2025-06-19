
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
  const userId = user?.id;
  
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

  const api = useMemo(() => {
    if (!userId) return null;
    
    try {
      return useChatAPI(userId);
    } catch (error) {
      console.error('Failed to initialize chat API:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to initialize chat',
        connected: false
      }));
      return null;
    }
  }, [userId]);

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

  const updateState = useCallback((updater: (prev: SimpleChatState) => SimpleChatState) => {
    try {
      setState(updater);
    } catch (error) {
      console.error('State update error:', error);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    if (!userId || !api) {
      updateState(prev => ({ ...prev, error: 'Not authenticated or API not available' }));
      return;
    }
    
    updateState(prev => ({ ...prev, loading: { ...prev.loading, rooms: true }, error: null }));
    
    try {
      const rooms = await api.fetchRooms();
      updateState(prev => ({ 
        ...prev, 
        rooms, 
        loading: { ...prev.loading, rooms: false },
        connected: true 
      }));
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      updateState(prev => ({ 
        ...prev, 
        loading: { ...prev.loading, rooms: false },
        error: 'Failed to load conversations',
        connected: false
      }));
    }
  }, [userId, api, updateState]);

  const fetchMessages = useCallback(async (roomId: string) => {
    if (!userId || !api) return;
    
    updateState(prev => ({ ...prev, loading: { ...prev.loading, messages: true }, error: null }));
    
    try {
      const result = await api.fetchMessages(roomId, 50, 0);
      updateState(prev => ({ 
        ...prev, 
        messages: result.messages,
        loading: { ...prev.loading, messages: false },
        connected: true
      }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      updateState(prev => ({ 
        ...prev, 
        loading: { ...prev.loading, messages: false },
        error: 'Failed to load messages'
      }));
    }
  }, [userId, api, updateState]);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'image' = 'text') => {
    if (!userId || !state.activeRoomId || !api) return;
    
    updateState(prev => ({ ...prev, loading: { ...prev.loading, sending: true }, error: null }));
    
    try {
      const message = await api.sendMessage(content, state.activeRoomId, type);
      updateState(prev => ({ 
        ...prev, 
        messages: [...prev.messages, message],
        loading: { ...prev.loading, sending: false }
      }));
      toast.success('Message sent');
    } catch (error) {
      console.error('Failed to send message:', error);
      updateState(prev => ({ 
        ...prev, 
        loading: { ...prev.loading, sending: false },
        error: 'Failed to send message'
      }));
      toast.error('Failed to send message');
    }
  }, [userId, state.activeRoomId, api, updateState]);

  const setActiveRoom = useCallback(async (roomId: string) => {
    updateState(prev => ({ ...prev, activeRoomId: roomId, messages: [] }));
    await fetchMessages(roomId);
  }, [fetchMessages, updateState]);

  const startChatWithUser = useCallback(async (userId: string): Promise<ChatRoom | null> => {
    if (!user?.id || !api) return null;
    
    try {
      const room = await api.createOrGetRoom(user.id, userId);
      updateState(prev => ({ 
        ...prev, 
        rooms: [...prev.rooms.filter(r => r.id !== room.id), room]
      }));
      return room;
    } catch (error) {
      console.error('Failed to start chat:', error);
      toast.error('Failed to start chat');
      return null;
    }
  }, [user?.id, api, updateState]);

  const setCurrentView = useCallback((view: 'rooms' | 'online' | 'chat') => {
    updateState(prev => ({ ...prev, currentView: view }));
  }, [updateState]);

  const clearCache = useCallback(() => {
    updateState(prev => ({ 
      ...prev, 
      rooms: [],
      messages: [],
      onlineUsers: [],
      activeRoomId: null,
      error: null
    }));
  }, [updateState]);

  const retryConnection = useCallback(() => {
    updateState(prev => ({ ...prev, error: null }));
    if (userId && api) {
      fetchRooms();
    }
  }, [userId, api, fetchRooms, updateState]);

  // Initialize chat - simplified with proper dependency handling
  useEffect(() => {
    if (!userId || !api) return;

    let isMounted = true;

    const initializeChat = async () => {
      try {
        await fetchRooms();
        
        if (!isMounted) return;
        
        const users = await api.fetchOnlineUsers();
        if (isMounted) {
          updateState(prev => ({ ...prev, onlineUsers: users }));
        }
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        if (isMounted) {
          updateState(prev => ({ ...prev, error: 'Failed to initialize chat' }));
        }
      }
    };

    initializeChat();

    return () => {
      isMounted = false;
    };
  }, [userId]); // Simplified dependencies

  // Separate effect for periodic updates
  useEffect(() => {
    if (!userId || !api) return;
    
    const interval = setInterval(async () => {
      try {
        const users = await api.fetchOnlineUsers();
        updateState(prev => ({ ...prev, onlineUsers: users }));
      } catch (error) {
        console.error('Failed to fetch online users:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userId]); // Simplified dependencies

  const contextValue = useMemo<SimpleChatContextType>(() => ({
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

export function useSimpleChat(): SimpleChatContextType {
  const context = useContext(SimpleChatContext);
  if (!context) {
    console.warn('useSimpleChat used outside of SimpleChatProvider');
    return {
      state: {
        rooms: [],
        messages: [],
        onlineUsers: [],
        activeRoomId: null,
        currentView: 'rooms' as const,
        loading: { rooms: false, messages: false, sending: false },
        connected: false,
        error: 'Chat not initialized'
      },
      fetchRooms: async () => {},
      fetchMessages: async () => {},
      sendMessage: async () => {},
      setActiveRoom: async () => {},
      startChatWithUser: async () => null,
      setCurrentView: () => {},
      clearCache: () => {},
      retryConnection: () => {},
      activeRoom: null,
      roomMessages: [],
      onlineUsersList: [],
      roomsList: [],
    } as SimpleChatContextType;
  }
  return context;
}
