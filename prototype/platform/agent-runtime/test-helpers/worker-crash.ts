/// <reference lib="WebWorker" />
// platform/agent-runtime/test-helpers/worker-crash.ts
//
// S8 §3.4 A4 — Test helper worker: throws immediately to simulate a
// worker onerror path in BunWorkerBusRunner.
//
// Author: Atlas (Core banking platform architect, engineering)

self.onmessage = (_ev: MessageEvent) => {
  throw new Error("worker-crash: simulated worker crash");
};
