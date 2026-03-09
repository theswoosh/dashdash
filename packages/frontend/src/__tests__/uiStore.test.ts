import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../store/uiStore';

beforeEach(() => {
  // Reset store to initial state before each test
  useUIStore.setState({
    editMode: false,
    activeBoardId: null,
  });
});

describe('uiStore — initial state', () => {
  it('starts with edit mode off', () => {
    expect(useUIStore.getState().editMode).toBe(false);
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
