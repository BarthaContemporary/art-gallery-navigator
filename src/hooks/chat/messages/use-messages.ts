
import { useState, useCallback } from 'react';
import { ChatMessage } from '../types';
import { useMessageFetcher } from './use-message-fetcher';
import { useMessageSender } from './use-message-sender';
import { useMessageReader } from './use-message-reader';
import { useMessageRealtime } from './use-message-realtime';
import { useMessageCleanup } from './use-message-cleanup';

export function useMessages(userId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { fetchMessages: fetchMessagesData, clearCache } = useMessageFetcher(userId);
  const { sendMessage: sendMessageData } = useMessageSender(userId);
  const { markMessagesAsRead, getUnreadCount, getTotalUnreadCount } = useMessageReader(userId);
  const { cleanupOldMessages } = useMessageCleanup();

  // Handle new messages from realtime
  const handleNewMessage = useCallback((newMessage: ChatMessage) => {
    setMessages(prev => [...prev, newMessage]);
    clearCache();
  }, [clearCache]);

  const { subscribeToMessages, cleanup } = useMessageRealtime(userId, handleNewMessage);

  // Fetch messages for a room with pagination
  const fetchMessages = useCallback(async (roomId: string, limit: number = 50, offset: number = 0, loadMore: boolean = false) => {
    if (!userId) return;

    try {
      if (!loadMore) {
        setLoadingMore(false);
      } else {
        setLoadingMore(true);
      }

      const result = await fetchMessagesData(roomId, limit, offset);

      if (loadMore) {
        // Prepend older messages to existing ones
        setMessages(prev => [...result.messages, ...prev]);
      } else {
        // Set initial messages
        setMessages(result.messages);
      }

      setHasMore(result.hasMore);
      setLoadingMore(false);
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      setLoadingMore(false);
    }
  }, [userId, fetchMessagesData]);

  // Load more older messages
  const loadMoreMessages = useCallback(async (roomId: string) => {
    if (!hasMore || loadingMore) return;
    
    const currentOffset = messages.length;
    await fetchMessages(roomId, 50, currentOffset, true);
  }, [hasMore, loadingMore, messages.length, fetchMessages]);

  // Send message
  const sendMessage = useCallback(async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    setSending(true);
    
    try {
      await sendMessageData(content, roomId, type);
      clearCache();
    } catch (error) {
      throw error;
    } finally {
      setSending(false);
    }
  }, [sendMessageData, clearCache]);

  // Clear cache function
  const clearAllCache = useCallback(() => {
    setMessages([]);
    setHasMore(true);
    clearCache();
    cleanup();
  }, [clearCache, cleanup]);

  return {
    messages,
    sending,
    loadingMore,
    hasMore,
    fetchMessages,
    loadMoreMessages,
    sendMessage,
    subscribeToMessages,
    markMessagesAsRead,
    getUnreadCount,
    getTotalUnreadCount,
    cleanupOldMessages,
    cleanup,
    clearCache: clearAllCache,
  };
}
