// dashboard/public/activity.js
//
// Activity timeline. Reads /api/state and renders the ownerInboxFeed as
// a reverse-chronological feed grouped by date, with agent badges.
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

// Filename pattern: YYYY-MM-DD_<agent>_<slug>.md or YYYY-MM-DD_<slug>.md.
// Returns the agent name (capitalised) if present, otherwise null.
function inferAgent(filename) {
  const m = filename.match(/^\d{4}-\d{2}-\d{2}_([a-z][a-z0-9-]*)_(.+)\.md$/i);
  if (!m) return null;
  const candidate = (m[1] ?? "").toLowerCase();
  // Whitelist of known agent name slugs to avoid mis-matching `2026-05-06_ceo-decision_*` etc.
  const KNOWN_AGENTS = new Set([
    "vera",
    "atlas",
    "anya",
    "scrooge",
    "owen",
    "mira",
    "senna",
    "saskia",
    "iris",
    "rashida",
    "thandiwe",
    "helena",
    "camille",
    "devon",
    "eitan",
    "imani",
    "kai",
    "rohan",
    "sade",
    "tomas",
    "yael",
    "zara",
    "niko",
    "bea",
    "ravi",
    "nolan",
    "pax",
  ]);
  if (!KNOWN_AGENTS.has(candidate)) return null;
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
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

function renderTimeline(feed) {
  const root = $("activityTimeline");
  root.innerHTML = "";

  // Group by date, descending.
  const byDate = new Map();
  for (const item of feed) {
    const date = item.date ?? "—";
    const arr = byDate.get(date) ?? [];
    arr.push(item);
    byDate.set(date, arr);
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));

  if (dates.length === 0) {
    root.appendChild(el("p", { class: "muted" }, "No deliverables in Owner Inbox."));
    return;
  }

  for (const date of dates) {
    const day = el("section", { class: "timeline-day" });
    day.appendChild(el("h2", { class: "timeline-date" }, date));

    const list = el("ul", { class: "timeline-list" });
    const items = byDate.get(date) ?? [];
    // Sort within a date by filename so order is deterministic.
    items.sort((a, b) => (a.filename < b.filename ? -1 : 1));
    for (const item of items) {
      const li = el("li", { class: "timeline-item" });
      const agent = inferAgent(item.filename);

      const header = el("div", { class: "timeline-head" });
      if (agent) {
        header.appendChild(
          el("span", { class: `timeline-agent agent-${agent.toLowerCase()}` }, agent),
        );
      } else {
        header.appendChild(el("span", { class: "timeline-agent agent-human" }, "human"));
      }
      header.appendChild(el("span", { class: "timeline-title" }, item.title));
      if (item.decisionRequired) {
        header.appendChild(el("span", { class: "pill timeline-decision" }, "decision-required"));
      }
      li.appendChild(header);

      if (item.summary) {
        li.appendChild(el("p", { class: "timeline-summary" }, item.summary));
      }

      const foot = el("div", { class: "timeline-foot muted small" });
      foot.appendChild(el("code", {}, item.path));
      li.appendChild(foot);

      list.appendChild(li);
    }
    day.appendChild(list);
    root.appendChild(day);
  }

  $("activitySub").textContent =
    `${feed.length} item${feed.length === 1 ? "" : "s"} across ${dates.length} day${dates.length === 1 ? "" : "s"}`;
}

async function load() {
  const live = $("liveDot");
  const stamp = $("lastUpdated");
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const state = await r.json();
    const feed = state.ownerInboxFeed ?? [];
    renderStrategyBanner(state);
    renderTimeline(feed);
    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(state.asOf)}`;
  } catch (e) {
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

load();
setInterval(load, 30_000);
