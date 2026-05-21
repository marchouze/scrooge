// dashboard/public/decisions.js
//
// Decisions register page — all authorities, filterable.
// Fetches /api/decisions-register (falling back to /api/state).
//
// Author: Atlas (Core banking platform architect)
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN (all 4 slices)

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

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

// ---------------------------------------------------------------------------
// View state persistence — so a click into a decision detail + browser-back
// restores the same filters / scroll position the user left from.

const VIEW_STATE_KEY = "decisions-register-view-state";

function saveViewState() {
  try {
    const state = {
      status: getStatusFilter(),
      query: getSearchText(),
      authAll: $("authAll")?.checked ?? true,
      selectedAuthorities: [...selectedAuthorities],
      scrollY: window.scrollY,
    };
    sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable — non-fatal.
  }
}

function loadViewState() {
  try {
    const raw = sessionStorage.getItem(VIEW_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applyViewState(state) {
  if (!state) return;
  const radio = document.querySelector(`input[name="statusFilter"][value="${state.status}"]`);
  if (radio) radio.checked = true;
  const search = $("searchInput");
  if (search && typeof state.query === "string") search.value = state.query;
  const authAll = $("authAll");
  if (authAll && typeof state.authAll === "boolean") authAll.checked = state.authAll;
  if (Array.isArray(state.selectedAuthorities)) {
    const want = new Set(state.selectedAuthorities);
    for (const cb of document.querySelectorAll("[data-auth]")) {
      cb.checked = want.has(cb.dataset.auth);
    }
    selectedAuthorities = want;
  }
}

// ---------------------------------------------------------------------------
// Data model

/** @type {{ open: any[], resolved: any[], asOf: string } | null} */
let registerData = null;
/** @type {Set<string>} */
let selectedAuthorities = new Set();
let allAuthorities = [];

// ---------------------------------------------------------------------------
// Fetch

async function fetchRegister() {
  // Primary: /api/decisions-register
  try {
    const r = await fetch("/api/decisions-register");
    if (r.ok) {
      const data = await r.json();
      return { open: data.open ?? [], resolved: data.resolved ?? [], asOf: data.asOf };
    }
  } catch (_) {
    // fall through
  }
  // Fallback: /api/state
  const r2 = await fetch("/api/state");
  if (!r2.ok) throw new Error("Failed to fetch decisions");
  const state = await r2.json();
  const open = (state.decisionsOpen ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    authority: d.authority ?? "CEO",
    authorityRef: d.owner ?? "",
    category: d.category ?? "",
    phase: "requested",
    requestedAt: undefined,
  }));
  const resolved = (state.decisionsResolved ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    authority: d.authority ?? "CEO",
    authorityRef: "",
    category: "",
    phase: d.action ?? "approved",
    actionedAt: d.actionedAt,
    outcome: d.outcome,
  }));
  return { open, resolved, asOf: state.asOf };
}

// ---------------------------------------------------------------------------
// Filter helpers

function getStatusFilter() {
  const radio = document.querySelector('input[name="statusFilter"]:checked');
  return radio ? radio.value : "all";
}

function getSearchText() {
  return ($("searchInput")?.value ?? "").toLowerCase().trim();
}

function matchesSearch(row, query) {
  if (!query) return true;
  return (
    (row.id ?? "").toLowerCase().includes(query) || (row.title ?? "").toLowerCase().includes(query)
  );
}

// ---------------------------------------------------------------------------
// Render

function phasePill(phase) {
  const cls =
    phase === "approved"
      ? "pill stat-decided"
      : phase === "rejected" || phase === "withdrawn"
        ? "pill stat-delegated"
        : phase === "requested"
          ? "pill stat-open"
          : "pill";
  return `<span class="${cls}">${esc(phase)}</span>`;
}

