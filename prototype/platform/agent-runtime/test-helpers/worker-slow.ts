// platform/agent-runtime/test-helpers/worker-slow.ts
//
// S8 §3.4 A4 — Test helper worker: waits 500ms before responding.
// Used to test timeout and in-flight-cap paths in BunWorkerBusRunner.
//
// Author: Atlas (Core banking platform architect, engineering)

import type { WorkerOutMessage } from "../worker-entry";

self.onmessage = async (_ev: MessageEvent) => {
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  self.postMessage({ ok: true, eventsEmitted: 0 } satisfies WorkerOutMessage);
};
