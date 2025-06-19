
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Circle, Loader2 } from 'lucide-react';
import { ChatRoom } from '@/hooks/chat/types';
import { useAuth } from '@/hooks/use-auth';
import { useEnhancedPresence } from '@/hooks/chat/use-enhanced-presence';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { format } from 'date-fns';

interface ChatHeaderProps {
  room: ChatRoom;
  onBack?: () => void;
}

export function ChatHeader({ room, onBack }: ChatHeaderProps) {
  const { user } = useAuth();
  const { 
    onlineUsers, 
    isConnected, 
    error, 
    loading, 
    retryCount,
    lastActivity 
  } = useEnhancedPresence(user?.id);
  
  // Determine which participant is the other user
  const otherParticipant = room.participant_1_id === user?.id 
    ? room.participant_2_profile 
    : room.participant_1_profile;

  const otherParticipantId = room.participant_1_id === user?.id 
    ? room.participant_2_id 
    : room.participant_1_id;

  const participantName = otherParticipant?.display_name || 'Unknown User';
  const participantInitials = participantName.split(' ').map(n => n[0]).join('').toUpperCase();

  // Find the presence status of the other participant
  const presenceStatus = onlineUsers.find(u => u.user_id === otherParticipantId);
  const isOnline = presenceStatus?.is_online || false;
  const lastSeen = presenceStatus?.last_seen;

  const getStatusText = () => {
    if (loading) {
      return retryCount > 0 ? `Retrying... (${retryCount})` : 'Checking status...';
    }
    
    if (error) {
      return retryCount > 0 ? `Reconnecting... (${retryCount})` : 'Status unknown';
    }
    
    if (isOnline) {
      return 'Online';
    } else if (lastSeen) {
      try {
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
        
        if (diffInMinutes < 1) {
          return 'Just now';
        } else if (diffInMinutes < 60) {
          return `${diffInMinutes}m ago`;
        } else if (diffInMinutes < 1440) {
          const hours = Math.floor(diffInMinutes / 60);
          return `${hours}h ago`;
        } else {
          return `Last seen ${format(lastSeenDate, 'MMM d')}`;
        }
      } catch (error) {
        console.error('Error parsing last seen date:', error);
        return 'Offline';
      }
    } else {
      return 'Offline';
    }
  };

  const getStatusColor = () => {
    if (loading) return retryCount > 0 ? 'text-orange-500' : 'text-blue-500';
    if (error) return 'text-red-500';
    return isOnline ? 'text-green-500' : 'text-gray-400';
  };

  const getCircleColor = () => {
    if (loading) return retryCount > 0 ? 'fill-orange-500 text-orange-500' : 'fill-blue-500 text-blue-500';
    if (error) return 'fill-red-500 text-red-500';
    return isOnline ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400';
  };

  return (
    <div className="flex items-center gap-3 p-3 border-b bg-white">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      
      <Avatar className="h-8 w-8">
        <AvatarImage src={otherParticipant?.avatar_url} />
        <AvatarFallback className="text-xs">{participantInitials}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <h3 className="font-semibold text-sm">{participantName}</h3>
        <div className="flex items-center gap-1 text-xs">
          {loading ? (
            <Loader2 className={`h-2 w-2 animate-spin ${retryCount > 0 ? 'text-orange-500' : 'text-blue-500'}`} />
          ) : (
            <Circle className={`h-2 w-2 ${getCircleColor()}`} />
          )}
          <span className={getStatusColor()}>{getStatusText()}</span>
        </div>
      </div>

      {/* Enhanced connection status indicator with retry info */}
      <ConnectionStatusIndicator 
        isConnected={isConnected}
        loading={loading}
        error={error}
        retryCount={retryCount}
        size="sm"
      />
    </div>
  );
}
