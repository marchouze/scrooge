// dashboard/fx-sim-view.ts
//
// API routes for the FX market-making simulation engine control panel.
// Registers:
//   GET  /api/fx-sim/status  — get current simulation status (read-only).
//
// RETIRED (D-FX-SIM-FRONTEND-INPUT-DRIVER, CEO-approved 2026-05-30):
//   POST /api/fx-sim/start   — started the in-process counterparty FX trade
//   POST /api/fx-sim/stop      loop, which auto-booked through `bookFxTrade`.
// Counterparty FX trades now ENTER VIA THE FRONT-END: an agent generates specs
// with `scripts/sim/fx-frontend-trade-specs.ts` and drives /trade-book.html via
// Claude-in-Chrome (see platform/simulation/fx-frontend-driver/README.md). The
// two control routes now return HTTP 410 Gone so no second in-process booking
// path remains ("One dispatch path per scope"). The internal-MM risk-monitor
// read context is still exposed via /api/fx-sim/status.
//
// Authority: D-FX-SALES-TRADING-FRONTEND; D-MARKETS-SCHEMA-FOUNDATION;
//   D-FX-SIM-FRONTEND-INPUT-DRIVER.
// Author: Devon (Chief Operating Officer, engineering);
//   retirement by Atlas (Core banking platform architect, engineering).

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
  _req: Request,
  simEngine: FxSimEngine,
): Promise<Response | null> {
  // GET /api/fx-sim/status
  if (pathname === "/api/fx-sim/status" && method === "GET") {
    return jsonResponse(simEngine.getStatus());
  }

  // POST /api/fx-sim/start, POST /api/fx-sim/stop — RETIRED.
  // The in-process counterparty FX trade loop (auto-booking via bookFxTrade) is
  // retired; counterparty trades now enter via the front-end driver. Returns
  // HTTP 410 Gone with a pointer to the replacement path.
  if ((pathname === "/api/fx-sim/start" || pathname === "/api/fx-sim/stop") && method === "POST") {
    return jsonResponse(
      {
        error: "retired",
        detail:
          "The in-process counterparty FX trade loop is retired (D-FX-SIM-FRONTEND-INPUT-DRIVER). Counterparty FX trades now enter via the front-end: generate specs with `bun run scripts/sim/fx-frontend-trade-specs.ts` and drive /trade-book.html via Claude-in-Chrome (platform/simulation/fx-frontend-driver/README.md).",
      },
      410,
    );
  }

  return null;
}
