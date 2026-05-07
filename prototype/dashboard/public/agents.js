// dashboard/public/agents.js
//
// Per-agent mini-dashboard view. Reads /api/state and renders one card per
// CEO-reporting agent. Cards show mandate, operating-spec status, owned
// workstreams (active + recently completed), open decisions owned, and
// recent deliverables matched to the agent.
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

function clip(text, max = 240) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function tag(text, cls) {
  return el("span", { class: `pill ${cls}` }, text);
}

function renderSummary(agents) {
  const summaryNode = $("agentsSummary");
  summaryNode.innerHTML = "";
  const total = agents.length;
  // "Specs ready" counts the head's own spec PLUS each subordinate's spec.
  const allPersonas = agents.flatMap((a) => [
    { hasOperatingSpec: a.hasOperatingSpec },
    ...(a.subordinates ?? []).map((s) => ({ hasOperatingSpec: s.hasOperatingSpec })),
  ]);
  const specReady = allPersonas.filter((p) => p.hasOperatingSpec).length;
  const specPending = allPersonas.length - specReady;
  // Totals are the rolled-up totals (own + subordinates).
  const active = agents.reduce((s, a) => s + (a.totalActive ?? a.activeWorkstreams.length), 0);
  const openDec = agents.reduce(
    (s, a) => s + (a.totalOpenDecisions ?? a.openDecisionsOwned.length),
    0,
  );
  const stats = [
    { label: "Direct reports", value: total },
    { label: "Personas total", value: allPersonas.length },
    { label: "Operating spec ready", value: specReady, klass: "good" },
    { label: "Spec pending", value: specPending, klass: specPending > 0 ? "warn" : "" },
    { label: "Active workstreams (rolled up)", value: active },
    {
      label: "Open decisions awaiting CEO (rolled up)",
      value: openDec,
      klass: openDec > 0 ? "warn" : "",
    },
  ];
  for (const s of stats) {
    summaryNode.appendChild(
      el("div", { class: `summary-stat ${s.klass ?? ""}` }, [
        el("span", { class: "summary-stat-value" }, String(s.value)),
        el("span", { class: "summary-stat-label" }, s.label),
      ]),
    );
  }
}

function renderWorkstreamItem(ws, opts = {}) {
  const cls = ws.active ? "ws-active" : "ws-done";
  const label = ws.active
    ? `Started ${fmtDate(ws.startedAt)} · due ${ws.due}`
    : `Completed ${fmtDate(ws.completedAt)}`;
  const children = [
    el("div", { class: "ws-head" }, [
      el("span", { class: "ws-id" }, ws.id),
      el("span", { class: "ws-what" }, ws.what),
    ]),
    el("div", { class: "ws-meta muted" }, label),
  ];
  if (ws.outcomeDoc) {
    children.push(
      el("div", { class: "ws-outcome" }, [
        el("span", { class: "muted" }, "→ "),
        el("a", { href: `#`, class: "ws-link", title: ws.outcomeDoc }, ws.outcomeDoc),
      ]),
    );
  }
  if (ws.outcomeNote) {
    children.push(el("div", { class: "ws-note muted" }, clip(ws.outcomeNote, 180)));
  }
  return el("li", { class: `ws-item ${cls}` }, children);
}

function renderDecisionItem(d) {
  return el("li", { class: "dec-item" }, [
    el("span", { class: "dec-id" }, d.id),
    el("span", { class: "dec-title" }, d.title),
    el("span", { class: "muted dec-prompt" }, d.decisionForCEO ?? ""),
  ]);
}

function renderDeliverable(d) {
  return el("li", { class: "del-item" }, [
    el("span", { class: "del-date muted" }, d.date),
    el("span", { class: "del-title" }, d.title),
  ]);
}

