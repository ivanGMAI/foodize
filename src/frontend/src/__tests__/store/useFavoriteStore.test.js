import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFavoriteStore } from '../../store/useFavoriteStore';
import { favoriteService } from '../../services/favoriteService';

vi.mock('../../services/favoriteService', () => ({
  favoriteService: {
    getAll: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('useFavoriteStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFavoriteStore.setState({ favoriteIds: new Set(), loaded: false });
  });

  it('loads favorite restaurant ids', async () => {
    favoriteService.getAll.mockResolvedValueOnce({
      data: {
        data: [{ restaurant: { id: 'r1' } }, { restaurant: { id: 'r2' } }],
      },
    });

    await useFavoriteStore.getState().loadFavorites();

    expect(favoriteService.getAll).toHaveBeenCalledWith({ size: 100 });
    expect(useFavoriteStore.getState().favoriteIds).toEqual(
      new Set(['r1', 'r2'])
    );
    expect(useFavoriteStore.getState().loaded).toBe(true);
  });

  it('marks loaded even when loading favorites fails', async () => {
    favoriteService.getAll.mockRejectedValueOnce(new Error('offline'));

    await useFavoriteStore.getState().loadFavorites();

    expect(useFavoriteStore.getState().loaded).toBe(true);
    expect(useFavoriteStore.getState().favoriteIds).toEqual(new Set());
  });

  it('adds and removes favorites optimistically', async () => {
    favoriteService.add.mockResolvedValueOnce({});
    favoriteService.remove.mockResolvedValueOnce({});

    await useFavoriteStore.getState().toggle('r1');
    expect(useFavoriteStore.getState().favoriteIds.has('r1')).toBe(true);
    expect(favoriteService.add).toHaveBeenCalledWith('r1');

    await useFavoriteStore.getState().toggle('r1');
    expect(useFavoriteStore.getState().favoriteIds.has('r1')).toBe(false);
    expect(favoriteService.remove).toHaveBeenCalledWith('r1');
  });

  it('rolls back optimistic favorite changes on API failure', async () => {
    favoriteService.add.mockRejectedValueOnce(new Error('fail'));

    await useFavoriteStore.getState().toggle('r1');

    expect(useFavoriteStore.getState().favoriteIds.has('r1')).toBe(false);
  });
});
