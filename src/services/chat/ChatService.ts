
import { supabase } from '@/integrations/supabase/client';

export interface ChatRoom {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  participant_1_profile?: { display_name: string; avatar_url?: string };
  participant_2_profile?: { display_name: string; avatar_url?: string };
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  created_at: string;
  edited_at?: string;
  read_by: string[];
  sender_profile?: { display_name: string; avatar_url?: string };
}

export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  updated_at: string;
  profile?: { display_name: string; avatar_url?: string };
}

export class ChatService {
  private static instance: ChatService;

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async getRooms(): Promise<ChatRoom[]> {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participant_1_profile:participant_1_id!inner(display_name, avatar_url),
          participant_2_profile:participant_2_id!inner(display_name, avatar_url)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  }

  async getMessages(roomId: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender_profile:sender_id!inner(display_name, avatar_url)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return (data || []).reverse();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async sendMessage(content: string, roomId: string, messageType: 'text' | 'image' | 'file' = 'text'): Promise<ChatMessage | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: user.user.id,
          content,
          message_type: messageType
        })
        .select(`
          *,
          sender_profile:sender_id!inner(display_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  async createOrGetRoom(participant1Id: string, participant2Id: string): Promise<ChatRoom | null> {
    try {
      const { data: roomId, error } = await supabase.rpc('find_or_create_chat_room', {
        _participant_1_id: participant1Id,
        _participant_2_id: participant2Id
      });

      if (error) throw error;

      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participant_1_profile:participant_1_id!inner(display_name, avatar_url),
          participant_2_profile:participant_2_id!inner(display_name, avatar_url)
        `)
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;
      return room;
    } catch (error) {
      console.error('Error creating/getting room:', error);
      return null;
    }
  }

  async getOnlineUsers(): Promise<UserPresence[]> {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select(`
          *,
          profile:user_id!inner(display_name, avatar_url)
        `)
        .eq('is_online', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching online users:', error);
      return [];
    }
  }

  async updatePresence(isOnline: boolean): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.user.id,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }
}
