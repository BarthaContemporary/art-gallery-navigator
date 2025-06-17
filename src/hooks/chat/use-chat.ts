
import { useState, useEffect } from 'react';
import { useAuth } from '../use-auth';
import { useChatPresence } from './use-chat-presence';
import { useChatRooms } from './use-chat-rooms';
import { useChatMessages } from './use-chat-messages';
import { ChatRoom } from './types';

export type { ChatRoom, ChatMessage, UserPresence } from './types';

export function useChat() {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(false);

  const { onlineUsers, fetchOnlineUsers } = useChatPresence(user?.id);
  const { chatRooms, fetchChatRooms, startChatWithUser } = useChatRooms(user?.id);
  const { messages, sending, fetchMessages, sendMessage, subscribeToMessages, cleanup, markMessagesAsRead } = useChatMessages(user?.id);

  // Set active room and fetch messages
  const setActiveRoomAndFetchMessages = async (room: ChatRoom) => {
    setActiveRoom(room);
    setLoading(true);
    await fetchMessages(room.id);
    await subscribeToMessages(room.id);
    // Mark messages as read when entering the room
    await markMessagesAsRead(room.id);
    setLoading(false);
  };

  // Send message wrapper that uses the active room and refreshes chat rooms
  const sendMessageToActiveRoom = async (content: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!activeRoom) return;
    await sendMessage(content, activeRoom.id, type);
    // Refresh chat rooms to update last message and timestamps
    await fetchChatRooms();
  };

  // Load chat rooms on mount
  useEffect(() => {
    if (user) {
      fetchChatRooms();
    }
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  // Add comprehensive cache clearing function
  const clearAllChatCache = () => {
    // Clear messages cache
    cleanup();
    
    // Reset active room
    setActiveRoom(null);
    
    // Clear loading state
    setLoading(false);
    
    // Use the cache manager for comprehensive clearing
    const cacheManager = require('@/utils/chat-cache-manager').ChatCacheManager.getInstance();
    cacheManager.clearAllChatCache();
  };

  return {
    chatRooms,
    activeRoom,
    messages,
    onlineUsers,
    loading,
    sending,
    startChatWithUser,
    setActiveRoomAndFetchMessages,
    sendMessage: sendMessageToActiveRoom,
    fetchChatRooms,
    fetchOnlineUsers,
    clearAllChatCache,
  };
}
