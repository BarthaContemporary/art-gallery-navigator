import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface SessionWarningDialogProps {
  isOpen: boolean;
  onExtendSession: () => void;
  onLogout: () => void;
  warningDurationMs: number;
}

export function SessionWarningDialog({
  isOpen,
  onExtendSession,
  onLogout,
  warningDurationMs
}: SessionWarningDialogProps) {
  const [timeLeft, setTimeLeft] = useState(warningDurationMs);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(warningDurationMs);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          onLogout();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, warningDurationMs, onLogout]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const progress = ((warningDurationMs - timeLeft) / warningDurationMs) * 100;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Session Expiring Soon</AlertDialogTitle>
          <AlertDialogDescription>
            Your session will expire in{' '}
            <span className="font-semibold text-destructive">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
            {' '}due to inactivity. Would you like to extend your session?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="my-4">
          <Progress value={progress} className="h-2" />
        </div>

        <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0">
          <AlertDialogCancel 
            onClick={onLogout}
            className="w-full sm:w-auto"
          >
            Logout Now
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onExtendSession}
            className="w-full sm:w-auto"
          >
            Extend Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}