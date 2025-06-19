
export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  encrypted_content: string;
  content?: string;
  message_type: 'text' | 'file' | 'image';
  created_at: string;
  edited_at?: string;
  read_by: string[];
  sender_profile?: { display_name: string; avatar_url?: string };
}

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

export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  updated_at: string;
  profile?: { display_name: string; avatar_url?: string };
}

export interface MessageBatch {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  retryCount: number;
  lastConnected?: Date;
}

export interface ChatState {
  // Core data
  rooms: Record<string, ChatRoom>;
  messages: Record<string, ChatMessage[]>;
  onlineUsers: Record<string, UserPresence>;
  
  // UI state
  activeRoomId: string | null;
  currentView: 'rooms' | 'online' | 'chat';
  
  // Loading states
  loading: {
    rooms: boolean;
    messages: Record<string, boolean>;
    sending: boolean;
    loadingMore: Record<string, boolean>;
  };
  
  // Pagination
  pagination: Record<string, {
    hasMore: boolean;
    nextCursor?: string;
    totalLoaded: number;
  }>;
  
  // Connection & errors
  connection: ConnectionState;
  errors: Record<string, string>;
  
  // Cache metadata
  cache: {
    lastFetch: Record<string, Date>;
    invalidated: Set<string>;
  };
}

export type ChatAction =
  | { type: 'SET_LOADING'; payload: { key: keyof ChatState['loading'] | string; value: boolean } }
  | { type: 'SET_ROOMS'; payload: ChatRoom[] }
  | { type: 'ADD_ROOM'; payload: ChatRoom }
  | { type: 'UPDATE_ROOM'; payload: { roomId: string; updates: Partial<ChatRoom> } }
  | { type: 'SET_MESSAGES'; payload: { roomId: string; messages: ChatMessage[]; hasMore: boolean; nextCursor?: string } }
  | { type: 'ADD_MESSAGE'; payload: { roomId: string; message: ChatMessage } }
  | { type: 'PREPEND_MESSAGES'; payload: { roomId: string; messages: ChatMessage[]; hasMore: boolean; nextCursor?: string } }
  | { type: 'SET_ONLINE_USERS'; payload: UserPresence[] }
  | { type: 'UPDATE_USER_PRESENCE'; payload: UserPresence }
  | { type: 'SET_ACTIVE_ROOM'; payload: string | null }
  | { type: 'SET_CURRENT_VIEW'; payload: 'rooms' | 'online' | 'chat' }
  | { type: 'SET_CONNECTION_STATE'; payload: Partial<ConnectionState> }
  | { type: 'SET_ERROR'; payload: { key: string; error: string } }
  | { type: 'CLEAR_ERROR'; payload: string }
  | { type: 'INVALIDATE_CACHE'; payload: string[] }
  | { type: 'CLEAR_ALL_CACHE' }
  | { type: 'MARK_MESSAGE_READ'; payload: { messageId: string; userId: string } };
