const form = document.getElementById("review-form");
const categorySelect = document.getElementById("category");
const areaSelect = document.getElementById("area");
const reviewText = document.getElementById("review_text");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");
const results = document.getElementById("results");

let demandChart = null;

const ICONS = {
  classify: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 10-5.4 5.4L2 19v3h3l7.3-7.3a4 4 0 005.4-5.4z"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>`,
  thermo: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>`,
  warehouse: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>`,
  hub: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>`,
};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function loadMeta() {
  const res = await fetch("/api/meta");
  const meta = await res.json();
  categorySelect.innerHTML = meta.categories
    .map((c) => `<option value="${c.code}">${c.name}</option>`)
    .join("");
  areaSelect.innerHTML = meta.areas
    .map((a) => `<option value="${a.code}">${a.name}</option>`)
    .join("");
}

function labelFor(classificationLabel) {
  return classificationLabel === "hardware_defect" ? "Hardware Defect" : "Personal Dissatisfaction";
}

function renderClassification(classification) {
  const badgeClass =
    classification.label === "hardware_defect" ? "badge-defect" : "badge-dissatisfaction";
  const pct = Math.round(classification.confidence * 100);
  return `
    <div class="card">
      <p class="card-title">${ICONS.classify} Classification</p>
      <span class="badge ${badgeClass}">${labelFor(classification.label)}</span>
      <div class="confidence-row">
        <div class="confidence-track"><div class="confidence-fill" style="width:${pct}%"></div></div>
        <span class="confidence-value">${pct}% confidence</span>
      </div>
    </div>
  `;
}

function renderDefectStub(defectBranch) {
  return `
    <div class="card stub-card">
      <div class="stub-icon">${ICONS.wrench}</div>
      <div>
        <p class="card-title" style="margin-bottom:4px;">Hardware Defect Handling</p>
        <p class="reason-text">${defectBranch.message}</p>
      </div>
    </div>
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
    statTile(
      "Change",
      `<span class="trend-arrow">${growthArrow}</span>${growthSign}${demand.growth_pct}`,
      "%",
      growthClass
    ),
    statTile("Threshold", demand.threshold, "/mo"),
  ].join("");

  return `
    <div class="section-block">
      <p class="card-title">${ICONS.chart} Recent Demand
        <span class="status-pill ${demand.has_demand ? "yes" : "no"}" style="margin-left:auto;">
          Demand: ${demand.has_demand ? "Yes" : "No"}
        </span>
      </p>
      <div class="chart-wrap"><canvas id="demand-chart" height="150"></canvas></div>
      <div class="stat-grid">${tiles}</div>
      <p class="reason-text">${demand.reason}</p>
    </div>
  `;
}

function zoneClass(zone) {
  if (zone === "Hot") return "hot";
  if (zone === "Cold") return "cold";
  return "moderate";
}

function renderClimateSection(climate) {
  const { min_c, max_c, cold_max_c, hot_min_c } = climate.temp_scale;
  const pct = Math.max(0, Math.min(100, ((climate.avg_temp_c - min_c) / (max_c - min_c)) * 100));
  const coldPct = ((cold_max_c - min_c) / (max_c - min_c)) * 100;
  const hotPct = ((hot_min_c - min_c) / (max_c - min_c)) * 100;

  return `
    <div class="section-block">
      <p class="card-title">${ICONS.thermo} Climate Fit
        <span class="status-pill ${climate.is_climate_fit ? "yes" : "no"}" style="margin-left:auto;">
          Fit: ${climate.is_climate_fit ? "Yes" : "No"}
        </span>
      </p>

      <div class="climate-zone-row">
        <span class="zone-chip ${zoneClass(climate.area_climate_zone)}">${climate.area_climate_zone}</span>
        <span class="reason-text">&middot; suited for: ${climate.category_suited_climates.join(", ")}</span>
      </div>

      <div class="thermal-gauge">
        <div class="thermal-track">
          <div class="thermal-marker" style="left:${pct}%;">
            <div class="thermal-marker-label">${climate.avg_temp_c}&deg;C</div>
            <div class="thermal-marker-pin"></div>
          </div>
        </div>
        <div class="thermal-zone-labels">
          <span>Cold (&lt;${cold_max_c}&deg;)</span>
          <span>Moderate</span>
          <span>Hot (&ge;${hot_min_c}&deg;)</span>
        </div>
      </div>

      <p class="reason-text">${climate.reason}</p>
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
    <div class="card">
      ${renderDemandSection(demand)}
      ${renderClimateSection(climate)}
      <div class="section-block">
        ${renderDecision(decision)}
      </div>
    </div>
  `;
}

function drawDemandChart(demand) {
  const canvas = document.getElementById("demand-chart");
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
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 3.5,
          pointBackgroundColor: seriesColor,
          pointBorderColor: seriesColor,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      interaction: { intersect: false, mode: "index" },
      scales: {
        x: {
          ticks: { color: textSecondary },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: textSecondary },
          grid: { color: cssVar("--gridline") },
          border: { display: false },
        },
      },
    },
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";

  try {
    const res = await fetch("/api/process-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        review_text: reviewText.value,
        category_code: categorySelect.value,
        area_code: areaSelect.value,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new Error(errBody?.detail?.[0]?.msg || `Request failed (${res.status})`);
    }

    const data = await res.json();

    let html = renderClassification(data.classification);
    if (data.defect_branch) {
      html += renderDefectStub(data.defect_branch);
    } else if (data.dissatisfaction_branch) {
      html += renderDissatisfaction(data.dissatisfaction_branch);
    }

    results.innerHTML = html;
    results.hidden = false;

    if (data.dissatisfaction_branch) {
      drawDemandChart(data.dissatisfaction_branch.demand);
    }
  } catch (err) {
    formError.textContent = err.message || "Something went wrong.";
    formError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Process Return";
  }
});

loadMeta();
