
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Search } from 'lucide-react';
import { UserPresence, useChat } from '@/hooks/use-chat';

interface OnlineUsersListProps {
  onStartChat: (userId: string) => void;
}

export function OnlineUsersList({ onStartChat }: OnlineUsersListProps) {
  const { onlineUsers } = useChat();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = onlineUsers.filter(user =>
    user.profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false
  );

  return (
    <div className="flex flex-col h-full bg-white border-r">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3">Online Users</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No users online</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.user_id}
                  user={user}
                  onStartChat={() => onStartChat(user.user_id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface UserCardProps {
  user: UserPresence;
  onStartChat: () => void;
}

function UserCard({ user, onStartChat }: UserCardProps) {
  return (
    <Button
      variant="ghost"
      className="w-full p-3 h-auto justify-start hover:bg-gray-50"
      onClick={onStartChat}
    >
      <div className="flex items-center space-x-3 w-full">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.profile?.avatar_url} />
            <AvatarFallback>
              {user.profile?.display_name?.slice(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 border-2 border-white rounded-full" />
        </div>
        
        <div className="flex-1 text-left">
          <p className="font-medium text-sm">
            {user.profile?.display_name || 'Unknown User'}
          </p>
          <div className="flex items-center space-x-1">
            <Badge variant="secondary" className="text-xs px-1 py-0">
              Online
            </Badge>
          </div>
        </div>
        
        <MessageCircle className="h-4 w-4 text-gray-400" />
      </div>
    </Button>
  );
}
