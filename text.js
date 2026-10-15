// Page text for Ranch Tech ROI, built from analyze() and combine() output (docs/audit/phase1-spec.md, 9.5). Pure
// functions, no DOM, so node tests check every string the page will show. Phase 1 adds to it step by step (9.1);
// the page shows it from step 6. Built so far: the formats and names of 9.5 items 9 and 11; the notices of F1, F3,
// F4, F5, F6 and F7 and the pool warnings of F9 (9.5 items 4 and 11); the state texts, tiles and verdict of F8; and,
// with the modules, the water-block warnings, the EID rule notice (B4a), the price labels (9.5 item 4) and the
// examples' banners (9.5 item 5).
import { CLASS_NAMES } from "./roi.js";

const MINUS = "−";

/** Help texts the page shows beside an input (9.3 Production). */
export const HELP = {
  valueOfGain: "Dollars per pound of added weight, not the sale price per pound: heavier cattle sell for fewer dollars a "
    + "pound. USDA NASS's \"calves\" price covers animals under 500 lb.",
};

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

/** A share stored as a fraction, shown as a percent: 0.5 → "50%", 0.255 → "25.50%" (9.2, 9.5 item 11). */
export const percent = (x) => `${quantity(x * 100)}%`;

/** A count with its unit, singular when it shows as 1 or −1: "1 year", "2 years", "−1 hour", "5 months". */
export function count(n, unit) {
  const q = quantity(n);
  return `${q} ${q.replace(MINUS, "") === "1" ? unit : `${unit}s`}`;
}

/** Joins with "and", with commas before it when there are more than two (9.5 item 11). */
export function joinAnd(items) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The B4a notice while the EID rule question is answered yes for any class (9.4, 10.1 row 36). */
export const EID_RULE_NOTICE = "Compliance treatment is pending verification of the rule's current status. All tags are "
  + "counted as project costs here, which may understate the case for EID if your tags are required anyway. Check with "
  + "your state veterinarian.";

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
    case "leaseEnds":
      return `The lease on land unit ${n.unit} ends in year ${n.year}, inside the ${n.horizon}-year horizon. Its share of `
        + "each benefit stops then; its costs run as entered, except improvements that stay with the land, which stop at "
        + "the lease end and are credited any reimbursement.";
    case "waterCare":
      return `On land unit ${n.unit}, ${n.reason === "landlord" ? "the landlord provides and checks the water" : "water care is included in the lease rate"}, `
        + "so the vehicle, labor and hours-freed savings there go to the landowner by default and are listed under 'Received by others'.";
    case "notEntered":
      return `${n.label}: not entered, not counted`;
    case "valueOfGainRange":
      return `Value of gain ${money(n.value)}/lb is outside the usual range of $0.10 to $5/lb. Check that it is entered in $/lb, not $/cwt (100 lb).`;
    case "valueOfGainAboveSale":
      return "Value of gain is normally below the sale price per pound.";
    case "quoteWeights":
      return "Value of gain: the heavier quote's weight must be above the base quote's weight.";
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
    case "freezeShare":
      return `The ${n.block} block is marked 'tanks freeze / water checked on the feeding route', so its share of runs `
        + `avoided is normally 0%. Check the ${percent(n.share)} you entered.`;
    case "shareAboveCap":
      return `The ${n.block} block's share of runs avoided is limited to ${percent(n.cap)} by the minimum visits; you entered ${percent(n.share)}.`;
    case "eidRulePending":
      return EID_RULE_NOTICE;
    case "baselinesDiffer":
      return `${joinAnd(n.modules.map(moduleName))} report different baselines for ${poolName(n.pool)} in year ${n.year} `
        + `(${joinAnd(n.values.map(quantity))}); the largest, ${quantity(n.largest)}, is used.`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- metrics, tiles and verdict (F8)

