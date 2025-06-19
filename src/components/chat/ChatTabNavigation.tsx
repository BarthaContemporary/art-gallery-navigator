
import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, MessageCircle } from 'lucide-react';

type ViewType = 'rooms' | 'online';

interface ChatTabNavigationProps {
  currentView?: ViewType;
  activeTab?: ViewType;
  onViewChange?: (view: ViewType) => void;
  onTabChange?: (view: ViewType) => void;
  roomsCount?: number;
  onlineCount?: number;
}

export function ChatTabNavigation({ 
  currentView, 
  activeTab, 
  onViewChange, 
  onTabChange,
  roomsCount,
  onlineCount 
}: ChatTabNavigationProps) {
  const view = currentView || activeTab || 'rooms';
  const handleChange = onViewChange || onTabChange || (() => {});

  return (
    <div className="bg-white border-b">
      <div className="flex">
        <Button
          variant={view === 'rooms' ? 'default' : 'ghost'}
          className="flex-1 rounded-none"
          onClick={() => handleChange('rooms')}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Chats
        </Button>
        <Button
          variant={view === 'online' ? 'default' : 'ghost'}
          className="flex-1 rounded-none"
          onClick={() => handleChange('online')}
        >
          <Users className="h-4 w-4 mr-2" />
          Online
        </Button>
      </div>
    </div>
  );
}
