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
  boardName: string;
  droppingItem: DroppingItem | null;
  configTarget: string | null;
  toggleEditMode: () => void;
  setActiveBoard: (id: string) => void;
  setTheme: (id: string) => void;
  setBoardName: (name: string) => void;
  setDroppingItem: (item: DroppingItem | null) => void;
  setConfigTarget: (id: string | null) => void;
  // TODO Phase 2: persist theme to user profile via PATCH /api/me
}

export const useUIStore = create<UIState>(set => ({
  editMode: false,
  activeBoardId: null,
  theme: 'liquid-glass',
  boardName: (typeof localStorage !== 'undefined' ? (localStorage.getItem('dashdash-boardName') ?? '') : ''),
  droppingItem: null,
  configTarget: null,
  toggleEditMode: () => set(s => ({ editMode: !s.editMode })),
  setActiveBoard: id => set({ activeBoardId: id }),
  setTheme: id => set({ theme: id }),
  setBoardName: name => {
    try { localStorage.setItem('dashdash-boardName', name); } catch { /* ignore */ }
    set({ boardName: name });
  },
  setDroppingItem: item => set({ droppingItem: item }),
  setConfigTarget: id => set({ configTarget: id }),
}));
