import { create } from 'zustand';

interface DroppingItem {
  i: string;
  w: number;
  h: number;
}

interface UIState {
  editMode: boolean;
  activeBoardId: string | null;
  droppingItem: DroppingItem | null;
  configTarget: string | null;
  toggleEditMode: () => void;
  setActiveBoard: (id: string) => void;
  setDroppingItem: (item: DroppingItem | null) => void;
  setConfigTarget: (id: string | null) => void;
  isAdminPanelOpen: boolean;
  setAdminPanelOpen: (open: boolean) => void;
  isProfileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  isInfoOpen: boolean;
  setInfoOpen: (open: boolean) => void;
  /** Copied widget bg color (rgba string) — session-only, never persisted. */
  colorClipboard: string | null;
  setColorClipboard: (color: string | null) => void;
}

export const useUIStore = create<UIState>(set => ({
  editMode: false,
  activeBoardId: null,
  droppingItem: null,
  configTarget: null,
  toggleEditMode: () => set(s => ({ editMode: !s.editMode })),
  setActiveBoard: id => set({ activeBoardId: id }),
  setDroppingItem: item => set({ droppingItem: item }),
  setConfigTarget: id => set({ configTarget: id }),
  isAdminPanelOpen: false,
  setAdminPanelOpen: open => set({ isAdminPanelOpen: open }),
  isProfileOpen: false,
  setProfileOpen: open => set({ isProfileOpen: open }),
  isInfoOpen: false,
  setInfoOpen: open => set({ isInfoOpen: open }),
  colorClipboard: null,
  setColorClipboard: color => set({ colorClipboard: color }),
}));
