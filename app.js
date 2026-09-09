/**
 * app.js — Home Energy Roadmap
 *
 * No backend, no build step: geocoding + climate data come from free,
 * no-API-key-required endpoints (Zippopotam for ZIP→lat/long, Open-Meteo
 * for solar/wind/temperature), which is what makes an "auto-lookup"
 * feature possible on a static GitHub Pages site.
 *
 * NOTE: these two fetch calls could not be tested inside the sandbox this
 * was built in (network egress there is allowlisted and doesn't include
 * these hosts) — verify the lookup once this is live on GitHub Pages, and
 * check the browser console if the ZIP lookup doesn't populate fields.
 */

// ---------- Placeholder icons (swap for real artwork later) ----------
// Simple 24x24 stroke icons, one per solution id — deliberately plain so
// they're obviously temporary and easy to find-and-replace.
const ICONS = {
  'air-sealing-insulation': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-7 9 7"/><path d="M6 10v9h12v-9"/><path d="M9 14c1-1.2 2-1.2 3 0s2 1.2 3 0"/></svg>',
  'solar-pv': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  'solar-thermal': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2.5 3.5 4 6 4 8.5a4 4 0 1 1-8 0C8 9 9.5 6.5 12 3z"/></svg>',
  'geothermal-hp': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 22v-4M12 8a6 6 0 0 1 6 6c0 3-2 5-6 8-4-3-6-5-6-8a6 6 0 0 1 6-6z"/></svg>',
  'air-source-hp': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="9" rx="1"/><path d="M7 9V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M7 21v-2M12 21v-2M17 21v-2"/></svg>',
  'heat-pump-water-heater': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="3"/><path d="M9 8c1.5 1 1.5 2 0 3s-1.5 2 0 3"/></svg>',
  'battery-storage': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="17" height="8" rx="1.5"/><path d="M21 10.5v3"/><path d="M11 10l-2 3h3l-2 3"/></svg>',
  'ev-charger': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="9" height="13" rx="1.5"/><path d="M16 10h2l2 3v5h-2M13 20H4"/><circle cx="7" cy="20" r="1.3"/><path d="M9 11l-1.5 2.5h3L9 16"/></svg>',
  'wood-pellet-stove': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c2.2 3 3.5 5.2 3.5 7.5a3.5 3.5 0 1 1-7 0C8.5 7.2 9.8 5 12 2z"/><path d="M6 22h12M8 22v-3a4 4 0 0 1 8 0v3"/></svg>',
  'small-wind': '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12V2"/><path d="M12 12c3-1 5 0 5 2.5S15 17 12 17"/><path d="M12 12c-3 1.5-6 1-6-1.5S8 6 12 8"/></svg>',
};
function iconFor(solId) { return ICONS[solId] || ICONS['solar-pv']; }

// ---------- User selection & priority state (Stage 05) ----------
let excludedByUser = new Set();  // solution ids the user unchecked
let manualOrder = null;          // array of solution ids in user-chosen priority order, or null to use fit score
let lastOrderedIds = [];         // the ordered ids from the most recent render, for up/down + priority numbers

document.getElementById('roadmapOutput').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  reorder(btn.dataset.id, btn.dataset.action);
});
document.getElementById('roadmapOutput').addEventListener('change', (e) => {
  const cb = e.target.closest('input[type="checkbox"][data-id]');
  if (!cb) return;
  toggleInclude(cb.dataset.id, cb.checked);
});
document.getElementById('resetRoadmapBtn').addEventListener('click', () => {
  excludedByUser.clear();
  manualOrder = null;
  recompute();
});

function reorder(id, direction) {
  if (!manualOrder) manualOrder = lastOrderedIds.slice();
  const idx = manualOrder.indexOf(id);
  if (idx === -1) return;
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= manualOrder.length) return;
  [manualOrder[idx], manualOrder[target]] = [manualOrder[target], manualOrder[idx]];
  recompute();
}

function toggleInclude(id, checked) {
  if (checked) excludedByUser.delete(id); else excludedByUser.add(id);
  recompute();
}

// ---------- Live-value labels ----------
const backupDaysNeeded = document.getElementById('backupDaysNeeded');
const backupDaysValue = document.getElementById('backupDaysValue');
backupDaysNeeded.addEventListener('input', () => {
  backupDaysValue.textContent = backupDaysNeeded.value;
  recompute();
});

