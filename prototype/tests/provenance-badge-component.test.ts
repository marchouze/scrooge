// tests/provenance-badge-component.test.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 3 — badge component tests.
//
// The badge module is browser JS (no module exports — installs onto
// `window.provenanceBadge`). We test it by:
//
//   1. Source-shape assertions — the module file declares the public API
//      surface this slice contracts to (render, mount, fetch, autoMount,
//      describe), the three expected modes are wired, and the component
//      has the page-top placement class.
//
//   2. Pure-function evaluation — extract the IIFE body into an isolated
//      scope with a minimal DOM stub (just enough to exercise `render`
//      and `describe`), then assert the renderer wires the mode attribute
//      and labels per the §6.2 taxonomy.
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime
//   + watermark layer).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

const MODULE_PATH = resolve(
  import.meta.dir,
  "..",
  "dashboard",
  "public",
  "provenance-badge.js",
);
const MODULE_SRC = readFileSync(MODULE_PATH, "utf8");

describe("provenance-badge.js — source shape", () => {
  it("declares the public API surface", () => {
    expect(MODULE_SRC).toContain("window.provenanceBadge");
    expect(MODULE_SRC).toContain("render");
    expect(MODULE_SRC).toContain("mount");
    expect(MODULE_SRC).toContain("fetch:");
    expect(MODULE_SRC).toContain("autoMount");
    expect(MODULE_SRC).toContain("describe");
  });

  it("targets the /api/provenance/mode endpoint", () => {
    expect(MODULE_SRC).toContain("/api/provenance/mode");
  });

  it("wires the three modes into the descriptor map", () => {
    expect(MODULE_SRC).toContain('"production-only"');
    expect(MODULE_SRC).toContain('"simulated-only"');
    expect(MODULE_SRC).toContain("combined:");
  });

  it("auto-mounts on DOMContentLoaded", () => {
    expect(MODULE_SRC).toContain("DOMContentLoaded");
  });

  it("has a page-top placement class for chrome injection", () => {
    expect(MODULE_SRC).toContain("provenance-badge-page-top");
    expect(MODULE_SRC).toContain("provenance-badge-tile");
  });

  it("includes the data-mode attribute selector hook on the rendered node", () => {
    expect(MODULE_SRC).toContain('setAttribute("data-mode"');
  });

  it("renders an explicit error state (never silent)", () => {
    expect(MODULE_SRC).toContain("renderError");
    expect(MODULE_SRC).toContain('"error"');
  });
});

// ---------------------------------------------------------------------------
// Pure-function evaluation. We wrap the IIFE source in a minimal DOM stub
// that supports the subset `render` + `describe` use, then exercise the
// public surface via the simulated `window`.
// ---------------------------------------------------------------------------

interface FakeNode {
  tagName: string;
  className: string;
  attrs: Map<string, string>;
  children: FakeNode[];
  textContent: string;
}

function makeFakeNode(tag: string): FakeNode {
  return {
    tagName: tag,
    className: "",
    attrs: new Map(),
    children: [],
    textContent: "",
  };
}

function loadModuleInFakeDom(): {
  api: {
    render: (
      filter: unknown,
      opts?: { placement?: string },
    ) => FakeNode;
    describe: (filter: unknown) => {
      mode: string;
      label: string;
      suffix: string | null;
      aria?: string;
    };
    renderError: (msg: string) => FakeNode;
    mount: (target: FakeNode, opts?: { filter?: unknown; placement?: string }) => FakeNode | null;
  };
} {
  const fakeWindow: Record<string, unknown> = {};
  const fakeDocumentListeners = new Map<string, Array<() => void>>();
  const fakeDocument = {
    createElement: (tag: string) => {
      const node = makeFakeNode(tag);
      // Mock setAttribute / classList / appendChild on the fake node.
      Object.assign(node, {
        setAttribute(k: string, v: string) {
          this.attrs.set(k, String(v));
        },
        appendChild(c: FakeNode) {
          this.children.push(c);
          return c;
        },
        replaceChildren(...newChildren: FakeNode[]) {
          this.children = [...newChildren];
        },
        classList: {
          add: (cls: string) => {
            node.className = node.className ? `${node.className} ${cls}` : cls;
          },
        },
      });
      return node;
    },
    querySelectorAll: () => [] as FakeNode[],
    querySelector: () => null as FakeNode | null,
    addEventListener: (ev: string, fn: () => void) => {
      const arr = fakeDocumentListeners.get(ev) ?? [];
      arr.push(fn);
      fakeDocumentListeners.set(ev, arr);
    },
    body: makeFakeNode("body"),
  };

  // Evaluate the IIFE in a sandbox that exposes our fakes. We use
  // `new Function` with explicit window/document parameters — strict
  // enough that the module's `(() => { ... })()` IIFE installs the API
  // onto our fake window.
  const factory = new Function(
    "window",
    "document",
    "console",
    "fetch",
    `${MODULE_SRC}; return window.provenanceBadge;`,
  );
  const api = factory(
    fakeWindow,
    fakeDocument,
    { warn: () => undefined, debug: () => undefined },
    () => Promise.resolve({ ok: true, json: () => Promise.resolve({ mode: "simulated-only" }) }),
  );
  return { api };
}