function renderTable(rows, type) {
  if (!rows.length) {
    return el("p", { class: "muted", text: `No ${type} decisions match the current filters.` });
  }

  const thead = el("thead", {}, [
    el("tr", {}, [
      el("th", { text: "Decision ID" }),
      el("th", { text: "Title" }),
      el("th", { text: "Authority" }),
      el("th", { text: "Phase" }),
      el("th", { text: "Category" }),
      el("th", { text: type === "resolved" ? "Actioned" : "Requested" }),
    ]),
  ]);

  const tbody = el("tbody");
  for (const row of rows) {
    const dateStr =
      type === "resolved" ? fmtDate(row.actionedAt) : fmtDate(row.requestedAt ?? row.openedAt);
    const tr = el("tr");
    tr.innerHTML = `
      <td><a href="/decisions/${esc(row.id)}" class="decision-link">${esc(row.id)}</a></td>
      <td>${esc(row.title)}</td>
      <td><span class="pill">${esc(row.authority ?? "—")}</span></td>
      <td>${phasePill(row.phase)}</td>
      <td class="muted">${esc(row.category ?? "—")}</td>
      <td class="muted">${dateStr}</td>
    `;
    tbody.appendChild(tr);
  }

  const table = el("table", { class: "decisions-table" });
  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

function applyFilters() {
  if (!registerData) return;

  const status = getStatusFilter();
  const query = getSearchText();
  const authAllChecked = $("authAll")?.checked ?? true;

  let open = registerData.open;
  let resolved = registerData.resolved;

  // Authority filter
  if (!authAllChecked && selectedAuthorities.size > 0) {
    open = open.filter((r) => selectedAuthorities.has(r.authority ?? "CEO"));
    resolved = resolved.filter((r) => selectedAuthorities.has(r.authority ?? "CEO"));
  }

  // Search
  open = open.filter((r) => matchesSearch(r, query));
  resolved = resolved.filter((r) => matchesSearch(r, query));

  const content = $("decisionsContent");
  if (!content) return;
  content.innerHTML = "";

  const showOpen = status === "all" || status === "open";
  const showResolved = status === "all" || status === "resolved";

  if (showOpen) {
    const section = el("section", { style: "margin-bottom: var(--space-6);" });
    const h2 = el("h2", { style: "margin-bottom: var(--space-2);" });
    h2.innerHTML = `Open <span class="pill stat-open">${open.length}</span>`;
    section.appendChild(h2);
    section.appendChild(renderTable(open, "open"));
    content.appendChild(section);
  }

  if (showResolved) {
    const section = el("section");
    const h2 = el("h2", { style: "margin-bottom: var(--space-2);" });
    h2.innerHTML = `Resolved <span class="pill stat-decided">${resolved.length}</span>`;
    section.appendChild(h2);
    section.appendChild(renderTable(resolved, "resolved"));
    content.appendChild(section);
  }

  // Update last-updated chip
  const lu = $("lastUpdated");
  if (lu && registerData.asOf) {
    lu.textContent = `as of ${registerData.asOf.slice(0, 16).replace("T", " ")} UTC`;
  }
}

// ---------------------------------------------------------------------------
// Authority filter setup

function buildAuthorityFilter(open, resolved) {
  const authSet = new Set();
  for (const r of open) if (r.authority) authSet.add(r.authority);
  for (const r of resolved) if (r.authority) authSet.add(r.authority);
  allAuthorities = [...authSet].sort();
  selectedAuthorities = new Set(allAuthorities);

  const container = $("authorityCheckboxes");
  if (!container) return;
  container.innerHTML = "";

  for (const auth of allAuthorities) {
    const lbl = el("label", { class: "filter-radio" });
    const cb = el("input");
    cb.type = "checkbox";
    cb.dataset.auth = auth;
    cb.checked = true;
    cb.addEventListener("change", onAuthorityChange);
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(` ${auth}`));
    container.appendChild(lbl);
  }
}

function onAuthorityChange() {
  const checkboxes = document.querySelectorAll("[data-auth]");
  selectedAuthorities = new Set();
  for (const cb of checkboxes) {
    if (cb.checked) selectedAuthorities.add(cb.dataset.auth);
  }
  // If all selected or none selected → treat as "all"
  const authAll = $("authAll");
  if (authAll) {
    authAll.checked =
      selectedAuthorities.size === 0 || selectedAuthorities.size === allAuthorities.length;
  }
  applyFilters();
}

// ---------------------------------------------------------------------------
// Init + polling

async function load() {
  try {
    registerData = await fetchRegister();
    buildAuthorityFilter(registerData.open, registerData.resolved);
    // Restore filters from sessionStorage if the user is returning from a
    // detail drill-down. Must run after buildAuthorityFilter created the
    // authority checkboxes; scroll restoration runs after the table renders.
    const saved = loadViewState();
    applyViewState(saved);
    applyFilters();
    if (saved && typeof saved.scrollY === "number") {
      // Let the table layout settle before restoring scroll.
      requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
    }
  } catch (err) {
    const content = $("decisionsContent");
    if (content) {
      content.innerHTML = `<p class="error">Failed to load decisions: ${esc(String(err))}</p>`;
    }
    const lu = $("lastUpdated");
    if (lu) lu.textContent = "error";
  }
}

// Wire filter controls
document.addEventListener("DOMContentLoaded", () => {
  for (const r of document.querySelectorAll('input[name="statusFilter"]')) {
    r.addEventListener("change", applyFilters);
  }

  $("searchInput")?.addEventListener("input", applyFilters);

  // Persist view state any time the user clicks into a decision detail,
  // so the back-navigation can restore the same filters + scroll position.
  $("decisionsContent")?.addEventListener("click", (e) => {
    const a = e.target.closest("a.decision-link");
    if (a) saveViewState();
  });

  $("authAll")?.addEventListener("change", (e) => {
    const checkboxes = document.querySelectorAll("[data-auth]");
    for (const cb of checkboxes) {
      cb.checked = e.target.checked;
    }
    if (e.target.checked) {
      selectedAuthorities = new Set(allAuthorities);
    } else {
      selectedAuthorities = new Set();
    }
    applyFilters();
  });
});

// Auto-refresh via shared refresh controls
if (typeof window.registerPagePoll === "function") {
  window.registerPagePoll(load, 30_000);
} else {
  setInterval(load, 30_000);
}

load();
