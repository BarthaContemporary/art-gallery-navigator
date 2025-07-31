/**
 * Hook for using the global dialog manager
 */

import { useState, useEffect } from 'react';
import { dialogManager, DialogState } from '@/services/DialogManager';

export function useDialogManager() {
  const [state, setState] = useState<DialogState>(dialogManager.getState());

  useEffect(() => {
    const unsubscribe = dialogManager.subscribe(() => {
      setState(dialogManager.getState());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    showArtworkOverview: dialogManager.showArtworkOverview,
    showArtworkEdit: dialogManager.showArtworkEdit, 
    showArtworkDelete: dialogManager.showArtworkDelete,
    setDeleting: dialogManager.setDeleting,
    closeDialog: dialogManager.closeDialog,
  };
}