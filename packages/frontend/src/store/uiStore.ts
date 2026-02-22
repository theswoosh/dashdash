import { create } from 'zustand';

interface UIState {
  editMode: boolean;
  activeBoardId: string | null;
  toggleEditMode: () => void;
  setActiveBoard: (id: string) => void;
}

export const useUIStore = create<UIState>(set => ({
  editMode: false,
  activeBoardId: null,
  toggleEditMode: () => set(s => ({ editMode: !s.editMode })),
  setActiveBoard: id => set({ activeBoardId: id }),
}));
