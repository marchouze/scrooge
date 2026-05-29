// models.js — Calculation Models page (Trusted-Figures Program).
//
// Fetches /api/models and renders, per surfaced regulatory figure: the owning
// agent, bound model id + version, registry governance status, the model-approval
// gate, the declared input contract, and the latest CalculationPerformed lineage
// (inputs → output + trust status). Objective 3 of D-TRUSTED-FIGURES-PROGRAM-V1.
//
// Author: Atlas (substrate)

(() => {
  const esc = (s) => SC.esc(String(s ?? ""));

  function statusColour(status) {
    if (status === "ok") return "var(--color-success)";
    if (status === "degraded") return "var(--color-warning, #d48806)";
    if (status === "failed") return "var(--color-danger)";
    return "var(--color-text-secondary)";
  }

  function valStatusColour(s) {
    if (s === "approved") return "var(--color-success)";
    if (s === "withheld") return "var(--color-danger)";
    return "var(--color-text-secondary)";
  }

  function fmtOutput(output, unit) {
    if (output === null || output === undefined) return "value unavailable";
    if (unit === "pct") return `${Number(output).toFixed(2)}%`;
    if (unit === "ZAR-minor") {
      return `ZAR ${(Number(output) / 100).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
    }
    if (unit === "ZAR") {
      return `ZAR ${Number(output).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
    }
    return `${output} ${unit}`;
  }

  function fmtInputValue(value, unit) {
    if (value === null || value === undefined) return "—";
    if (unit === "ZAR-minor") {
      return `ZAR ${(Number(value) / 100).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
    }
    if (unit === "ZAR") {
      return `ZAR ${Number(value).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
    }
    return `${value} ${unit}`;
  }

  function renderCard(m) {
    const card = document.createElement("div");
    card.style.cssText =
      "border:1px solid var(--color-border);border-radius:8px;padding:var(--space-5);margin-bottom:var(--space-5);background:var(--color-surface)";

    const approvalBadge = m.approved
      ? `<span style="color:var(--color-success);font-weight:600">● Approved model</span>`
      : `<span style="color:var(--color-danger);font-weight:600">● NOT approved — figure suppressed</span>`;

    const last = m.lastCalculation;
    const lastBlock = last
      ? `
        <div style="margin-top:var(--space-4)">
          <div style="font-weight:600;margin-bottom:var(--space-2)">Latest calculation
            <span style="color:${statusColour(last.status)};font-weight:600">[${esc(last.status)}]</span>
          </div>
          <div style="font:var(--text-heading-3);margin-bottom:var(--space-2)">
            ${esc(m.figure)} = <strong>${esc(fmtOutput(last.output, last.outputUnit))}</strong>
          </div>
          <div style="font:var(--text-caption);color:var(--color-text-secondary);margin-bottom:var(--space-3)">
            computed as of ${esc(last.asOf)}${
              last.missingInputs?.length ? ` · missing: ${esc(last.missingInputs.join(", "))}` : ""
            }
          </div>
          <table style="width:100%;border-collapse:collapse;font:var(--text-caption)">
            <thead><tr style="text-align:left;color:var(--color-text-secondary)">
              <th style="padding:4px 8px">Input</th><th style="padding:4px 8px">Value</th>
              <th style="padding:4px 8px">Lineage</th><th style="padding:4px 8px">Status</th>
            </tr></thead>
            <tbody>
              ${last.inputs
                .map(
                  (i) => `<tr style="border-top:1px solid var(--color-border)">
                    <td style="padding:4px 8px">${esc(i.name)}</td>
                    <td style="padding:4px 8px">${esc(fmtInputValue(i.value, i.unit))}</td>
                    <td style="padding:4px 8px;color:var(--color-text-secondary)">${esc(i.lineage)}</td>
                    <td style="padding:4px 8px;color:${i.missing ? "var(--color-danger)" : "var(--color-success)"}">${i.missing ? "missing" : "present"}</td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>`
      : `<div style="margin-top:var(--space-4);color:var(--color-text-secondary)">No CalculationPerformed event recorded yet.</div>`;

    const contractBlock = `
      <div style="margin-top:var(--space-3);font:var(--text-caption);color:var(--color-text-secondary)">
        <strong>Input contract:</strong>
        ${m.inputContract
          .map((c) => `${esc(c.name)} (${c.required ? "required" : "optional"}, ${esc(c.unit)})`)
          .join(" · ")}
      </div>`;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-2)">
        <div>
          <div style="font:var(--text-heading-3);font-weight:600">${esc(m.figure)}</div>
          <div style="font:var(--text-caption);color:var(--color-text-secondary)">
            ${esc(m.modelId)} · v${esc(m.modelVersion)} · owned by ${esc(m.owningAgent)}
          </div>
        </div>
        <div style="text-align:right;font:var(--text-caption)">
          ${approvalBadge}<br>
          <span style="color:${valStatusColour(m.validationStatus)}">registry: ${esc(m.validationStatus)}</span>
          ${m.tier !== null ? ` · Tier-${esc(m.tier)}` : ""}
        </div>
      </div>
      ${m.approved ? "" : `<div style="margin-top:var(--space-2);color:var(--color-danger);font:var(--text-caption)">${esc(m.approvalReason || "")}</div>`}
      ${contractBlock}
      ${lastBlock}
      <div style="margin-top:var(--space-3);font:var(--text-caption);color:var(--color-text-secondary)">
        Citations: ${m.citations.map((c) => `<code>${esc(c)}</code>`).join(" ")}
      </div>`;
    return card;
  }

  async function load() {
    const data = await fetch("/api/models").then((r) => (r.ok ? r.json() : null));
    const tilesEl = document.getElementById("model-tiles");
    const cardsEl = document.getElementById("model-cards");
    if (!data) {
      if (cardsEl) cardsEl.textContent = "Failed to load /api/models.";
      return;
    }

    if (tilesEl) {
      tilesEl.innerHTML = "";
      tilesEl.append(
        SC.renderTile({ label: "Bound figures", value: data.counts.total, status: "info" }),
        SC.renderTile({ label: "Approved models", value: data.counts.approved, status: "ok" }),
        SC.renderTile({
          label: "Unapproved",
          value: data.counts.unapproved,
          status: data.counts.unapproved > 0 ? "danger" : "ok",
        }),
      );
    }

    if (cardsEl) {
      cardsEl.innerHTML = "";
      for (const m of data.models) cardsEl.append(renderCard(m));
    }
  }

  load();
})();
