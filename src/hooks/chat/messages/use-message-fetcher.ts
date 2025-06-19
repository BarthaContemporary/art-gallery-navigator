
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatMessage } from '../types';

export function useMessageFetcher(userId?: string) {
  const messagesCache = useRef<Map<string, ChatMessage[]>>(new Map());

  const fetchMessages = useCallback(async (
    roomId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
    if (!userId) return { messages: [], hasMore: false };

    try {
      // Check cache first for initial load
      const cacheKey = `${roomId}-${offset}-${limit}`;
      if (offset === 0 && messagesCache.current.has(cacheKey)) {
        const cachedMessages = messagesCache.current.get(cacheKey) || [];
        return { messages: cachedMessages, hasMore: true };
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
        return { messages: [], hasMore: false };
      }

      if (!data || data.length === 0) {
        return { messages: [], hasMore: false };
      }

      // Check if we have fewer messages than requested (reached the end)
      const hasMore = data.length === limit;

      // Fetch profile data for all senders
      const senderIds = data.map(message => message.sender_id);
      const uniqueSenderIds = [...new Set(senderIds)];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', uniqueSenderIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

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

      // Cache the initial load
      if (offset === 0) {
        messagesCache.current.set(cacheKey, orderedMessages);
      }

      return { messages: orderedMessages, hasMore };
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      toast.error('Failed to load messages');
      return { messages: [], hasMore: false };
    }
  }, [userId]);

  const clearCache = useCallback(() => {
    messagesCache.current.clear();
  }, []);

  return {
    fetchMessages,
    clearCache,
  };
}
