
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from './types';
import { toast } from 'sonner';

export function useUnifiedMessages(userId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesChannel = useRef<any>(null);
  const messagesCache = useRef<Map<string, ChatMessage[]>>(new Map());

  // Fetch messages with pagination
  const fetchMessages = useCallback(async (
    roomId: string, 
    limit: number = 50, 
    offset: number = 0,
    loadMore: boolean = false
  ) => {
    if (!userId) return;

    try {
      if (!loadMore) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load messages');
        return;
      }

      if (!data || data.length === 0) {
        setHasMore(false);
        if (!loadMore) setMessages([]);
        return;
      }

      const hasMoreData = data.length === limit;
      setHasMore(hasMoreData);

      // Fetch profile data for all senders
      const senderIds = data.map(message => message.sender_id);
      const uniqueSenderIds = [...new Set(senderIds)];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', uniqueSenderIds);

      // Create profiles map for efficient lookup
      const profilesMap = new Map();
      (profilesData || []).forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Transform messages with profile data
      const transformedMessages = data.map(message => {
        const senderProfile = profilesMap.get(message.sender_id);
        
        return {
          ...message,
          sender_profile: senderProfile ? {
            display_name: senderProfile.display_name || 'Unknown User',
            avatar_url: senderProfile.avatar_url
          } : { display_name: 'Unknown User' }
        };
      });

      // Reverse to show oldest first in UI
      const orderedMessages = transformedMessages.reverse();

      if (loadMore) {
        setMessages(prev => [...orderedMessages, ...prev]);
      } else {
        setMessages(orderedMessages);
      }

    } catch (error) {
      console.error('Error in fetchMessages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId]);

  // Send message
  const sendMessage = useCallback(async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!userId || !content.trim()) {
      toast.error('Cannot send empty message');
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
          encrypted_content: content,
          message_type: type,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Message sent');
      messagesCache.current.clear();

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      throw error;
    } finally {
      setSending(false);
    }
  }, [userId]);

  // Subscribe to real-time messages
  const subscribeToMessages = useCallback(async (roomId: string) => {
    // Clean up existing subscription
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
    }

    messagesChannel.current = supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        const newMessage = payload.new as ChatMessage;
        
        try {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          const transformedMessage = {
            ...newMessage,
            sender_profile: senderProfile ? {
              display_name: senderProfile.display_name || 'Unknown User',
              avatar_url: senderProfile.avatar_url
            } : { display_name: 'Unknown User' }
          };

          setMessages(prev => [...prev, transformedMessage]);

          if (newMessage.sender_id !== userId) {
            toast.info(`New message from ${senderProfile?.display_name || 'Unknown User'}`);
          }
        } catch (error) {
          console.error('Error handling real-time message:', error);
        }
      })
      .subscribe();
  }, [userId]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (roomId: string) => {
    if (!userId) return;

    try {
      const { data: unreadMessages } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', roomId)
        .not('read_by', 'cs', `{${userId}}`);

      for (const message of unreadMessages || []) {
        await supabase.rpc('mark_message_as_read', {
          message_id: message.id,
          reader_id: userId
        });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [userId]);

  // Get unread count
  const getUnreadCount = useCallback(async (roomId: string): Promise<number> => {
    if (!userId) return 0;

    try {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .neq('sender_id', userId)
        .not('read_by', 'cs', `{${userId}}`);

      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }, [userId]);

  // Get total unread count
  const getTotalUnreadCount = useCallback(async (): Promise<number> => {
    if (!userId) return 0;

    try {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', userId)
        .not('read_by', 'cs', `{${userId}}`);

      return count || 0;
    } catch (error) {
      console.error('Error getting total unread count:', error);
      return 0;
    }
  }, [userId]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
      messagesChannel.current = null;
    }
    setMessages([]);
    setHasMore(true);
    messagesCache.current.clear();
  }, []);

  return {
    messages,
    loading,
    sending,
    loadingMore,
    hasMore,
    fetchMessages,
    sendMessage,
    subscribeToMessages,
    markMessagesAsRead,
    getUnreadCount,
    getTotalUnreadCount,
    cleanup,
  };
}
