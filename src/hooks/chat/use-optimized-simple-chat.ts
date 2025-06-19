
import { useEffect, useCallback } from 'react';
import { useAuth } from '../use-auth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useChatState } from './use-chat-state';
import { useUnifiedMessages } from './use-unified-messages';
import { useOptimizedChatPresence } from './use-optimized-chat-presence';
import { useChatRooms } from './use-chat-rooms';

export function useOptimizedSimpleChat() {
  const { user, isLoading: authLoading } = useAuth();
  const { state, setState } = useChatState();
  
  const messageOps = useUnifiedMessages(user?.id);
  const { onlineUsers, connected, fetchOnlineUsers } = useOptimizedChatPresence(user?.id);
  const { chatRooms, fetchChatRooms, startChatWithUser } = useChatRooms(user?.id);

  // Set active room and fetch messages
  const setActiveRoomAndFetchMessages = useCallback(async (room: any) => {
    setState(prev => ({ 
      ...prev, 
      activeRoom: room,
      loading: true,
      hasMore: true,
      loadingMore: false
    }));
    
    try {
      await messageOps.fetchMessages(room.id, 50, 0, false);
      await messageOps.subscribeToMessages(room.id);
      await messageOps.markMessagesAsRead(room.id);
    } catch (error) {
      console.error('Error setting active room:', error);
      toast.error('Failed to load chat room');
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [messageOps, setState]);

  // Load more older messages
  const loadMoreMessages = useCallback(async () => {
    if (!state.activeRoom || !messageOps.hasMore || messageOps.loadingMore) return;
    
    const currentOffset = messageOps.messages.length;
    await messageOps.fetchMessages(state.activeRoom.id, 50, currentOffset, true);
  }, [state.activeRoom, messageOps]);

  // Send message wrapper
  const sendMessage = useCallback(async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    try {
      await messageOps.sendMessage(content, roomId, type);
      // Refresh chat rooms to update last message
      await fetchChatRooms();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [messageOps, fetchChatRooms]);

  // Clear all cache
  const clearAllChatCache = useCallback(() => {
    messageOps.cleanup();
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
  }, [messageOps, setState]);

  // Cleanup old messages
  const cleanupOldMessages = useCallback(async (daysToKeep: number = 30) => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;
      
      toast.success(`Messages older than ${daysToKeep} days have been cleaned up`);
      
      // Refresh current room messages if active
      if (state.activeRoom) {
        await messageOps.fetchMessages(state.activeRoom.id, 50, 0, false);
      }
    } catch (error) {
      console.error('Error cleaning up old messages:', error);
      toast.error('Failed to cleanup old messages');
    }
  }, [state.activeRoom, messageOps]);

  // Initialize chat when user is available
  useEffect(() => {
    if (!authLoading && user) {
      fetchChatRooms();
      fetchOnlineUsers();
    }
  }, [authLoading, user, fetchChatRooms, fetchOnlineUsers]);

  // Update state with current values
  useEffect(() => {
    setState(prev => ({
      ...prev,
      messages: messageOps.messages,
      onlineUsers,
      connected,
      sending: messageOps.sending,
      loadingMore: messageOps.loadingMore,
      hasMore: messageOps.hasMore,
      chatRooms,
    }));
  }, [
    messageOps.messages,
    messageOps.sending,
    messageOps.loadingMore,
    messageOps.hasMore,
    onlineUsers,
    connected,
    chatRooms,
    setState
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      messageOps.cleanup();
    };
  }, [messageOps]);

  return {
    ...state,
    fetchChatRooms,
    startChatWithUser,
    setActiveRoomAndFetchMessages,
    loadMoreMessages,
    sendMessage,
    fetchOnlineUsers,
    clearAllChatCache,
    cleanupOldMessages,
    markMessagesAsRead: messageOps.markMessagesAsRead,
  };
}
