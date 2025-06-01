
import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChatCleanupButtonProps {
  onCleanup: () => Promise<void>;
  loading?: boolean;
}

export function ChatCleanupButton({ onCleanup, loading = false }: ChatCleanupButtonProps) {
  const handleCleanup = async () => {
    try {
      await onCleanup();
    } catch (error) {
      console.error('Cleanup failed:', error);
      toast.error('Failed to cleanup old messages');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCleanup}
      disabled={loading}
      className="flex items-center gap-2"
    >
      <Trash2 className="h-4 w-4" />
      {loading ? 'Cleaning...' : 'Cleanup Old Messages'}
    </Button>
  );
}
