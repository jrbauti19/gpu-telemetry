# How Telemetrize Streams & Renders Data

A walkthrough of how real-time data flows through the app: how WebSockets
work, **where the transport layer lives**, how component state is managed,
and what the charting library is doing under the hood.

Author: Josh B.

---

## 1. WebSockets in 60 seconds

A normal HTTP request is one-shot: the client asks, the server answers, the
connection closes. That is a poor fit for live GPU telemetry, where the
server needs to *keep pushing* new frames every couple of seconds without
being asked each time.

A **WebSocket** solves this. It starts life as an ordinary HTTP request
carrying an `Upgrade: websocket` header. If the server agrees, the same TCP
socket is "upgraded" into a persistent, **full-duplex** channel — either side
can send messages at any time until someone closes it.

```
Client                          Server
  |  HTTP GET  Upgrade: websocket  |
  | -----------------------------> |
  |  101 Switching Protocols       |
  | <----------------------------- |   <-- handshake done, socket stays open
  |                                |
  |         frame (gpus[])         |
  | <============================= |   push
  |         frame (gpus[])         |
  | <============================= |   push (every ~2.5s)
  |            close               |
  | <===========================>  |
```

The browser exposes this through the native `WebSocket` object, which is an
**event emitter** with four events we care about:

| WebSocket event | Meaning                                  |
| --------------- | ---------------------------------------- |
| `open`          | handshake succeeded, connection is live  |
| `message`       | the server pushed a data frame           |
| `error`         | something went wrong                     |
| `close`         | the connection ended                     |

Everything downstream in this app is modeled around those two ideas:
a **connection lifecycle** (open/close) and a **stream of messages**.

---

## 2. Where the Transport Layer lives

> **The entire transport layer is the `src/telemetry/` folder.** It is the
> only part of the codebase that knows a connection exists — the UI never
> touches it directly.

It is built in three pieces so the rest of the app depends on an *interface*,
not on a concrete socket:

### 2a. The contract — `src/telemetry/types.ts`

`TelemetryStream` is the abstraction the whole app is written against. Notice
it is deliberately shaped like the WebSocket event model (`onMessage`,
`onStatusChange`, `connect`, `disconnect`):

```ts
// src/telemetry/types.ts
export interface TelemetryStream {
  connect(): void;
  disconnect(): void;
  onMessage(handler: MessageHandler): () => void;
  onStatusChange(handler: StatusHandler): () => void;
  getStatus(): ConnectionStatus;
}
```

Because the UI only knows about this interface, the actual socket
implementation can be swapped with zero UI changes.

### 2b. The implementation — `src/telemetry/MockTelemetryStream.ts`

