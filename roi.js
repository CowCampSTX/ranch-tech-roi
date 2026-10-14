// Ranch technology ROI model. Pure functions, no dependencies: the page (app.js) and the tests both use this file.
// Every number the page shows comes from analyze(); every formula is written out in README.md.

/** One input the model takes. `pct` inputs are entered and stored as percents (8 means 8%). */
export const FIELDS = [
  // group, key, label, unit, step
  ["Operation", "head", "Herd size", "head", 10],
  ["Operation", "years", "Years analyzed", "years", 1],
  ["Operation", "discountRate", "Discount rate", "%", 0.5],
  ["Upfront cost", "hardwarePerHead", "Hardware per head", "$/head", 1],
  ["Upfront cost", "fixedCost", "Base station, setup and install", "$", 100],
  ["Yearly cost", "subscriptionPerHead", "Subscription per head", "$/head/yr", 1],
  ["Yearly cost", "maintenancePct", "Repairs, as % of hardware", "%/yr", 0.5],
  ["Yearly cost", "replacementPct", "Devices lost or replaced", "%/yr", 1],
  ["Yearly benefit", "laborHoursPerWeek", "Labor hours saved", "hrs/week", 0.5],
  ["Yearly benefit", "wage", "Loaded labor cost", "$/hr", 1],
  ["Yearly benefit", "deathLossPts", "Death loss avoided", "% of herd", 0.1],
  ["Yearly benefit", "valuePerHead", "Value per head", "$/head", 50],
  ["Yearly benefit", "gainLbsPerHead", "Extra weight sold", "lbs/head", 1],
  ["Yearly benefit", "pricePerLb", "Price", "$/lb", 0.05],
  ["Yearly benefit", "otherSavings", "Fuel, vehicle and fence savings", "$/yr", 100],
  ["Yearly benefit", "year1Realized", "Benefit reached in year 1", "%", 5],
];

/**
 * Starting points for a 1,000-cow operation. Costs come from published prices (sources on the page and in README.md);
 * benefits are assumptions to replace with your own records. Prices change: check with the vendor before deciding.
 */
export const PRESETS = {
  "Halter virtual fencing": {
    // $4,500 infrastructure + 3 base stations at $3,000; subscription "less than $7 per head per month", collars included.
    head: 1000, years: 1, discountRate: 8,
    hardwarePerHead: 0, fixedCost: 13500,
    subscriptionPerHead: 84, maintenancePct: 0, replacementPct: 0,
    laborHoursPerWeek: 30, wage: 28, deathLossPts: 0.2, valuePerHead: 3000,
    gainLbsPerHead: 15, pricePerLb: 3.5, otherSavings: 30000, year1Realized: 60,
  },
  "Ranchbot water monitoring": {
    // 10 satellite monitors at $1,490 each; $365 per monitor per year = $3.65 per head across 1,000 head.
    head: 1000, years: 1, discountRate: 8,
    hardwarePerHead: 0, fixedCost: 14900,
    subscriptionPerHead: 3.65, maintenancePct: 0, replacementPct: 0,
    laborHoursPerWeek: 12, wage: 28, deathLossPts: 0.2, valuePerHead: 3000,
    gainLbsPerHead: 0, pricePerLb: 3.5, otherSavings: 4500, year1Realized: 90,
  },
  "EID tags and scale": {
    head: 1000, years: 1, discountRate: 8,
    hardwarePerHead: 4, fixedCost: 12000,
    subscriptionPerHead: 1, maintenancePct: 2, replacementPct: 100,
    laborHoursPerWeek: 3, wage: 28, deathLossPts: 0, valuePerHead: 3000,
    gainLbsPerHead: 10, pricePerLb: 3.5, otherSavings: 2000, year1Realized: 50,
  },
};

const r2 = (x) => Math.round(x * 100) / 100;

