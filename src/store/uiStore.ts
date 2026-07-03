import { create } from "zustand";

/**
 * Lightweight UI-only store, kept separate from the telemetry data store.
 * Holds the id of the GPU whose detail drawer is open (or null). Any card
 * can set it and the drawer reads it, avoiding prop-drilling through the
 * virtualized grid.
 */
interface UiState {
  selectedGpuId: string | null;
  selectGpu: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedGpuId: null,
  selectGpu: (id) => set({ selectedGpuId: id }),
}));

export const useSelectedGpuId = (): string | null =>
  useUiStore((s) => s.selectedGpuId);

export const useSelectGpu = (): ((id: string | null) => void) =>
  useUiStore((s) => s.selectGpu);
