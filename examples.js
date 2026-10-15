// The four synthetic examples (docs/audit/phase1-spec.md: section 11 and Appendix A for the inputs, 9.2 for `prov`,
// 9.5 items 4, 5 and 7 for the labels and the vendor fills). Pure data and functions, no DOM, so node tests check every
// value and its provenance. The ranches are made up for demonstration: they are not any real operation's data and not
// the site owner's operation. No example's inputs were tuned to reach a result.

/** The examples in the order the page lists them (9.5 item 5), with their names. */
export const EXAMPLE_IDS = ["ranchA", "ranchB", "ranchC", "ranchD"];
export const EXAMPLE_NAMES = {
  ranchA: "Synthetic Ranch A", ranchB: "Synthetic Ranch B", ranchC: "Synthetic Ranch C", ranchD: "Synthetic Ranch D",
};

const CHECKED = "undated; checked 15 Oct 2026";

// Sources (docs/audit/sources.md, section 13). `src` is the citation the label links to `url` (9.5 item 4).
const SOURCES = {
  allTex: { src: "All-Tex dealer flyer", url: "https://www.alltexirrigation.com/storage/UserFileFolder/Ranchbot_Flyer_-_All-Tex.pdf",
    pub: CHECKED, region: "US" }, // [S33]
  nrcsE614A: { src: "USDA NRCS, E614A enhancement sheet (enhancement life span 10 years)",
    url: "https://www.nrcs.usda.gov/sites/default/files/2025-02/E614A%20-%20Adding%20telemetry%20to%20a%20watering%20facility%20to%20monitor%20water%20levels%20remotely_09-24.pdf",
    pub: "Sep 2024", region: "US" }, // [S32]
  nassFarmLabor: { src: "USDA NASS, Farm Labor (Northern Plains livestock workers, reference week 6–12 April 2025)",
    url: "https://esmis.nal.usda.gov/sites/default/release-files/x920fw89s/0v839z45n/sx61gj70t/fmla0525.txt",
    pub: "21 May 2025", dataYear: 2025, region: "US (Northern Plains)" }, // [S73]
  blsEcec: { src: "U.S. Bureau of Labor Statistics, Employer Costs for Employee Compensation (legally required benefits)",
    url: "https://www.bls.gov/news.release/archives/ecec_09122025.htm", pub: "12 Sep 2025", dataYear: 2025, region: "US" }, // [S75]
  dtn: { src: "DTN", url: "https://www.dtnpf.com/agriculture/web/ag/news/article/2025/04/01/virtual-fencing-ranchers-new-best",
    pub: "31 Mar 2025", region: "US", reported: true }, // [S5]
  missouriG1193: { src: "University of Missouri Extension, G1193 Pasture Fence Construction Budget",
    url: "https://extension.missouri.edu/publications/g1193", pub: "Feb 2024", dataYear: 2024, region: "US (Missouri)" }, // [S89]
  iowaFM1855: { src: "Iowa State University Extension, FM-1855 Estimated Costs for Livestock Fencing (Table 6)",
    url: "https://www.extension.iastate.edu/agdm/livestock/pdf/b1-75.pdf", pub: "Dec 2024", region: "US (Iowa)" }, // [S90]
  jeffersTags: { src: "Jeffers retail listing", url: "https://jefferspet.com/products/usda-840-hdx-eid-tags", pub: CHECKED,
    region: "US" }, // [S61]
  jeffersReader: { src: "Jeffers retail listing", url: "https://jefferspet.com/products/xrs2-eid-stick-reader", pub: CHECKED,
    region: "US" }, // [S62]
  valleyVet: { src: "Valley Vet retail listing", url: "https://www.valleyvet.com/s3-weigh-scale-indicator-system-mp600/",
    pub: CHECKED, region: "US" }, // [S65]
};
// Each source's evidence class (9.2): [A] official statistics, [B] research and extension, [C] vendor information.
const CLASS_OF = {
  allTex: "C", nrcsE614A: "B", nassFarmLabor: "A", blsEcec: "B", dtn: "C", missouriG1193: "B", iowaFM1855: "B",
  jeffersTags: "C", jeffersReader: "C", valleyVet: "C",
};
const money = (source, more = {}) => ({ cls: CLASS_OF[source], ...SOURCES[source], currency: "USD", ...more });
const notMoney = (source, more = {}) => ({ cls: CLASS_OF[source], ...SOURCES[source], currency: null, ...more });
const PLACEHOLDER = { placeholder: true };

/**
 * "Use published vendor price" (9.5 item 7): the one fill of each price input that has a first-hand published price,
 * by module and path, with its [C] record. No other price input has a fill, and a reported price is never one.
 */
