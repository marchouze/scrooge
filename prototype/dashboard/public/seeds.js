// seeds.js — Boot Seeds page (Trusted-Figures Program, objective 1).
//
// Fetches /api/seeds and renders, per build-phase boot seed: its title, kind,
// emitted event types + live counts, descope status, and controls to descope
// (POST /api/seeds/descope) or replace-with-simulated (link to the authoring UI
// + POST /api/seeds/promote). Structural seeds (fleet, party graph) are shown
// read-only.
//
// Author: Atlas (substrate)

(() => {
  const esc = (s) => SC.esc(String(s ?? ""));

  function kindColour(kind) {
    if (kind === "treasury-positions") return "var(--color-accent, #1668dc)";
    if (kind === "balance-sheet") return "var(--color-accent, #1668dc)";
    if (kind === "model-governance") return "var(--color-warning, #d48806)";
    if (kind === "npa-attestation") return "var(--color-warning, #d48806)";
    return "var(--color-text-secondary)";
  }

  async function descope(seedId, title) {
    const reason = window.prompt(
      `Descope "${title}"?\n\nGive a reason (the seed is skipped at next boot):`,
    );
    if (reason === null) return;
    if (!reason.trim()) {
      window.alert("A reason is required to descope a seed.");
      return;
    }
    const res = await fetch("/api/seeds/descope", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seedId, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      window.alert(`Descope failed: ${data?.error ?? res.statusText}`);
      return;
    }
    window.alert(data?.effect ?? "Seed descoped at next boot.");
    load();
  }

  function renderCard(s) {
    const card = document.createElement("div");
    card.style.cssText =
      "border:1px solid var(--color-border);border-radius:8px;padding:var(--space-5);margin-bottom:var(--space-5);background:var(--color-surface)";

    const statusBadge = s.descoped
      ? `<span style="color:var(--color-danger);font-weight:600">● Descoped — skipped at next boot</span>`
      : s.descopable
        ? `<span style="color:var(--color-success);font-weight:600">● Active (descopable)</span>`
        : `<span style="color:var(--color-text-secondary);font-weight:600">● Structural (not descopable)</span>`;

    const eventRows = Object.entries(s.eventCounts)
      .map(
        ([t, n]) =>
          `<tr style="border-top:1px solid var(--color-border)">
            <td style="padding:4px 8px"><code>${esc(t)}</code></td>
            <td style="padding:4px 8px;text-align:right;color:${n > 0 ? "var(--color-success)" : "var(--color-text-secondary)"}">${n}</td>
          </tr>`,
      )
      .join("");

    const descopeNote = s.descope
      ? `<div style="margin-top:var(--space-2);color:var(--color-danger);font:var(--text-caption)">
          Descoped ${esc(s.descope.asOf)} by ${esc(s.descope.actor)}: ${esc(s.descope.reason)}
        </div>`
      : "";

    const promoteNote = s.promotion
      ? `<div style="margin-top:var(--space-2);color:var(--color-text-secondary);font:var(--text-caption)">
          Replaced with ${s.promotion.replacementEventIds.length} simulated event(s) ${esc(s.promotion.asOf)}${s.promotion.note ? ` — ${esc(s.promotion.note)}` : ""}
        </div>`
      : "";

    const controls =
      s.descopable && !s.descoped
        ? `<div style="margin-top:var(--space-4);display:flex;gap:var(--space-3);flex-wrap:wrap">
            <button data-descope="${esc(s.seedId)}" data-title="${esc(s.title)}"
              style="padding:6px 14px;border:1px solid var(--color-danger);color:var(--color-danger);background:transparent;border-radius:6px;cursor:pointer;font:var(--text-caption)">
              Descope
            </button>
            ${
              s.replaceWith
                ? `<a href="${esc(s.replaceWith.href)}"
                    style="padding:6px 14px;border:1px solid var(--color-border);color:var(--color-text);background:transparent;border-radius:6px;text-decoration:none;font:var(--text-caption)">
                    ${esc(s.replaceWith.label)} →
                  </a>`
                : ""
            }
          </div>`
        : "";

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-2)">
        <div>
          <div style="font:var(--text-heading-3);font-weight:600">${esc(s.title)}</div>
          <div style="font:var(--text-caption);color:${kindColour(s.kind)}">
            ${esc(s.kind)} · <code>${esc(s.seedId)}</code> · ${esc(s.bootFn)}()
          </div>
        </div>
        <div style="text-align:right;font:var(--text-caption)">${statusBadge}</div>
      </div>
      <div style="margin-top:var(--space-3);font:var(--text-body);color:var(--color-text-secondary)">${esc(s.description)}</div>
      ${descopeNote}
      ${promoteNote}
      <div style="margin-top:var(--space-4)">
        <div style="font-weight:600;margin-bottom:var(--space-2);font:var(--text-caption)">
          Emitted events (${s.totalEvents} present)
        </div>
        <table style="width:60%;min-width:320px;border-collapse:collapse;font:var(--text-caption)">
          <thead><tr style="text-align:left;color:var(--color-text-secondary)">
            <th style="padding:4px 8px">Event type</th><th style="padding:4px 8px;text-align:right">Count</th>
          </tr></thead>
          <tbody>${eventRows}</tbody>
        </table>
      </div>
      ${controls}
      <div style="margin-top:var(--space-3);font:var(--text-caption);color:var(--color-text-secondary)">
        Citations: ${s.citations.map((c) => `<code>${esc(c)}</code>`).join(" ")}
      </div>`;

    const btn = card.querySelector("[data-descope]");
    if (btn) {
      btn.addEventListener("click", () => descope(btn.dataset.descope, btn.dataset.title));
    }
    return card;
  }

  async function load() {
    const data = await fetch("/api/seeds").then((r) => (r.ok ? r.json() : null));
    const tilesEl = document.getElementById("seed-tiles");
    const cardsEl = document.getElementById("seed-cards");
    if (!data) {
      if (cardsEl) cardsEl.textContent = "Failed to load /api/seeds.";
      return;
    }

    if (tilesEl) {
      tilesEl.innerHTML = "";
      tilesEl.append(
        SC.renderTile({ label: "Boot seeds", value: data.counts.total, status: "info" }),
        SC.renderTile({ label: "Descopable", value: data.counts.descopable, status: "ok" }),
        SC.renderTile({
          label: "Descoped",
          value: data.counts.descoped,
          status: data.counts.descoped > 0 ? "warning" : "ok",
        }),
      );
    }

    if (cardsEl) {
      cardsEl.innerHTML = "";
      for (const s of data.seeds) cardsEl.append(renderCard(s));
    }
  }

  load();
})();