function renderSubordinate(sub) {
  const li = el("li", { class: `sub-item ${sub.activeWorkstreams.length > 0 ? "sub-busy" : ""}` });
  const head = el("div", { class: "sub-head" }, [
    el("span", { class: "sub-name" }, sub.name),
    sub.role ? el("span", { class: "sub-role muted" }, sub.role) : null,
    sub.hasOperatingSpec
      ? tag("spec ready", "op-spec-tag op-spec-yes")
      : tag("spec pending", "op-spec-tag op-spec-no"),
  ]);
  li.appendChild(head);

  const stats = [];
  if (sub.activeWorkstreams.length > 0) stats.push(`${sub.activeWorkstreams.length} active`);
  if (sub.recentlyCompletedWorkstreams.length > 0)
    stats.push(`${sub.recentlyCompletedWorkstreams.length} done`);
  if (sub.openDecisionsOwned.length > 0)
    stats.push(`${sub.openDecisionsOwned.length} CEO decisions owed`);
  if (sub.recentDeliverables.length > 0)
    stats.push(
      `${sub.recentDeliverables.length} deliverable${sub.recentDeliverables.length === 1 ? "" : "s"}`,
    );
  if (sub.lastActivityAt) stats.push(`last ${fmtDate(sub.lastActivityAt)}`);
  if (stats.length === 0) stats.push("no tracked activity");
  li.appendChild(el("div", { class: "sub-stats muted small" }, stats.join(" · ")));

  // Inline list of active workstreams + recent deliverables for the subordinate.
  if (sub.activeWorkstreams.length > 0) {
    const ul = el("ul", { class: "sub-ws-list" });
    for (const ws of sub.activeWorkstreams.slice(0, 3)) {
      ul.appendChild(
        el("li", {}, [el("span", { class: "ws-id" }, ws.id), el("span", {}, ` ${ws.what}`)]),
      );
    }
    li.appendChild(ul);
  }
  if (sub.recentlyCompletedWorkstreams.length > 0) {
    const ul = el("ul", { class: "sub-ws-list sub-ws-done" });
    for (const ws of sub.recentlyCompletedWorkstreams.slice(0, 2)) {
      ul.appendChild(
        el("li", {}, [
          el("span", { class: "ws-id" }, ws.id),
          el("span", {}, ` ${ws.what}`),
          el("span", { class: "muted small" }, ` · done ${fmtDate(ws.completedAt)}`),
        ]),
      );
    }
    li.appendChild(ul);
  }
  if (sub.recentDeliverables.length > 0) {
    const ul = el("ul", { class: "sub-del-list" });
    for (const d of sub.recentDeliverables.slice(0, 3)) {
      ul.appendChild(
        el("li", {}, [
          el("span", { class: "del-date muted" }, d.date),
          el("span", {}, ` ${d.title}`),
        ]),
      );
    }
    li.appendChild(ul);
  }
  if (sub.openDecisionsOwned.length > 0) {
    const ul = el("ul", { class: "sub-dec-list" });
    for (const d of sub.openDecisionsOwned) {
      ul.appendChild(
        el("li", {}, [el("span", { class: "dec-id" }, d.id), el("span", {}, ` ${d.title}`)]),
      );
    }
    li.appendChild(ul);
  }

  return li;
}

