import { create } from 'zustand';

interface DroppingItem {
  i: string;
  w: number;
  h: number;
}

interface UIState {
  editMode: boolean;
  activeBoardId: string | null;
  theme: string;
  settingsPanelOpen: boolean;
  droppingItem: DroppingItem | null;
  configTarget: string | null;
  toggleEditMode: () => void;
  setActiveBoard: (id: string) => void;
  setTheme: (id: string) => void;
  toggleSettingsPanel: () => void;
  setDroppingItem: (item: DroppingItem | null) => void;
  setConfigTarget: (id: string | null) => void;
  // TODO Phase 2: persist theme to user profile via PATCH /api/me
}

export const useUIStore = create<UIState>(set => ({
  editMode: false,
  activeBoardId: null,
  theme: 'liquid-glass',
  settingsPanelOpen: false,
  droppingItem: null,
  configTarget: null,
  toggleEditMode: () => set(s => ({ editMode: !s.editMode })),
  setActiveBoard: id => set({ activeBoardId: id }),
  setTheme: id => set({ theme: id }),
  toggleSettingsPanel: () => set(s => ({ settingsPanelOpen: !s.settingsPanelOpen })),
  setDroppingItem: item => set({ droppingItem: item }),
  setConfigTarget: id => set({ configTarget: id }),
}));
