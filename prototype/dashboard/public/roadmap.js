// roadmap.js — Build Status page.
//
// Renders the complete build-phase roadmap from a single live endpoint,
// /api/v2/build-status. Every element's status is derived server-side from the
// event store and engineering registries (Workstreams register, Decisions
// register, V1-removal ratchet + live registry counts, recon-gate inventory).
//
// This page holds NO hardcoded roadmap data — it previously carried a ~640-line
// `WORKSTREAMS` array that drifted from reality; that is now gone. The page is
// non-static: it re-fetches on an interval via window.registerPagePoll.
//
// Author: Anya (Data / analytics engineer, engineering), coordinated by
// Scrooge (Chief of Staff).

(() => {
  const $ = (id) => document.getElementById(id);

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtTs(iso) {
    if (!iso || typeof iso !== "string") return "—";
    return iso.replace("T", " ").replace(/\.\d+Z$/, "Z");
  }

  // ── Phase timeline ──────────────────────────────────────────────────────
  function renderPhases(phases) {
    const host = $("bs-phases");
    host.innerHTML = "";
    const labelFor = { current: "Current", gate: "Gate", target: "Target" };
    phases.forEach((p, i) => {
      if (i > 0) {
        const arrow = document.createElement("div");
        arrow.className = "rm-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "→";
        host.appendChild(arrow);
      }
      const div = document.createElement("div");
      div.className = `rm-phase ${esc(p.phaseKind)}`;
      div.setAttribute("role", "listitem");
      div.innerHTML = `<div class="rm-phase-label">${esc(labelFor[p.phaseKind] ?? p.phaseKind)}</div>
        <div class="rm-phase-title">${esc(p.title)}</div>
        <div class="rm-phase-sub">${esc(p.detail)}</div>`;
      host.appendChild(div);
    });
  }

  // ── Stat cards ──────────────────────────────────────────────────────────
  function statCard(label, value, tone, sub) {
    return `<div class="rm-stat">
      <div class="rm-stat-label">${esc(label)}</div>
      <div class="rm-stat-value" data-tone="${esc(tone)}">${esc(value)}</div>
      <div class="rm-stat-sub">${esc(sub)}</div>
    </div>`;
  }

  function renderStats(d) {
    const v1 = d.v1Removal;
    const ws = d.workstreams;
    $("bs-stats").innerHTML = [
      statCard(
        "V1 retired",
        `${v1.pctRetired}%`,
        "green",
        `${v1.originalBaseline - v1.v1Only} of ${v1.originalBaseline} types`,
      ),
      statCard(
        "v1-only remaining",
        v1.v1Only,
        v1.v1Only > 0 ? "amber" : "green",
        `baseline ${v1.currentBaseline}`,
      ),
      statCard("Workstreams active", ws.active, "green", `${ws.total} total`),
      statCard(
        "Workstreams blocked",
        ws.blocked,
        ws.blocked > 0 ? "red" : "muted",
        "need attention",
      ),
      statCard(
        "Decisions open",
        d.decisions.open,
        d.decisions.open > 0 ? "amber" : "green",
        `${d.decisions.resolved} resolved`,
      ),
      statCard("Recon gates", d.reconGates.total, "muted", "enforced in CI"),
    ].join("");
  }

  // ── V1 removal ──────────────────────────────────────────────────────────
  function renderV1(v1, gates) {
    const host = $("bs-v1");
    const chips = `<div class="rm-v2-chips">
      <span class="rm-v2-chip v1"><b>${esc(v1.v1Only)}</b> v1-only</span>
      <span class="rm-v2-chip par"><b>${esc(v1.v2Parallel)}</b> v2-parallel</span>
      <span class="rm-v2-chip repl"><b>${esc(v1.v2Replaced)}</b> v2-replaced</span>
      <span class="rm-v2-chip"><b>${esc(v1.totalTypes)}</b> total types</span>
    </div>`;
    const gatePills = gates.v1RemovalEnforcing.length
      ? `<div class="rm-gate-pills">${gates.v1RemovalEnforcing
          .map((g) => `<span class="rm-gate-pill">${esc(g)}</span>`)
          .join("")}</div>`
      : "";
    const pct = Math.max(0, Math.min(100, v1.pctRetired));
    host.innerHTML = `<div class="rm-progress-track" role="progressbar" aria-valuenow="${esc(v1.pctRetired)}" aria-valuemin="0" aria-valuemax="100">
        <div class="rm-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="rm-stat-sub">${esc(v1.pctRetired)}% of the ${esc(v1.originalBaseline)}-type baseline retired (committed baseline ${esc(v1.currentBaseline)} as of ${esc(v1.baselineAsOf)}).</div>
      ${chips}
      ${gatePills}`;
  }

  // ── RMS phases ──────────────────────────────────────────────────────────
  function renderRms(phases) {
    $("bs-rms").innerHTML = phases
      .map(
        (p) => `<li>
          <div class="rm-phase-main">
            <div class="rm-phase-name">${esc(p.title)}</div>
            <div class="rm-phase-summary">${esc(p.summary)}</div>
            <div class="rm-phase-ref">${esc(p.decisionId)}</div>
          </div>
          <span class="rm-badge ${esc(p.status)}">${esc(p.status.replace("-", " "))}</span>
        </li>`,
      )
      .join("");
  }

  // ── Workstreams (with status filter) ──────────────────────────────────────
  let wsRows = [];
  let wsFilter = "all";

  function renderWsFilter(counts) {
    const host = $("bs-ws-filter");
    const opts = [
      ["all", `All (${counts.total})`],
      ["active", `Active (${counts.active})`],
      ["blocked", `Blocked (${counts.blocked})`],
      ["complete", `Complete (${counts.complete})`],
    ];
    host.innerHTML = opts
      .map(
        ([key, label]) =>
          `<button class="rm-filter-btn ${key === wsFilter ? "active" : ""}" data-filter="${esc(key)}">${esc(label)}</button>`,
      )
      .join("");
    for (const btn of host.querySelectorAll("button[data-filter]")) {
      btn.addEventListener("click", () => {
        wsFilter = btn.getAttribute("data-filter");
        renderWsFilter(counts);
        renderWsBody();
      });
    }
  }

  function renderWsBody() {
    const body = $("bs-ws-body");
    const rows = wsFilter === "all" ? wsRows : wsRows.filter((r) => r.status === wsFilter);
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="rm-empty">No workstreams in this view.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map(
        (r) => `<tr>
          <td><div>${esc(r.title)}</div><code>${esc(r.workstreamId)}</code></td>
          <td><span class="rm-badge ${esc(r.status)}">${esc(r.status)}</span></td>
          <td class="rm-num">${esc(r.briefCount)}</td>
          <td class="rm-num">${esc(r.runCount)}</td>
          <td class="rm-num">${esc(r.decisionCount)}</td>
          <td>${esc(fmtTs(r.lastActivityAt))}</td>
        </tr>`,
      )
      .join("");
  }

  function renderWorkstreams(ws) {
    wsRows = ws.rows || [];
    renderWsFilter(ws);
    renderWsBody();
  }

  // ── Open decision queue ───────────────────────────────────────────────────
  function renderQueue(decisions) {
    const body = $("bs-queue-body");
    const rows = decisions.openRows || [];
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4" class="rm-empty">No open decisions — the queue is clear.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map(
        (d) => `<tr>
          <td><code>${esc(d.id)}</code></td>
          <td>${esc(d.title)}</td>
          <td>${esc(d.owner)}</td>
          <td>${esc(d.authority)}</td>
        </tr>`,
      )
      .join("");
  }

  // ── Fetch + render ────────────────────────────────────────────────────────
  function showError(msg) {
    const el = $("bs-error");
    el.style.display = "block";
    el.textContent = `Could not load build status: ${msg}`;
  }

  async function refreshAll() {
    try {
      const res = await fetch("/api/v2/build-status");
      if (!res.ok) {
        showError(`HTTP ${res.status}`);
        return;
      }
      const d = await res.json();
      $("bs-error").style.display = "none";
      $("bs-generated").textContent = `· as of ${fmtTs(d.generatedAt)}`;
      renderPhases(d.buildPhases);
      renderStats(d);
      renderV1(d.v1Removal, d.reconGates);
      renderRms(d.rmsPhases);
      renderWorkstreams(d.workstreams);
      renderQueue(d.decisions);
    } catch (e) {
      showError(e?.message ? e.message : String(e));
    }
  }

  refreshAll();
  // Live refresh: prefer the shell-managed poll (pauses when hidden, integrates
  // with the refresh-controls UI); fall back to a plain interval when the shell
  // helper is absent. Either way the operator view does not go stale.
  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(refreshAll, 30_000);
  } else {
    setInterval(refreshAll, 30_000);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshAll();
  });
})();
