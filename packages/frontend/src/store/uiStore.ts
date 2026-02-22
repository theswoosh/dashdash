import { create } from 'zustand';

interface UIState {
  editMode: boolean;
  activeBoardId: string | null;
  theme: string;
  settingsPanelOpen: boolean;
  toggleEditMode: () => void;
  setActiveBoard: (id: string) => void;
  setTheme: (id: string) => void;
  toggleSettingsPanel: () => void;
  // TODO Phase 2: persist theme to user profile via PATCH /api/me
}

export const useUIStore = create<UIState>(set => ({
  editMode: false,
  activeBoardId: null,
  theme: 'liquid-glass',
  settingsPanelOpen: false,
  toggleEditMode: () => set(s => ({ editMode: !s.editMode })),
  setActiveBoard: id => set({ activeBoardId: id }),
  setTheme: id => set({ theme: id }),
  toggleSettingsPanel: () => set(s => ({ settingsPanelOpen: !s.settingsPanelOpen })),
}));
