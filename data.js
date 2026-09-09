/**
 * data.js — Solutions catalog
 *
 * Every solution carries a cost range, a rough CO2/payback profile, prerequisite
 * checks (functions run against the user's inputs), and a source citation —
 * same spirit as The People's Ledger's "assumptions & sources" section.
 *
 * COST DATA CONFIDENCE:
 *   "sourced"    = backed by a cited 2026 market range (see .source)
 *   "estimate"   = reasonable published ballpark, not freshly verified — flagged
 *                  in the UI as "approximate, confirm with local quotes"
 * Nothing here is a quote. It's a planning-grade starting point, same disclaimer
 * spirit as the Ledger: "not a forecast, a defensible midpoint."
 */

const CATEGORIES = {
  EFFICIENCY: 'efficiency',
  GENERATION: 'generation',
  HEATING: 'heating',
  WATER: 'water',
  STORAGE: 'storage',
  EV: 'ev',
};

const SOLUTIONS = [
  {
    id: 'air-sealing-insulation',
    name: 'Air Sealing & Insulation Upgrade',
    category: CATEGORIES.EFFICIENCY,
    blurb: 'Seal the envelope before sizing anything else — every other system gets cheaper to run and smaller to buy once heat stops leaking out.',
    costRange: [1500, 8000],
    costUnit: 'whole-home, depends on current insulation level',
    paybackYears: [2, 7],
    co2ReductionTons: 0.8,
    confidence: 'estimate',
    source: { name: 'ENERGY STAR / DOE Weatherization', url: 'https://www.energystar.gov/campaign/seal_insulate' },
    prerequisite: (inputs) => true,
    scoreFactors: (inputs) => {
      let score = 40;
      if (inputs.homeAge === 'pre-1980') score += 35;
      else if (inputs.homeAge === '1980-2000') score += 20;
      else if (inputs.homeAge === '2000-2015') score += 8;
      if (inputs.insulationUpdated === 'no') score += 20;
      if (inputs.insulationUpdated === 'unknown') score += 10;
      return Math.min(score, 100);
    },
  },
  {
    id: 'solar-pv',
    name: 'Rooftop Solar PV',
    category: CATEGORIES.GENERATION,
    blurb: 'Panels sized to your annual electricity baseline plus any EV or electrification load you plan to add.',
    costRange: [2.5, 3.5], // per watt installed
    costUnit: 'per watt installed (typical system 5–10 kW)',
    paybackYears: [10, 16],
    co2ReductionTons: 3.5,
    confidence: 'sourced',
    source: { name: 'EnergySage / LBNL Tracking the Sun, 2026', url: 'https://www.solar.com/learn/solar-panel-cost/' },
    prerequisite: (inputs) => {
      const targetKw = Math.min(Math.max(inputs.annualKwh / 1200, 3), 14);
      return inputs.roofSizeSqft > 200 && inputs.sunlightHours !== 'low' && (inputs.existingSolarKw || 0) < targetKw;
    },
    scoreFactors: (inputs) => {
      let score = 30;
      if (inputs.sunlightHours === 'high') score += 40;
      else if (inputs.sunlightHours === 'medium') score += 20;
      if (inputs.roofSizeSqft >= 600) score += 15;
      else if (inputs.roofSizeSqft >= 300) score += 8;
      if (inputs.roofCondition === 'good' || inputs.roofCondition === 'new') score += 10;
      if (inputs.roofCondition === 'needs-replacement') score -= 25;
      if (inputs.wantsEV) score += 5;
      return Math.max(0, Math.min(score, 100));
    },
  },
  {
    id: 'solar-thermal',
    name: 'Solar Water Heating',
    category: CATEGORIES.WATER,
    blurb: 'Rooftop collectors that preheat water — cheaper per BTU than PV for water heating alone, if roof space is limited.',
    costRange: [4000, 9000],
    costUnit: 'whole-home system, 2–4 collector panels',
    paybackYears: [8, 15],
    co2ReductionTons: 0.6,
    confidence: 'estimate',
    source: { name: 'DOE Solar Water Heater guidance', url: 'https://www.energy.gov/energysaver/solar-water-heaters' },
    prerequisite: (inputs) => inputs.roofSizeSqft > 80 && inputs.sunlightHours !== 'low',
    scoreFactors: (inputs) => {
      let score = 15;
      if (inputs.sunlightHours === 'high') score += 25;
      if (inputs.roofSizeSqft < 400) score += 15; // good use of small roof
      if (inputs.householdSize >= 4) score += 10;
      return Math.min(score, 100);
    },
  },
  {
    id: 'geothermal-hp',
    name: 'Geothermal (Ground-Source) Heat Pump',
    category: CATEGORIES.HEATING,
    blurb: 'Highest upfront cost, but stable year-round efficiency (COP 3.5–5) — the strongest case in cold climates with land or a well for the loop field.',
    costRange: [20000, 45000],
    costUnit: 'installed, 3-ton typical, varies heavily by loop type',
    paybackYears: [10, 20],
    co2ReductionTons: 2.5,
    confidence: 'sourced',
    source: { name: 'GeothermalFinder / DOE Geothermal Heat Pumps, 2026', url: 'https://geothermalfinder.com/costs/geothermal-heat-pump-cost/' },
    prerequisite: (inputs) => inputs.hasWell || inputs.landAvailable !== 'none',
    scoreFactors: (inputs) => {
      let score = 10;
      if (inputs.hasWell) score += 25;
      if (inputs.landAvailable === 'large') score += 25;
      else if (inputs.landAvailable === 'small') score += 10;
      if (inputs.climate === 'cold') score += 25;
      if (inputs.currentHeat === 'oil' || inputs.currentHeat === 'propane') score += 15;
      return Math.min(score, 100);
    },
  },
  {
    id: 'air-source-hp',
    name: 'Air-Source Heat Pump',
    category: CATEGORIES.HEATING,
    blurb: 'Lower upfront cost than geothermal, no yard work required — cold-climate models now perform well down to about -13°F.',
    costRange: [4000, 12000],
    costUnit: 'installed, ducted or ductless',
    paybackYears: [5, 10],
    co2ReductionTons: 1.8,
    confidence: 'sourced',
    source: { name: 'GeothermalInsider / DOE Heat Pump Systems, 2026', url: 'https://geothermalinsider.com/compare/geothermal-vs-air-source-heat-pump/' },
    prerequisite: (inputs) => true,
    scoreFactors: (inputs) => {
      let score = 25;
      if (inputs.currentHeat === 'oil' || inputs.currentHeat === 'propane' || inputs.currentHeat === 'coal') score += 25;
      if (inputs.currentHeat === 'electric-resistance') score += 20;
      if (inputs.secondaryHeat === 'oil' || inputs.secondaryHeat === 'propane' || inputs.secondaryHeat === 'coal') score += 10;
      if (inputs.climate !== 'cold') score += 15;
      if (!inputs.hasWell && inputs.landAvailable === 'none') score += 15; // fills the gap where geothermal isn't viable
      return Math.min(score, 100);
    },
  },
  {
    id: 'heat-pump-water-heater',
    name: 'Heat Pump Water Heater',
    category: CATEGORIES.WATER,
    blurb: '2–3x more efficient than a standard electric tank; a strong pairing with solar or battery sizing.',
    costRange: [1800, 4500],
    costUnit: 'installed, including venting/electrical if needed',
    paybackYears: [3, 7],
    co2ReductionTons: 0.5,
    confidence: 'estimate',
    source: { name: 'ENERGY STAR Heat Pump Water Heaters', url: 'https://www.energystar.gov/products/water_heaters/heat_pump_water_heaters' },
    prerequisite: (inputs) => inputs.currentWaterHeat !== 'heat-pump',
    scoreFactors: (inputs) => {
      let score = 30;
      if (inputs.currentWaterHeat === 'electric-tank') score += 25;
      if (inputs.currentWaterHeat === 'gas-tank' || inputs.currentWaterHeat === 'oil') score += 15;
      if (inputs.hasPoolOrHotTub) score += 5;
      return Math.min(score, 100);
    },
  },
  {
    id: 'battery-storage',
    name: 'Home Battery Storage',
    category: CATEGORIES.STORAGE,
    blurb: 'Sized to the backup duration you actually need — essentials-only for a couple days looks very different from whole-home multi-day backup.',
    costRange: [1000, 1200], // per kWh installed
    costUnit: 'per kWh installed (typical 10–15 kWh single unit)',
    paybackYears: [12, 25],
    co2ReductionTons: 0.2,
    confidence: 'sourced',
    source: { name: 'Avepower / Solar Price List, 2026', url: 'https://avebattery.com/blog/home-battery-storage-costs/' },
    prerequisite: (inputs) => {
      const targetKwh = Math.min(Math.max(inputs.backupDaysNeeded * 7, 5), 40);
      return (inputs.existingBatteryKwh || 0) < targetKwh;
    },
    scoreFactors: (inputs) => {
      let score = 10;
      if (inputs.backupDaysNeeded >= 3) score += 40;
      else if (inputs.backupDaysNeeded >= 1) score += 25;
      if (inputs.hasSolarPlanned) score += 20;
      if (inputs.gridReliability === 'unreliable') score += 20;
      return Math.min(score, 100);
    },
  },
  {
    id: 'ev-charger',
    name: 'Level 2 EV Charger',
    category: CATEGORIES.EV,
    blurb: 'Straightforward if your panel has spare capacity; a panel upgrade adds real cost if it doesn\'t.',
    costRange: [800, 3000],
    costUnit: 'installed, +$1,500–$4,000 more if a panel upgrade is needed',
    paybackYears: [2, 5],
    co2ReductionTons: 1.5,
    confidence: 'sourced',
    source: { name: 'EcoFlow / Hammerio EV Charger Cost Guides, 2026', url: 'https://hammerio.com/blog/ev-charger-installation-cost/' },
    prerequisite: (inputs) => inputs.wantsEV,
    scoreFactors: (inputs) => {
      let score = 0;
      if (inputs.wantsEV) score = 70;
      if (inputs.panelCapacity === 'ample') score += 20;
      if (inputs.panelCapacity === 'tight') score -= 10;
      return Math.max(0, Math.min(score, 100));
    },
  },
  {
    id: 'wood-pellet-stove',
    name: 'Wood or Pellet Stove',
    category: CATEGORIES.HEATING,
    blurb: 'Low-tech, resilient supplemental heat — especially relevant if you already have a chimney and access to wood.',
    costRange: [3000, 7000],
    costUnit: 'installed, including chimney/venting work',
    paybackYears: [6, 12],
    co2ReductionTons: 0.3,
    confidence: 'estimate',
    source: { name: 'EPA Certified Wood Stove guidance', url: 'https://www.epa.gov/burnwise' },
    prerequisite: (inputs) => (inputs.existingWoodStoveBtu || 0) === 0 && (inputs.hasChimney || inputs.currentHeat === 'wood'),
    scoreFactors: (inputs) => {
      let score = 15;
      if (inputs.woodAccess === 'own-land' || inputs.woodAccess === 'cheap-local') score += 30;
      if (inputs.hasChimney) score += 20;
      if (inputs.backupDaysNeeded >= 3) score += 15; // heat resilience during outages
      if (inputs.secondaryHeat === 'wood') score += 15; // already relying on wood as backup
      return Math.min(score, 100);
    },
  },
  {
    id: 'small-wind',
    name: 'Small Residential Wind Turbine',
    category: CATEGORIES.GENERATION,
    blurb: 'Only pencils out with strong, consistent average wind speeds and enough land setback — worth a real site assessment before committing.',
    costRange: [15000, 40000],
    costUnit: 'installed, depends on tower height and rated capacity',
    paybackYears: [12, 25],
    co2ReductionTons: 2.0,
    confidence: 'estimate',
    source: { name: 'DOE Wind Energy Technologies Office', url: 'https://www.energy.gov/eere/wind/small-wind-guidebook' },
    prerequisite: (inputs) => inputs.landAvailable !== 'none' && inputs.avgWindSpeed >= 10,
    scoreFactors: (inputs) => {
      let score = 0;
      if (inputs.avgWindSpeed >= 12) score += 50;
      else if (inputs.avgWindSpeed >= 10) score += 25;
      if (inputs.landAvailable === 'large') score += 25;
      return Math.min(score, 100);
    },
  },
];

const EXISTING_FUEL_TYPES = [
  { id: 'natural-gas', label: 'Natural gas furnace/boiler' },
  { id: 'oil', label: 'Oil furnace/boiler' },
  { id: 'propane', label: 'Propane furnace/boiler' },
  { id: 'coal', label: 'Coal (legacy system)' },
  { id: 'wood', label: 'Wood stove/furnace' },
  { id: 'electric-resistance', label: 'Electric resistance (baseboard)' },
  { id: 'air-source-hp', label: 'Already have an air-source heat pump' },
  { id: 'geothermal', label: 'Already have geothermal' },
];
