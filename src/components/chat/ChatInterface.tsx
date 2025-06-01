
import React from 'react';
import { ChatRoom, ChatMessage } from '@/hooks/chat/types';
import { ChatHeader } from './ChatHeader';
import { ChatMessagesList } from './ChatMessagesList';
import { ChatMessageInput } from './ChatMessageInput';

interface ChatInterfaceProps {
  room: ChatRoom;
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  sending: boolean;
  onBack?: () => void;
}

export function ChatInterface({ room, messages, onSendMessage, sending, onBack }: ChatInterfaceProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      <ChatHeader room={room} onBack={onBack} />
      <ChatMessagesList messages={messages} />
      <ChatMessageInput onSendMessage={onSendMessage} sending={sending} />
    </div>
  );
}