export const VENDOR_FILLS = {
  water: {
    "costs.monitors.unitCost": { value: 1490, prov: money("allTex") },
    "costs.subscription.unitCost": { value: 365, prov: money("allTex") },
  },
  eid: {
    // Stored unrounded ($156.99 ÷ 50) and shown as $3.14, its label followed by the pack price (9.5 item 4).
    "eid.tagPrice": { value: 156.99 / 50, prov: money("jeffersTags", { note: "$156.99 per 50" }) },
    "costs.reader.unitCost": { value: 1919, prov: money("jeffersReader") },
    "costs.indicatorBars.unitCost": { value: 1829.95, prov: money("valleyVet") },
  },
};

/** The fill for an input of analysis a, or null when the input has none (9.5 item 7). */
export const vendorFill = (a, path) => VENDOR_FILLS[a.module]?.[path] ?? null;

// Fields that hold no value of their own: identifiers, labels, notes, the flag the EID module sets on its cow tags,
// and the two flags of the user's own analysis. Every other field set in an example is a value with a `prov` record:
// the herd's head counts (`classes.cows.head`), a line's timing, basis and billing, a line's or an event's list of
// classes (one value, like a per-year array), and the fence's land unit among them (F10: every value the user did not
// type carries prov).
const NOT_VALUES = new Set(["module", "example", "prov", "id", "label", "name", "quoteNote", "sourceNote", "perAnimal",
  "ownAnalysis", "rateReviewed"]);

/**
 * The paths of the values set in analysis a (9.2 `prov` keys): every field except those above, each list item
 * addressed by its index ("water.blocks.0.shareAvoided"), a per-year array as one value ("labor.added.0.hours"), and
 * each ramp entry as its own value ("ramp.1").
 * A blank value (null, undefined, "" or an empty list) has no path.
 */
export function valuePaths(a, prefix = "", out = []) {
  for (const [k, v] of Object.entries(a ?? {})) {
    if (NOT_VALUES.has(k)) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    // The ramp is not a per-year array (9.2): each entry from ramp[1] on is its own value ("ramp.1"); ramp[0] is unused.
    if (path === "ramp" && Array.isArray(v)) v.forEach((x, i) => i > 0 && !(x === null || x === undefined || x === "") && out.push(`ramp.${i}`));
    else if (Array.isArray(v) && v.every((x) => typeof x !== "object" || x === null)) out.push(path);
    else if (Array.isArray(v)) v.forEach((item, i) => valuePaths(item, `${path}.${i}`, out));
    else if (typeof v === "object") valuePaths(v, path, out);
    else out.push(path);
  }
  return out;
}

/**
 * Gives every value of an example its `prov` record: the example's own [E] record ("made up"), or the record listed
 * for its path. A listed path that holds no value is an error, so the records cannot drift from the inputs.
 */
function withProv(a, records) {
  const src = `${EXAMPLE_NAMES[a.example]}: made-up example value`;
  const paths = valuePaths(a);
  for (const p of Object.keys(records)) if (!paths.includes(p)) throw new Error(`${a.example}: prov for "${p}", which holds no value`);
  a.prov = Object.fromEntries(paths.map((p) => [p, { cls: "E", src, ...records[p] }]));
  return a;
}

// The examples' discount rate: an assumption, not a recommendation (owner decision, 15 Oct 2026; 9.5 item 5).
const RATE = { src: "The synthetic examples' real rate: an example assumption, not a recommendation" };
const settings = (more) => ({ discountRate: 0.07, paybackTarget: 5, ownAnalysis: false, rateReviewed: false, opType: "cowCalf", ...more });
const owned = [{ id: "u1", kind: "owned", share: 1 }];