Today the app ships a **mock** that fakes the whole WebSocket lifecycle
locally (so there's no server to run). **This is exactly where a real
connection would be established.** The `connect()` method is the analogue of
`new WebSocket(url)`:

```ts
// src/telemetry/MockTelemetryStream.ts  (connect)
connect(): void {
  if (this.status === "connected" || this.status === "connecting") return;
  this.setStatus("connecting");

  // Simulate network handshake latency before data starts flowing.
  this.connectTimer = setTimeout(() => {
    this.setStatus("connected");        // ~ ws.onopen
    this.emitFrame();                   // ~ first ws.onmessage
    this.tickTimer = setInterval(() => this.emitFrame(), TICK_MS); // pushes
  }, CONNECT_LATENCY_MS);
}
```

`emitFrame()` builds a `TelemetryFrame` and fans it out to subscribers via
`this.messageHandlers.forEach((h) => h(frame))` — the mock's stand-in for the
browser dispatching a `message` event.

**To go live**, you'd write a `LiveTelemetryStream` that implements the same
interface. The `connect()` body would be roughly:

```ts
connect() {
  this.setStatus("connecting");
  const ws = new WebSocket("wss://your-host/telemetry");
  ws.onopen    = () => this.setStatus("connected");
  ws.onmessage = (e) => this.messageHandlers.forEach(h => h(JSON.parse(e.data)));
  ws.onclose   = () => this.setStatus("disconnected");
}
```

### 2c. The swap point — `src/store/telemetryStore.ts`

There is a single factory that decides which stream implementation to build.
Changing this one line is the entire "go live" migration:

```ts
// src/store/telemetryStore.ts
const streamFactory = (): TelemetryStream => new MockTelemetryStream();
// swap for:  () => new LiveTelemetryStream("wss://your-host/telemetry")
```

---

## 3. How state is managed in the components

State lives in a single **[Zustand](https://github.com/pmndrs/zustand) store**,
and the design goal is surgical re-renders: a data tick should only re-render
the cards whose numbers actually changed, never the whole page.

```
TelemetryStream  ──frames──▶  Zustand store  ──selector hooks──▶  React components
 (transport)                  (src/store/…)                        (useTelemetryStore)
```

### 3a. The store — `src/store/telemetryStore.ts`

The store holds the full app state (`status`, `gpuIds`, `snapshots`,
`aggregate`, `lastTimestamp`) plus two lifecycle actions:

- `connect()` builds the transport stream, subscribes to its status/message
  events, and starts it. It is **idempotent** (safe under React 18 StrictMode's
  double-mount) because it guards on an existing stream.
- `disconnect()` unsubscribes and tears the stream down.

Each incoming frame is folded into state by a pure `reduceFrame(state, frame)`
helper that keeps a **rolling 60-second window** per GPU (`WINDOW_SECONDS`),
recomputes the cached **fleet aggregate**, and rebuilds the `snapshots` map.
The transport handles (`stream`, unsub fns) live in module scope — they're
plumbing, not rendered data.

> Why Zustand? It replaced a hand-rolled `useSyncExternalStore` class. Zustand
> is itself built on `useSyncExternalStore`, so we keep the exact same
> tear-free, per-slice re-render behavior but with far less boilerplate and no
> `store` instance threaded through props.

### 3b. Selector hooks — the React binding

Components never receive a `store` prop. They import a **selector hook** and
read exactly the slice they need; Zustand re-renders them only when that
slice's value changes:

| Hook                     | Subscribes to        | Re-renders when…                       |
| ------------------------ | -------------------- | -------------------------------------- |
| `useTelemetryConnection` | — (lifecycle only)   | never (drives connect/disconnect)      |
| `useStatus`              | connection status    | the lifecycle changes                  |
| `useGpuIds`              | gpu id list          | fleet membership changes               |
| `useGpuSnapshot(id)`     | one GPU's slice      | *that* GPU's metrics/history change    |
| `useFleetAggregate`      | cached rollup        | any per-tick aggregate change          |
| `useLastTimestamp`       | last frame time      | a new frame arrives                    |

Because `DashboardHeader` reads only `useStatus()`, it does **not** re-render on
data ticks — only when the connection lifecycle changes. Each `GpuNodeCard` is
`memo`-ized and calls `useGpuSnapshot(gpuId)`, so four cards updating in the
same tick don't force each other (or the parent) to re-render. The top-level
`Dashboard` calls `useTelemetryConnection()` once to open the stream.

---

## 4. The charting library — and is it SVG or Canvas?

The app uses **[Recharts](https://recharts.org)** (`recharts@^2.13.3`, see
`package.json`). The live sparklines in each GPU card are rendered by
`src/components/TelemetryChart.tsx` using `<AreaChart>` inside a
`<ResponsiveContainer>`.

### SVG or Canvas?

**Recharts is SVG-based.** It is built on top of D3 and renders each chart as
a tree of real SVG elements (`<svg>`, `<path>`, `<linearGradient>`, etc.) in
the DOM — not pixels painted onto a `<canvas>`.

What that means in practice:

- **Pros:** every line/area is a DOM node, so it's inspectable, styleable with
  CSS, crisp at any zoom/DPI, and trivially accessible/animatable. Our gradient
  fills and severity-colored strokes are just SVG attributes.
- **Cons:** SVG creates a DOM node per point/segment, so it gets expensive with
  *very* large datasets. That's fine here because we cap history to a 60-second
  rolling window, and each `TelemetryChart` is `memo`-ized so it only redraws
  when its GPU's `history` array reference changes.

> Rule of thumb: **SVG (Recharts)** is great for dashboards with modest point
> counts and rich styling — exactly this use case. If we ever needed tens of
> thousands of points per chart, a **Canvas/WebGL** library (e.g. uPlot,
> visx + canvas, or lightweight-charts) would scale better.

---

## File map

| Concern            | File                                          |
| ------------------ | --------------------------------------------- |
| Transport contract | `src/telemetry/types.ts`                      |
| Connection setup   | `src/telemetry/MockTelemetryStream.ts`        |
| Stream swap point  | `src/store/telemetryStore.ts` (`streamFactory`) |
| State container    | `src/store/telemetryStore.ts` (Zustand)       |
| React bindings     | `src/store/telemetryStore.ts` (selector hooks)|
| Charts (SVG)       | `src/components/TelemetryChart.tsx`           |
