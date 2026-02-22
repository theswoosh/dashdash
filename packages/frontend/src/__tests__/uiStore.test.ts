import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../store/uiStore';

beforeEach(() => {
  // Reset store to initial state before each test
  useUIStore.setState({
    editMode: false,
    activeBoardId: null,
    theme: 'liquid-glass',
    settingsPanelOpen: false,
  });
});

describe('uiStore — initial state', () => {
  it('starts with liquid-glass theme', () => {
    expect(useUIStore.getState().theme).toBe('liquid-glass');
  });

  it('starts with edit mode off', () => {
    expect(useUIStore.getState().editMode).toBe(false);
  });

  it('starts with settings panel closed', () => {
    expect(useUIStore.getState().settingsPanelOpen).toBe(false);
  });
});

describe('setTheme', () => {
  it('updates the theme id', () => {
    useUIStore.getState().setTheme('ascii');
    expect(useUIStore.getState().theme).toBe('ascii');
  });

  it('accepts any string (registry validates at render time)', () => {
    useUIStore.getState().setTheme('future-theme');
    expect(useUIStore.getState().theme).toBe('future-theme');
  });
});

describe('toggleSettingsPanel', () => {
  it('opens when closed', () => {
    useUIStore.getState().toggleSettingsPanel();
    expect(useUIStore.getState().settingsPanelOpen).toBe(true);
  });

  it('closes when open', () => {
    useUIStore.getState().toggleSettingsPanel();
    useUIStore.getState().toggleSettingsPanel();
    expect(useUIStore.getState().settingsPanelOpen).toBe(false);
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
