// dashboard/sim-hub-view.ts
//
// API routes for the centralised 3rd-party simulator hub control panel.
//   GET  /api/sim/registry      — self-describing list of simulators by domain
//   GET  /api/sim/status        — live status of every simulator by domain
//   GET  /api/sim/events        — recently-emitted simulated events (feed)
//   GET  /api/sim/:id/status    — single simulator status
//   POST /api/sim/:id/start     — start (body = config)
//   POST /api/sim/:id/stop      — stop
//   POST /api/sim/:id/fire      — one-shot action (body = { actionId, args })
//
// Mirrors the conventions in fx-sim-view.ts. Registered in server.ts before the
// catch-all static handler; returns a Response when handled, null otherwise.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION. Scrooge session-delegation (Marc).

import type { ThirdPartySimHub } from "../platform/simulation/hub/index";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(err: unknown, status = 400): Response {
  const message = err instanceof Error ? err.message : String(err);
  return jsonResponse({ error: message }, status);
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const raw = await req.json();
    if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
  } catch {
    // empty / non-JSON body is fine — treated as no config
  }
  return {};
}

export async function registerSimHubRoutes(
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
  req: Request,
  hub: ThirdPartySimHub,
): Promise<Response | null> {
  if (!pathname.startsWith("/api/sim/")) return null;

  // Collection routes.
  if (pathname === "/api/sim/registry" && method === "GET") {
    return jsonResponse({ domains: hub.list() });
  }
  if (pathname === "/api/sim/status" && method === "GET") {
    return jsonResponse({ domains: hub.statusAll() });
  }
  if (pathname === "/api/sim/events" && method === "GET") {
    const limitRaw = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;
    return jsonResponse({ events: hub.recentSimulatedEvents(limit) });
  }

  // Per-simulator routes: /api/sim/:id/<action>
  const rest = pathname.slice("/api/sim/".length);
  const slash = rest.lastIndexOf("/");
  if (slash <= 0) return null;
  const id = rest.slice(0, slash);
  const action = rest.slice(slash + 1);

  try {
    if (action === "status" && method === "GET") {
      return jsonResponse(hub.status(id));
    }
    if (action === "start" && method === "POST") {
      const config = await readJsonBody(req);
      return jsonResponse(hub.start(id, config));
    }
    if (action === "stop" && method === "POST") {
      return jsonResponse(hub.stop(id));
    }
    if (action === "fire" && method === "POST") {
      const body = await readJsonBody(req);
      const actionId = typeof body.actionId === "string" ? body.actionId : "";
      const args =
        typeof body.args === "object" && body.args !== null
          ? (body.args as Record<string, unknown>)
          : {};
      if (!actionId) return errorResponse("fire requires an 'actionId'");
      const result = await hub.fire(id, actionId, args);
      return jsonResponse(result);
    }
  } catch (err) {
    return errorResponse(err);
  }

  return null;
}
