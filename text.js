// Page text for Ranch Tech ROI, built from analyze() and combine() output (docs/audit/phase1-spec.md, 9.5). Pure
// functions, no DOM, so node tests check every string the page will show. Phase 1 adds to it step by step (9.1);
// the page shows it from step 6. Built so far: the formats and names of 9.5 items 9 and 11, and the notices of F1,
// F3 and F5 and the pool warnings of F9 (9.5 item 11).
import { CLASS_NAMES } from "./roi.js";

const MINUS = "−";

/** Generic module names (9.5 item 11); a fixture module is named by its own id. */
export const MODULE_NAMES = {
  water: "Remote water monitoring",
  vf: "Collar-based virtual fencing",
  eid: "EID tags and scale",
};

const POOL_NAMES = {
  waterRuns: "water runs",
  gatherHours: "moving and gathering hours",
  fenceMiles: "interior fence miles",
};

/** The input that gives a pool's baseline, where it can be left blank while a claim is made (9.6, 9.5 item 11). */
const BASELINE_INPUTS = { gatherHours: "moving and gathering hours today" };

export const moduleName = (id) => MODULE_NAMES[id] ?? id;
export const className = (c) => CLASS_NAMES[c] ?? c;

/** A pool as the notices name it: "water runs", "death loss (water)". */
export function poolName(pool) {
  if (pool.startsWith("deathLoss:")) return `death loss (${pool.slice("deathLoss:".length)})`;
  return POOL_NAMES[pool] ?? pool;
}

const signed = (x, body) => (x < 0 && /[1-9]/.test(body) ? MINUS : "") + body;

/** A quantity: two decimals, thousands separators, and no ".00" (9.5 item 11). */
export function quantity(x) {
  const body = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return signed(x, body.replace(/\.00$/, ""));
}

/** Money: whole dollars at $100 or more, cents below, thousands separators, and no ".00" (9.5 item 9). */
export function money(x) {
  const abs = Math.abs(x);
  const body = abs >= 100
    ? Math.round(abs).toLocaleString("en-US")
    : abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, "");
  return signed(x, "$" + body);
}

/** A count with its unit, singular when it shows as 1: "1 year", "2 years", "5 months". */
export function count(n, unit) {
  const q = quantity(n);
  return `${q} ${q === "1" ? unit : `${unit}s`}`;
}

/** Joins with "and", with commas before it when there are more than two (9.5 item 11). */
export function joinAnd(items) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The text of a notice from analyze() or a warning from combine() (9.5 item 11), or null for a notice whose text
 * comes with a later item.
 */
export function noticeText(n) {
  switch (n.type) {
    case "noCattle":
      return `No cattle in year ${n.year}: benefits not counted.`;
    case "absorbed":
      return "Freed time is absorbed, so no cash labor saving is counted.";
    case "commitPastHorizon":
      return `The horizon (${count(n.horizon, "year")}) ends inside the ${n.commitYears}-year contract on ${n.label}, `
        + `so its early-termination fee (${money(n.fee)}) is charged in year ${n.horizon}.`;
    case "perHeadYearMonths":
      return `${n.label} is billed for 12 months per head, but the ${className(n.class)} are `
        + `${n.enrolled ? "enrolled" : "served"} for ${count(n.months, "month")} in year ${n.year}. Check how your quote bills.`;
    case "poolClamp":
      return `The claim on ${poolName(n.pool)} is above the baseline in year ${n.year} (${quantity(n.claim)} against `
        + `${quantity(n.baseline)}), so it is counted only up to the baseline.`;
    case "baselineBlank":
      return `Enter ${BASELINE_INPUTS[n.pool] ?? `the baseline for ${poolName(n.pool)}`} to check the claim on ${poolName(n.pool)}.`;
    case "poolShared":
      return `${joinAnd(n.modules.map(moduleName))} claim the same ${poolName(n.pool)}: together ${quantity(n.claim)} `
        + `against a baseline of ${quantity(n.baseline)} in year ${n.year}, so each claim is scaled down in proportion.`;
    case "baselinesDiffer":
      return `${joinAnd(n.modules.map(moduleName))} report different baselines for ${poolName(n.pool)} in year ${n.year} `
        + `(${joinAnd(n.values.map(quantity))}); the largest, ${quantity(n.largest)}, is used.`;
    default:
      return null;
  }
}
