// Shared links (docs/audit/phase1-spec.md 9.5 item 8, B8): writing the state into the page's hash, reading it back,
// and converting a version 1 link (migrateV1). Pure functions, no DOM, so node tests read every kind of link. The page
// passes location.hash to readLink() when it opens and writes writeLink(state) into the hash as the state changes.
import { example, EXAMPLE_IDS } from "./examples.js";
import { V1_FIELDS, V1_PRESETS } from "./v1.js";
import { analyze, buildLines, CLASS_NAMES, defaultHorizon, MAX_YEARS, validate } from "./roi.js";

// ---------------------------------------------------------------- the s parameter: base64url of UTF-8 JSON

/** base64url (the URL-safe alphabet, without "=" padding) of the UTF-8 bytes of a text (9.5 item 8). */
export function toBase64url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The text that toBase64url() encoded. Throws on anything else: another alphabet, a bad length or invalid UTF-8. */
export function fromBase64url(s) {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error("not base64url");
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// ---------------------------------------------------------------- comparing states

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Deep equality of JSON values, whatever the order of an object's keys. */
export function same(x, y) {
  if (x === y) return true;
  if (Array.isArray(x) || Array.isArray(y)) {
    return Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v, i) => same(v, y[i]));
  }
  if (!isObject(x) || !isObject(y)) return false;
  const kx = Object.keys(x).filter((k) => x[k] !== undefined), ky = Object.keys(y).filter((k) => y[k] !== undefined);
  return kx.length === ky.length && kx.every((k) => same(x[k], y[k]));
}

const DEFAULT_TARGET = 5; // the payback target a link without one reads as (owner decision, 15 Oct 2026)
const withTarget = (settings) => ({ ...settings, paybackTarget: settings?.paybackTarget ?? DEFAULT_TARGET });

// ---------------------------------------------------------------- writing a link

/**
 * The hash of a link to state a, without its "#" (9.5 item 8): v=2&m=<module>&x=<example>&s=<base64url(JSON)>. s holds
 * each top-level key whose value differs from the example's, whole (so lists and lines are replaced whole and a
 * removal can be expressed), null for a key the example has and the state lacks, and for prov, by path, each record
 * that differs from the example's and null for each the state lacks. settings carries paybackTarget only when it is
 * not 5. A state equal to its example gives a link with no s.
 */
export function writeLink(a) {
  const ex = example(a.example);
  const s = {};
  for (const k of new Set([...Object.keys(ex), ...Object.keys(a)])) {
    if (k === "module" || k === "example" || k === "prov") continue;
    if (a[k] === undefined) {
      if (ex[k] !== undefined) s[k] = null;
    } else if (k === "settings") {
      if (!same(withTarget(a.settings), withTarget(ex.settings))) {
        const { paybackTarget, ...rest } = a.settings;
        s.settings = paybackTarget === undefined || paybackTarget === DEFAULT_TARGET ? rest : { ...rest, paybackTarget };
      }
    } else if (!same(a[k], ex[k])) {
      s[k] = a[k];
    }
  }
  const prov = {}, mine = a.prov ?? {}, theirs = ex.prov ?? {};
  for (const p of Object.keys(mine)) if (!same(mine[p], theirs[p])) prov[p] = mine[p];
  for (const p of Object.keys(theirs)) if (mine[p] === undefined) prov[p] = null;
  if (Object.keys(prov).length) s.prov = prov;
  const hash = `v=2&m=${a.module}&x=${a.example}`;
  return Object.keys(s).length ? `${hash}&s=${toBase64url(JSON.stringify(s))}` : hash;
}

// ---------------------------------------------------------------- reading a link

// The top-level keys of an analysis that a link can carry (9.2), besides module, example and the module's own inputs.
const STATE_KEYS = ["settings", "classes", "heifersRetained", "enrolled", "served", "labor", "startYear", "ramp", "costs",
  "benefitShares", "costShares", "riskLines", "production"];

