// dashboard/public/health.js
//
// Fleet health view. Reads /api/state and computes:
//   - Per-runtime-handler traffic-light status from lastActivityAt vs an
//     inline cadence map (which mirrors the cron schedules in
//     .github/workflows/agent-runtime-*.yml).
//   - Aggregate fleet stats from the agents + decisions arrays.
//   - A separate panel for personas that have an operating spec but no
//     registered runtime handler — those carry a substrate gap, not a
//     health failure.
//
// Author: Atlas · Anya

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

// Cadence map mirrors .github/workflows/agent-runtime-*.yml schedules.
// Keys are agent name (case-insensitive). Values are the expected
// Cadence in hours; thresholds: green ≤ 1.0× · amber 1.5× · red ≥ 2×.
//
// Cadence info is now derived from `state.runtimeHandlers` (canonical
// source: dashboard/derive.ts RUNTIME_HANDLERS). The functions below
// build a per-agent cadence + on-runtime view from that array on every
// render so the page can never drift from the registry.

function buildRuntimeView(state) {
  // For each agent, take the *fastest* scheduled cadence. Event-driven
  // and on-request handlers don't have a cadence — they fire on demand,
  // so they don't impose a staleness threshold but they do mark the
  // agent as on-runtime.
  const cadenceByAgent = new Map();
  const runtimeAgents = new Set();
  for (const h of state.runtimeHandlers ?? []) {
    const k = h.agent.toLowerCase();
    runtimeAgents.add(k);
    if (typeof h.cadenceHours === "number") {
      const prev = cadenceByAgent.get(k);
      if (prev === undefined || h.cadenceHours < prev) cadenceByAgent.set(k, h.cadenceHours);
    }
  }
  return { cadenceByAgent, runtimeAgents };
}

function statusFor(agentName, lastActivityAt, asOf, latestRun, runtimeView) {
  const key = agentName.toLowerCase();
  const cadenceH = runtimeView.cadenceByAgent.get(key);
  const onRuntime = runtimeView.runtimeAgents.has(key);
  if (!onRuntime) return { tag: "spec-only", label: "spec only" };
  if (cadenceH === undefined) {
    // On-runtime but no scheduled cadence (event-driven / on-request
    // only). Status is "ready" — fires when triggered, can't be stale.
    if (latestRun && latestRun.status === "completed" && latestRun.conclusion === "failure") {
      return { tag: "red", label: `last run failed (${latestRun.createdAt.slice(0, 10)})` };
    }
    return { tag: "green", label: "on-demand · ready" };
  }

  // Run conclusion (from /api/agent-runs) is the strongest signal.
  // A failed most-recent run is red regardless of deliverable age, because
  // it means the agent ran but produced no deliverable — the
  // deliverable-age signal alone would silently miss this.
  if (latestRun && latestRun.status === "completed") {
    if (latestRun.conclusion === "failure") {
      return { tag: "red", label: `last run failed (${latestRun.createdAt.slice(0, 10)})` };
    }
    if (latestRun.conclusion === "cancelled") {
      return { tag: "amber", label: `last run cancelled (${latestRun.createdAt.slice(0, 10)})` };
    }
  }
  if (latestRun && latestRun.status === "in_progress") {
    return { tag: "green", label: "in progress" };
  }

  // Fall back to deliverable-age signal.
  if (!lastActivityAt) return { tag: "red", label: "no run on record" };
  const ageMs = new Date(asOf).getTime() - new Date(lastActivityAt).getTime();
  const ageH = ageMs / 1000 / 60 / 60;
  if (ageH < 0)
    return { tag: "green", label: `ran ${Math.round(-ageH)}h in the future (clock skew)` };
  if (ageH <= cadenceH) return { tag: "green", label: `ran ${Math.round(ageH)}h ago` };
  if (ageH <= cadenceH * 1.5)
    return { tag: "amber", label: `${Math.round(ageH)}h since last run (cadence ${cadenceH}h)` };
  return { tag: "red", label: `${Math.round(ageH)}h since last run (cadence ${cadenceH}h)` };
}

