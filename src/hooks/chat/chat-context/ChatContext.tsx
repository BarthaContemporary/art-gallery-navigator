
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { ChatState, ChatAction, ChatMessage, ChatRoom, UserPresence } from './types';
import { chatReducer, initialState } from './reducer';
import { useAuth } from '@/hooks/use-auth';
import { useChatAPI } from './api';
import { useChatRealtime } from './realtime';
import { useChatErrorRecovery } from './error-recovery';

interface ChatContextType {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  
  // Core actions
  fetchRooms: () => Promise<void>;
  fetchMessages: (roomId: string, loadMore?: boolean) => Promise<void>;
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

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user } = useAuth();
  
  const api = useChatAPI(user?.id);
  const realtime = useChatRealtime(user?.id, dispatch);
  const errorRecovery = useChatErrorRecovery(dispatch);

  // Core actions
  const fetchRooms = useCallback(async () => {
    if (!user?.id) return;
    
    dispatch({ type: 'SET_LOADING', payload: { key: 'rooms', value: true } });
    dispatch({ type: 'CLEAR_ERROR', payload: 'rooms' });
    
    try {
      const rooms = await api.fetchRooms();
      dispatch({ type: 'SET_ROOMS', payload: rooms });
      
      // Update cache metadata
      state.cache.lastFetch['rooms'] = new Date();
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      dispatch({ type: 'SET_ERROR', payload: { key: 'rooms', error: error instanceof Error ? error.message : 'Unknown error' } });
      errorRecovery.handleError('fetchRooms', error, fetchRooms);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'rooms', value: false } });
    }
  }, [user?.id, api, errorRecovery]);

  const fetchMessages = useCallback(async (roomId: string, loadMore = false) => {
    if (!user?.id) return;
    
    const loadingKey = loadMore ? `loadingMore.${roomId}` : `messages.${roomId}`;
    dispatch({ type: 'SET_LOADING', payload: { key: loadingKey, value: true } });
    dispatch({ type: 'CLEAR_ERROR', payload: `messages-${roomId}` });
    
    try {
      const currentPagination = state.pagination[roomId];
      const cursor = loadMore ? currentPagination?.nextCursor : undefined;
      const offset = loadMore ? currentPagination?.totalLoaded || 0 : 0;
      
      const result = await api.fetchMessages(roomId, 50, offset, cursor);
      
      if (loadMore) {
        dispatch({ 
          type: 'PREPEND_MESSAGES', 
          payload: { 
            roomId, 
            messages: result.messages, 
            hasMore: result.hasMore,
            nextCursor: result.nextCursor 
          } 
        });
      } else {
        dispatch({ 
          type: 'SET_MESSAGES', 
          payload: { 
            roomId, 
            messages: result.messages, 
            hasMore: result.hasMore,
            nextCursor: result.nextCursor 
          } 
        });
      }
      
      // Update cache metadata
      state.cache.lastFetch[`messages-${roomId}`] = new Date();
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      dispatch({ type: 'SET_ERROR', payload: { key: `messages-${roomId}`, error: error instanceof Error ? error.message : 'Unknown error' } });
      errorRecovery.handleError('fetchMessages', error, () => fetchMessages(roomId, loadMore));
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: loadingKey, value: false } });
    }
  }, [user?.id, api, state.pagination, errorRecovery]);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'image' = 'text') => {
    if (!user?.id || !state.activeRoomId) return;
    
    dispatch({ type: 'SET_LOADING', payload: { key: 'sending', value: true } });
    dispatch({ type: 'CLEAR_ERROR', payload: 'sending' });
    
    // Optimistic update
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      room_id: state.activeRoomId,
      sender_id: user.id,
      encrypted_content: content,
      content,
      message_type: type,
      created_at: new Date().toISOString(),
      read_by: [user.id],
      sender_profile: {
        display_name: user.email || 'You',
        avatar_url: undefined,
      },
    };
    
    dispatch({ type: 'ADD_MESSAGE', payload: { roomId: state.activeRoomId, message: optimisticMessage } });
    
    try {
      const sentMessage = await api.sendMessage(content, state.activeRoomId, type);
      
      // Replace optimistic message with real one
      const currentMessages = state.messages[state.activeRoomId] || [];
      const updatedMessages = currentMessages.map(msg => 
        msg.id === optimisticMessage.id ? sentMessage : msg
      );
      
      dispatch({ type: 'SET_MESSAGES', payload: { 
        roomId: state.activeRoomId, 
        messages: updatedMessages, 
        hasMore: state.pagination[state.activeRoomId]?.hasMore || false 
      } });
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove optimistic message on failure
      const currentMessages = state.messages[state.activeRoomId] || [];
      const updatedMessages = currentMessages.filter(msg => msg.id !== optimisticMessage.id);
      
      dispatch({ type: 'SET_MESSAGES', payload: { 
        roomId: state.activeRoomId, 
        messages: updatedMessages, 
        hasMore: state.pagination[state.activeRoomId]?.hasMore || false 
      } });
      
      dispatch({ type: 'SET_ERROR', payload: { key: 'sending', error: error instanceof Error ? error.message : 'Failed to send message' } });
      errorRecovery.handleError('sendMessage', error, () => sendMessage(content, type));
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'sending', value: false } });
    }
  }, [user?.id, state.activeRoomId, state.messages, state.pagination, api, errorRecovery]);

  const setActiveRoom = useCallback(async (roomId: string) => {
    dispatch({ type: 'SET_ACTIVE_ROOM', payload: roomId });
    
    // Fetch messages if not already loaded
    if (!state.messages[roomId] || state.cache.invalidated.has(`messages-${roomId}`)) {
      await fetchMessages(roomId);
    }
    
    // Subscribe to real-time updates for this room
    await realtime.subscribeToRoom(roomId);
    
    // Mark messages as read
    try {
      await api.markMessagesAsRead(roomId);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [state.messages, state.cache.invalidated, fetchMessages, realtime, api]);

  const startChatWithUser = useCallback(async (userId: string): Promise<ChatRoom | null> => {
    if (!user?.id) return null;
    
    try {
      const room = await api.createOrGetRoom(user.id, userId);
      dispatch({ type: 'ADD_ROOM', payload: room });
      return room;
    } catch (error) {
      console.error('Failed to start chat:', error);
      dispatch({ type: 'SET_ERROR', payload: { key: 'startChat', error: error instanceof Error ? error.message : 'Failed to start chat' } });
      return null;
    }
  }, [user?.id, api]);

  const setCurrentView = useCallback((view: 'rooms' | 'online' | 'chat') => {
    dispatch({ type: 'SET_CURRENT_VIEW', payload: view });
  }, []);

  const clearCache = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_CACHE' });
  }, []);

  const retryConnection = useCallback(() => {
    realtime.reconnect();
  }, [realtime]);

  // Computed values
  const activeRoom = state.activeRoomId ? state.rooms[state.activeRoomId] || null : null;
  const roomMessages = state.activeRoomId ? state.messages[state.activeRoomId] || [] : [];
  const onlineUsersList = Object.values(state.onlineUsers);
  const roomsList = Object.values(state.rooms).sort((a, b) => 
    new Date(b.last_message_at || b.updated_at).getTime() - new Date(a.last_message_at || a.updated_at).getTime()
  );

  // Initialize on mount
  useEffect(() => {
    if (user?.id) {
      fetchRooms();
      realtime.initialize();
    }
    
    return () => {
      realtime.cleanup();
    };
  }, [user?.id, fetchRooms, realtime]);

  const contextValue: ChatContextType = {
    state,
    dispatch,
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
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
