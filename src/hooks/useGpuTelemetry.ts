import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { MockTelemetryStream } from "@/telemetry/MockTelemetryStream";
import { TelemetryStore } from "@/telemetry/TelemetryStore";
import type { GpuSnapshot } from "@/telemetry/TelemetryStore";
import type { ConnectionStatus, TelemetryStream } from "@/telemetry/types";

/**
 * Factory for the telemetry source. Swap the returned stream for a
 * WebSocket-backed implementation to go live — nothing else changes.
 */
const defaultStreamFactory = (): TelemetryStream => new MockTelemetryStream();

/**
 * Root hook. Owns the store lifecycle and exposes the connection
 * status plus the list of GPU ids. Data for individual cards is read
 * via the granular selector hooks below so a tick only re-renders the
 * cards, never this provider-level chrome.
 */
export function useGpuTelemetry(
  streamFactory: () => TelemetryStream = defaultStreamFactory
) {
  // The store is created once and kept stable for the component's life.
  const storeRef = useRef<TelemetryStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new TelemetryStore(streamFactory());
  }
  const store = storeRef.current;

  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);

  const status = useSyncExternalStore(store.subscribe, store.getStatus);

  // getGpuIds returns the same array ref until membership changes, so
  // this subscription stays quiet across ordinary data ticks.
  const gpuIds = useSyncExternalStore(store.subscribe, store.getGpuIds);

  return { store, status, gpuIds } as const;
}

/**
 * Granular selector: subscribes a single card to one GPU's slice.
 * Because the store hands out fresh snapshot refs only for GPUs whose
 * data changed, React can bail out of unrelated updates.
 */
export function useGpuSnapshot(
  store: TelemetryStore,
  gpuId: string
): GpuSnapshot | undefined {
  const getSnapshot = useMemo(
    () => () => store.getGpuSnapshot(gpuId),
    [store, gpuId]
  );
  return useSyncExternalStore(store.subscribe, getSnapshot);
}

/** Convenience selector for components that only need the timestamp. */
export function useLastTimestamp(store: TelemetryStore): number {
  return useSyncExternalStore(store.subscribe, store.getLastTimestamp);
}

/** Selector for the cached fleet-wide rollup (updates each tick). */
export function useFleetAggregate(store: TelemetryStore) {
  return useSyncExternalStore(store.subscribe, store.getAggregate);
}

export type { ConnectionStatus };
