// dashboard/fx-sim-view.ts
//
// API routes for the FX market-making simulation engine control panel.
// Registers three endpoints:
//   POST /api/fx-sim/start   — start the simulation with optional config
//   POST /api/fx-sim/stop    — stop the simulation
//   GET  /api/fx-sim/status  — get current simulation status
//
// Authority: D-FX-SALES-TRADING-FRONTEND; D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import type { FxSimEngine } from "../platform/simulation/fx-sim-engine";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * Register FX simulation API routes.
 *
 * Call this from `server.ts` before the catch-all static-file handler.
 * Returns a Response if the URL is handled, null otherwise.
 */
export async function registerFxSimRoutes(
  pathname: string,
  method: string,
  _searchParams: URLSearchParams,
  req: Request,
  simEngine: FxSimEngine,
): Promise<Response | null> {
  // GET /api/fx-sim/status
  if (pathname === "/api/fx-sim/status" && method === "GET") {
    return jsonResponse(simEngine.getStatus());
  }

  // POST /api/fx-sim/start
  if (pathname === "/api/fx-sim/start" && method === "POST") {
    let body: {
      minIntervalMs?: number;
      maxIntervalMs?: number;
      bookId?: string;
      settlementMode?: string;
    } = {};
    try {
      const raw = await req.json();
      if (typeof raw === "object" && raw !== null) {
        body = raw as typeof body;
      }
    } catch {
      // empty body or non-JSON is fine — all fields are optional
    }

    const config: {
      minIntervalMs?: number;
      maxIntervalMs?: number;
      bookId?: string;
      settlementMode?: "realtime" | "accelerated";
    } = {};
    if (typeof body.minIntervalMs === "number" && body.minIntervalMs > 0) {
      config.minIntervalMs = body.minIntervalMs;
    }
    if (typeof body.maxIntervalMs === "number" && body.maxIntervalMs > 0) {
      config.maxIntervalMs = body.maxIntervalMs;
    }
    if (typeof body.bookId === "string" && body.bookId.trim().length > 0) {
      config.bookId = body.bookId.trim();
    }
    if (body.settlementMode === "realtime" || body.settlementMode === "accelerated") {
      config.settlementMode = body.settlementMode;
    }

    const status = simEngine.start(config);
    return jsonResponse(status);
  }

  // POST /api/fx-sim/stop
  if (pathname === "/api/fx-sim/stop" && method === "POST") {
    const status = simEngine.stop();
    return jsonResponse(status);
  }

  return null;
}
