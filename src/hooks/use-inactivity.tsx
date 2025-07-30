
import { useState } from 'react';
import { useEnhancedInactivity } from './use-enhanced-inactivity';
import { SessionWarningDialog } from '@/components/session-warning-dialog';
import { useAuth } from './use-auth';

export function useInactivity() {
  const { signOut } = useAuth();
  const [showDialog, setShowDialog] = useState(false);

  const {
    showWarning,
    extendSession,
    warningDuration,
    trackActivity
  } = useEnhancedInactivity({
    onWarning: () => setShowDialog(true),
    onExtendSession: () => setShowDialog(false)
  });

  const handleExtendSession = () => {
    extendSession();
    setShowDialog(false);
    trackActivity(); // Track activity to reset all timers
  };

  const handleLogout = () => {
    setShowDialog(false);
    signOut();
  };

  const SessionWarning = () => (
    <SessionWarningDialog
      isOpen={showDialog}
      onExtendSession={handleExtendSession}
      onLogout={handleLogout}
      warningDurationMs={warningDuration}
    />
  );

  return {
    SessionWarning,
    showWarning: showDialog
  };
}
