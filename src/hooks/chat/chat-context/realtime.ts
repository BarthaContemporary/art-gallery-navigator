
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatAction, ChatMessage, UserPresence } from './types';

export function useChatRealtime(userId?: string, dispatch?: React.Dispatch<ChatAction>) {
  const subscriptions = useRef<Map<string, any>>(new Map());
  const presenceChannel = useRef<any>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const updateConnectionState = useCallback((status: 'connecting' | 'connected' | 'disconnected' | 'error', error?: string) => {
    if (dispatch) {
      dispatch({ 
        type: 'SET_CONNECTION_STATE', 
        payload: { 
          status, 
          error,
          lastConnected: status === 'connected' ? new Date() : undefined 
        } 
      });
    }
  }, [dispatch]);

  const subscribeToRoom = useCallback(async (roomId: string) => {
    if (!userId || !dispatch) return;

    // Clean up existing subscription for this room
    const existingChannel = subscriptions.current.get(roomId);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    updateConnectionState('connecting');

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        try {
          const newMessage = payload.new as ChatMessage;
          
          // Fetch sender profile
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

          dispatch({ type: 'ADD_MESSAGE', payload: { roomId, message: transformedMessage } });
          
          // Update room's last message timestamp
          dispatch({ 
            type: 'UPDATE_ROOM', 
            payload: { 
              roomId, 
              updates: { 
                last_message_at: newMessage.created_at,
                last_message: transformedMessage 
              } 
            } 
          });

          updateConnectionState('connected');
        } catch (error) {
          console.error('Error handling real-time message:', error);
          updateConnectionState('error', error instanceof Error ? error.message : 'Real-time error');
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateConnectionState('connected');
        } else if (status === 'CHANNEL_ERROR') {
          updateConnectionState('error', 'Channel subscription failed');
          scheduleReconnect();
        }
      });

    subscriptions.current.set(roomId, channel);
  }, [userId, dispatch, updateConnectionState]);

  const subscribeToPresence = useCallback(() => {
    if (!userId || !dispatch) return;

    updateConnectionState('connecting');

    presenceChannel.current = supabase
      .channel('user_presence_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence'
      }, async (payload) => {
        try {
          const presenceData = payload.new as UserPresence;
          
          // Fetch profile for the user
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', presenceData.user_id)
            .single();

          const transformedPresence = {
            ...presenceData,
            profile: profile ? {
              display_name: profile.display_name || 'Unknown User',
              avatar_url: profile.avatar_url
            } : { display_name: 'Unknown User' }
          };

          dispatch({ type: 'UPDATE_USER_PRESENCE', payload: transformedPresence });
          updateConnectionState('connected');
        } catch (error) {
          console.error('Error handling presence update:', error);
          updateConnectionState('error', error instanceof Error ? error.message : 'Presence error');
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateConnectionState('connected');
        } else if (status === 'CHANNEL_ERROR') {
          updateConnectionState('error', 'Presence subscription failed');
          scheduleReconnect();
        }
      });
  }, [userId, dispatch, updateConnectionState]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }

    reconnectTimer.current = setTimeout(() => {
      console.log('Attempting to reconnect real-time subscriptions...');
      if (dispatch) {
        dispatch({ 
          type: 'SET_CONNECTION_STATE', 
          payload: { retryCount: Date.now() } 
        });
      }
      
      initialize();
    }, 5000); // Reconnect after 5 seconds
  }, [dispatch]);

  const initialize = useCallback(() => {
    if (!userId) return;

    subscribeToPresence();
    
    // Update user's own presence
    updatePresence(true);
    
    // Set up periodic presence updates
    const presenceInterval = setInterval(() => {
      updatePresence(true);
    }, 60000); // Update every minute

    return () => {
      clearInterval(presenceInterval);
      updatePresence(false);
    };
  }, [userId, subscribeToPresence]);

  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!userId) return;

    try {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: userId,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }, [userId]);

  const reconnect = useCallback(() => {
    cleanup();
    initialize();
  }, [initialize]);

  const cleanup = useCallback(() => {
    // Clear reconnect timer
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    // Clean up all message subscriptions
    subscriptions.current.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    subscriptions.current.clear();

    // Clean up presence subscription
    if (presenceChannel.current) {
      supabase.removeChannel(presenceChannel.current);
      presenceChannel.current = null;
    }

    // Update presence to offline
    if (userId) {
      updatePresence(false);
    }

    updateConnectionState('disconnected');
  }, [userId, updatePresence, updateConnectionState]);

  return {
    subscribeToRoom,
    subscribeToPresence,
    initialize,
    reconnect,
    cleanup,
  };
}
