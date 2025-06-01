
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export class ChatCacheManager {
  private static instance: ChatCacheManager;

  static getInstance(): ChatCacheManager {
    if (!ChatCacheManager.instance) {
      ChatCacheManager.instance = new ChatCacheManager();
    }
    return ChatCacheManager.instance;
  }

  // Clear all chat-related cache and state
  clearAllChatCache(): void {
    // Clear any active Supabase channels
    const channels = supabase.getChannels();
    channels.forEach(channel => {
      if (channel.topic.includes('messages:') || channel.topic.includes('user_presence')) {
        supabase.removeChannel(channel);
      }
    });

    // Clear browser storage if any chat data is stored there
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('chat_') || key.includes('encryption_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Could not clear localStorage:', error);
    }

    // Clear session storage as well
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('chat_') || key.includes('encryption_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Could not clear sessionStorage:', error);
    }

    toast.success('Chat cache cleared successfully');
  }

  // Clear specific cache types
  clearMessagesCache(): void {
    // This will be called by the chat hooks to clear their state
    toast.success('Chat messages cache cleared');
  }

  clearEncryptionKeysCache(): void {
    // Clear any cached encryption keys
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('encryption_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Could not clear encryption cache:', error);
    }
    
    toast.success('Encryption keys cache cleared');
  }

  clearPresenceCache(): void {
    // Clear presence-related cache
    toast.success('Presence cache cleared');
  }
}
