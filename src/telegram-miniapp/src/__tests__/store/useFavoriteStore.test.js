import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFavoriteStore } from "../../store/useFavoriteStore";
import { favoriteService } from "../../services/favoriteService";

vi.mock("../../services/favoriteService", () => ({
  favoriteService: {
    getAll: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  },
}));

describe("useFavoriteStore", () => {
  beforeEach(() => {
    useFavoriteStore.setState({
      favoriteIds: new Set(),
      loaded: false,
    });
    vi.clearAllMocks();
  });

  it("should load favorites successfully", async () => {
    favoriteService.getAll.mockResolvedValueOnce({
      data: {
        data: [
          { restaurant: { id: "rest-1" } },
          { restaurant: { id: "rest-2" } },
        ],
      },
    });

    await useFavoriteStore.getState().loadFavorites();

    const state = useFavoriteStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.favoriteIds.has("rest-1")).toBe(true);
    expect(state.favoriteIds.has("rest-2")).toBe(true);
    expect(state.favoriteIds.size).toBe(2);
  });

  it("should handle load favorites error", async () => {
    favoriteService.getAll.mockRejectedValueOnce(new Error("Failed"));

    await useFavoriteStore.getState().loadFavorites();

    const state = useFavoriteStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.favoriteIds.size).toBe(0);
  });

  it("should toggle favorite from true to false", async () => {
    useFavoriteStore.setState({
      favoriteIds: new Set(["rest-1"]),
      loaded: true,
    });
    favoriteService.remove.mockResolvedValueOnce({});

    await useFavoriteStore.getState().toggle("rest-1");

    const state = useFavoriteStore.getState();
    expect(state.favoriteIds.has("rest-1")).toBe(false);
    expect(favoriteService.remove).toHaveBeenCalledWith("rest-1");
  });

  it("should revert toggle from true to false on error", async () => {
    useFavoriteStore.setState({
      favoriteIds: new Set(["rest-1"]),
      loaded: true,
    });
    favoriteService.remove.mockRejectedValueOnce(new Error("Failed"));

    await useFavoriteStore.getState().toggle("rest-1");

    const state = useFavoriteStore.getState();
    expect(state.favoriteIds.has("rest-1")).toBe(true);
  });

  it("should toggle favorite from false to true", async () => {
    useFavoriteStore.setState({
      favoriteIds: new Set(),
      loaded: true,
    });
    favoriteService.add.mockResolvedValueOnce({});

    await useFavoriteStore.getState().toggle("rest-1");

    const state = useFavoriteStore.getState();
    expect(state.favoriteIds.has("rest-1")).toBe(true);
    expect(favoriteService.add).toHaveBeenCalledWith("rest-1");
  });

  it("should revert toggle from false to true on error", async () => {
    useFavoriteStore.setState({
      favoriteIds: new Set(),
      loaded: true,
    });
    favoriteService.add.mockRejectedValueOnce(new Error("Failed"));

    await useFavoriteStore.getState().toggle("rest-1");

    const state = useFavoriteStore.getState();
    expect(state.favoriteIds.has("rest-1")).toBe(false);
  });
});
