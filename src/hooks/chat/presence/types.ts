
export interface PresenceState {
  onlineUsers: UserPresence[];
  isConnected: boolean;
  error: string | null;
  loading: boolean;
  retryCount: number;
  lastActivity: Date | null;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  updated_at: string;
  profile?: { display_name: string; avatar_url?: string };
}
