/**
 * Global Dialog Manager Service
 * Handles all dialog operations from a centralized location for optimal performance
 */

import { Artwork } from "@/types/artwork";

export interface DialogState {
  type: 'overview' | 'edit' | 'delete' | null;
  artwork: Artwork | null;
  isOpen: boolean;
  isDeleting?: boolean;
}

class DialogManagerService {
  private state: DialogState = {
    type: null,
    artwork: null,
    isOpen: false,
  };

  private listeners = new Set<() => void>();
  private preloadedDialogs = new Set<string>();

  // Subscribe to state changes
  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Get current state
  getState(): DialogState {
    return this.state;
  }

  // Open overview dialog
  showArtworkOverview(artwork: Artwork) {
    this.state = {
      type: 'overview',
      artwork,
      isOpen: true,
    };
    this.notifyListeners();
    this.preloadDialog('edit', artwork);
  }

  // Open edit dialog
  showArtworkEdit(artwork: Artwork) {
    this.state = {
      type: 'edit',
      artwork,
      isOpen: true,
    };
    this.notifyListeners();
  }

  // Open delete dialog
  showArtworkDelete(artwork: Artwork) {
    this.state = {
      type: 'delete',
      artwork,
      isOpen: true,
      isDeleting: false,
    };
    this.notifyListeners();
  }

  // Set deleting state
  setDeleting(isDeleting: boolean) {
    if (this.state.type === 'delete') {
      this.state = {
        ...this.state,
        isDeleting,
      };
      this.notifyListeners();
    }
  }

  // Close dialog
  closeDialog() {
    this.state = {
      type: null,
      artwork: null,
      isOpen: false,
    };
    this.notifyListeners();
  }

  // Preload dialog content
  private preloadDialog(type: string, artwork: Artwork) {
    const key = `${type}-${artwork.id}`;
    if (!this.preloadedDialogs.has(key)) {
      this.preloadedDialogs.add(key);
      // Trigger preloading logic here if needed
    }
  }

  // Clear preload cache
  clearPreloadCache() {
    this.preloadedDialogs.clear();
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback());
  }
}

export const dialogManager = new DialogManagerService();