// Synthetic Ranch A (Appendix A): 900 cows, 10 water points on owned land, remote water monitoring over 10 years.
const ranchA = () => withProv({
  module: "water", example: "ranchA",
  settings: settings({ T: 10, oppCostPerHour: 20, landUnits: owned }),
  classes: { cows: { head: 900, valuePerHead: 2700 } }, heifersRetained: 0,
  served: { cows: {} }, // 12 months, the default
  labor: {
    freedTimeUse: "replacesPaidWork",
    cut: { laborUnit: "day", unitsCut: 16, hoursPerUnit: 8, paidRate: 18.72, loadPct: 0.1 },
    added: [{ label: "install", hours: [30, 0], doneBy: "unpaid" }, { label: "monitoring time", hours: 52, doneBy: "unpaid" }],
  },
  startYear: 0, ramp: [1, 1, 1, 1],
  costs: {
    monitors: { timing: "capital", basis: "perDevice", unitCost: 1490, lifeYears: 10, repairPct: 0, residual: { mode: "straightLine" } },
    mounting: { timing: "capital", basis: "fixed", unitCost: 750, lifeYears: null }, // 10 monitors × $75, one amount
    subscription: { timing: "annual", basis: "perDevice", unitCost: 365, billing: "advance" },
    batteries: { timing: "annual", basis: "perDevice", unitCost: [0, 0, 0, 0, 100, 0, 0, 0, 100, 0, 0], billing: "arrears" },
  },
  riskLines: [{ cause: "water", class: "cows", eventsPerYear: 0.15, headPerEvent: 5, shareCaught: 0.75 }],
  water: {
    monitors: 10,
    blocks: [
      { name: "summer", weeks: 22, runsPerWeek: 4, milesPerRun: 120, hoursPerRun: 6, minVisitsPerWeek: 2, freezeOrFeedRoute: false,
        shareAvoided: 0.5 },
      { name: "fall–winter", weeks: 30, runsPerWeek: 2, milesPerRun: 120, hoursPerRun: 6, minVisitsPerWeek: 1, freezeOrFeedRoute: true,
        shareAvoided: 0 },
    ],
    variableCostPerMile: 0.4,
  },
}, {
  "settings.discountRate": { cls: "E", ...RATE },
  "costs.monitors.unitCost": money("allTex"),
  "costs.monitors.lifeYears": notMoney("nrcsE614A"),
  "costs.mounting.unitCost": PLACEHOLDER,
  "costs.subscription.unitCost": money("allTex"),
  "costs.batteries.unitCost": PLACEHOLDER,
  "water.blocks.0.shareAvoided": {
    note: "A synthetic demonstration assumption, set at the 50% that the Utah State University Extension worked example "
      + "assumes (US, Utah; undated, checked 15 Oct 2026; https://extension.usu.edu/rangelands/research/save-time-money). "
      + "PIRSA (South Australia, February 2022 prices) assumes the same 50%: non-US context only, not a US value.",
  },
  "labor.cut.paidRate": money("nassFarmLabor"),
  "labor.cut.loadPct": notMoney("blsEcec"),
});

// The contract handling and hours cut of Synthetic Ranches B and D: $25/h, a synthetic placeholder at both paths.
const contractLabor = (handling) => ({
  freedTimeUse: "replacesPaidWork",
  cut: { laborUnit: "hour", unitsCut: 200, hoursPerUnit: 1, paidRate: 25, loadPct: 0 },
  handling: { ...handling, gathers: 2, gatherRiders: 3, hoursPerGather: 8, trainingRiders: 2, hoursPerDay: 6, doneBy: "paid",
    paidRate: 25, loadPct: 0 },
});
const leasedCollars = () => ({
  subscription: { timing: "annual", basis: "perHeadMonth", unitCost: 7, billing: "advance" },
  infrastructure: { timing: "capital", basis: "fixed", unitCost: 4500, lifeYears: null },
});
const VF_RECORDS = {
  "settings.discountRate": { cls: "E", ...RATE },
  "costs.subscription.unitCost": money("dtn"),
  "costs.infrastructure.unitCost": money("dtn"),
  "labor.cut.paidRate": PLACEHOLDER,
  "labor.handling.paidRate": PLACEHOLDER,
  "vf.fence.F": money("missouriG1193"),
  "vf.fence.Lf": notMoney("iowaFM1855"),
  "vf.fence.m": notMoney("iowaFM1855"),
};

// Synthetic Ranch B (Appendix A): 1,200 yearlings for a 5.5-month season, virtual fence instead of 8 miles of
// 2-strand polywire, over 7 years.
const ranchB = () => withProv({
  module: "vf", example: "ranchB",
  settings: settings({ T: 7, opType: "stocker", landUnits: owned }),
  classes: { yearlings: { head: 1200 } }, heifersRetained: 0,
  enrolled: { yearlings: { head: 1200, months: 5.5 } },
  labor: contractLabor({
    events: [{ label: "collar on", classes: ["yearlings"], timesPerYear: 1, minutesPerHead: 1.5, crewSize: 4 },
      { label: "collar off", classes: ["yearlings"], timesPerYear: 1, minutesPerHead: 1.5, crewSize: 4 }],
    trainingDays: 7,
  }),
  startYear: 0, ramp: [1, 1, 1, 1],
  costs: leasedCollars(),
  vf: {
    pricing: "leased", batteriesPerCollar: 0,
    collarLoss: { pctPerYear: 0, chargePerCollar: null }, // the quote is assumed to cover loss; no published charge
    fence: { landUnitId: "u1", miles: 8, planMiles: 8, F: 4300, k: 0, Lf: 4, m: 0.05, mode: "avoided" },
    gatherHoursToday: null, gatherHoursCut: 200, healthCheckHoursCut: 0, validatedAlert: false,
  },
}, VF_RECORDS);