function renderStrategyBanner(state) {
  const banner = $("strategyBanner");
  if (!banner) return;
  const phase = state.bank?.operatingPosture ?? "—";
  const openCount = (state.decisionsOpen ?? []).length;
  const agentCount = (state.agents ?? []).length;
  banner.innerHTML = "";
  banner.appendChild(el("span", { class: "banner-phase" }, `Phase: ${phase}`));
  banner.appendChild(el("span", { class: "banner-sep" }, " · "));
  banner.appendChild(el("span", {}, `${openCount} CEO decision${openCount === 1 ? "" : "s"} open`));
  banner.appendChild(el("span", { class: "banner-sep" }, " · "));
  banner.appendChild(el("span", {}, `${agentCount} agent${agentCount === 1 ? "" : "s"} reporting`));
}

function flattenAllPersonas(state) {
  const out = [];
  for (const a of state.agents ?? []) {
    out.push({
      name: a.name,
      role: a.role,
      type: a.type,
      hasOperatingSpec: a.hasOperatingSpec,
      lastActivityAt: a.lastActivityAt ?? null,
      isDirectReport: true,
    });
    for (const s of a.subordinates ?? []) {
      out.push({
        name: s.name,
        role: s.role,
        type: "Engineer",
        hasOperatingSpec: s.hasOperatingSpec,
        lastActivityAt: s.lastActivityAt ?? null,
        isDirectReport: false,
      });
    }
  }
  return out;
}

function renderAggregateStats(state) {
  const root = $("aggregateStats");
  root.innerHTML = "";
  const personas = flattenAllPersonas(state);
  const runtimeView = buildRuntimeView(state);
  const specReady = personas.filter((p) => p.hasOperatingSpec).length;
  const onRuntime = personas.filter((p) =>
    runtimeView.runtimeAgents.has(p.name.toLowerCase()),
  ).length;
  const counts = {
    runtime: { green: 0, amber: 0, red: 0 },
  };
  for (const p of personas) {
    const s = statusFor(
      p.name,
      p.lastActivityAt,
      state.asOf,
      latestRunByAgent[p.name.toLowerCase()],
      runtimeView,
    );
    if (s.tag === "green" || s.tag === "amber" || s.tag === "red") counts.runtime[s.tag]++;
  }
  const stats = [
    { label: "Personas total", value: personas.length },
    { label: "Operating spec ready", value: specReady, klass: "good" },
    { label: "Runtime handlers", value: onRuntime, klass: "good" },
    { label: "Green", value: counts.runtime.green, klass: counts.runtime.green > 0 ? "good" : "" },
    { label: "Amber", value: counts.runtime.amber, klass: counts.runtime.amber > 0 ? "warn" : "" },
    { label: "Red", value: counts.runtime.red, klass: counts.runtime.red > 0 ? "warn" : "" },
    { label: "CEO decisions open", value: (state.decisionsOpen ?? []).length },
  ];
  for (const s of stats) {
    root.appendChild(
      el("div", { class: `summary-stat ${s.klass ?? ""}` }, [
        el("span", { class: "summary-stat-value" }, String(s.value)),
        el("span", { class: "summary-stat-label" }, s.label),
      ]),
    );
  }
}

function renderHealthCard(persona, state, runtimeView) {
  const status = statusFor(
    persona.name,
    persona.lastActivityAt,
    state.asOf,
    latestRunByAgent[persona.name.toLowerCase()],
    runtimeView,
  );
  const card = el("article", { class: `health-card health-${status.tag}` });
  const head = el("header", { class: "health-head" }, [
    el("span", { class: `health-light health-light-${status.tag}` }),
    el("span", { class: "health-name" }, persona.name),
    el("span", { class: "muted small" }, persona.role || ""),
  ]);
  card.appendChild(head);
  card.appendChild(el("p", { class: "health-status" }, status.label));
  if (persona.lastActivityAt) {
    card.appendChild(
      el("p", { class: "muted small" }, `Last activity: ${fmtDate(persona.lastActivityAt)}`),
    );
  }
  return card;
}

function renderRuntimeAgents(state) {
  const root = $("runtimeAgents");
  root.innerHTML = "";
  const runtimeView = buildRuntimeView(state);
  const personas = flattenAllPersonas(state);
  const onRuntime = personas.filter((p) => runtimeView.runtimeAgents.has(p.name.toLowerCase()));
  // Sort by status severity: red first, then amber, then green.
  const order = { red: 0, amber: 1, green: 2 };
  onRuntime.sort((a, b) => {
    const sa = statusFor(
      a.name,
      a.lastActivityAt,
      state.asOf,
      latestRunByAgent[a.name.toLowerCase()],
      runtimeView,
    ).tag;
    const sb = statusFor(
      b.name,
      b.lastActivityAt,
      state.asOf,
      latestRunByAgent[b.name.toLowerCase()],
      runtimeView,
    ).tag;
    return (order[sa] ?? 99) - (order[sb] ?? 99);
  });
  for (const p of onRuntime) root.appendChild(renderHealthCard(p, state, runtimeView));
  // Show registered handler count, not just persona count, so multi-trigger agents read accurately.
  const handlerCount = (state.runtimeHandlers ?? []).length;
  $("runtimeSub").textContent =
    `${onRuntime.length} agent${onRuntime.length === 1 ? "" : "s"} · ${handlerCount} handler${handlerCount === 1 ? "" : "s"}`;
}