describe("provenance-badge.js — render / describe", () => {
  const { api } = loadModuleInFakeDom();

  it("describe(production-only) returns the production label", () => {
    const d = api.describe({ mode: "production-only" });
    expect(d.mode).toBe("production-only");
    expect(d.label).toBe("Production data");
    expect(d.suffix).toBeNull();
  });

  it("describe(simulated-only) returns the simulated label", () => {
    const d = api.describe({ mode: "simulated-only" });
    expect(d.mode).toBe("simulated-only");
    expect(d.label).toBe("Simulated data");
    expect(d.suffix).toBeNull();
  });

  it("describe(combined) returns the combined label", () => {
    const d = api.describe({ mode: "combined" });
    expect(d.mode).toBe("combined");
    expect(d.label).toBe("Combined (P+S)");
  });

  it("describe with scenario narrowing emits a suffix", () => {
    const d = api.describe({
      mode: "simulated-only",
      scenarios: ["rehearsal-2026-Q1"],
    });
    expect(d.suffix).toContain("scenarios: rehearsal-2026-Q1");
  });

  it("describe with variant + lineage narrowing concatenates suffix parts", () => {
    const d = api.describe({
      mode: "combined",
      variants: ["uat"],
      sourceLineages: ["agent-runtime:atlas"],
    });
    expect(d.suffix).toContain("variants: uat");
    expect(d.suffix).toContain("lineages: agent-runtime:atlas");
  });

  it("describe(null) falls back to unknown — never silent", () => {
    const d = api.describe(null);
    expect(d.mode).toBe("unknown");
  });

  it("describe(undefined) falls back to unknown — never silent", () => {
    const d = api.describe(undefined);
    expect(d.mode).toBe("unknown");
  });

  it("render(production-only) emits a span with data-mode + label", () => {
    const node = api.render({ mode: "production-only" });
    expect(node.tagName).toBe("span");
    expect(node.attrs.get("data-mode")).toBe("production-only");
    expect(node.className).toContain("provenance-badge");
    expect(node.className).toContain("provenance-badge-page-top");
    // Label child has the descriptor label.
    const labels = node.children.filter((c) => c.className.includes("provenance-badge-label"));
    expect(labels.length).toBe(1);
    expect(labels[0].textContent).toBe("Production data");
  });

  it("render(simulated-only) sets data-mode='simulated-only'", () => {
    const node = api.render({ mode: "simulated-only" });
    expect(node.attrs.get("data-mode")).toBe("simulated-only");
  });

  it("render(combined) sets data-mode='combined'", () => {
    const node = api.render({ mode: "combined" });
    expect(node.attrs.get("data-mode")).toBe("combined");
  });

  it("render(filter, {placement: 'tile'}) uses the tile placement class", () => {
    const node = api.render({ mode: "production-only" }, { placement: "tile" });
    expect(node.className).toContain("provenance-badge-tile");
    expect(node.className).not.toContain("provenance-badge-page-top");
  });

  it("render with filter scenario adds the suffix child", () => {
    const node = api.render({
      mode: "simulated-only",
      scenarios: ["unit-test"],
    });
    const suffixes = node.children.filter((c) =>
      c.className.includes("provenance-badge-suffix"),
    );
    expect(suffixes.length).toBe(1);
    expect(suffixes[0].textContent).toContain("scenarios: unit-test");
  });

  it("render(null) emits the unknown badge — never disappears", () => {
    const node = api.render(null);
    expect(node.attrs.get("data-mode")).toBe("unknown");
  });

  it("renderError emits an error badge with title carrying the cause", () => {
    const node = api.renderError("/api/provenance/mode timeout");
    expect(node.attrs.get("data-mode")).toBe("error");
    expect(node.attrs.get("title")).toContain("/api/provenance/mode timeout");
  });

  it("mount with explicit filter overrides the cached filter", () => {
    const target = makeFakeNode("div");
    Object.assign(target, {
      replaceChildren(...c: FakeNode[]) {
        this.children = [...c];
      },
    });
    const node = api.mount(target, { filter: { mode: "combined" }, placement: "tile" });
    expect(node).not.toBeNull();
    expect(node?.attrs.get("data-mode")).toBe("combined");
    expect(target.children.length).toBe(1);
  });
});
