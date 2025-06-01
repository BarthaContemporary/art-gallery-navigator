
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

  // Set active room and fetch messages
  const setActiveRoomAndFetchMessages = useCallback(async (room: any) => {
    setState(prev => ({ ...prev, activeRoom: room }));
    await dataOps.fetchMessages(room.id, messageOps.markMessagesAsRead);
    realtimeOps.subscribeToMessages(room.id);
  }, [dataOps.fetchMessages, messageOps.markMessagesAsRead, realtimeOps.subscribeToMessages, setState]);

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
    });

    toast.success('Chat cache cleared');
  }, [realtimeOps, setState]);

  // Wrapper for cleanup with current state
  const cleanupOldMessages = useCallback(async () => {
    await messageOps.cleanupOldMessages(state.activeRoom, dataOps.fetchMessages);
  }, [messageOps, state.activeRoom, dataOps.fetchMessages]);

  // Initialize chat when user is available
  useEffect(() => {
    if (!authLoading && user) {
      dataOps.fetchChatRooms();
      dataOps.fetchOnlineUsers();
    }
  }, [authLoading, user, dataOps.fetchChatRooms, dataOps.fetchOnlineUsers]);

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
    sendMessage: messageOps.sendMessage,
    fetchOnlineUsers: dataOps.fetchOnlineUsers,
    clearAllChatCache,
    cleanupOldMessages,
    markMessagesAsRead: messageOps.markMessagesAsRead,
  };
}
