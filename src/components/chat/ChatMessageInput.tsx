
import React, { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip } from 'lucide-react';

interface ChatMessageInputProps {
  onSendMessage: (message: string, type?: 'text' | 'image') => Promise<void>;
  sending: boolean;
}

export function ChatMessageInput({ onSendMessage, sending }: ChatMessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (message.trim() && !sending) {
      const messageToSend = message.trim();
      setMessage('');
      await onSendMessage(messageToSend);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t bg-white">
      <div className="flex items-end gap-2">
        <Button variant="ghost" size="sm" className="flex-shrink-0">
          <Paperclip className="h-4 w-4" />
        </Button>
        
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />
        </div>
        
        <Button 
          onClick={handleSend} 
          disabled={!message.trim() || sending}
          size="sm"
          className="flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