const totalBudget = document.getElementById('totalBudget');
const totalBudgetValue = document.getElementById('totalBudgetValue');
totalBudget.addEventListener('input', () => {
  totalBudgetValue.textContent = formatMoney(Number(totalBudget.value));
  recompute();
});

// ---------- Need chips (multi-select) ----------
const needsState = { wantsEV: false, hasPoolOrHotTub: false, electrifyingHeat: false };
document.querySelectorAll('#needsChips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const key = chip.dataset.need;
    needsState[key] = !needsState[key];
    chip.classList.toggle('active', needsState[key]);
    recompute();
  });
});

// ---------- Geography auto-lookup ----------
const lookupBtn = document.getElementById('lookupBtn');
const zipInput = document.getElementById('zipInput');
const geoStatus = document.getElementById('geoStatus');
const geoSourceNote = document.getElementById('geoSourceNote');

lookupBtn.addEventListener('click', async () => {
  const zip = zipInput.value.trim();
  if (!/^\d{5}$/.test(zip)) {
    geoStatus.textContent = 'Enter a 5-digit U.S. ZIP code.';
    geoStatus.className = 'geo-status err';
    return;
  }
  geoStatus.textContent = 'Looking up location…';
  geoStatus.className = 'geo-status';
  try {
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!geoRes.ok) throw new Error('ZIP not found');
    const geo = await geoRes.json();
    const lat = parseFloat(geo.places[0].latitude);
    const lon = parseFloat(geo.places[0].longitude);
    const placeName = `${geo.places[0]['place name']}, ${geo.places[0]['state abbreviation']}`;

    geoStatus.textContent = `Found ${placeName} — pulling a year of solar/wind/temperature data…`;

    const end = new Date();
    end.setDate(end.getDate() - 5);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    const fmt = (d) => d.toISOString().slice(0, 10);

    const climateRes = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${fmt(start)}&end_date=${fmt(end)}` +
      `&daily=shortwave_radiation_sum,wind_speed_10m_max,temperature_2m_min` +
      `&timezone=auto`
    );
    if (!climateRes.ok) throw new Error('Climate data unavailable');
    const climate = await climateRes.json();

    const radiationVals = (climate.daily.shortwave_radiation_sum || []).filter((v) => v != null);
    const windVals = (climate.daily.wind_speed_10m_max || []).filter((v) => v != null);
    const tempMinVals = (climate.daily.temperature_2m_min || []).filter((v) => v != null);

    const avgRadiation = average(radiationVals); // MJ/m²/day
    const avgWindKmh = average(windVals);
    const avgWindMph = avgWindKmh * 0.621371;
    const coldestMonthAvgC = coldestMonthAverage(climate.daily.time, tempMinVals);
    const coldestMonthAvgF = coldestMonthAvgC * 9 / 5 + 32;

    // Classification thresholds are rough planning-grade buckets, not
    // a substitute for a real NREL PVWatts site assessment.
    document.getElementById('sunlightHours').value =
      avgRadiation >= 18 ? 'high' : avgRadiation >= 13 ? 'medium' : 'low';
    document.getElementById('avgWindSpeed').value = Math.round(avgWindMph);
    document.getElementById('climate').value =
      coldestMonthAvgF <= 25 ? 'cold' : coldestMonthAvgF <= 40 ? 'moderate' : 'hot';

    geoStatus.textContent = `Auto-filled from ${placeName} (last 12 months of data).`;
    geoStatus.className = 'geo-status ok';
    geoSourceNote.textContent =
      `Source: Open-Meteo Historical Weather API, Zippopotam.us geocoding. ` +
      `Avg daily solar radiation ≈ ${avgRadiation.toFixed(1)} MJ/m², avg wind ≈ ${avgWindMph.toFixed(1)} mph, ` +
      `coldest-month avg low ≈ ${coldestMonthAvgF.toFixed(0)}°F. Override any field above if it doesn't match your site.`;

    recompute();
  } catch (err) {
    geoStatus.textContent = `Couldn't complete auto-lookup (${err.message}). Set the fields below manually.`;
    geoStatus.className = 'geo-status err';
  }
});

