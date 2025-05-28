
import React from 'react';
import { ChatRoom, useChat } from '@/hooks/chat/use-chat';
import { ChatHeader } from './ChatHeader';
import { ChatMessagesList } from './ChatMessagesList';
import { ChatMessageInput } from './ChatMessageInput';

interface ChatInterfaceProps {
  room: ChatRoom;
  onBack?: () => void;
}

export function ChatInterface({ room, onBack }: ChatInterfaceProps) {
  const { messages, sendMessage, sending } = useChat();

  return (
    <div className="flex flex-col h-full bg-white">
      <ChatHeader room={room} onBack={onBack} />
      <ChatMessagesList messages={messages} />
      <ChatMessageInput onSendMessage={sendMessage} sending={sending} />
    </div>
  );
}
