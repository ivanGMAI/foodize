import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../../store/useThemeStore';

describe('useThemeStore', () => {
  beforeEach(() => {
    // Clear localStorage or reset store manually as persist middleware might interfere
    useThemeStore.setState({ theme: 'light' });
    document.documentElement.removeAttribute('data-theme');
  });

  it('initial state is light', () => {
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('toggleTheme switches between light and dark', () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('initTheme sets attribute based on state', () => {
    useThemeStore.setState({ theme: 'dark' });
    useThemeStore.getState().initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
