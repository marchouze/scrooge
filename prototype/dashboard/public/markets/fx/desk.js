// dashboard/public/markets/fx/desk.js — FX desk Slice 1.
//
// Reads `/api/markets/fx/counterparties` and renders the eligibility-
// passing counterparty list. Re-uses `_refresh-controls.js` for periodic
// refresh + the shell header refresh button. The page is read-only in
// Slice 1; RFQ submission lands in Slice 2.
//
// Author: Kai (Trading systems engineer, engineering — reports to Saskia,
//         Head of Global Markets).

(() => {
  function $(sel) {
    return document.querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      c === "&"
        ? "&amp;"
        : c === "<"
          ? "&lt;"
          : c === ">"
            ? "&gt;"
            : c === '"'
              ? "&quot;"
              : "&#39;",
    );
  }

  function fmtAsOf(asOf) {
    if (!asOf) return "—";
    try {
      const d = new Date(asOf);
      return d.toISOString().slice(0, 10);
    } catch {
      return String(asOf);
    }
  }

  async function fetchCounterparties() {
    try {
      const res = await fetch("/api/markets/fx/counterparties", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn("[fx-desk] counterparty fetch failed", e);
      return null;
    }
  }

  function renderEmpty(message) {
    const tbody = $("[data-fx-cp-tbody]");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="fx-cp-empty">${escapeHtml(message)}</td></tr>`;
  }

  function renderCounterparties(payload) {
    const summaryCount = $("[data-fx-cp-count]");
    const tbody = $("[data-fx-cp-tbody]");
    if (!tbody) return;

    if (!payload || !Array.isArray(payload.counterparties)) {
      if (summaryCount) summaryCount.textContent = "?";
      renderEmpty("Counterparty endpoint unavailable.");
      return;
    }

    const list = payload.counterparties;
    if (summaryCount) summaryCount.textContent = String(list.length);

    if (list.length === 0) {
      // Empty corpus is the expected state until Slice 2 seeds the
      // synthetic counterparty corpus (pack §9 gap #6).
      renderEmpty(
        "No eligibility-passing counterparties in the event store. " +
          "Seed CounterpartyEligibilityScreened events to populate (Slice 2 substrate gap §9 #6).",
      );
      return;
    }

    tbody.innerHTML = list
      .map((c) => {
        const evidenceList = (c.evidenceRefs || [])
          .slice(0, 3)
          .map((e) => `<li>${escapeHtml(e)}</li>`)
          .join("");
        return [
          "<tr>",
          `<td><strong>${escapeHtml(c.counterpartyId)}</strong>`,
          `<span class="fx-cp-id">${escapeHtml(c.screeningId || "")}</span></td>`,
          `<td>${escapeHtml(c.screeningId || "—")}</td>`,
          `<td><span class="fx-cp-outcome-pass">${escapeHtml(c.outcome || "—")}</span></td>`,
          `<td>${escapeHtml(fmtAsOf(c.asOf))}</td>`,
          `<td><ul class="fx-cp-evidence">${evidenceList || "<li>—</li>"}</ul></td>`,
          "</tr>",
        ].join("");
      })
      .join("");
  }

  async function loadDesk() {
    const payload = await fetchCounterparties();
    renderCounterparties(payload);

    if (window.bankShell?.render) {
      const asOf = payload?.asOf ? payload.asOf : new Date().toISOString();
      window.bankShell.render.asOf(asOf);
    }
    if (window.bankShell?.audit) {
      window.bankShell.audit.log("fx-desk.tiles.rendered", {
        counterparties: payload?.counterparties?.length ?? 0,
      });
    }
  }

  async function boot() {
    // Render skeleton immediately so the shell chrome lays out even
    // before the first API call returns.
    renderEmpty("Loading…");
    await loadDesk();
    if (typeof window.registerPagePoll === "function") {
      window.registerPagePoll(loadDesk, 30_000);
    } else {
      setInterval(() => {
        loadDesk().catch((e) => console.warn("[fx-desk] refresh failed", e));
      }, 30_000);
    }
  }

  // Expose for the shell header refresh button + future tests.
  window.bankFxDesk = { loadDesk };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