// The shape of an analysis (9.2), for checking a state read from a link. A leaf is a finite number, a text, a yes/no
// answer or one of a field's listed values, and may be null (blank); a per-year field is a number or a list of them by
// year. Every list, object and keyed set has the shape its field holds, with no key the data model does not have. A
// blank fits a leaf, or a list or keyed set of leaves, never an object or a list of objects: a removed line or item is
// left out, not null. An id (a line's, a land unit's) is letters, digits, "_" and "-", with ":<n>" for a list item's
// line (added:0, risk:1), and never the name of a built-in member such as "toString", which the engine would read in
// its place. A list or keyed set holds at most MAX_ITEMS entries. A hand-made link whose state has another shape is
// unreadable rather than a wrong result, a NaN or a stopped page (judgment).
const NUM = { t: "num" }, YEARS = { t: "years" }, TEXT = { t: "text" }, YES = { t: "yes" }, ID = { t: "id" };
const oneOf = (...values) => ({ t: "oneOf", values });
const list = (item) => ({ t: "list", item });
const fields = (f) => ({ t: "fields", f });
const keyed = (keys, value) => ({ t: "keyed", keys, value }); // keys: the keys allowed, "id" or "path" (source records)
const either = (...shapes) => ({ t: "either", shapes });
// The longest list or keyed set: a value for each year of the longest horizon (T ≤ 50). Longer lists of items (land
// units, lines, risk lines) would make the analysis slow enough to stop the page, as a longer horizon would
// (judgment). Source records, which the analysis does not go through, are not limited.
const MAX_ITEMS = MAX_YEARS + 1;
const isId = (k) => /^[A-Za-z0-9_-]+(:\d+)?$/.test(k) && !(k in Object.prototype);
const isPath = (k) => /^[A-Za-z0-9_:.-]+$/.test(k) && k.split(".").every((x) => !(x in Object.prototype));
const CLASS_IDS = Object.keys(CLASS_NAMES);
const CLASS = oneOf(...CLASS_IDS);
const SHARE = either(NUM, keyed("id", NUM)); // an operator share, or one per land unit (9.3)
const PAID_BY = oneOf("paid", "unpaid");
const PARTY = oneOf("tenant", "landlord");
const COST_LINE = fields({
  id: TEXT, label: TEXT, kind: oneOf("cost"), timing: oneOf("capital", "annual"),
  basis: oneOf("fixed", "perDevice", "perHeadMonth", "perHeadYear"), classes: list(CLASS), unitCost: YEARS, qty: YEARS,
  startYear: NUM, operatorShare: SHARE, lifeYears: NUM, repairPct: NUM,
  residual: fields({ mode: oneOf("straightLine", "none", "pctOfCost", "amount"), pct: NUM, dollars: NUM }),
  perAnimal: YES, staysWithLand: YES, leaseReimbursement: NUM, billing: oneOf("advance", "arrears"), minQty: NUM,
  commitYears: NUM, earlyTerminationFee: NUM, paths: list(TEXT),
});
const PROV = fields({
  cls: oneOf("A", "B", "C", "D", "E"), src: TEXT, url: TEXT, pub: TEXT, dataYear: either(NUM, TEXT), region: TEXT,
  currency: TEXT, note: TEXT, reported: YES, placeholder: YES, confirmed: YES,
});
const ANALYSIS = fields({
  module: oneOf("water", "vf", "eid"),
  example: oneOf(...EXAMPLE_IDS),
  settings: fields({
    T: NUM, discountRate: NUM, paybackTarget: NUM, ownAnalysis: YES, rateReviewed: YES,
    opType: oneOf("cowCalf", "stocker", "seedstock", "other"), oppCostPerHour: NUM,
    landUnits: list(fields({
      id: ID, kind: oneOf("owned", "leased"), leaseYears: NUM, renewalExpected: YES, share: NUM,
      fenceBuiltBy: PARTY, fenceMaintainedBy: PARTY, waterBy: PARTY, careInLeaseRate: YES, fenceReimbursement: NUM,
    })),
  }),
  classes: keyed(CLASS_IDS, fields({ head: YEARS, valuePerHead: NUM, valueOfGain: NUM })),
  heifersRetained: YEARS,
  enrolled: keyed(CLASS_IDS, fields({ head: YEARS, months: YEARS })),
  served: keyed(CLASS_IDS, fields({ months: YEARS })),
  labor: fields({
    freedTimeUse: oneOf("absorbed", "replacesPaidWork"),
    cut: fields({ laborUnit: oneOf("hour", "day", "week", "position"), unitsCut: YEARS, hoursPerUnit: NUM, paidRate: NUM,
      salary: NUM, loadPct: NUM }),
    avoidedHire: fields({ salary: NUM, loadPct: NUM, startYear: NUM, years: NUM }),
    added: list(fields({ label: TEXT, hours: YEARS, doneBy: PAID_BY, paidRate: NUM, loadPct: NUM })),
    otherHoursSaved: NUM,
    handling: fields({
      events: list(fields({ label: TEXT, classes: list(CLASS), timesPerYear: NUM, minutesPerHead: NUM, crewSize: NUM })),
      gathers: NUM, gatherRiders: NUM, hoursPerGather: NUM, trainingDays: YEARS, trainingRiders: NUM, hoursPerDay: NUM,
      doneBy: PAID_BY, paidRate: NUM, loadPct: NUM,
    }),
  }),
  startYear: NUM,
  ramp: list(NUM),
  costs: keyed("id", COST_LINE),
  benefitShares: keyed("id", SHARE),
  costShares: keyed("id", SHARE),
  riskLines: list(fields({ cause: TEXT, class: CLASS, eventsPerYear: NUM, headPerEvent: NUM, shareCaught: NUM })),
  production: fields({ lbPerHeadPerDay: NUM, days: NUM, classes: list(CLASS), soldShare: NUM, fromRecords: YES, sourceNote: TEXT }),
  water: fields({
    monitors: NUM,
    blocks: list(fields({ name: TEXT, weeks: NUM, runsPerWeek: NUM, milesPerRun: NUM, hoursPerRun: NUM, minVisitsPerWeek: NUM,
      freezeOrFeedRoute: YES, shareAvoided: NUM })),
    variableCostPerMile: NUM,
    fewerChecksLoss: fields({ headPerYear: NUM, class: CLASS }),
  }),
  vf: fields({
    pricing: oneOf("leased", "purchased"), batteriesPerCollar: NUM, collarLoss: fields({ pctPerYear: NUM, chargePerCollar: NUM }),
    fence: fields({ landUnitId: ID, miles: NUM, planMiles: NUM, F: NUM, k: NUM, Lf: NUM, m: NUM, mode: oneOf("avoided", "deferred"), d: NUM }),
    gatherHoursToday: NUM, gatherHoursCut: NUM, healthCheckHoursCut: NUM, validatedAlert: YES,
  }),
  eid: fields({
    ruleApplies: keyed(CLASS_IDS, YES),
    freeTags: fields({ qty: YEARS, years: list(NUM) }),
    tagPrice: NUM, retagPct: NUM, recordingHoursToday: NUM,
    premium: fields({ saleCwt: NUM, premiumPerCwt: NUM, verificationFee: NUM, quoteNote: TEXT }),
    dosing: fields({ perApplication: NUM, applications: keyed(CLASS_IDS, NUM) }),
  }),
  prov: keyed("path", PROV),
});

