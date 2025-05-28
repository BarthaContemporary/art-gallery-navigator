
import React from 'react';
import { MessageCircle } from 'lucide-react';

export function ChatEmptyState() {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center">
        <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Select a conversation
        </h3>
        <p className="text-gray-500 max-w-sm">
          Choose an existing conversation or start a new one with someone online
        </p>
      </div>
    </div>
  );
}
