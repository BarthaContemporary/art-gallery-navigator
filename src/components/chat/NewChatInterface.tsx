
import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Loader2, Circle } from 'lucide-react';
import { useChat } from '@/contexts/chat/ChatContext';
import { useAuth } from '@/hooks/use-auth';
import { ChatRoom, ChatMessage } from '@/services/chat/ChatService';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/50 bg-muted/30">
        {onBack && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 hover:bg-primary/10" 
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        )}
        
        <div className="relative">
          <div className="h-7 w-7 rounded bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-border/50">
            <span className="text-xs font-medium">
              {otherParticipant?.display_name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-green-500 text-green-500" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium truncate">
            {otherParticipant?.display_name || 'Unknown User'}
          </h3>
          <p className="text-[10px] text-muted-foreground font-mono">online</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {state.loading.messages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : state.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-10 w-10 rounded bg-muted/50 flex items-center justify-center mb-2">
                <Send className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Start the conversation
              </p>
            </div>
          ) : (
            <>
              {state.messages.map((message, index) => {
                const isOwn = message.sender_id === user?.id;
                const showTime = index === 0 || 
                  new Date(message.created_at).getTime() - new Date(state.messages[index - 1].created_at).getTime() > 300000;
                
                return (
                  <div key={message.id}>
                    {showTime && (
                      <div className="flex justify-center mb-2">
                        <span className="text-[10px] text-muted-foreground font-mono px-2 py-0.5 bg-muted/30 rounded">
                          {format(new Date(message.created_at), 'MMM d, HH:mm')}
                        </span>
                      </div>
                    )}
                    <MessageBubble message={message} isOwn={isOwn} />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-2 border-t border-border/50 bg-muted/30">
        <div className="flex gap-1.5">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type message..."
            disabled={state.loading.sending}
            className="flex-1 h-8 text-xs bg-background/50 border-border/50 focus:border-primary/50"
          />
          <Button 
            type="submit" 
            size="icon"
            className="h-8 w-8 bg-primary/90 hover:bg-primary"
            disabled={!messageInput.trim() || state.loading.sending}
          >
            {state.loading.sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] px-2.5 py-1.5 text-xs",
        isOwn 
          ? "bg-primary text-primary-foreground rounded-l rounded-tr" 
          : "bg-muted/50 border border-border/50 rounded-r rounded-tl"
      )}>
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
        <span className={cn(
          "text-[9px] font-mono mt-0.5 block",
          isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
        )}>
          {format(new Date(message.created_at), 'HH:mm')}
        </span>
      </div>
    </div>
  );
}