const LEAF = new Set(["num", "years", "text", "yes", "id", "oneOf"]);
/** True when a blank (null) fits the shape: a leaf, or a list or keyed set of leaves (a cleared class list or share). */
const blankFits = (shape) => LEAF.has(shape.t) || (shape.t === "list" && LEAF.has(shape.item.t))
  || (shape.t === "keyed" && LEAF.has(shape.value.t)) || (shape.t === "either" && shape.shapes.some(blankFits));

/** True when v has the shape (above). The check follows the shape, so it goes only as deep as the data model. */
function fits(v, shape) {
  if (v === null) return blankFits(shape);
  switch (shape.t) {
    case "num": return Number.isFinite(v);
    case "years": return Number.isFinite(v) || (Array.isArray(v) && v.length <= MAX_ITEMS && v.every((x) => x === null || Number.isFinite(x)));
    case "text": return typeof v === "string";
    case "id": return typeof v === "string" && isId(v);
    case "yes": return typeof v === "boolean";
    case "oneOf": return shape.values.includes(v);
    case "either": return shape.shapes.some((s) => fits(v, s));
    case "list": return Array.isArray(v) && v.length <= MAX_ITEMS && v.every((x) => fits(x, shape.item));
    case "fields":
      return isObject(v) && Object.entries(v).every(([k, x]) => Object.hasOwn(shape.f, k) && (x === undefined || fits(x, shape.f[k])));
    case "keyed": {
      const key = shape.keys === "id" ? isId : shape.keys === "path" ? isPath : (k) => shape.keys.includes(k);
      const entries = isObject(v) ? Object.entries(v) : null;
      return entries !== null && (shape.keys === "path" || entries.length <= MAX_ITEMS)
        && entries.every(([k, x]) => key(k) && fits(x, shape.value));
    }
    default: return false;
  }
}

