
import { useState } from 'react';
import { ChatRoom, ChatMessage, UserPresence } from './types';

interface ChatState {
  chatRooms: ChatRoom[];
  activeRoom: ChatRoom | null;
  messages: ChatMessage[];
  onlineUsers: UserPresence[];
  loading: boolean;
  sending: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  connected: boolean;
  error: string | null;
}

export function useChatState() {
  const [state, setState] = useState<ChatState>({
    chatRooms: [],
    activeRoom: null,
    messages: [],
    onlineUsers: [],
    loading: false,
    sending: false,
    loadingMore: false,
    hasMore: true,
    connected: false,
    error: null,
  });

  return { state, setState };
}
