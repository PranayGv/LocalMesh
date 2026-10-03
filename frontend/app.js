const $ = (id) => document.getElementById(id);

const queueListEl = $("queue-list");
const emptyStateEl = $("empty-state");
const detailPlaceholder = $("detail-placeholder");
const detailContent = $("detail-content");

let returns = [];
let selectedId = null;
let demandChart = null;
let lastQueueFingerprint = "";
let leafletMap = null;

const ICONS = {
  classify: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 10-5.4 5.4L2 19v3h3l7.3-7.3a4 4 0 005.4-5.4z"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>`,
  thermo: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>`,
  warehouse: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>`,
  hub: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>`,
  review: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---------------------------------------------------------------------- */
/* Queue polling + list                                                   */
/* ---------------------------------------------------------------------- */

async function fetchQueue() {
  try {
    const res = await fetch("/api/returns");
    if (!res.ok) return;
    returns = await res.json();
    const fingerprint = JSON.stringify(returns.map((r) => [r.id, r.status]));
    if (fingerprint !== lastQueueFingerprint) {
      lastQueueFingerprint = fingerprint;
      renderQueueList();
    }
    renderStats();
  } catch (err) {
    /* storefront/backend not reachable yet — keep showing what we have */
  }
}

function renderStats() {
  const local = returns.filter((r) => r.status === "routed_local").length;
  const hub = returns.filter((r) => r.status === "routed_hub").length;
  const defect = returns.filter((r) => r.status === "defect_repaired" || r.status === "defect_hub").length;
  $("stat-queue").textContent = returns.length;
  $("stat-local").textContent = local;
  $("stat-hub").textContent = hub;
  $("stat-defect").textContent = defect;
}

function statusMeta(status) {
  if (status === "routed_local") return { dot: "dot-local", label: "LOCAL WH" };
  if (status === "routed_hub") return { dot: "dot-hub", label: "CENTRAL HUB" };
  if (status === "defect_repaired") return { dot: "dot-repaired", label: "REPAIRED · LOCAL" };
  if (status === "defect_hub") return { dot: "dot-defect", label: "CENTRAL WAREHOUSE" };
  return { dot: "dot-defect", label: "DEFECT" };
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Season the customer themselves selected on the storefront at the time of
// the return — stated context, not inferred from the product.
function seasonLabel(season) {
  const labels = { summer: "Summer", monsoon: "Monsoon", winter: "Winter" };
  return labels[season] || "Season: unknown";
}

function renderQueueList() {
  const hasReturns = returns.length > 0;
  emptyStateEl.hidden = hasReturns;
  queueListEl.hidden = !hasReturns;

  queueListEl.innerHTML = returns
    .map((r) => {
      const meta = statusMeta(r.status);
      const active = r.id === selectedId ? "active" : "";
      return `
        <button class="queue-row ${active}" data-id="${r.id}">
          <span class="qr-dot ${meta.dot}"></span>
          <span class="qr-main">
            <span class="qr-product">${r.product}</span>
            <span class="qr-meta">${r.area_name} (${r.area_climate_zone}) &middot; ${formatTimestamp(r.submitted_at)}</span>
          </span>
          <span class="qr-status ${meta.dot}">${meta.label}</span>
        </button>
      `;
    })
    .join("");

  queueListEl.querySelectorAll(".queue-row").forEach((row) => {
    row.addEventListener("click", () => selectReturn(row.dataset.id));
  });
}

async function selectReturn(id) {
  selectedId = id;
  renderQueueList();
  detailPlaceholder.hidden = true;
  detailContent.hidden = false;
  detailContent.innerHTML = `<p class="loading-msg">Loading analysis…</p>`;

  try {
    const res = await fetch(`/api/returns/${id}`);
    if (!res.ok) throw new Error("Return not found");
    const record = await res.json();
    renderDetail(record);
  } catch (err) {
    detailContent.innerHTML = `<p class="loading-msg">Could not load this return.</p>`;
  }
}

/* ---------------------------------------------------------------------- */
/* Detail panel                                                           */
/* ---------------------------------------------------------------------- */

function renderDetail(record) {
  const meta = statusMeta(record.status);
  let html = `
    <div class="detail-header">
      <div>
        <p class="detail-eyebrow">RETURN ${record.id.toUpperCase()}</p>
        <h2>${record.product}</h2>
        <p class="detail-sub">${record.area_name} <span class="zone-tag zone-${record.area_climate_zone.toLowerCase()}">${record.area_climate_zone}</span> &middot; ${seasonLabel(record.season)} &middot; received ${formatTimestamp(record.submitted_at)}</p>
      </div>
      <span class="status-badge ${meta.dot}">${meta.label}</span>
    </div>
  `;

  html += renderReview(record.review_text);
  html += renderClassification(record.classification);

  if (record.defect_branch) {
    html += renderDefect(record.defect_branch);
  } else if (record.dissatisfaction_branch) {
    html += renderDissatisfaction(record.dissatisfaction_branch, record.area_code);
  }

  detailContent.innerHTML = html;

  if (record.dissatisfaction_branch) {
    drawDemandChart(record.dissatisfaction_branch.demand);
    mountIndiaMap(record.dissatisfaction_branch.climate);
  } else if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }
}

function renderReview(reviewText) {
  return `
    <section class="panel">
      <p class="panel-title">${ICONS.review} Customer Review</p>
      <p class="review-text">&ldquo;${reviewText}&rdquo;</p>
    </section>
  `;
}

function labelFor(classificationLabel) {
  return classificationLabel === "hardware_defect" ? "Hardware Defect" : "Personal Dissatisfaction";
}

function renderClassification(classification) {
  const badgeClass = classification.label === "hardware_defect" ? "badge-defect" : "badge-dissatisfaction";
  const pct = Math.round(classification.confidence * 100);
  return `
    <section class="panel">
      <p class="panel-title">${ICONS.classify} Classification</p>
      <span class="badge ${badgeClass}">${labelFor(classification.label)}</span>
      <div class="confidence-row">
        <div class="confidence-track"><div class="confidence-fill" style="width:${pct}%"></div></div>
        <span class="confidence-value">${pct}% confidence</span>
      </div>
    </section>
  `;
}

function renderDefect(defect) {
  const resolutionLabel = defect.resolution === "replacement" ? "Replacement" : "Refund Issued";
  const isLocal = defect.route === "local_warehouse";
  const bannerClass = isLocal ? "local-warehouse" : "central-hub";
  const icon = isLocal ? ICONS.warehouse : ICONS.hub;
  const routeLabel = isLocal ? "Repaired — Local Warehouse" : "Central Warehouse — Deep Repair";

  return `
    <section class="panel">
      <p class="panel-title">${ICONS.wrench} Hardware Defect — Repair Pipeline</p>

      <div class="section-block">
        <p class="flow-step-label">Step 1 &middot; Refund or Replacement?</p>
        <span class="badge badge-dissatisfaction">${resolutionLabel}</span>
        <span class="source-tag">${defect.customer_requested ? "Customer's choice" : "Auto-assigned"}</span>
        <p class="reason-text" style="margin-top:10px;">${defect.resolution_reason}</p>
      </div>

      <div class="section-block">
        <p class="flow-step-label">Step 2 &middot; Local Repair Shop</p>
        <p class="reason-text">Faulty unit sent here for inspection and repair.</p>
      </div>

      <div class="section-block">
        <p class="flow-step-label">Step 3 &middot; Repair Successful?
          <span class="status-pill ${defect.repair_successful ? "yes" : "no"}">${defect.repair_successful ? "Yes" : "No"}</span>
        </p>
      </div>

      <div class="section-block">
        <div class="decision-banner ${bannerClass}">
          <p class="decision-head">${icon}<span class="route-label">${routeLabel}</span></p>
          <p class="reason-text">${defect.repair_reason}</p>
        </div>
      </div>
    </section>
  `;
}

function statTile(label, value, unit, trendClass) {
  return `
    <div class="stat-tile">
      <p class="stat-tile-label">${label}</p>
      <p class="stat-tile-value ${trendClass || ""}">${value}${unit ? `<span class="stat-tile-unit">${unit}</span>` : ""}</p>
    </div>
  `;
}

function renderDemandSection(demand) {
  const growthSign = demand.growth_pct >= 0 ? "+" : "";
  const growthClass = demand.growth_pct >= 0 ? "up" : "down";
  const growthArrow = demand.growth_pct >= 0 ? "&#8593;" : "&#8595;";

  const tiles = [
    statTile("Recent Avg", demand.recent_avg, "/mo"),
    statTile("Prior Avg", demand.prior_avg, "/mo"),
    statTile("Change", `<span class="trend-arrow">${growthArrow}</span>${growthSign}${demand.growth_pct}`, "%", growthClass),
    statTile("Threshold", demand.threshold, "/mo"),
  ].join("");

  return `
    <div class="section-block">
      <p class="panel-title">${ICONS.chart} Recent Demand
        <span class="status-pill ${demand.has_demand ? "yes" : "no"}">Demand: ${demand.has_demand ? "Yes" : "No"}</span>
      </p>
      <div class="chart-wrap"><canvas id="demand-chart" height="150"></canvas></div>
      <div class="stat-grid">${tiles}</div>
      <p class="reason-text">${demand.reason}</p>
    </div>
  `;
}

function renderClimateSection(climate) {
  const { min_c, max_c, cold_max_c, hot_min_c } = climate.temp_scale;
  const pct = Math.max(0, Math.min(100, ((climate.avg_temp_c - min_c) / (max_c - min_c)) * 100));
  const markerColor = tempColor(climate.avg_temp_c, climate.temp_scale);
  const isWeatherNeutral = ["Hot", "Moderate", "Cold"].every((z) => climate.category_suited_climates.includes(z));
  const favorable = isWeatherNeutral ? "All climates" : climate.category_suited_climates.join(", ");

  const tiles = [statTile("Favorable for", favorable), statTile("Current condition", climate.area_climate_zone)].join("");

  return `
    <div class="section-block">
      <p class="panel-title">${ICONS.thermo} Climate Fit
        <span class="status-pill ${climate.is_climate_fit ? "yes" : "no"}">Fit: ${climate.is_climate_fit ? "Yes" : "No"}</span>
      </p>
      <div class="map-readout">
        <span class="zone-chip zone-${climate.area_climate_zone.toLowerCase()}">${climate.area_climate_zone}</span>
        <span class="readout-temp">${climate.avg_temp_c}&deg;C</span>
      </div>
      ${renderIndiaMap(climate)}
      <div class="thermal-slider">
        <div class="thermal-track">
          <div class="thermal-marker" style="left:${pct}%;">
            <div class="thermal-marker-pin" style="border-color:${markerColor};"></div>
          </div>
        </div>
        <div class="thermal-zone-labels">
          <span>Cold (&lt;${cold_max_c}&deg;)</span>
          <span>Moderate</span>
          <span>Hot (&ge;${hot_min_c}&deg;)</span>
        </div>
      </div>
      <div class="stat-grid">${tiles}</div>
    </div>
  `;
}

function renderDecision(decision) {
  const isWarehouse = decision.route === "local_warehouse";
  const decisionClass = isWarehouse ? "local-warehouse" : "central-hub";
  const routeLabel = isWarehouse ? "Local Warehouse" : "Central Hub";
  const icon = isWarehouse ? ICONS.warehouse : ICONS.hub;

  return `
    <div class="decision-banner ${decisionClass}">
      <p class="decision-head">${icon}<span class="route-label">Decision: ${routeLabel}</span></p>
      <p class="reason-text">${decision.reason}</p>
    </div>
  `;
}

function renderDissatisfaction(branch) {
  const { demand, climate, decision } = branch;
  return `
    <section class="panel">
      <div class="dual-col">
        ${renderDemandSection(demand)}
        ${renderClimateSection(climate)}
      </div>
      <div class="section-block">
        ${renderDecision(decision)}
      </div>
    </section>
  `;
}

function drawDemandChart(demand) {
  const canvas = $("demand-chart");
  if (!canvas) return;

  if (demandChart) {
    demandChart.destroy();
    demandChart = null;
  }

  const seriesColor = cssVar("--series-1");
  const seriesSoft = cssVar("--series-1-soft");
  const textSecondary = cssVar("--text-secondary");

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 150);
  gradient.addColorStop(0, seriesSoft);
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  demandChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: demand.months,
      datasets: [
        {
          label: "Purchases",
          data: demand.counts,
          borderColor: seriesColor,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: seriesColor,
          pointBorderColor: seriesColor,
        },
      ],
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      interaction: { intersect: false, mode: "index" },
      scales: {
        x: { ticks: { color: textSecondary, font: { family: "var(--mono)" } }, grid: { display: false }, border: { display: false } },
        y: { beginAtZero: true, ticks: { color: textSecondary, font: { family: "var(--mono)" } }, grid: { color: cssVar("--gridline") }, border: { display: false } },
      },
    },
  });
}

/* ---------------------------------------------------------------------- */
/* Thermal color scale (used by the climate-fit slider marker)            */
/* ---------------------------------------------------------------------- */

function lerpColor(c1, c2, t) {
  const rgb = c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// Colors are anchored to the Cold/Moderate/Hot zone boundaries (not the raw
// min/max) so anything in the Cold zone always reads as a shade of blue and
// anything in the Hot zone always reads as a shade of red — a mid-range
// temperature near 0..max shouldn't wash out into an ambiguous olive tone.
function tempColor(tempC, scale) {
  const { min_c, max_c, cold_max_c, hot_min_c } = scale;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const DEEP_BLUE = [30, 64, 130];
  const LIGHT_BLUE = [96, 165, 217];
  const AMBER = [217, 150, 40];
  const ORANGE = [224, 110, 40];
  const DEEP_RED = [153, 27, 27];

  if (tempC < cold_max_c) {
    const t = clamp01((tempC - min_c) / (cold_max_c - min_c || 1));
    return lerpColor(DEEP_BLUE, LIGHT_BLUE, t);
  }
  if (tempC >= hot_min_c) {
    const t = clamp01((tempC - hot_min_c) / (max_c - hot_min_c || 1));
    return lerpColor(ORANGE, DEEP_RED, t);
  }
  const t = clamp01((tempC - cold_max_c) / (hot_min_c - cold_max_c || 1));
  return lerpColor(LIGHT_BLUE, AMBER, t);
}

/* ---------------------------------------------------------------------- */
/* India map (Leaflet + OpenStreetMap — no API key required)             */
/* ---------------------------------------------------------------------- */

// Real-world coordinates for each mock area. Mirrors backend AREAS.
const CITY_LATLNG = {
  RAJ: [26.9124, 75.7873], // Jaipur
  DEL: [28.6139, 77.209], // Delhi
  BLR: [12.9716, 77.5946], // Bengaluru
  PUN: [18.5204, 73.8567], // Pune
  SHM: [31.1048, 77.1734], // Shimla
  MUM: [19.076, 72.8777], // Mumbai
  CHE: [13.0827, 80.2707], // Chennai
  KOL: [22.5726, 88.3639], // Kolkata
  LKO: [26.8467, 80.9462], // Lucknow
  LEH: [34.1526, 77.577], // Leh
};

function renderIndiaMap(climate) {
  const latlng = CITY_LATLNG[climate.area_code];
  if (!latlng) return "";
  return `<div class="india-map-wrap"><div class="leaflet-map" id="leaflet-map"></div></div>`;
}

function mountIndiaMap(climate) {
  const el = $("leaflet-map");
  if (!el || typeof L === "undefined") return;
  const latlng = CITY_LATLNG[climate.area_code];
  if (!latlng) return;
  const color = tempColor(climate.avg_temp_c, climate.temp_scale);

  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }

  leafletMap = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView(latlng, 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(leafletMap);

  const emoji = climate.area_climate_zone === "Hot" ? "🔥" : climate.area_climate_zone === "Cold" ? "❄️" : "";
  L.circleMarker(latlng, {
    radius: 9,
    color: "#fff",
    weight: 2,
    fillColor: color,
    fillOpacity: 1,
  })
    .addTo(leafletMap)
    .bindTooltip(`${emoji} ${climate.avg_temp_c}&deg;C`, { permanent: true, direction: "top", offset: [0, -8] })
    .openTooltip();

  // Leaflet needs a size recalculation once its container is in the live DOM.
  setTimeout(() => leafletMap && leafletMap.invalidateSize(), 0);
}

fetchQueue();
setInterval(fetchQueue, 4000);

// Clear queue button
const clearBtn = document.getElementById("clear-queue");
if (clearBtn) {
  clearBtn.addEventListener("click", async () => {
    if (!returns.length) return;
    if (!confirm("Clear all returns from the queue? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/returns", { method: "DELETE" });
      if (res.ok) {
        returns = [];
        selectedId = null;
        lastQueueFingerprint = "";
        renderQueueList();
        renderStats();
        detailContent.hidden = true;
        detailPlaceholder.hidden = false;
      }
    } catch (err) {
      console.error("Failed to clear queue", err);
    }
  });
}