/** Year-by-year cash flows. Year 0 is the purchase; years 1..N are operating years. */
export function cashFlows(p) {
  const hardware = p.head * p.hardwarePerHead;
  const upfront = hardware + p.fixedCost;
  const yearlyCost = p.head * p.subscriptionPerHead
    + hardware * (p.maintenancePct / 100)
    + hardware * (p.replacementPct / 100);
  const fullBenefit = {
    labor: p.laborHoursPerWeek * 52 * p.wage,
    deathLoss: p.head * (p.deathLossPts / 100) * p.valuePerHead,
    gain: p.head * p.gainLbsPerHead * p.pricePerLb,
    other: p.otherSavings,
  };
  const benefitTotal = Object.values(fullBenefit).reduce((a, b) => a + b, 0);
  const rows = [{ year: 0, cost: upfront, benefit: 0, net: -upfront }];
  for (let y = 1; y <= Math.round(p.years); y++) {
    const realized = y === 1 ? Math.min(1, Math.max(0, p.year1Realized / 100)) : 1;
    const benefit = benefitTotal * realized;
    rows.push({ year: y, cost: yearlyCost, benefit, net: benefit - yearlyCost });
  }
  let cum = 0;
  for (const row of rows) row.cumulative = cum += row.net;
  return { rows, upfront, yearlyCost, fullBenefit, benefitTotal };
}

export function npv(rate, nets) {
  return nets.reduce((sum, cf, t) => sum + cf / (1 + rate) ** t, 0);
}

/** Internal rate of return by bisection; null when cash flows never turn positive enough. */
export function irr(nets) {
  let lo = -0.99, hi = 10;
  const f = (r) => npv(r, nets);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Years until cumulative (undiscounted) cash turns positive, interpolated within the year; null if never. */
export function payback(rows) {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].cumulative >= 0) {
      const before = rows[i - 1].cumulative;
      return i - 1 + (-before / rows[i].net);
    }
  }
  return null;
}

export function analyze(p) {
  const cf = cashFlows(p);
  const nets = cf.rows.map((r) => r.net);
  const totalCost = cf.rows.reduce((a, r) => a + r.cost, 0);
  const totalBenefit = cf.rows.reduce((a, r) => a + r.benefit, 0);
  return {
    ...cf,
    npv: npv(p.discountRate / 100, nets),
    irr: irr(nets),
    payback: payback(cf.rows),
    roi: totalCost ? (totalBenefit - totalCost) / totalCost : null,
    totalCost, totalBenefit,
    costPerHeadYear: p.head && p.years ? totalCost / (p.head * p.years) : null,
  };
}

/** Which inputs matter most: NPV with each input moved down and up by `swing` (0.2 = 20%), biggest spread first. */
export function tornado(p, swing = 0.2, keys = FIELDS.map((f) => f[1]).filter((k) => k !== "years")) {
  const base = analyze(p).npv;
  return keys
    .filter((k) => p[k] !== 0)
    .map((k) => {
      const low = analyze({ ...p, [k]: p[k] * (1 - swing) }).npv;
      const high = analyze({ ...p, [k]: p[k] * (1 + swing) }).npv;
      return { key: k, low, high, spread: Math.abs(high - low), base };
    })
    .sort((a, b) => b.spread - a.spread);
}

/**
 * The value of one input that makes NPV exactly zero, searching 0..10x the current value.
 * Returns {value} or {none: "positive"|"negative"} when NPV keeps one sign across that whole range.
 */
export function breakEven(p, key) {
  const f = (v) => analyze({ ...p, [key]: v }).npv;
  let lo = 0, hi = Math.max(1, Math.abs(p[key]) * 10);
  if (f(lo) * f(hi) > 0) return { none: f(lo) > 0 ? "positive" : "negative" };
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
  }
  return { value: r2((lo + hi) / 2) };
}

/** NPV over a grid of two inputs, for the two-way sensitivity table. */
export function grid(p, rowKey, rowValues, colKey, colValues) {
  return rowValues.map((rv) => colValues.map((cv) => analyze({ ...p, [rowKey]: rv, [colKey]: cv }).npv));
}