/**
 * True when the state has the shape of an analysis (9.2): settings is present with a discount rate (never blank), each
 * source record names its class, a [C] record with its source and date (9.5 item 4), and each cost line has a timing
 * and basis, as stored or as its module sets them. These hold whatever validation finds, so a state that loads with an
 * error to fix still computes once it is fixed.
 */
function wellFormed(state) {
  if (!fits(state, ANALYSIS) || !isObject(state.settings) || !Number.isFinite(state.settings.discountRate)) return false;
  const records = Object.values(state.prov ?? {}).every((r) => r.cls !== null && r.cls !== undefined
    && (r.cls !== "C" || (typeof r.src === "string" && typeof r.pub === "string")));
  return records && buildLines(state).every((l) => l.kind !== "cost" || l.flow !== undefined
    || (["capital", "annual"].includes(l.timing) && ["fixed", "perDevice", "perHeadMonth", "perHeadYear"].includes(l.basis)));
}

/**
 * The corrections of 9.2 on a state read from a link, in place: a negative number is set to 0 and a ramp value above 1
 * to 1. Returns each one as { path, from, to }, for the banner (9.5 item 11).
 */
function correct(state) {
  const out = [];
  const walk = (o, path) => {
    for (const [k, v] of Object.entries(o)) {
      const p = path ? `${path}.${k}` : k;
      if (typeof v === "number") {
        const to = v < 0 ? 0 : /^ramp\.\d+$/.test(p) && v > 1 ? 1 : v;
        if (to !== v) {
          out.push({ path: p, from: v, to });
          o[k] = to;
        }
      } else if (v !== null && typeof v === "object") {
        walk(v, p);
      }
    }
  };
  const { prov, ...values } = state;
  walk(values, "");
  Object.assign(state, values);
  return out;
}

/** True when the state's validation and, once it is valid, its analysis run and give finite results. */
function computes(state) {
  try {
    if (validate(state).length) return true; // the page shows the errors; the state still loads (9.5 item 7)
    const r = analyze(state);
    return [r.cashNPV, r.cashNPVWithRisk, r.economicNPV].every(Number.isFinite);
  } catch {
    return false;
  }
}

const unreadable = () => ({ kind: "unreadable", state: example("ranchA"), corrected: [] });

/**
 * Reads the page's hash (with or without its "#") into a state (9.5 item 8). Returns { kind, state, corrected,
 * horizonAssumed, v1 }:
 * - kind "none": an empty hash is not a link; the page opens on Synthetic Ranch A with no link banner.
 * - kind "v2": the example x with s applied; corrected lists the values set to a valid one (9.2), for the banner.
 *   horizonAssumed is true when s.settings has no T and none of the module's lines gives one (F2, row 51).
 * - kind "v1": a non-empty hash without v, converted by migrateV1(); v1 holds what its banner names.
 * - kind "unreadable": v present but not 2; x missing or not an example; m not the module of x; an s that cannot be
 *   decoded or that does not hold an analysis; the page opens on Synthetic Ranch A with the banner that says so.
 * Every state that loads, from either version, then passes the same validation as typed values (the page's job).
 */
