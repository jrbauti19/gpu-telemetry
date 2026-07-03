# TensorWave · GPU Telemetry Dashboard

A high-performance, real-time GPU telemetry dashboard built as a single-page
React app. No backend required — a **client-side telemetry simulation layer**
mimics a live WebSocket feed, so the whole thing deploys to Vercel in one click.

## Tech Stack

- **React + TypeScript + Vite**
- **Tailwind CSS** (dark-mode-first) + **shadcn/ui**-style primitives (Radix)
- **Recharts** for real-time line/area charts
- **lucide-react** icons

## Architecture

The UI is fully decoupled from the data source via the `TelemetryStream`
contract (`src/telemetry/types.ts`):

```
MockTelemetryStream  ──▶  TelemetryStore  ──▶  useGpuTelemetry (useSyncExternalStore)  ──▶  UI
   (simulation)            (rolling 60s window)      (granular slice selectors)          (cards/charts)
```

- **`MockTelemetryStream`** reproduces a real WebSocket lifecycle
  (`connect` / `disconnect` / `onMessage` every 1000ms). Metrics evolve via a
  **bounded random walk + sine "workload wave"**, with temperature and power
  correlated to utilization for realistic thermals.
- **`TelemetryStore`** keeps a rolling **60-second** window per GPU and hands
  out referentially-stable, per-GPU snapshots.
- **`useGpuTelemetry`** binds the store to React with `useSyncExternalStore`.
  Each card subscribes to only its own slice, so a tick re-renders just the
  leaves whose data changed — the header and layout stay put.

### Going live

Swap the simulation for a real feed without touching any UI code — implement
the `TelemetryStream` interface against a `WebSocket` and pass it to
`useGpuTelemetry(() => new WebSocketTelemetryStream(url))`.

## Getting Started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run preview  # preview the production build
```

## Deploy to Vercel

Import the repo in Vercel (framework preset: **Vite**) or run `vercel`.
`vercel.json` is preconfigured for SPA routing.
