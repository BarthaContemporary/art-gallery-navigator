
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users } from 'lucide-react';

interface ChatTabNavigationProps {
  currentView: 'rooms' | 'online';
  onViewChange: (view: 'rooms' | 'online') => void;
  roomsCount: number;
  onlineCount: number;
}

export function ChatTabNavigation({ 
  currentView, 
  onViewChange, 
  roomsCount, 
  onlineCount 
}: ChatTabNavigationProps) {
  return (
    <div className="flex border-b">
      <Button
        variant={currentView === 'rooms' ? 'default' : 'ghost'}
        className="flex-1 rounded-none h-12"
        onClick={() => onViewChange('rooms')}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Conversations
        {roomsCount > 0 && (
          <Badge variant="secondary" className="ml-2">
            {roomsCount}
          </Badge>
        )}
      </Button>
      
      <Button
        variant={currentView === 'online' ? 'default' : 'ghost'}
        className="flex-1 rounded-none h-12"
        onClick={() => onViewChange('online')}
      >
        <Users className="h-4 w-4 mr-2" />
        Online
        {onlineCount > 0 && (
          <Badge variant="secondary" className="ml-2">
            {onlineCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}