export function readLink(hash) {
  const text = String(hash ?? "").replace(/^#/, "");
  if (!text) return { kind: "none", state: example("ranchA"), corrected: [] };
  const q = new URLSearchParams(text);
  if (!q.has("v")) return { kind: "v1", ...migrateV1(q), corrected: [] };
  if (q.get("v") !== "2") return unreadable();
  const x = q.get("x");
  if (!EXAMPLE_IDS.includes(x)) return unreadable();
  const state = example(x);
  if (q.get("m") !== state.module) return unreadable();
  if (!q.has("s")) return { kind: "v2", state, corrected: [] };

  let s;
  try {
    s = JSON.parse(fromBase64url(q.get("s")));
  } catch {
    return unreadable();
  }
  try {
    return applyLink(state, s);
  } catch {
    return unreadable(); // whatever a hand-made link holds, reading it never throws
  }
}

/** The example's state with the decoded s applied (9.5 item 8), checked and corrected; see readLink(). */
function applyLink(state, s) {
  if (!isObject(s)) return unreadable();
  for (const k of [...STATE_KEYS, state.module]) {
    if (!(k in s)) continue;
    if (s[k] === null) delete state[k];
    else state[k] = s[k];
  }
  if (!isObject(state.settings)) return unreadable(); // every analysis has settings (9.2)
  state.settings = withTarget(state.settings);
  if (isObject(s.prov)) {
    state.prov = { ...state.prov, ...s.prov };
    for (const [p, v] of Object.entries(state.prov)) if (v === null) delete state.prov[p];
  } else if ("prov" in s && s.prov !== null) {
    return unreadable();
  }
  if (!wellFormed(state)) return unreadable();
  const corrected = correct(state); // before the prefill, so that T is taken from the values that load
  let horizonAssumed = false;
  if (isObject(s.settings) && (state.settings.T === undefined || state.settings.T === null)) {
    const h = defaultHorizon(state);
    state.settings.T = h.T;
    horizonAssumed = h.assumed;
  }
  if (!computes(state)) return unreadable();
  return { kind: "v2", state, corrected, horizonAssumed };
}

// ---------------------------------------------------------------- version 1 links (migrateV1)

const V1_MODULES = { "Collar-based virtual fencing": "vf", "Remote water monitoring": "water", "EID tags and scale": "eid" };
// The names earlier version 1 pages (14 Oct 2026, before d0fd9b8) wrote into their links, read as the starting points
// they became (spec issue; judgment): 73ac97d's two presets had the same values as d0fd9b8's. "Virtual fencing"
// (457025c to 28366f1) is not one: its preset values differ from d0fd9b8's, so it takes the unknown-name path and its
// banner sentence (9.5 item 8). The names stay in code: the page shows only the generic names (owner decision).
const V1_ALIASES = { "Halter virtual fencing": "Collar-based virtual fencing", "Ranchbot water monitoring": "Remote water monitoring" };
const V1_EXAMPLES = { vf: "ranchB", water: "ranchA", eid: "ranchC" };
const V1_DEFAULT = "Collar-based virtual fencing"; // the first v1 starting point, as today's page opens (app.js:24, :30)
const V1_DROPPED = ["deathLossPts", "valuePerHead", "gainLbsPerHead", "pricePerLb", "otherSavings", "replacementPct"];
const SRC = "version 1 link";

/**
 * Converts a version 1 link (9.5 item 8). It rebuilds the full v1 input from the frozen V1_PRESETS plus the link's
 * values, read as version 1 read them (a value that is not a number is skipped; judgment: so is one that is not
 * finite), sets a negative value to 0 (and a year-1 share above 100% to 100%, the ramp's limit, 9.2), and maps the
 * result to a state of the matching example's module, as the table of 9.5 item 8 says. params: URLSearchParams, or
 * anything URLSearchParams takes. Returns { state, v1 }, where v1 = { unknownPreset, notCarried, corrected,
 * subscription, example } lists what the banner names (9.5 item 11): the v1 fields not carried over whose value is not
 * 0, in V1_FIELDS order; each corrected field as { field, from, to }; whether a v1Subscription line was created; and
 * the example the land units came from.
 */
export function migrateV1(params) {
  const q = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const named = q.get("preset") ?? "";
  const name = Object.hasOwn(V1_ALIASES, named) ? V1_ALIASES[named] : named;
  const unknownPreset = !Object.hasOwn(V1_PRESETS, name);
  const preset = unknownPreset ? V1_DEFAULT : name;
  const v = { ...V1_PRESETS[preset] };
  const set = new Set();
  for (const [, k] of V1_FIELDS) {
    if (!q.has(k)) continue;
    const x = +q.get(k); // as version 1 read it (app.js:31 at d0fd9b8)
    if (!Number.isFinite(x)) continue;
    v[k] = x;
    set.add(k);
  }
  const corrected = [];
  for (const [, k] of V1_FIELDS) {
    const to = v[k] < 0 ? 0 : k === "year1Realized" && v[k] > 100 ? 100 : v[k];
    if (to !== v[k]) {
      corrected.push({ field: k, from: v[k], to });
      v[k] = to;
    }
  }

  const module = V1_MODULES[preset], exId = V1_EXAMPLES[module], ex = example(exId);
  const head = v.head;
  const rec = (k) => ({ cls: set.has(k) ? "D" : "E", src: SRC });
  const settings = { T: v.years, discountRate: v.discountRate / 100, paybackTarget: DEFAULT_TARGET, ownAnalysis: true,
    rateReviewed: false, opType: "cowCalf", oppCostPerHour: v.wage };
  if (ex.settings.landUnits) settings.landUnits = structuredClone(ex.settings.landUnits);
  const state = {
    module, example: exId, settings,
    classes: { cows: { head } },
    heifersRetained: 0,
    ...(module === "vf" ? { enrolled: { cows: { head, months: 12 } } } : { served: { cows: { months: 12 } } }),
    labor: { freedTimeUse: "absorbed", otherHoursSaved: v.laborHoursPerWeek * 52 },
    startYear: 0,
    ramp: [1, v.year1Realized / 100, 1, 1],
    costs: {},
    benefitShares: {}, costShares: {},
    riskLines: [],
  };
  if (module === "eid") state.eid = { ruleApplies: Object.fromEntries(Object.keys(ex.eid?.ruleApplies ?? { cows: false }).map((c) => [c, false])) };

  const prov = {
    "classes.cows.head": rec("head"),
    "settings.T": rec("years"),
    "settings.discountRate": rec("discountRate"),
    "settings.oppCostPerHour": rec("wage"),
    "labor.otherHoursSaved": rec("laborHoursPerWeek"),
    "ramp.1": rec("year1Realized"),
  };
  // Enrolled head is the v1 head too (judgment), so it carries the same record; its 12 months are set by the migration.
  if (module === "vf") prov["enrolled.cows.head"] = rec("head");
  // A cost taken from V1_PRESETS is a placeholder, except the two that are vendor prices as they stand; a cost the
  // link set is the user's [D] value (9.5 item 8).
  const price = (k, vendor) => (set.has(k) ? rec(k) : vendor ?? { cls: "E", src: SRC, placeholder: true });
  if (v.hardwarePerHead !== 0) {
    state.costs.v1Hardware = { id: "v1Hardware", label: "Hardware per head", kind: "cost", timing: "capital", basis: "perDevice",
      classes: ["cows"], unitCost: v.hardwarePerHead, lifeYears: null, residual: { mode: "none" }, repairPct: v.maintenancePct / 100 };
    prov["costs.v1Hardware.unitCost"] = price("hardwarePerHead");
    prov["costs.v1Hardware.repairPct"] = rec("maintenancePct");
  }
  if (v.fixedCost !== 0) {
    state.costs.v1Fixed = { id: "v1Fixed", label: "Base station, setup and install", kind: "cost", timing: "capital",
      basis: "fixed", unitCost: v.fixedCost, lifeYears: null, residual: { mode: "none" } };
    prov["costs.v1Fixed.unitCost"] = price("fixedCost", module === "water"
      ? { ...ex.prov["costs.monitors.unitCost"], note: "10 monitors × $1,490 (version 1 link)" } : undefined);
  }
  if (v.subscriptionPerHead !== 0) {
    state.costs.v1Subscription = { id: "v1Subscription", label: "Subscription per head", kind: "cost", timing: "annual",
      basis: "perHeadYear", classes: ["cows"], unitCost: v.subscriptionPerHead / 12, billing: "advance" };
    prov["costs.v1Subscription.unitCost"] = price("subscriptionPerHead", module === "vf"
      ? { ...ex.prov["costs.subscription.unitCost"], note: SRC } : undefined);
  }
  for (const [p, r] of Object.entries(ex.prov)) if (p.startsWith("settings.landUnits")) prov[p] = structuredClone(r);
  state.prov = prov;

  const notCarried = V1_FIELDS.map(([, k]) => k).filter((k) => v[k] !== 0
    && (V1_DROPPED.includes(k) || (k === "maintenancePct" && !state.costs.v1Hardware)));
  return { state, v1: { unknownPreset, notCarried, corrected, subscription: !!state.costs.v1Subscription, example: exId } };
}
