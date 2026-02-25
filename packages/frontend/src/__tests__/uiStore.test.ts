import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../store/uiStore';

beforeEach(() => {
  // Reset store to initial state before each test
  useUIStore.setState({
    editMode: false,
    activeBoardId: null,
    theme: 'liquid-glass',
    boardName: '',
  });
});

describe('uiStore — initial state', () => {
  it('starts with liquid-glass theme', () => {
    expect(useUIStore.getState().theme).toBe('liquid-glass');
  });

  it('starts with edit mode off', () => {
    expect(useUIStore.getState().editMode).toBe(false);
  });

  it('starts with empty board name', () => {
    expect(useUIStore.getState().boardName).toBe('');
  });
});

describe('setTheme', () => {
  it('updates the theme id', () => {
    useUIStore.getState().setTheme('atom');
    expect(useUIStore.getState().theme).toBe('atom');
  });

  it('accepts any string (registry validates at render time)', () => {
    useUIStore.getState().setTheme('future-theme');
    expect(useUIStore.getState().theme).toBe('future-theme');
  });
});

describe('setBoardName', () => {
  it('sets the board name', () => {
    useUIStore.getState().setBoardName('My Dashboard');
    expect(useUIStore.getState().boardName).toBe('My Dashboard');
  });

  it('can be cleared back to empty string', () => {
    useUIStore.getState().setBoardName('something');
    useUIStore.getState().setBoardName('');
    expect(useUIStore.getState().boardName).toBe('');
  });
});

describe('toggleEditMode', () => {
  it('enables edit mode', () => {
    useUIStore.getState().toggleEditMode();
    expect(useUIStore.getState().editMode).toBe(true);
  });

  it('toggles back off', () => {
    useUIStore.getState().toggleEditMode();
    useUIStore.getState().toggleEditMode();
    expect(useUIStore.getState().editMode).toBe(false);
  });
});
