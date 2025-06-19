
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Circle, MessageCircle, Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/chat/chat-context/ChatContext';
import { format } from 'date-fns';

interface OnlineUsersListProps {
  onStartChat: (userId: string) => Promise<void>;
}

export function OnlineUsersList({ onStartChat }: OnlineUsersListProps) {
  const { user } = useAuth();
  const { onlineUsersList, state, retryConnection } = useChat();
  
  const isConnected = state.connection.status === 'connected';
  const isLoading = state.connection.status === 'connecting';
  const hasError = state.connection.status === 'error';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 animate-pulse">
          {state.connection.retryCount > 0 ? (
            <RefreshCw className="h-6 w-6 text-orange-500 animate-spin" />
          ) : (
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <h3 className="font-medium mb-2">
          {state.connection.retryCount > 0 ? `Retrying... (${state.connection.retryCount})` : 'Loading online users...'}
        </h3>
        {state.connection.retryCount > 0 && (
          <p className="text-sm text-orange-600">Connection issues detected, retrying...</p>
        )}
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <h3 className="font-medium mb-2 text-red-700">Error loading users</h3>
        <p className="text-sm text-red-600">{state.connection.error}</p>
        {state.connection.retryCount > 0 && (
          <p className="text-xs text-orange-600 mt-1">Retry attempt {state.connection.retryCount}</p>
        )}
        <Button variant="outline" size="sm" onClick={retryConnection} className="mt-2">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry Now
        </Button>
      </div>
    );
  }

  if (onlineUsersList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-2">No users online</h3>
        <p className="text-sm text-muted-foreground">
          Check back later to see who's available to chat
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Enhanced connection status bar */}
      <div className={`flex items-center gap-2 px-4 py-2 text-xs border-b ${
        isConnected 
          ? 'bg-green-50 text-green-700 border-green-200' 
          : hasError
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-orange-50 text-orange-700 border-orange-200'
      }`}>
        {isConnected ? (
          <>
            <Wifi className="h-3 w-3" />
            <span>Real-time updates active</span>
          </>
        ) : hasError ? (
          <>
            <AlertCircle className="h-3 w-3" />
            <span>Connection error{state.connection.retryCount > 0 ? ` (retry ${state.connection.retryCount})` : ''}</span>
          </>
        ) : (
          <>
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Reconnecting{state.connection.retryCount > 0 ? ` (attempt ${state.connection.retryCount})` : ''}...</span>
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground mb-3">
            Online Users ({onlineUsersList.length})
          </h3>
          
          {onlineUsersList.map((userPresence) => {
            const userName = userPresence.profile?.display_name || 'Unknown User';
            const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase();
            const lastSeen = new Date(userPresence.last_seen);
            const isOnline = userPresence.is_online;
            
            return (
              <div key={userPresence.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={userPresence.profile?.avatar_url} />
                    <AvatarFallback className="text-sm">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1">
                    <Circle 
                      className={`h-3 w-3 ${
                        isOnline 
                          ? 'fill-green-500 text-green-500' 
                          : 'fill-gray-400 text-gray-400'
                      }`} 
                    />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground">
                    {isOnline ? 'Online now' : `Last seen ${format(lastSeen, 'MMM d, HH:mm')}`}
                  </p>
                </div>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onStartChat(userPresence.user_id)}
                  className="flex-shrink-0"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
