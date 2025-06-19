
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
      // First get the rooms
      const { data: rooms, error: roomsError } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (roomsError) throw roomsError;
      if (!rooms) return [];

      // Then get the profiles for all participants
      const participantIds = new Set<string>();
      rooms.forEach(room => {
        participantIds.add(room.participant_1_id);
        participantIds.add(room.participant_2_id);
      });

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', Array.from(participantIds));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Map profiles to rooms
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return rooms.map(room => ({
        ...room,
        participant_1_profile: profileMap.get(room.participant_1_id),
        participant_2_profile: profileMap.get(room.participant_2_id)
      }));
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  }

  async getMessages(roomId: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
    try {
      // First get the messages
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (messagesError) throw messagesError;
      if (!messages) return [];

      // Get sender profiles
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', senderIds);

      if (profilesError) {
        console.error('Error fetching sender profiles:', profilesError);
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Transform messages and reverse to get chronological order
      return messages.map(message => ({
        id: message.id,
        room_id: message.room_id,
        sender_id: message.sender_id,
        content: message.encrypted_content || message.content || '', // Handle both encrypted and plain content
        message_type: message.message_type,
        created_at: message.created_at,
        edited_at: message.edited_at,
        read_by: message.read_by || [],
        sender_profile: profileMap.get(message.sender_id)
      })).reverse();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async sendMessage(content: string, roomId: string, messageType: 'text' | 'image' | 'file' = 'text'): Promise<ChatMessage | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Insert message with encrypted_content field
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: user.user.id,
          encrypted_content: content, // Use encrypted_content field
          message_type: messageType
        })
        .select('*')
        .single();

      if (error) throw error;

      // Get sender profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', user.user.id)
        .single();

      return {
        id: data.id,
        room_id: data.room_id,
        sender_id: data.sender_id,
        content: data.encrypted_content || '', // Transform back to content
        message_type: data.message_type,
        created_at: data.created_at,
        edited_at: data.edited_at,
        read_by: data.read_by || [],
        sender_profile: profile || undefined
      };
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

      // Get the room with profiles
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      // Get participant profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', [room.participant_1_id, room.participant_2_id]);

      if (profilesError) {
        console.error('Error fetching participant profiles:', profilesError);
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return {
        ...room,
        participant_1_profile: profileMap.get(room.participant_1_id),
        participant_2_profile: profileMap.get(room.participant_2_id)
      };
    } catch (error) {
      console.error('Error creating/getting room:', error);
      return null;
    }
  }

  async getOnlineUsers(): Promise<UserPresence[]> {
    try {
      // Get online users
      const { data: presence, error: presenceError } = await supabase
        .from('user_presence')
        .select('*')
        .eq('is_online', true)
        .order('updated_at', { ascending: false });

      if (presenceError) throw presenceError;
      if (!presence) return [];

      // Get profiles for online users
      const userIds = presence.map(p => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching user profiles:', profilesError);
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return presence.map(p => ({
        user_id: p.user_id,
        is_online: p.is_online,
        last_seen: p.last_seen,
        updated_at: p.updated_at,
        profile: profileMap.get(p.user_id)
      }));
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
