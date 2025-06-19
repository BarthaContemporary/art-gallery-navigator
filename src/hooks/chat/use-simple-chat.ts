
import { useEffect, useCallback } from 'react';
import { useAuth } from '../use-auth';
import { toast } from 'sonner';
import { useChatState } from './use-chat-state';
import { useMessageOperations } from './use-message-operations';
import { useChatData } from './use-chat-data';
import { useChatRealtime } from './use-chat-realtime';

export function useSimpleChat() {
  const { user, isLoading: authLoading } = useAuth();
  const { state, setState } = useChatState();
  
  const messageOps = useMessageOperations(user, setState);
  const dataOps = useChatData(user, setState);
  const realtimeOps = useChatRealtime(user, setState);

  // Set active room and fetch messages with pagination
  const setActiveRoomAndFetchMessages = useCallback(async (room: any) => {
    setState(prev => ({ 
      ...prev, 
      activeRoom: room,
      hasMore: true, // Reset pagination state
      loadingMore: false
    }));
    
    // Fetch initial messages (most recent 50)
    await dataOps.fetchMessages(room.id, 50, 0, false);
    await messageOps.markMessagesAsRead(room.id);
    realtimeOps.subscribeToMessages(room.id);
  }, [dataOps, messageOps, realtimeOps, setState]);

  // Load more older messages
  const loadMoreMessages = useCallback(async () => {
    if (!state.activeRoom || !state.hasMore || state.loadingMore) return;
    
    const currentOffset = state.messages.length;
    await dataOps.fetchMessages(state.activeRoom.id, 50, currentOffset, true);
  }, [state.activeRoom, state.hasMore, state.loadingMore, state.messages.length, dataOps]);

  // Clear cache
  const clearAllChatCache = useCallback(() => {
    realtimeOps.cleanup();

    setState({
      chatRooms: [],
      activeRoom: null,
      messages: [],
      onlineUsers: [],
      loading: false,
      sending: false,
      connected: false,
      error: null,
      loadingMore: false,
      hasMore: true,
    });

    toast.success('Chat cache cleared');
  }, [realtimeOps, setState]);

  // Wrapper for cleanup with current state
  const cleanupOldMessages = useCallback(async (daysToKeep: number = 30) => {
    await messageOps.cleanupOldMessages(daysToKeep);
    
    // Refresh current room messages if active
    if (state.activeRoom) {
      await dataOps.fetchMessages(state.activeRoom.id, 50, 0, false);
    }
  }, [messageOps, state.activeRoom, dataOps]);

  // Initialize chat when user is available
  useEffect(() => {
    if (!authLoading && user) {
      dataOps.fetchChatRooms();
      dataOps.fetchOnlineUsers();
    }
  }, [authLoading, user, dataOps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      realtimeOps.cleanup();
    };
  }, [realtimeOps]);

  return {
    ...state,
    fetchChatRooms: dataOps.fetchChatRooms,
    startChatWithUser: dataOps.startChatWithUser,
    setActiveRoomAndFetchMessages,
    loadMoreMessages,
    sendMessage: messageOps.sendMessage,
    fetchOnlineUsers: dataOps.fetchOnlineUsers,
    clearAllChatCache,
    cleanupOldMessages,
    markMessagesAsRead: messageOps.markMessagesAsRead,
  };
}
