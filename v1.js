// Version 1 of the calculator, kept only so that its links can be read (docs/audit/phase1-spec.md 9.1 step 6, 9.5
// item 8): its inputs (V1_FIELDS: group, key, label, unit, step) and its three starting points (V1_PRESETS). The model
// itself left this file when the page moved to roi.js. Pure data, no DOM.

/**
 * The inputs and starting points of version 1 exactly as they were at commit d0fd9b8, before phase 1 changed anything,
 * so that links made with that version can be read and converted (B8, migrateV1 in links.js).
 */
export const V1_FIELDS = [
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

export const V1_PRESETS = {
  "Collar-based virtual fencing": {
    head: 1000, years: 1, discountRate: 8,
    hardwarePerHead: 0, fixedCost: 13500,
    subscriptionPerHead: 84, maintenancePct: 0, replacementPct: 0,
    laborHoursPerWeek: 30, wage: 28, deathLossPts: 0.2, valuePerHead: 3000,
    gainLbsPerHead: 15, pricePerLb: 3.5, otherSavings: 30000, year1Realized: 60,
  },
  "Remote water monitoring": {
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