function average(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function coldestMonthAverage(dates, temps) {
  const byMonth = {};
  dates.forEach((d, i) => {
    if (temps[i] == null) return;
    const month = d.slice(5, 7);
    byMonth[month] = byMonth[month] || [];
    byMonth[month].push(temps[i]);
  });
  const monthlyAverages = Object.values(byMonth).map(average);
  return monthlyAverages.length ? Math.min(...monthlyAverages) : 0;
}

// ---------- Recompute on any input change ----------
document.querySelectorAll('select, input[type="number"], input[type="text"]').forEach((el) => {
  el.addEventListener('change', recompute);
});
document.getElementById('phaseCount').addEventListener('change', recompute);

function val(id) { return document.getElementById(id).value; }
function num(id) { return Number(document.getElementById(id).value) || 0; }
function boolVal(id) { return document.getElementById(id).value === 'yes'; }

function gatherInputs() {
  let annualKwh = num('annualKwh');
  if (!annualKwh) {
    const bill = num('monthlyBillDollars');
    if (bill) annualKwh = (bill / 0.17) * 12; // ~$0.17/kWh US average, EIA 2026 ballpark
  }
  return {
    homeAge: val('homeAge'),
    insulationUpdated: val('insulationUpdated'),
    householdSize: num('householdSize'),
    homeSqft: num('homeSqft'),
    roofSizeSqft: num('roofSizeSqft'),
    roofCondition: val('roofCondition'),
    hasWell: boolVal('hasWell'),
    landAvailable: val('landAvailable'),
    hasChimney: boolVal('hasChimney'),
    woodAccess: val('woodAccess'),
    existingSolarKw: num('existingSolarKw'),
    existingBatteryKwh: num('existingBatteryKwh'),
    existingWoodStoveBtu: num('existingWoodStoveBtu'),
    sunlightHours: val('sunlightHours'),
    avgWindSpeed: num('avgWindSpeed'),
    climate: val('climate'),
    currentHeat: val('currentHeat'),
    secondaryHeat: val('secondaryHeat'),
    currentWaterHeat: val('currentWaterHeat'),
    annualKwh: annualKwh || 10500, // US household average fallback, EIA
    wantsEV: needsState.wantsEV,
    hasPoolOrHotTub: needsState.hasPoolOrHotTub,
    electrifyingHeat: needsState.electrifyingHeat,
    backupDaysNeeded: num('backupDaysNeeded'),
    gridReliability: val('gridReliability'),
    panelCapacity: val('panelCapacity'),
    hasSolarPlanned: false, // set below once solar is scored in
  };
}

// ---------- Cost estimation for variable-unit solutions ----------
function estimateCost(sol, inputs) {
  if (sol.id === 'solar-pv') {
    let targetKw = Math.min(Math.max(inputs.annualKwh / 1200, 3), 14);
    if (inputs.wantsEV) targetKw += 2;
    if (inputs.electrifyingHeat) targetKw += 3;
    const additionalKw = Math.max(targetKw - (inputs.existingSolarKw || 0), 0);
    const perWatt = (sol.costRange[0] + sol.costRange[1]) / 2;
    return Math.round(additionalKw * 1000 * perWatt);
  }
  if (sol.id === 'battery-storage') {
    const targetKwh = Math.min(Math.max(inputs.backupDaysNeeded * 7, 5), 40);
    const additionalKwh = Math.max(targetKwh - (inputs.existingBatteryKwh || 0), 0);
    const perKwh = (sol.costRange[0] + sol.costRange[1]) / 2;
    return Math.round(additionalKwh * perKwh);
  }
  if (sol.id === 'ev-charger') {
    let mid = (sol.costRange[0] + sol.costRange[1]) / 2;
    if (inputs.panelCapacity === 'tight') mid += 2500;
    return Math.round(mid);
  }
  return Math.round((sol.costRange[0] + sol.costRange[1]) / 2);
}

// ---------- Scoring + phase allocation ----------
function buildRoadmap(inputs, totalBudgetAmt, phaseCount, excludedByUserSet, manualOrderArr) {
  const scored = [];
  const excluded = [];

  SOLUTIONS.forEach((sol) => {
    const passes = sol.prerequisite(inputs);
    if (!passes) {
      excluded.push({ sol, reason: exclusionReason(sol, inputs) });
      return;
    }
    const score = sol.scoreFactors(inputs);
    const cost = estimateCost(sol, inputs);
    scored.push({ sol, score, cost });
  });

  // let solar's presence influence battery scoring (paired sizing)
  const solarIncluded = scored.some((s) => s.sol.id === 'solar-pv' && s.score >= 40);
  scored.forEach((s) => {
    if (s.sol.id === 'battery-storage' && solarIncluded) {
      s.score = Math.min(100, s.score + 15);
    }
  });

  // split out anything the user explicitly unchecked
  const userExcluded = scored.filter((e) => excludedByUserSet.has(e.sol.id));
  const active = scored.filter((e) => !excludedByUserSet.has(e.sol.id));

  // order: user's manual priority wins where set, fit score otherwise;
  // anything newly-eligible that isn't in a manual order yet falls to the end, by score
  if (manualOrderArr && manualOrderArr.length) {
    const orderIndex = new Map(manualOrderArr.map((id, i) => [id, i]));
    active.sort((a, b) => {
      const ai = orderIndex.has(a.sol.id) ? orderIndex.get(a.sol.id) : Infinity;
      const bi = orderIndex.has(b.sol.id) ? orderIndex.get(b.sol.id) : Infinity;
      if (ai !== bi) return ai - bi;
      return b.score - a.score;
    });
  } else {
    active.sort((a, b) => b.score - a.score);
  }

  const perPhase = Math.round(totalBudgetAmt / phaseCount);
  const phases = Array.from({ length: phaseCount }, (_, i) => ({
    label: `Phase ${i + 1}`,
    budget: perPhase,
    remaining: perPhase,
    items: [],
  }));
  const unfunded = [];

  active.forEach((entry) => {
    let placed = false;
    for (const phase of phases) {
      if (entry.cost <= phase.remaining) {
        phase.items.push(entry);
        phase.remaining -= entry.cost;
        placed = true;
        break;
      }
    }
    if (!placed) unfunded.push(entry);
  });

  return { phases, unfunded, excluded, userExcluded };
}

function exclusionReason(sol, inputs) {
  switch (sol.id) {
    case 'solar-pv': return inputs.existingSolarKw > 0
      ? 'Your existing array already covers your estimated needs.'
      : 'Needs more usable roof area or better sun exposure.';
    case 'solar-thermal': return 'Needs more usable roof area or better sun exposure.';
    case 'geothermal-hp': return 'Needs a well or available land for the ground loop.';
    case 'heat-pump-water-heater': return 'You already have one.';
    case 'battery-storage': return 'Your existing battery already covers the backup duration you asked for.';
    case 'ev-charger': return 'Only relevant if you\'re planning to get an EV — toggle that under Needs.';
    case 'wood-pellet-stove': return inputs.existingWoodStoveBtu > 0
      ? 'You already have a wood/pellet stove installed.'
      : 'Needs an existing chimney/flue, or wood heat already in use.';
    case 'small-wind': return 'Needs both meaningful land and an average wind speed of at least ~10 mph.';
    default: return 'Doesn\'t currently fit your profile.';
  }
}

// ---------- Rendering ----------
function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function recompute() {
  const inputs = gatherInputs();
  const budgetAmt = num('totalBudget');
  const phaseCount = Number(val('phaseCount'));

  const { phases, unfunded, excluded, userExcluded } = buildRoadmap(inputs, budgetAmt, phaseCount, excludedByUser, manualOrder);

  lastOrderedIds = [...phases.flatMap((p) => p.items), ...unfunded].map((e) => e.sol.id);
  const totalActive = lastOrderedIds.length;

  // Stats
  const fundedItems = phases.flatMap((p) => p.items);
  const totalCost = fundedItems.reduce((sum, e) => sum + e.cost, 0);
  const totalCO2 = fundedItems.reduce((sum, e) => sum + (e.sol.co2ReductionTons || 0), 0);
  document.getElementById('statMatched').textContent = fundedItems.length + unfunded.length + userExcluded.length;
  document.getElementById('statCost').textContent = formatMoney(totalCost);
  document.getElementById('statPhases').textContent = phases.filter((p) => p.items.length).length;
  document.getElementById('statCO2').textContent = totalCO2.toFixed(1) + ' t';

  // Roadmap
  const out = document.getElementById('roadmapOutput');
  out.innerHTML = '';
  phases.forEach((phase) => {
    if (!phase.items.length) return;
    const phaseCost = phase.items.reduce((s, e) => s + e.cost, 0);
    const pct = Math.min(100, Math.round((phaseCost / phase.budget) * 100));
    const el = document.createElement('div');
    el.className = 'phase';
    el.innerHTML = `
      <div class="phase-head">
        <h3>${phase.label}</h3>
        <span class="phase-meta">${formatMoney(phaseCost)} of ${formatMoney(phase.budget)} budget</span>
      </div>
      <div class="phase-budget-bar"><div class="phase-budget-fill" style="width:${pct}%"></div></div>
      ${phase.items.map((entry) => cardHtml(entry, cardMeta(entry, totalActive))).join('')}
    `;
    out.appendChild(el);
  });

  if (unfunded.length) {
    const el = document.createElement('div');
    el.className = 'phase';
    el.innerHTML = `
      <div class="phase-head"><h3>Beyond Current Budget</h3></div>
      <p class="hint">Still part of your plan, just not funded by your current budget/phases — reorder to bring one forward.</p>
      ${unfunded.map((entry) => cardHtml(entry, cardMeta(entry, totalActive))).join('')}
    `;
    out.appendChild(el);
  }

  if (userExcluded.length) {
    const el = document.createElement('div');
    el.className = 'phase';
    el.innerHTML = `
      <div class="phase-head"><h3>Not In Your Plan</h3></div>
      <p class="hint">You unchecked these — tick the box to add one back in.</p>
      ${userExcluded.map(notIncludedCardHtml).join('')}
    `;
    out.appendChild(el);
  }

  // Excluded note (infeasible for this home — not user-editable)
  const excludedNote = document.getElementById('excludedNote');
  if (excluded.length) {
    excludedNote.innerHTML = `<strong>Not shown above (doesn't currently fit your home):</strong><br>` +
      excluded.map((e) => `${e.sol.name} — ${e.reason}`).join('<br>');
  } else {
    excludedNote.innerHTML = '';
  }

  // Sources
  const sourcesList = document.getElementById('sourcesList');
  const seen = new Set();
  sourcesList.innerHTML = '';
  SOLUTIONS.forEach((s) => {
    if (seen.has(s.source.url)) return;
    seen.add(s.source.url);
    const li = document.createElement('li');
    li.innerHTML = `<a href="${s.source.url}" target="_blank" rel="noopener">${s.source.name}</a> (used for ${s.name})${s.confidence === 'estimate' ? ' — approximate, confirm with local quotes' : ''}`;
    sourcesList.appendChild(li);
  });
}

function cardMeta(entry, total) {
  const idx = lastOrderedIds.indexOf(entry.sol.id);
  return { priority: idx + 1, isFirst: idx <= 0, isLast: idx === total - 1 };
}

function cardHtml(entry, meta) {
  const s = entry.sol;
  return `
    <div class="card">
      <div class="card-icon">${iconFor(s.id)}</div>
      <div class="card-body">
        <div class="card-head">
          <div>
            <h4>${s.name}${s.confidence === 'estimate' ? '<span class="badge approx">approx.</span>' : ''}</h4>
          </div>
          <div class="card-cost">${formatMoney(entry.cost)}</div>
        </div>
        <p class="blurb">${s.blurb}</p>
        <div class="card-footer">
          <span>Payback ~${s.paybackYears[0]}–${s.paybackYears[1]} yrs</span>
          <span>~${s.co2ReductionTons}t CO₂/yr</span>
          <span>Fit score ${entry.score}/100</span>
        </div>
      </div>
      <div class="card-controls">
        <button type="button" class="pri-btn" data-action="up" data-id="${s.id}" ${meta.isFirst ? 'disabled' : ''} aria-label="Raise priority">▲</button>
        <span class="pri-num">#${meta.priority}</span>
        <button type="button" class="pri-btn" data-action="down" data-id="${s.id}" ${meta.isLast ? 'disabled' : ''} aria-label="Lower priority">▼</button>
        <label class="include-toggle">
          <input type="checkbox" data-id="${s.id}" checked />
          Include
        </label>
      </div>
    </div>
  `;
}

function notIncludedCardHtml(entry) {
  const s = entry.sol;
  return `
    <div class="card card-muted">
      <div class="card-icon">${iconFor(s.id)}</div>
      <div class="card-body">
        <div class="card-head">
          <div><h4>${s.name}</h4></div>
          <div class="card-cost">${formatMoney(entry.cost)}</div>
        </div>
        <p class="blurb">${s.blurb}</p>
      </div>
      <div class="card-controls">
        <label class="include-toggle">
          <input type="checkbox" data-id="${s.id}" />
          Include
        </label>
      </div>
    </div>
  `;
}

// ---------- Init ----------
totalBudgetValue.textContent = formatMoney(Number(totalBudget.value));
recompute();
