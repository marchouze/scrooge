// dashboard/public/fleet.js
//
// Fleet status view (A3.2 — read-only). Reads /api/fleet and renders one row
// per registered handler. Sortable columns; staleness shading inherits from
// the cadence map.
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

function fmtRelative(iso, asOfIso) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = new Date(asOfIso).getTime();
  const ms = now - then;
  const _sign = ms >= 0 ? "" : "in ";
  const abs = Math.abs(ms);
  const h = Math.round(abs / 3600 / 1000);
  if (h < 1) return ms >= 0 ? "just now" : "in <1h";
  if (h < 24) return ms >= 0 ? `${h}h ago` : `in ${h}h`;
  const d = Math.round(h / 24);
  return ms >= 0 ? `${d}d ago` : `in ${d}d`;
}

function rowStaleness(row, asOfIso) {
  if (row.kind !== "scheduled" || !row.cadenceHours) return "fleet-row-neutral";
  if (!row.lastActivityAt) return "fleet-row-red";
  const ageH =
    (new Date(asOfIso).getTime() - new Date(row.lastActivityAt).getTime()) / 1000 / 60 / 60;
  if (ageH < 0) return "fleet-row-neutral";
  if (ageH <= row.cadenceHours) return "fleet-row-green";
  if (ageH <= row.cadenceHours * 1.5) return "fleet-row-amber";
  return "fleet-row-red";
}

function renderSummary(rows, asOf) {
  const wrap = $("fleetSummary");
  wrap.innerHTML = "";
  const total = rows.length;
  const pending = rows.reduce((s, r) => s + r.pendingEscalationCount, 0);
  const inFlight = rows.reduce((s, r) => s + r.inFlightRuns, 0);
  const recent = rows.reduce((s, r) => s + r.recentDecisionsCount, 0);
  const stale = rows.filter((r) => rowStaleness(r, asOf) === "fleet-row-red").length;
  const stats = [
    { label: "Handlers", value: total },
    { label: "Pending escalations", value: pending, klass: pending > 0 ? "warn" : "" },
    { label: "In-flight runs", value: inFlight },
    { label: "Recent decisions", value: recent, klass: "good" },
    { label: "Stale (red)", value: stale, klass: stale > 0 ? "warn" : "" },
  ];
  for (const s of stats) {
    wrap.appendChild(
      el("div", { class: `summary-stat ${s.klass ?? ""}` }, [
        el("span", { class: "summary-stat-value" }, String(s.value)),
        el("span", { class: "summary-stat-label" }, s.label),
      ]),
    );
  }
}

function renderTable(rows, asOf) {
  const wrap = $("fleetTableWrap");
  wrap.innerHTML = "";
  if (rows.length === 0) {
    wrap.appendChild(el("p", { class: "muted" }, "No handlers registered."));
    return;
  }
  const table = el("table", { class: "fleet-table" });
  const thead = el("thead", {}, [
    el("tr", {}, [
      el("th", {}, "Agent"),
      el("th", {}, "Trigger"),
      el("th", {}, "Kind"),
      el("th", {}, "Cadence"),
      el("th", {}, "Last run"),
      el("th", {}, "Next run"),
      el("th", {}, "In-flight"),
      el("th", {}, "Pending escalations"),
      el("th", {}, "Recent decisions"),
    ]),
  ]);
  table.appendChild(thead);
  const tbody = el("tbody", {});
  for (const row of rows) {
    const cls = rowStaleness(row, asOf);
    const cadenceLabel = row.cadenceHours
      ? row.cadenceHours >= 24
        ? `${Math.round(row.cadenceHours / 24)}d`
        : `${row.cadenceHours}h`
      : "—";
    const subscribesLabel =
      row.subscribesTo && row.subscribesTo.length > 0 ? row.subscribesTo.join(", ") : null;
    tbody.appendChild(
      el("tr", { class: `fleet-row ${cls}` }, [
        el("td", { class: "fleet-agent" }, [
          el("span", { class: "fleet-agent-name" }, row.agent),
          el("br"),
          el("span", { class: "muted small mono" }, row.agentUrn),
        ]),
        el("td", { class: "fleet-trigger" }, [
          el("span", { class: "mono" }, row.trigger),
          subscribesLabel
            ? el("div", { class: "muted small" }, `subscribes: ${subscribesLabel}`)
            : null,
        ]),
        el("td", {}, [el("span", { class: `pill kind-${row.kind}` }, row.kind)]),
        el("td", {}, cadenceLabel),
        el("td", {}, [
          row.lastActivityAt
            ? el("span", {}, [
                el("div", {}, fmtDate(row.lastActivityAt)),
                el("div", { class: "muted small" }, fmtRelative(row.lastActivityAt, asOf)),
              ])
            : el("span", { class: "muted" }, "no activity"),
        ]),
        el("td", {}, [
          row.nextRunAt
            ? el("span", {}, [
                el("div", {}, fmtDate(row.nextRunAt)),
                el("div", { class: "muted small" }, fmtRelative(row.nextRunAt, asOf)),
              ])
            : el("span", { class: "muted" }, "—"),
        ]),
        el("td", { class: "fleet-numeric" }, String(row.inFlightRuns)),
        el(
          "td",
          {
            class: `fleet-numeric ${row.pendingEscalationCount > 0 ? "fleet-warn" : ""}`,
          },
          String(row.pendingEscalationCount),
        ),
        el("td", { class: "fleet-numeric" }, String(row.recentDecisionsCount)),
      ]),
    );
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  $("fleetSub").textContent = `${rows.length} handler${rows.length === 1 ? "" : "s"}`;
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
    const [fleetR, stateR] = await Promise.all([
      fetch("/api/fleet", { cache: "no-store" }),
      fetch("/api/state", { cache: "no-store" }),
    ]);
    if (!fleetR.ok) throw new Error(`HTTP ${fleetR.status}`);
    const fleetData = await fleetR.json();
    const state = stateR.ok ? await stateR.json() : null;
    const rows = fleetData.fleet ?? [];
    renderStrategyBanner(state);
    renderSummary(rows, fleetData.asOf);
    renderTable(rows, fleetData.asOf);
    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(fleetData.asOf)}`;
  } catch (e) {
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

load();
setInterval(load, 30_000);
