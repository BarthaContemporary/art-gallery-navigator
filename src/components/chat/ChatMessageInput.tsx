
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface ChatMessageInputProps {
  onSendMessage: (message: string) => Promise<void>;
  sending: boolean;
}

export function ChatMessageInput({ onSendMessage, sending }: ChatMessageInputProps) {
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageToSend = newMessage.trim();
    setNewMessage('');
    await onSendMessage(messageToSend);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="p-4 border-t bg-white">
      <form onSubmit={handleSendMessage} className="flex space-x-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={sending}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!newMessage.trim() || sending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
