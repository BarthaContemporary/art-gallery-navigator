
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { UserPresence } from '@/hooks/chat/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface ChatEmptyStateProps {
  onlineUsers?: UserPresence[];
  onStartChat?: (targetUser: any) => Promise<void>;
}

export function ChatEmptyState({ onlineUsers = [], onStartChat }: ChatEmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center max-w-md">
        <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Select a conversation
        </h3>
        <p className="text-gray-500 mb-6">
          Choose an existing conversation or start a new one with someone online
        </p>
        
        {onlineUsers.length > 0 && onStartChat && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Start a conversation with:
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {onlineUsers.slice(0, 5).map((user) => (
                <Button
                  key={user.user_id}
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => onStartChat(user)}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.profile?.avatar_url} />
                    <AvatarFallback>
                      {user.profile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.profile?.display_name || 'Unknown User'}</span>
                  <div className="ml-auto w-2 h-2 bg-green-500 rounded-full"></div>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