function renderAgentCard(a) {
  const card = el("article", {
    class: `agent-card ${a.type === "Functional" ? "is-functional" : "is-governance"}`,
  });

  const header = el("header", { class: "agent-head" }, [
    el("div", { class: "agent-id" }, [
      el("h3", { class: "agent-name" }, a.name),
      el("div", { class: "agent-role muted" }, a.role),
    ]),
    el("div", { class: "agent-flags" }, [
      a.hasOperatingSpec
        ? tag("spec ready", "op-spec-tag op-spec-yes")
        : tag("spec pending", "op-spec-tag op-spec-no"),
      tag(a.type, a.type === "Governance" ? "type-tag type-gov" : "type-tag type-fn"),
    ]),
  ]);
  card.appendChild(header);

  card.appendChild(
    el(
      "p",
      { class: "agent-mandate" },
      a.mandate ? clip(a.mandate, 280) : el("em", { class: "muted" }, "(persona file not found)"),
    ),
  );

  // Roll-up totals strip — what the CEO sees at a glance for this seat
  // (own duties + everything under them).
  const totals = el("div", { class: "rollup-totals" });
  const tEntries = [
    {
      label: "active",
      value: a.totalActive ?? a.activeWorkstreams.length,
      klass: (a.totalActive ?? 0) > 0 ? "rollup-busy" : "",
    },
    {
      label: "done recently",
      value: a.totalRecentlyCompleted ?? a.recentlyCompletedWorkstreams.length,
      klass: "rollup-good",
    },
    {
      label: "CEO decisions owed",
      value: a.totalOpenDecisions ?? a.openDecisionsOwned.length,
      klass: (a.totalOpenDecisions ?? 0) > 0 ? "rollup-warn" : "",
    },
    {
      label: "deliverables",
      value: a.totalRecentDeliverables ?? a.recentDeliverables.length,
      klass: "",
    },
  ];
  for (const t of tEntries) {
    totals.appendChild(
      el("span", { class: `rollup-stat ${t.klass}` }, [
        el("span", { class: "rollup-value" }, String(t.value)),
        el("span", { class: "rollup-label" }, t.label),
      ]),
    );
  }
  card.appendChild(totals);

  // Subordinates rolled up under this seat's accountability.
  const subs = a.subordinates ?? [];
  if (subs.length > 0) {
    const subBlock = el("section", { class: "agent-section subs-section" }, [
      el("h4", {}, [
        "Subordinates ",
        el("span", { class: "muted small" }, `(${subs.length} reporting to ${a.name})`),
      ]),
    ]);
    const ul = el("ul", { class: "sub-list" });
    for (const s of subs) ul.appendChild(renderSubordinate(s));
    subBlock.appendChild(ul);
    card.appendChild(subBlock);
  }

  // Own workstreams (active first, then recently completed).
  // Heading is qualified to disambiguate from subordinate rollup above.
  const wsCount = a.activeWorkstreams.length + a.recentlyCompletedWorkstreams.length;
  const wsBlock = el("section", { class: "agent-section" }, [
    el("h4", {}, [
      `${a.name}'s own workstreams `,
      el(
        "span",
        { class: "muted small" },
        `(${a.activeWorkstreams.length} active · ${a.recentlyCompletedWorkstreams.length} recently completed)`,
      ),
    ]),
  ]);
  if (wsCount === 0) {
    wsBlock.appendChild(el("p", { class: "muted small" }, "No workstreams currently attributed."));
  } else {
    const ul = el("ul", { class: "ws-list" });
    for (const ws of a.activeWorkstreams) ul.appendChild(renderWorkstreamItem(ws));
    for (const ws of a.recentlyCompletedWorkstreams) ul.appendChild(renderWorkstreamItem(ws));
    wsBlock.appendChild(ul);
  }
  card.appendChild(wsBlock);

  // Decisions owned (open) — own only; subordinate decisions are listed in the subordinate cards.
  const decBlock = el("section", { class: "agent-section" }, [
    el("h4", {}, [
      `${a.name}'s open decisions awaiting CEO `,
      el("span", { class: "muted small" }, `(${a.openDecisionsOwned.length})`),
    ]),
  ]);
  if (a.openDecisionsOwned.length === 0) {
    decBlock.appendChild(el("p", { class: "muted small" }, "None."));
  } else {
    const ul = el("ul", { class: "dec-list" });
    for (const d of a.openDecisionsOwned) ul.appendChild(renderDecisionItem(d));
    decBlock.appendChild(ul);
  }
  card.appendChild(decBlock);

  // Recent deliverables — own only.
  const delBlock = el("section", { class: "agent-section" }, [
    el("h4", {}, [
      `${a.name}'s recent deliverables `,
      el("span", { class: "muted small" }, `(${a.recentDeliverables.length})`),
    ]),
  ]);
  if (a.recentDeliverables.length === 0) {
    delBlock.appendChild(
      el("p", { class: "muted small" }, "No deliverables in Owner Inbox attributed to this agent."),
    );
  } else {
    const ul = el("ul", { class: "del-list" });
    for (const d of a.recentDeliverables) ul.appendChild(renderDeliverable(d));
    delBlock.appendChild(ul);
  }
  card.appendChild(delBlock);

  // Footer — last activity + persona file link
  const footer = el("footer", { class: "agent-foot muted small" }, [
    a.lastActivityAt ? `Last activity ${fmtDate(a.lastActivityAt)}` : "No tracked activity yet",
    el("span", { class: "agent-foot-sep" }, " · "),
    el("code", {}, a.personaPath),
  ]);
  card.appendChild(footer);

  return card;
}

function renderAgents(agents) {
  const grid = $("agentsGrid");
  grid.innerHTML = "";
  // Sort: governance first by recent activity desc, then functional.
  const sorted = [...agents].sort((a, b) => {
    if (a.type !== b.type) return a.type === "Governance" ? -1 : 1;
    const da = a.lastActivityAt ?? "";
    const db = b.lastActivityAt ?? "";
    if (da !== db) return da < db ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  for (const a of sorted) grid.appendChild(renderAgentCard(a));
  $("agentsSub").textContent = `${agents.length} agents`;
}

async function load() {
  const live = $("liveDot");
  const stamp = $("lastUpdated");
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const state = await r.json();
    const agents = state.agents ?? [];
    renderSummary(agents);
    renderAgents(agents);
    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(state.asOf)}`;
  } catch (e) {
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

load();
setInterval(load, 30_000);
