
import React from 'react';
import { NewChatWrapper } from './NewChatWrapper';

interface SafeChatWrapperProps {
  children: React.ReactNode;
}

export function SafeChatWrapper({ children }: SafeChatWrapperProps) {
  return (
    <NewChatWrapper>
      {children}
    </NewChatWrapper>
  );
}