function renderSpecOnlyPersonas(state) {
  const root = $("specOnlyPersonas");
  root.innerHTML = "";
  const runtimeView = buildRuntimeView(state);
  const personas = flattenAllPersonas(state);
  // Deduplicate by name (subordinates may also appear as direct-report engineers).
  const seen = new Set();
  const specOnly = [];
  for (const p of personas) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    if (runtimeView.runtimeAgents.has(p.name.toLowerCase())) continue;
    if (!p.hasOperatingSpec) continue;
    specOnly.push(p);
  }
  specOnly.sort((a, b) => a.name.localeCompare(b.name));
  for (const p of specOnly) {
    const card = el("article", { class: "health-card health-spec-only" });
    card.appendChild(
      el("header", { class: "health-head" }, [
        el("span", { class: "health-light health-light-spec-only" }),
        el("span", { class: "health-name" }, p.name),
        el("span", { class: "muted small" }, p.role || ""),
      ]),
    );
    card.appendChild(
      el("p", { class: "muted small" }, "Spec ready · runtime handler not yet built"),
    );
    root.appendChild(card);
  }
  $("specOnlySub").textContent =
    `${specOnly.length} persona${specOnly.length === 1 ? "" : "s"} (substrate gap)`;
}

// Latest run per agent name (lower-case keyed). Refreshed alongside /api/state.
let latestRunByAgent = {};

function renderSubstrateGaps(view) {
  const list = $("substrateGapsList");
  const sub = $("substrateGapsSub");
  if (!list) return;
  list.innerHTML = "";
  const gaps = view?.gaps ?? [];
  if (gaps.length === 0) {
    if (view?.sourceFile) {
      list.appendChild(
        el("li", { class: "muted" }, "Atlas's most-recent run reports no substrate gaps."),
      );
    } else {
      list.appendChild(
        el(
          "li",
          { class: "muted" },
          "No Atlas substrate-state deliverable found yet — run Atlas to populate.",
        ),
      );
    }
  } else {
    for (const g of gaps) {
      list.appendChild(el("li", { class: "substrate-gap" }, g));
    }
  }
  if (sub) {
    if (view?.sourceFile && view.asOf) {
      sub.textContent = `${gaps.length} tracked · source: ${view.sourceFile} (${view.asOf.slice(0, 10)})`;
    } else if (view?.sourceFile) {
      sub.textContent = `${gaps.length} tracked · source: ${view.sourceFile}`;
    } else {
      sub.textContent = `${gaps.length} tracked`;
    }
  }
}

async function load() {
  const live = $("liveDot");
  const stamp = $("lastUpdated");
  try {
    const [stateR, runsR, gapsR] = await Promise.all([
      fetch("/api/state", { cache: "no-store" }),
      fetch("/api/agent-runs", { cache: "no-store" }).catch(() => null),
      fetch("/api/substrate-gaps", { cache: "no-store" }).catch(() => null),
    ]);
    if (!stateR.ok) throw new Error(`HTTP ${stateR.status}`);
    const state = await stateR.json();
    latestRunByAgent = {};
    if (runsR?.ok) {
      const data = await runsR.json();
      for (const [agent, runs] of Object.entries(data.byAgent ?? {})) {
        if (runs.length > 0) latestRunByAgent[agent.toLowerCase()] = runs[0];
      }
    }
    const gapsView = gapsR?.ok ? await gapsR.json() : null;
    renderStrategyBanner(state);
    renderAggregateStats(state);
    renderRuntimeAgents(state);
    renderSubstrateGaps(gapsView);
    renderSpecOnlyPersonas(state);
    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(state.asOf)}`;
  } catch (e) {
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

load();
if (typeof window.registerPagePoll === "function") {
  window.registerPagePoll(load, 30_000);
} else {
  setInterval(load, 30_000);
}
