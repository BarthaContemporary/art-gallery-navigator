
import React, { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { ChatImageUpload } from './ChatImageUpload';
import { EmojiPicker } from './EmojiPicker';

interface ChatMessageInputProps {
  onSendMessage: (message: string, type?: 'text' | 'image') => Promise<void>;
  sending: boolean;
}

export function ChatMessageInput({ onSendMessage, sending }: ChatMessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    
    const messageToSend = message.trim();
    setMessage('');
    
    try {
      await onSendMessage(messageToSend, 'text');
    } catch (error) {
      console.error('Error sending message:', error);
      setMessage(messageToSend); // Restore message on error
    }
  };

  const handleImageSend = async (imageUrl: string) => {
    try {
      await onSendMessage(imageUrl, 'image');
    } catch (error) {
      console.error('Error sending image:', error);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = message.slice(0, start) + emoji + message.slice(end);
    
    setMessage(newMessage);
    
    // Set cursor position after the emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    }, 0);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t p-4 bg-white">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="min-h-[40px] max-h-32 resize-none"
            disabled={sending}
          />
        </div>
        
        <div className="flex gap-1">
          <EmojiPicker 
            onEmojiSelect={handleEmojiSelect}
            disabled={sending}
          />
          
          <ChatImageUpload 
            onImageSelect={handleImageSend}
            disabled={sending}
          />
          
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            size="icon"
            className="h-10 w-10"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
