
import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useChat } from '@/contexts/chat/ChatContext';
import { useAuth } from '@/hooks/use-auth';
import { ChatRoom, ChatMessage } from '@/services/chat/ChatService';
import { format } from 'date-fns';

interface NewChatInterfaceProps {
  room: ChatRoom;
  onBack?: () => void;
}

export function NewChatInterface({ room, onBack }: NewChatInterfaceProps) {
  const { state, sendMessage } = useChat();
  const { user } = useAuth();
  const [messageInput, setMessageInput] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherParticipant = room.participant_1_id === user?.id 
    ? room.participant_2_profile 
    : room.participant_1_profile;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || state.loading.sending) return;

    const content = messageInput.trim();
    setMessageInput('');
    await sendMessage(content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - Made more compact */}
      <div className="flex items-center gap-3 p-3 border-b bg-background">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        
        <Avatar className="h-8 w-8">
          <AvatarImage src={otherParticipant?.avatar_url} />
          <AvatarFallback>
            {otherParticipant?.display_name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <h3 className="font-medium text-sm">
            {otherParticipant?.display_name || 'Unknown User'}
          </h3>
        </div>
      </div>

      {/* Messages - Increased area */}
      <ScrollArea className="flex-1 p-3">
        {state.loading.messages ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {state.messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                isOwn={message.sender_id === user?.id} 
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input - Made more compact */}
      <form onSubmit={handleSendMessage} className="p-3 border-t bg-background">
        <div className="flex gap-2">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message..."
            disabled={state.loading.sending}
            className="flex-1 h-9"
          />
          <Button 
            type="submit" 
            size="icon"
            className="h-9 w-9"
            disabled={!messageInput.trim() || state.loading.sending}
          >
            {state.loading.sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.sender_profile?.avatar_url} />
          <AvatarFallback className="text-xs">
            {message.sender_profile?.display_name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-lg px-3 py-2 ${
          isOwn 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        }`}>
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
        
        <span className="text-xs text-muted-foreground mt-1">
          {format(new Date(message.created_at), 'HH:mm')}
        </span>
      </div>
    </div>
  );
}
