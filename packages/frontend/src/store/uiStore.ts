import { create } from 'zustand';

const STORAGE_KEY_BOARD_NAME = 'dashdash-boardName';

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
  boardName: (() => { try { return localStorage.getItem(STORAGE_KEY_BOARD_NAME) ?? ''; } catch { return ''; } })(),
  droppingItem: null,
  configTarget: null,
  toggleEditMode: () => set(s => ({ editMode: !s.editMode })),
  setActiveBoard: id => set({ activeBoardId: id }),
  setTheme: id => set({ theme: id }),
  setBoardName: name => {
    try { localStorage.setItem(STORAGE_KEY_BOARD_NAME, name); } catch { /* quota exceeded — non-critical */ }
    set({ boardName: name });
  },
  setDroppingItem: item => set({ droppingItem: item }),
  setConfigTarget: id => set({ configTarget: id }),
}));
