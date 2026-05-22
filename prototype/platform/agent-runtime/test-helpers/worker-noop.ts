// platform/agent-runtime/test-helpers/worker-noop.ts
//
// S8 §3.4 A4 — Test helper worker: posts { ok: true, eventsEmitted: 0 }
// immediately upon receiving any message. Used to test the
// BunWorkerBusRunner happy path without a real composition root.
//
// Author: Atlas (Core banking platform architect, engineering)

import type { WorkerOutMessage } from "../worker-entry";

self.onmessage = (_ev: MessageEvent) => {
  self.postMessage({ ok: true, eventsEmitted: 0 } satisfies WorkerOutMessage);
};
