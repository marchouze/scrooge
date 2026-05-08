// dashboard/public/escalations.js
//
// Escalation inbox view (A3.2 — read-only). Reads /api/escalations and
// renders a list of EscalationView grouped by terminal vs in-flight, with a
// summary strip up top. Each row links to /decisions/<escalationId> for the
// drill-down view.
//
// Author: Atlas + Anya

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

function fmtTimestamp(iso) {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

function statusTag(view) {
  // Return a list of pills: status + overdue overlay + sealed reason if set.
  const out = [];
  const cls =
    view.status === "decided"
      ? "stat-decided"
      : view.status === "delegated"
        ? "stat-delegated"
        : view.status === "acknowledged"
          ? "stat-acknowledged"
          : "stat-open";
  out.push(el("span", { class: `pill esc-stat ${cls}` }, view.status));
  if (view.overdue && view.status !== "decided") {
    out.push(el("span", { class: "pill esc-overdue" }, "overdue"));
  }
  if (view.sealedReason) {
    out.push(el("span", { class: "pill esc-sealed" }, `sealed · ${view.sealedReason}`));
  }
  const sevCls =
    view.severity === "blocking"
      ? "esc-sev-blocking"
      : view.severity === "high"
        ? "esc-sev-high"
        : view.severity === "medium"
          ? "esc-sev-medium"
          : "esc-sev-low";
  out.push(el("span", { class: `pill ${sevCls}` }, view.severity));
  return out;
}

function renderOptions(options) {
  if (!options || options.length === 0) {
    return el("p", { class: "muted small" }, "No options enumerated.");
  }
  const ul = el("ul", { class: "esc-options" });
  for (const o of options) ul.appendChild(el("li", {}, o));
  return ul;
}

function renderEscalation(view) {
  const wrap = el("article", {
    class: `esc-card status-${view.status}${view.overdue ? " is-overdue" : ""}`,
  });
  const head = el("header", { class: "esc-head" }, [
    el("div", { class: "esc-head-top" }, [
      el(
        "a",
        {
          class: "esc-id",
          href: `/decisions/${encodeURIComponent(view.escalationId)}`,
        },
        view.escalationId,
      ),
      el("div", { class: "esc-tags" }, statusTag(view)),
    ]),
    el("h3", { class: "esc-question" }, view.question),
  ]);
  wrap.appendChild(head);

  const meta = el("div", { class: "esc-meta" });
  const metaRow = (label, value) => {
    if (value == null || value === "") return null;
    return el("div", { class: "esc-meta-row" }, [el("b", {}, label), el("span", {}, value)]);
  };
  const rows = [
    metaRow("Raised by", view.raisedBy),
    metaRow("Raised at", fmtTimestamp(view.raisedAt)),
    metaRow("Routed to", view.routedTo),
    metaRow("Current responsible", view.currentResponsible),
    view.deadline ? metaRow("Deadline", fmtTimestamp(view.deadline)) : null,
    metaRow("Blocked by", view.blockedBy),
    view.acknowledgementCount > 0
      ? metaRow("Acknowledgements", String(view.acknowledgementCount))
      : null,
    view.delegationCount > 0 ? metaRow("Delegations", String(view.delegationCount)) : null,
  ];
  for (const r of rows) if (r) meta.appendChild(r);
  wrap.appendChild(meta);

  const optWrap = el("div", { class: "esc-options-wrap" }, [
    el("h4", {}, "Options considered"),
    renderOptions(view.options),
  ]);
  wrap.appendChild(optWrap);

  const foot = el("footer", { class: "esc-foot" }, [
    el(
      "a",
      {
        class: "btn-secondary",
        href: `/decisions/${encodeURIComponent(view.escalationId)}`,
      },
      "Open drill-down →",
    ),
    view.hasResolvingDecision
      ? el("span", { class: "pill stat-decided" }, "decision recorded")
      : null,
  ]);
  wrap.appendChild(foot);
  return wrap;
}

function renderSummary(views) {
  const summaryNode = $("escalationsSummary");
  summaryNode.innerHTML = "";
  const total = views.length;
  const open = views.filter((v) => v.status === "open").length;
  const ack = views.filter((v) => v.status === "acknowledged").length;
  const delegated = views.filter((v) => v.status === "delegated").length;
  const decided = views.filter((v) => v.status === "decided").length;
  const overdue = views.filter((v) => v.overdue && v.status !== "decided").length;
  const stats = [
    { label: "Total", value: total },
    { label: "Open", value: open, klass: open > 0 ? "warn" : "" },
    { label: "Acknowledged", value: ack },
    { label: "Delegated", value: delegated },
    { label: "Decided", value: decided, klass: "good" },
    { label: "Overdue", value: overdue, klass: overdue > 0 ? "warn" : "" },
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

function renderLists(views) {
  const openNode = $("escalationsOpen");
  const decidedNode = $("escalationsDecided");
  openNode.innerHTML = "";
  decidedNode.innerHTML = "";

  const openViews = views.filter((v) => v.status !== "decided");
  const decidedViews = views.filter((v) => v.status === "decided");

  if (openViews.length === 0) {
    openNode.appendChild(el("p", { class: "muted" }, "No open escalations. The fleet is settled."));
  } else {
    for (const v of openViews) openNode.appendChild(renderEscalation(v));
  }
  if (decidedViews.length === 0) {
    decidedNode.appendChild(el("p", { class: "muted" }, "No decided escalations on record yet."));
  } else {
    for (const v of decidedViews) decidedNode.appendChild(renderEscalation(v));
  }
  $("openSub").textContent = `${openViews.length} item${openViews.length === 1 ? "" : "s"}`;
  $("decidedSub").textContent =
    `${decidedViews.length} item${decidedViews.length === 1 ? "" : "s"}`;
  $("escalationsSub").textContent = `${views.length} total`;
}

function renderStrategyBanner(state) {
  const banner = $("strategyBanner");
  if (!banner) return;
  const phase = state?.bank?.operatingPosture ?? "—";
  const openCount = (state?.decisionsOpen ?? []).length;
  const agentCount = (state?.agents ?? []).length;
  banner.innerHTML = "";
  banner.appendChild(el("span", { class: "banner-phase" }, `Phase: ${phase}`));
  banner.appendChild(el("span", { class: "banner-sep" }, " · "));
  banner.appendChild(el("span", {}, `${openCount} CEO decision${openCount === 1 ? "" : "s"} open`));
  banner.appendChild(el("span", { class: "banner-sep" }, " · "));
  banner.appendChild(el("span", {}, `${agentCount} agent${agentCount === 1 ? "" : "s"} reporting`));
}

async function load() {
  const live = $("liveDot");
  const stamp = $("lastUpdated");
  try {
    const [escR, stateR] = await Promise.all([
      fetch("/api/escalations", { cache: "no-store" }),
      fetch("/api/state", { cache: "no-store" }),
    ]);
    if (!escR.ok) throw new Error(`HTTP ${escR.status}`);
    const escData = await escR.json();
    const state = stateR.ok ? await stateR.json() : null;
    const views = escData.escalations ?? [];
    renderStrategyBanner(state);
    renderSummary(views);
    renderLists(views);
    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(escData.asOf)}`;
  } catch (e) {
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

load();
setInterval(load, 30_000);
