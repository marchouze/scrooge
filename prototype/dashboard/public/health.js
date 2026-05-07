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
// cadence in hours; thresholds: green ≤ 1.0× · amber 1.5× · red ≥ 2×.
const CADENCE_HOURS = {
  vera: 24,
  anya: 24,
  scrooge: 24,
  atlas: 24 * 7,
  owen: 24 * 7,
  mira: 24 * 7,
  senna: 24 * 7,
};

// Agents with registered runtime handlers — kept in sync with
// runtime/run.ts HANDLERS map. Used to separate "fleet" agents from
// "spec-only" personas on the health page.
const RUNTIME_AGENTS = new Set(["vera", "anya", "scrooge", "atlas", "owen", "mira", "senna"]);

function statusFor(agentName, lastActivityAt, asOf, latestRun) {
  const key = agentName.toLowerCase();
  const cadenceH = CADENCE_HOURS[key];
  if (cadenceH === undefined) return { tag: "spec-only", label: "spec only" };

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
  if (ageH < 0) return { tag: "green", label: `ran ${Math.round(-ageH)}h in the future (clock skew)` };
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
  const specReady = personas.filter((p) => p.hasOperatingSpec).length;
  const onRuntime = personas.filter((p) => RUNTIME_AGENTS.has(p.name.toLowerCase())).length;
  const counts = {
    runtime: { green: 0, amber: 0, red: 0 },
  };
  for (const p of personas) {
    const s = statusFor(p.name, p.lastActivityAt, state.asOf, latestRunByAgent[p.name.toLowerCase()]);
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

function renderHealthCard(persona, state) {
  const status = statusFor(persona.name, persona.lastActivityAt, state.asOf, latestRunByAgent[persona.name.toLowerCase()]);
  const card = el("article", { class: `health-card health-${status.tag}` });
  const head = el("header", { class: "health-head" }, [
    el("span", { class: `health-light health-light-${status.tag}` }),
    el("span", { class: "health-name" }, persona.name),
    el("span", { class: "muted small" }, persona.role || ""),
  ]);
  card.appendChild(head);
  card.appendChild(el("p", { class: "health-status" }, status.label));
  if (persona.lastActivityAt) {
    card.appendChild(el("p", { class: "muted small" }, `Last activity: ${fmtDate(persona.lastActivityAt)}`));
  }
  return card;
}

function renderRuntimeAgents(state) {
  const root = $("runtimeAgents");
  root.innerHTML = "";
  const personas = flattenAllPersonas(state);
  const onRuntime = personas.filter((p) => RUNTIME_AGENTS.has(p.name.toLowerCase()));
  // Sort by status severity: red first, then amber, then green.
  const order = { red: 0, amber: 1, green: 2 };
  onRuntime.sort((a, b) => {
    const sa = statusFor(a.name, a.lastActivityAt, state.asOf, latestRunByAgent[a.name.toLowerCase()]).tag;
    const sb = statusFor(b.name, b.lastActivityAt, state.asOf, latestRunByAgent[b.name.toLowerCase()]).tag;
    return (order[sa] ?? 99) - (order[sb] ?? 99);
  });
  for (const p of onRuntime) root.appendChild(renderHealthCard(p, state));
  $("runtimeSub").textContent = `${onRuntime.length} agent${onRuntime.length === 1 ? "" : "s"}`;
}

function renderSpecOnlyPersonas(state) {
  const root = $("specOnlyPersonas");
  root.innerHTML = "";
  const personas = flattenAllPersonas(state);
  // Deduplicate by name (subordinates may also appear as direct-report engineers).
  const seen = new Set();
  const specOnly = [];
  for (const p of personas) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    if (RUNTIME_AGENTS.has(p.name.toLowerCase())) continue;
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
  $("specOnlySub").textContent = `${specOnly.length} persona${specOnly.length === 1 ? "" : "s"} (substrate gap)`;
}

// Latest run per agent name (lower-case keyed). Refreshed alongside /api/state.
let latestRunByAgent = {};

async function load() {
  const live = $("liveDot");
  const stamp = $("lastUpdated");
  try {
    const [stateR, runsR] = await Promise.all([
      fetch("/api/state", { cache: "no-store" }),
      fetch("/api/agent-runs", { cache: "no-store" }).catch(() => null),
    ]);
    if (!stateR.ok) throw new Error(`HTTP ${stateR.status}`);
    const state = await stateR.json();
    latestRunByAgent = {};
    if (runsR && runsR.ok) {
      const data = await runsR.json();
      for (const [agent, runs] of Object.entries(data.byAgent ?? {})) {
        if (runs.length > 0) latestRunByAgent[agent.toLowerCase()] = runs[0];
      }
    }
    renderStrategyBanner(state);
    renderAggregateStats(state);
    renderRuntimeAgents(state);
    renderSpecOnlyPersonas(state);
    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(state.asOf)}`;
  } catch (e) {
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

load();
setInterval(load, 30_000);
