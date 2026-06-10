// dashboard/static-assets.test.ts
//
// Tests for static-file serving with cache validation
// (WS-DASHBOARD-STATIC-CACHING).
// Author: Atlas (Core banking platform architect, engineering)

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { contentTypeFor, serveStaticFile } from "./static-assets";

let publicDir: string;

beforeAll(() => {
  publicDir = mkdtempSync(join(tmpdir(), "static-assets-test-"));
  writeFileSync(join(publicDir, "home.html"), "<html><body>home</body></html>");
  writeFileSync(join(publicDir, "_shell.js"), "export const nav = 'collapsible';");
  writeFileSync(join(publicDir, "_shell.css"), ".nav { display: flex; }");
});

afterAll(() => {
  rmSync(publicDir, { recursive: true, force: true });
});

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/_shell.js", { headers });
}

describe("contentTypeFor", () => {
  it("maps known extensions and falls back to octet-stream", () => {
    expect(contentTypeFor("a.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("a.css")).toBe("text/css; charset=utf-8");
    expect(contentTypeFor("a.js")).toBe("application/javascript; charset=utf-8");
    expect(contentTypeFor("a.json")).toBe("application/json; charset=utf-8");
    expect(contentTypeFor("a.svg")).toBe("image/svg+xml");
    expect(contentTypeFor("a.bin")).toBe("application/octet-stream");
  });
});

describe("serveStaticFile cache validation", () => {
  it("serves files with Cache-Control: no-cache, ETag, and Last-Modified", async () => {
    const res = serveStaticFile(publicDir, "/_shell.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("ETag")).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
    expect(res.headers.get("Last-Modified")).toMatch(/GMT$/);
    expect(await res.text()).toBe("export const nav = 'collapsible';");
  });

  it("treats HTML identically to JS/CSS", () => {
    for (const path of ["/home.html", "/_shell.css"]) {
      const res = serveStaticFile(publicDir, path);
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
      expect(res.headers.get("ETag")).toMatch(/^W\//);
    }
  });

  it("returns a bodyless 304 with the same validators when If-None-Match matches", async () => {
    const first = serveStaticFile(publicDir, "/_shell.js");
    const etag = first.headers.get("ETag");
    if (!etag) throw new Error("expected ETag on first response");
    const second = serveStaticFile(publicDir, "/_shell.js", reqWith({ "If-None-Match": etag }));
    expect(second.status).toBe(304);
    expect(second.headers.get("ETag")).toBe(etag);
    expect(second.headers.get("Cache-Control")).toBe("no-cache");
    expect(await second.text()).toBe("");
  });

  it("matches weak comparison and comma-separated If-None-Match lists", () => {
    const etag = serveStaticFile(publicDir, "/_shell.js").headers.get("ETag") ?? "";
    const strong = etag.replace(/^W\//, "");
    const list = `"stale-etag", ${strong}`;
    const res = serveStaticFile(publicDir, "/_shell.js", reqWith({ "If-None-Match": list }));
    expect(res.status).toBe(304);
  });

  it("returns 200 with a body when If-None-Match does not match", async () => {
    const res = serveStaticFile(
      publicDir,
      "/_shell.js",
      reqWith({ "If-None-Match": 'W/"dead-beef"' }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).not.toBe("");
  });

  it("changes the ETag when the file changes", () => {
    const path = join(publicDir, "mutable.js");
    writeFileSync(path, "v1");
    const before = serveStaticFile(publicDir, "/mutable.js").headers.get("ETag");
    writeFileSync(path, "v2-longer");
    // Bump mtime explicitly: same-millisecond rewrites would otherwise be
    // distinguishable only by size (which also changed here).
    utimesSync(path, new Date(1735689600000), new Date(1735689600000));
    const after = serveStaticFile(publicDir, "/mutable.js").headers.get("ETag");
    expect(after).not.toBe(before);
    // A stale ETag from before the deploy must revalidate to a full 200.
    if (!before) throw new Error("expected ETag on first response");
    const res = serveStaticFile(publicDir, "/mutable.js", reqWith({ "If-None-Match": before }));
    expect(res.status).toBe(200);
  });
});

describe("serveStaticFile routing and safety", () => {
  it("maps / to home.html", async () => {
    const res = serveStaticFile(publicDir, "/");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toContain("home");
  });

  it("404s on missing files, directories, and traversal attempts", () => {
    expect(serveStaticFile(publicDir, "/nope.js").status).toBe(404);
    expect(serveStaticFile(publicDir, "/.").status).toBe(404);
    expect(serveStaticFile(publicDir, "/../../etc/passwd").status).toBe(404);
  });
});
