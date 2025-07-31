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
    showArtworkOverview: dialogManager.showArtworkOverview.bind(dialogManager),
    showArtworkEdit: dialogManager.showArtworkEdit.bind(dialogManager),
    showArtworkDelete: dialogManager.showArtworkDelete.bind(dialogManager),
    setDeleting: dialogManager.setDeleting.bind(dialogManager),
    closeDialog: dialogManager.closeDialog.bind(dialogManager),
  };
}