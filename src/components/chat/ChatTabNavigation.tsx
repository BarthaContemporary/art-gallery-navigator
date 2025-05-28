
import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, MessageCircle } from 'lucide-react';

type ViewType = 'rooms' | 'online';

interface ChatTabNavigationProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function ChatTabNavigation({ currentView, onViewChange }: ChatTabNavigationProps) {
  return (
    <div className="bg-white border-b">
      <div className="flex">
        <Button
          variant={currentView === 'rooms' ? 'default' : 'ghost'}
          className="flex-1 rounded-none"
          onClick={() => onViewChange('rooms')}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Chats
        </Button>
        <Button
          variant={currentView === 'online' ? 'default' : 'ghost'}
          className="flex-1 rounded-none"
          onClick={() => onViewChange('online')}
        >
          <Users className="h-4 w-4 mr-2" />
          Online
        </Button>
      </div>
    </div>
  );
}
