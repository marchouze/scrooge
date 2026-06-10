// dashboard/static-assets.ts
//
// Static-file serving for the dashboard with HTTP cache validation
// (WS-DASHBOARD-STATIC-CACHING).
// Author: Atlas (Core banking platform architect, engineering)
//
// Extracted from server.ts so the logic is importable in tests (server.ts
// boots Bun.serve at module level). Responses carry `Cache-Control: no-cache`
// plus a weak mtime+size ETag: browsers given no cache headers fall back to
// heuristic caching and keep serving stale _shell.js/_shell.css after a
// deploy + server bounce, so merged UI changes looked "not visible" until a
// hard refresh. `no-cache` forces revalidation on every load; the ETag turns
// unchanged revalidations into bodyless 304s. HTML and JS/CSS/JSON/SVG get
// identical treatment.

import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

export function contentTypeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

/** Weak validator: a touched or resized file changes it; content hashing is
 * not worth a read on every request for a single-operator dashboard. */
function etagFor(size: number, mtimeMs: number): string {
  return `W/"${size.toString(16)}-${Math.trunc(mtimeMs).toString(16)}"`;
}

/** RFC 9110 §13.1.2: If-None-Match is a comma-separated list; comparison for
 * GET is weak, so `W/` prefixes are ignored on both sides. */
function etagMatches(ifNoneMatch: string, etag: string): boolean {
  const target = etag.replace(/^W\//, "");
  return ifNoneMatch
    .split(",")
    .some((t) => t.trim() === "*" || t.trim().replace(/^W\//, "") === target);
}

export function serveStaticFile(publicDir: string, pathname: string, req?: Request): Response {
  const requested = pathname === "/" ? "/home.html" : pathname;
  const safe = normalize(requested).replace(/^\/+/, "");
  const filePath = join(publicDir, safe);
  if (!filePath.startsWith(publicDir)) {
    return new Response("Not found", { status: 404 });
  }
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!stat.isFile()) {
    return new Response("Not found", { status: 404 });
  }
  const etag = etagFor(stat.size, stat.mtimeMs);
  const headers = {
    "Content-Type": contentTypeFor(filePath),
    "Cache-Control": "no-cache",
    ETag: etag,
    "Last-Modified": new Date(stat.mtimeMs).toUTCString(),
  };
  const ifNoneMatch = req?.headers.get("if-none-match");
  if (ifNoneMatch && etagMatches(ifNoneMatch, etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(readFileSync(filePath), { headers });
}