// Synthetic Ranch C (Appendix A): 300 cows and 285 calves born, EID tags, reader and scale, over 7 years.
const ranchC = () => withProv({
  module: "eid", example: "ranchC",
  settings: settings({ T: 7, oppCostPerHour: 20 }),
  classes: { cows: { head: 300 }, calvesBorn: { head: 285 }, calvesSold: { head: 240 } }, heifersRetained: 0,
  served: { cows: {}, calvesBorn: {} },
  labor: {
    freedTimeUse: "absorbed",
    // 885 weighings a year (cows twice, calves once) at 20 seconds a read with a crew of 3: 14.75 h, unpaid.
    handling: { events: [{ label: "weighing", classes: ["cows"], timesPerYear: 2, minutesPerHead: 20 / 60, crewSize: 3 },
      { label: "weighing", classes: ["calvesBorn"], timesPerYear: 1, minutesPerHead: 20 / 60, crewSize: 3 }], doneBy: "unpaid" },
    added: [{ label: "data upkeep", hours: 15, doneBy: "unpaid" }],
  },
  startYear: 0, ramp: [1, 1, 1, 1],
  costs: {
    cowTags: { timing: "capital", classes: ["cows"], lifeYears: null, residual: { mode: "none" } },
    calfTags: { timing: "annual", billing: "arrears" },
    retags: { timing: "annual", billing: "arrears" },
    reader: { timing: "capital", basis: "fixed", unitCost: 1919, lifeYears: null, residual: { mode: "pctOfCost", pct: 0.15 } },
    indicatorBars: { timing: "capital", basis: "fixed", unitCost: 1830, lifeYears: null, residual: { mode: "pctOfCost", pct: 0.15 } },
    platform: { timing: "capital", basis: "fixed", unitCost: 800, lifeYears: null, residual: { mode: "pctOfCost", pct: 0.15 } },
    software: { timing: "annual", basis: "fixed", unitCost: 360, billing: "advance" },
  },
  eid: {
    ruleApplies: { cows: false, calvesBorn: false },
    tagPrice: 3.14, retagPct: 0.015, recordingHoursToday: 0,
    dosing: { perApplication: 0.45, applications: { cows: 2, calvesBorn: 1 } },
  },
}, {
  "settings.discountRate": { cls: "E", ...RATE },
  "eid.tagPrice": money("jeffersTags", { note: "rounded from $156.99 per 50" }),
  "costs.reader.unitCost": money("jeffersReader"),
  "costs.indicatorBars.unitCost": money("valleyVet", { note: "rounded from $1,829.95" }),
  "costs.platform.unitCost": PLACEHOLDER,
  "costs.software.unitCost": PLACEHOLDER,
  "eid.dosing.perApplication": PLACEHOLDER,
});

// Synthetic Ranch D (Appendix A), the good-fit example: 400 cows on 8,000 owned acres, virtual fence instead of
// 14.14 miles of 6-wire high-tensile cross-fence, over 7 years. Its fence miles are stored unrounded, and planMiles is
// left blank, so it defaults to them and the claim is not clamped.
const ranchD = () => withProv({
  module: "vf", example: "ranchD",
  settings: settings({ T: 7, landUnits: owned }),
  classes: { cows: { head: 400 } }, heifersRetained: 0,
  enrolled: { cows: { head: 400, months: 12 } },
  labor: contractLabor({
    events: [{ label: "collar fit check", classes: ["cows"], timesPerYear: 1, minutesPerHead: 1.5, crewSize: 4 }],
    trainingDays: [0, 7, 0], // the cow herd is trained once, in year 1
  }),
  startYear: 0, ramp: [1, 1, 1, 1],
  costs: leasedCollars(),
  vf: {
    pricing: "leased", batteriesPerCollar: 0,
    collarLoss: { pctPerYear: 0, chargePerCollar: null },
    fence: { landUnitId: "u1", miles: 2 * Math.sqrt(2000 / 640) * 4, F: 15100, k: 0, Lf: 25, m: 0.05, mode: "avoided" },
    gatherHoursToday: null, gatherHoursCut: 200, healthCheckHoursCut: 0, validatedAlert: false,
  },
}, VF_RECORDS);

const BUILD = { ranchA, ranchB, ranchC, ranchD };

/**
 * A fresh copy of an example's analysis, with its values and `prov` (9.5 item 5). It shares nothing with any other
 * copy, so a change to one never reaches another or a later load.
 */
export function example(id) {
  if (!BUILD[id]) throw new Error(`Unknown example "${id}"`);
  return structuredClone(BUILD[id]());
}
