// dashboard/public/_refresh-controls.js
//
// Cross-page periodic-refresh controls. Loaded by every dashboard page.
//
// Provides three pieces of behaviour:
//
//  1. `window.registerPagePoll(fn, intervalMs)` — pages call this instead of
//     `setInterval(fn, ms)`. The shared module owns the timer so that all
//     pages share consistent visibility-pause behaviour.
//
//  2. Tab-visibility pausing. While the tab is hidden, registered polls do
//     not tick (saves CPU on background tabs and avoids burning bandwidth
//     against /api/state for tabs the operator isn't looking at). When the
//     tab becomes visible again, every registered fn fires immediately and
//     the interval resumes.
//
//  3. Manual "Refresh" button auto-injected into the topbar `.meta` area.
//     On click, POSTs to /api/refresh (forces server-side re-derivation
//     even if the 30s server poll hasn't fired yet) then calls every
//     registered fn so the page re-renders.
//
// Memory rule: feedback_dashboards_live_reports_as_of.md (2026-05-09).
// Dashboards = live = periodic re-derivation + user-trigger refresh.
//
// Author: Anya (Data / analytics engineer)

(() => {
  /** @type {Array<{ fn: () => unknown, intervalMs: number, timer: number | null }>} */
  const registrations = [];

  function clearTimer(reg) {
    if (reg.timer !== null) {
      window.clearInterval(reg.timer);
      reg.timer = null;
    }
  }

  function startTimer(reg) {
    clearTimer(reg);
    reg.timer = window.setInterval(() => {
      try {
        reg.fn();
      } catch (e) {
        console.warn("registered poll threw", e);
      }
    }, reg.intervalMs);
  }

  function pauseAll() {
    for (const reg of registrations) clearTimer(reg);
  }

  function resumeAll() {
    for (const reg of registrations) {
      // Immediate fetch on resume so the operator sees fresh data straight
      // away rather than waiting up to `intervalMs` for the next tick.
      try {
        reg.fn();
      } catch (e) {
        console.warn("registered poll threw on resume", e);
      }
      startTimer(reg);
    }
  }

  /**
   * Register a polling function. Replaces `setInterval(fn, intervalMs)` for
   * dashboard pages so visibility-pause and manual-refresh apply uniformly.
   */
  window.registerPagePoll = function registerPagePoll(fn, intervalMs) {
    if (typeof fn !== "function") return;
    const reg = { fn, intervalMs: intervalMs || 30_000, timer: null };
    registrations.push(reg);
    if (document.visibilityState !== "hidden") startTimer(reg);
    return () => {
      clearTimer(reg);
      const i = registrations.indexOf(reg);
      if (i >= 0) registrations.splice(i, 1);
    };
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pauseAll();
    else resumeAll();
  });

  // ---------- Refresh button ----------

  function findMeta() {
    // Every page's topbar uses <div class="meta"> (sometimes with id="meta").
    return document.querySelector(".topbar .meta");
  }

  function injectRefreshButton() {
    const meta = findMeta();
    if (!meta) return;
    if (document.getElementById("refreshNowBtn")) return;
    const btn = document.createElement("button");
    btn.id = "refreshNowBtn";
    btn.type = "button";
    btn.className = "btn-ghost refresh-now";
    btn.textContent = "Refresh";
    btn.title = "Force server-side re-derivation, then refetch";
    btn.addEventListener("click", onRefreshClick);
    // Insert before the live-dot / lastUpdated cluster if present, otherwise
    // append. Both layouts work because the topbar uses flex.
    const liveDot = meta.querySelector("#liveDot");
    if (liveDot) meta.insertBefore(btn, liveDot);
    else meta.appendChild(btn);
  }

  async function onRefreshClick() {
    const btn = document.getElementById("refreshNowBtn");
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "Refreshing…";
    try {
      // Force the server to re-derive immediately. The POST returns once
      // re-derivation completes, so the subsequent fn() calls will see
      // fresh state.
      await fetch("/api/refresh", { method: "POST", cache: "no-store" });
    } catch (e) {
      console.warn("manual refresh: /api/refresh failed", e);
    }
    // Trigger every registered page-poll regardless of POST outcome — at
    // worst we re-render the prior server state.
    await Promise.allSettled(
      registrations.map((reg) => {
        try {
          return Promise.resolve(reg.fn());
        } catch (e) {
          return Promise.reject(e);
        }
      }),
    );
    btn.textContent = prev;
    btn.disabled = false;
  }

  // ---------- Shell back-link (v0 nav-back) ----------
  //
  // Per CEO directive 2026-05-09: every dashboard page needs a minimal
  // shell-aware nav-back to /home.html so users on /agents.html etc.
  // are not stranded. The full per-page shell-chrome retrofit is v3.1
  // (Linnea, brand-supplement). Until then, a single anchor tag pinned
  // at the top of every non-home page does the job.
  //
  // Single-file injection: every page that loads `_refresh-controls.js`
  // (which is now all 9 sibling pages — agents, policies, decision,
  // activity, escalations, fleet, health, architecture, obligations)
  // picks up the back-link without per-page edits.
  //
  // Author: Linnea (Brand & design lead) + Anya (Data / analytics
  // engineer) — under CEO directive 2026-05-09.

  function isHomePage() {
    const p = window.location.pathname;
    return p === "/home.html" || p === "/" || p === "";
  }

  function injectShellBackLink() {
    if (isHomePage()) return;
    if (document.querySelector(".shell-back-link")) return;

    const link = document.createElement("a");
    link.className = "shell-back-link";
    link.href = "/home.html";
    link.setAttribute("data-shell-nav", "back-to-home");
    link.setAttribute("aria-label", "Back to Hoz home");
    // U+2190 leftward arrow + thin space — kept inline so the arrow
    // does not depend on a webfont being loaded.
    link.innerHTML = '<span class="shell-back-arrow" aria-hidden="true">←</span> Hoz home';

    // Preferred: nest inside the legacy `.topbar .meta` so the link
    // sits next to the existing nav-links and inherits the topbar
    // colour. Most pages have this layout (agents, policies,
    // decision, activity, escalations, fleet, health, obligations).
    const meta = document.querySelector(".topbar .meta");
    if (meta) {
      // Insert at the start of the meta cluster so the back-link is
      // the leftmost element — closest visual analogue to a header
      // breadcrumb.
      meta.insertBefore(link, meta.firstChild);
      link.classList.add("shell-back-link--topbar");
      return;
    }

    // Fallback: pages without `.topbar` (e.g. architecture.html which
    // uses a plain body layout). Pin a small bar to the very top of
    // the body so the link is visible without scrolling.
    const bar = document.createElement("div");
    bar.className = "shell-back-bar";
    bar.appendChild(link);
    if (document.body.firstChild) {
      document.body.insertBefore(bar, document.body.firstChild);
    } else {
      document.body.appendChild(bar);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectRefreshButton);
    document.addEventListener("DOMContentLoaded", injectShellBackLink);
  } else {
    injectRefreshButton();
    injectShellBackLink();
  }
})();
