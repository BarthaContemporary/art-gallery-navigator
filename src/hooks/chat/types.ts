
export interface ChatRoom {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  participant_1_profile?: { display_name: string; avatar_url?: string };
  participant_2_profile?: { display_name: string; avatar_url?: string };
  last_message?: ChatMessage;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  encrypted_content: string;
  content?: string; // Plain text content for display
  message_type: 'text' | 'file' | 'image';
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
