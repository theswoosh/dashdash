import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface UIState {
  editMode: boolean;
  activeBoardId: string | null;
  theme: Theme;
  toggleEditMode: () => void;
  setActiveBoard: (id: string) => void;
  toggleTheme: () => void;
  // TODO Phase 2: persist theme to user profile via PATCH /api/me
}

export const useUIStore = create<UIState>(set => ({
  editMode: false,
  activeBoardId: null,
  theme: 'dark',
  toggleEditMode: () => set(s => ({ editMode: !s.editMode })),
  setActiveBoard: id => set({ activeBoardId: id }),
  toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
}));