/** IRR as the page shows it (9.3 Metrics): a percent to one decimal with thousands separators, or its state. */
export function irrText(x) {
  switch (x.state) {
    case "noFlows": return "n/a: no cash flows";
    case "noOutlay": return `n/a: no net outlay in year ${x.year}`;
    case "signChanges": return "n/a: cash flows change sign more than once";
    case "below0": return "below 0%";
    case "above": return "above 10,000%";
    default: return `${(x.value * 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }
}

/** Payback (or discounted payback) as the page shows it (9.3 Metrics): years to two decimals, or its state. */
export function paybackText(p) {
  switch (p.state) {
    case "noFlows": return "n/a: no cash flows";
    case "noOutlay": return "no net outlay: cumulative cash never negative";
    case "none": {
      let text = `none within ${count(p.T, "year")}`;
      if (p.noOutlayYear !== undefined) text += ` (no net outlay in year ${p.noOutlayYear}; cumulative negative from year ${p.negativeFrom})`;
      if (p.positiveYears.length) text += ` (positive in year(s) ${p.positiveYears.join(", ")}, negative again by year ${p.T})`;
      return text;
    }
    default: {
      let text = `${p.years.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} years`;
      if (p.earlyPositive !== undefined) text += ` (cumulative was positive in year ${p.earlyPositive}, then negative again before year ${p.before})`;
      if (p.s0 > 0) text += ` (counted from year 0; the first cash flow is in year ${p.s0})`;
      return text;
    }
  }
}

const FIRST_HAND = ["A", "D"];

/**
 * The rounding unit of the headline figures (7.3): $100 when every material input is [A] or [D], else $1,000. A line
 * is material when its |PV| is at least 10% of PV(B) + PV(R); its inputs are its `paths`, each with the class of its
 * `prov` record. A material line with no recorded inputs counts as not first-hand.
 */
export function roundingUnit(a, r) {
  const floor = 0.1 * (r.pv.B + r.pv.R);
  const material = r.lines.filter((l) => Math.abs(l.pv ?? 0) >= floor && Math.abs(l.pv ?? 0) > 0);
  const firstHand = (l) => (l.paths ?? []).length > 0 && l.paths.every((p) => FIRST_HAND.includes(a.prov?.[p]?.cls));
  return material.every(firstHand) ? 100 : 1000;
}

/** A headline NPV on a tile (9.5 item 2): "about −$11,000", or "about break-even" when it rounds to $0. */
export function aboutMoney(x, unit) {
  const rounded = Math.round(Math.abs(x) / unit) * unit;
  return rounded === 0 ? "about break-even" : `about ${signed(x, "$" + rounded.toLocaleString("en-US"))}`;
}

/** True while the rate shows the example's label: an example's unedited value, not one from a version 1 link (9.5 item 5). */
export function exampleRate(a) {
  const p = a.prov?.["settings.discountRate"];
  return p?.cls === "E" && p.src !== "version 1 link";
}

/**
 * The verdict sentence (9.5 item 1), built so far from its first three parts: the amount over T years at the rate,
 * before tax; the state by the "pays" rule of 9.3; and, when cash NPV is below 0 and there are cash benefits, the
 * rise they would need. The sentence that names the drivers joins with the sensitivity port (9.1 step 6).
 */
export function verdictSentence(a, r) {
  if (r.noCashFlows) return "No cash flows for you in this analysis.";
  const unit = roundingUnit(a, r);
  const pct = quantity(r.rate * 100);
  const rate = exampleRate(a) ? `the example's ${pct}% real rate (an assumption, not a recommendation)` : `your ${pct}% real rate`;
  const X = Math.round(Math.abs(r.cashNPV) / unit) * unit;
  const amount = X === 0 ? `is within ${money(unit / 2)} of breaking even`
    : r.cashNPV >= 0 ? `saves about ${money(X)} more than it costs` : `costs about ${money(X)} more than it saves`;
  const parts = [`Over ${count(r.T, "year")} at ${rate}, before tax, this ${amount} in cash.`];
  parts.push(r.cashNPV >= 0 ? "It pays." : r.cashNPVWithRisk >= 0 ? "It pays only if the loss estimate holds." : "It does not pay.");
  if (r.cashNPV < 0 && r.pv.B > 0) {
    const f = (r.pv.C - r.pv.R) / r.pv.B;
    parts.push(f >= 2 ? `Cash benefits would need to rise about ${f.toFixed(1)}-fold.`
      : `Cash benefits would need to rise by about ${Math.max(1, Math.round((f - 1) * 100))}%.`);
  }
  return parts.join(" ");
}

/** The capacity-hours line under the verdict (9.5 item 1), or null when the average rounds to 0. */
export function capacityLine(r) {
  const h = Math.round(r.hoursFreedPerYear);
  if (h === 0) return null;
  const hours = `${quantity(Math.abs(h))}${h > 0 ? "" : " more"} ${Math.abs(h) === 1 ? "hour" : "hours"}`;
  return `It also ${h > 0 ? "frees" : "takes"} about ${hours} a year of your time (not cash).`;
}

export const PUBLISHED_PRICES = "Published prices describe what the equipment costs. They do not support the projected savings, which come from your entries or the example's assumptions.";

/** The verdict's notes on the rate and the placeholders, each while it applies (9.3, 9.5 item 1). */
export function verdictNotes(a) {
  const own = a.settings.ownAnalysis;
  const notes = [];
  if (own && !a.settings.rateReviewed) notes.push("Discount rate not yet reviewed.");
  if (own && Object.values(a.prov ?? {}).some((p) => p.placeholder && !p.confirmed)) notes.push("Includes synthetic cost placeholders.");
  return notes;
}

/**
 * The headline tiles (9.5 item 2): each label followed by " (before tax)", and its value as the tile shows it. The
 * losses-avoided tile shows only when a risk line is entered: a blank one, such as the water module's losses from
 * fewer physical checks by default, counts 0 and is listed as not entered instead.
 */
export function tiles(a, r) {
  const unit = roundingUnit(a, r);
  const out = [["Cash NPV", aboutMoney(r.cashNPV, unit)]];
  if (r.lines.some((l) => l.kind === "risk" && !l.missing)) out.push(["Cash NPV including expected losses avoided", aboutMoney(r.cashNPVWithRisk, unit)]);
  out.push(
    ["Economic NPV", aboutMoney(r.economicNPV, unit)],
    ["Cash payback", paybackText(r.payback)],
    ["BCR", r.bcr === null ? "n/a" : r.bcr.toFixed(2)],
    ["Cost per head-month", r.costPerHeadMonth === null ? "n/a" : `$${r.costPerHeadMonth.toFixed(2)}`],
    ["Hours freed per year", count(Math.round(r.hoursFreedPerYear), "hour")],
    ["IRR", irrText(r.irr)],
  );
  return out.map(([label, value]) => ({ label: `${label} (before tax)`, value }));
}

// ---------------------------------------------------------------- examples and price labels (9.5 items 4 and 5)

const SYNTHETIC = "Made-up numbers for demonstration, not any real operation's data.";
/** The banner of each example while the analysis is not yet the user's own (9.5 item 5). */
export const EXAMPLE_BANNERS = {
  ranchA: `Synthetic example ranch. ${SYNTHETIC}`,
  ranchB: `Synthetic example ranch. ${SYNTHETIC}`,
  ranchC: `Synthetic example ranch. ${SYNTHETIC}`,
  ranchD: `Good-fit synthetic example: conditions where this technology is most likely to pay. ${SYNTHETIC} Check whether your operation matches.`,
};

/**
 * The label of a price input (9.5 item 4), from its `prov` record: a synthetic placeholder; a vendor price reported
 * second-hand; a published list price, followed by its note in parentheses when the value was rounded from it or
 * computed from a pack price; or "your quote" for a typed price. The source part is the citation the page links to
 * prov.url. null for a price with no record (blank: "Quote required", 9.5 item 7).
 */
export function priceLabel(prov) {
  if (!prov) return null;
  if (prov.placeholder) return "Synthetic placeholder, not a price. Replace with your quote.";
  if (prov.cls === "D") return "your quote";
  if (prov.cls !== "C") return null;
  const cite = `${prov.src}, ${prov.pub}`;
  if (prov.reported) return `Vendor information: reported price (${cite}), not a published list price. Not an endorsement. Replace with your quote.`;
  return `Vendor information: published list price (${cite}). Not an endorsement. Replace with your quote.${prov.note ? ` (${prov.note})` : ""}`;
}
