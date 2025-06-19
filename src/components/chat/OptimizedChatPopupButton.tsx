
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, WifiOff, AlertTriangle } from 'lucide-react';
import { useChatMessages } from '@/hooks/chat/use-chat-messages';
import { useOptimizedPresence } from '@/hooks/chat/use-optimized-presence';
import { useAuth } from '@/hooks/use-auth';

interface OptimizedChatPopupButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export const OptimizedChatPopupButton = React.memo(function OptimizedChatPopupButton({ 
  onClick, 
  isOpen 
}: OptimizedChatPopupButtonProps) {
  const { user } = useAuth();
  const { getTotalUnreadCount } = useChatMessages(user?.id);
  const { isConnected, error, retryCount } = useOptimizedPresence(user?.id);
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [shouldPulse, setShouldPulse] = useState(false);

  // Memoized update function to prevent unnecessary re-renders
  const updateUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const count = await getTotalUnreadCount();
      setUnreadCount(prevCount => {
        // Trigger pulse animation when count increases
        if (count > prevCount && count > 0) {
          setShouldPulse(true);
          setTimeout(() => setShouldPulse(false), 2000);
        }
        return count;
      });
    } catch (error) {
      console.error('Error updating unread count:', error);
    }
  }, [user?.id, getTotalUnreadCount]);

  // Reduced polling frequency based on connection status
  useEffect(() => {
    updateUnreadCount();
    
    const interval = setInterval(
      updateUnreadCount, 
      isConnected ? 30000 : 60000 // 30s when connected, 60s when not
    );
    
    return () => clearInterval(interval);
  }, [updateUnreadCount, isConnected]);

  // Memoized connection icon to prevent unnecessary re-renders
  const connectionIcon = useMemo(() => {
    if (error && retryCount > 0) {
      return <AlertTriangle className="absolute -top-1 -left-1 h-3 w-3 text-red-500 bg-white rounded-full p-0.5" />;
    }
    if (!isConnected) {
      return <WifiOff className="absolute -top-1 -left-1 h-3 w-3 text-orange-500 bg-white rounded-full p-0.5" />;
    }
    return null;
  }, [error, retryCount, isConnected]);

  // Memoized button classes
  const buttonClasses = useMemo(() => 
    `h-12 w-12 rounded-full shadow-lg transition-all duration-300 relative ${
      isOpen ? 'scale-95 opacity-75' : 'hover:scale-105'
    } ${
      unreadCount > 0 && shouldPulse ? 'animate-pulse' : ''
    }`,
    [isOpen, unreadCount, shouldPulse]
  );

  // Memoized badge styles
  const badgeStyles = useMemo(() => ({
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
  }), []);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Button
        onClick={onClick}
        size="icon"
        className={buttonClasses}
      >
        <MessageCircle className={`h-5 w-5 transition-transform duration-200 ${
          unreadCount > 0 ? 'animate-bounce' : ''
        }`} />
        
        {connectionIcon}

        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className={`absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold shadow-lg border-2 border-white transition-all duration-300 ${
              shouldPulse ? 'animate-pulse scale-110' : ''
            }`}
            style={badgeStyles}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>
    </div>
  );
});
