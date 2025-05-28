
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
  const { messages, sending, fetchMessages, sendMessage, subscribeToMessages, cleanup } = useChatMessages(user?.id);

  // Set active room and fetch messages
  const setActiveRoomAndFetchMessages = async (room: ChatRoom) => {
    setActiveRoom(room);
    setLoading(true);
    await fetchMessages(room.id);
    await subscribeToMessages(room.id);
    setLoading(false);
  };

  // Send message wrapper that uses the active room
  const sendMessageToActiveRoom = async (content: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!activeRoom) return;
    await sendMessage(content, activeRoom.id, type);
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
  };
}
