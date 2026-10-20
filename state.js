// What each user action does to the state (docs/audit/phase1-spec.md: 9.1 "state.js", 9.2, 9.5 items 5 and 7). Pure
// functions, no DOM: each takes a state (an analysis, 9.2) and returns the next one, and never changes the one it is
// given. A call that changes nothing returns its state unchanged. The page (app.js) connects its buttons and inputs to
// these and holds no state logic of its own, so node tests drive every action the page offers.
import { example, vendorFill } from "./examples.js";
import { at, landUnitsOf, lastShownYear } from "./roi.js";

/**
 * The cost lines a module can hold (9.4), with what a new one holds: its price is blank, so it reads "Quote required"
 * until a quote or a vendor fill is entered (9.5 item 7). A line the page adds or removes is the user's change.
 */
export const LINE_TEMPLATES = {
  water: {
    monitors: { timing: "capital", basis: "perDevice", unitCost: null, lifeYears: null },
    mounting: { timing: "capital", basis: "fixed", unitCost: null, lifeYears: null },
    subscription: { timing: "annual", basis: "perDevice", unitCost: null, billing: "advance" },
    batteries: { timing: "annual", basis: "perDevice", unitCost: null, billing: "arrears" },
  },
  vf: {
    subscription: { timing: "annual", basis: "perHeadMonth", unitCost: null, billing: "advance" },
    collars: { timing: "capital", basis: "perDevice", unitCost: null, lifeYears: null },
    serviceFee: { timing: "annual", basis: "perDevice", unitCost: null, billing: "advance" },
    collarBatteries: { timing: "annual", unitCost: null },
    baseStations: { timing: "capital", basis: "perDevice", qty: 1, unitCost: null, lifeYears: null },
    infrastructure: { timing: "capital", basis: "fixed", unitCost: null, lifeYears: null },
  },
  eid: {
    cowTags: { timing: "capital", classes: ["cows"], lifeYears: null, residual: { mode: "none" } },
    calfTags: { timing: "annual", billing: "arrears" },
    retags: { timing: "annual", billing: "arrears" },
    reader: { timing: "capital", basis: "fixed", unitCost: null, lifeYears: null },
    indicatorBars: { timing: "capital", basis: "fixed", unitCost: null, lifeYears: null },
    platform: { timing: "capital", basis: "fixed", unitCost: null, lifeYears: null },
    software: { timing: "annual", basis: "fixed", unitCost: null, billing: "advance" },
  },
};
// The lines a virtual fence analysis needs for its pricing model (9.4): the page adds them, blank, when it is chosen.
export const PRICING_LINES = { leased: ["subscription"], purchased: ["collars", "serviceFee"] };

const blank = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.every(blank));
const clone = (a) => structuredClone(a);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

/** The value at a path ("water.blocks.0.shareAvoided"), or undefined. */
export function getAt(obj, path) {
  return path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
}

/**
 * Sets the value at a path in place, creating the objects (or, before an index, the lists) on the way. A list that
 * grows to a new index fills the entries in between with what they held before: the ramp's default, 1; a per-year
 * list's last number (a shorter array carries its last value forward, 9.2); otherwise blanks. A path through
 * a number or a string, such as an entry of a per-year field entered as one number, is an error: the caller replaces
 * the whole field instead.
 */
function setAt(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  keys.slice(0, -1).forEach((k, i) => {
    // A share by land unit is keyed by the unit's id, which can be all digits: an object, never a list (9.2 F6).
    const list = /^\d+$/.test(keys[i + 1]) && !SHARES_BY_UNIT.test(keys.slice(0, i + 1).join("."));
    if (o[k] === null || o[k] === undefined) o[k] = list ? [] : {};
    if (typeof o[k] !== "object") throw new Error(`Cannot set "${path}": "${keys.slice(0, i + 1).join(".")}" holds a single value`);
    o = o[k];
  });
  const last = keys[keys.length - 1];
  if (Array.isArray(o)) {
    // The ramp's entries default to 1 (9.2, 9.3); a per-year list of numbers carries its last value; any other list,
    // such as a list of classes, gets blanks.
    const end = o[o.length - 1];
    const pad = keys[0] === "ramp" && keys.length === 2 ? 1 : typeof end === "number" ? end : null;
    while (o.length < Number(last)) o.push(pad);
  }
  o[last] = value;
}

// A line's shares by land unit: "costs.<id>.operatorShare", "costShares.<id>" or "benefitShares.<id>", keyed by unit id.
const SHARES_BY_UNIT = /(^costs\.[^.]+\.operatorShare|^(costShares|benefitShares)\.[^.]+)$/;

/**
 * The `prov` key of the value a path writes (9.2): the path itself, except for an entry of a per-year list of numbers
 * ("classes.cows.head.3", "labor.cut.unitsCut.2"), which is part of one value with its record on the list's path. The
 * ramp is not a per-year array (9.2): each entry is its own value, "ramp.1" (as 9.5 item 8 records it).
 */
function provKey(a, path) {
  const keys = path.split(".");
  if (keys.length < 2 || keys[0] === "ramp" || !/^\d+$/.test(keys[keys.length - 1])) return path;
  if (SHARES_BY_UNIT.test(keys.slice(0, -1).join("."))) return path;
  const parent = keys.slice(0, -1).join(".");
  const list = getAt(a, parent);
  return list === undefined || list === null || (Array.isArray(list) && list.every((x) => x === null || typeof x !== "object"))
    ? parent : path;
}

// The fields whose cleared input keeps its last value (9.5 items 5 and 7): the rate, the payback target and the
// structural fields. Any other cleared field becomes blank, with the meaning 9.2 to 9.4 give a blank.
const KEEPS_LAST_VALUE = [
  /^settings\.(T|discountRate|paybackTarget)$/,
  /^startYear$/,
  /^classes\.\w+\.head(\.\d+)?$/, /^enrolled\.\w+\.(head|months)(\.\d+)?$/, /^served\.\w+\.months(\.\d+)?$/,
  /^heifersRetained(\.\d+)?$/,
  /^water\.monitors$/, /^water\.blocks\.\d+\.(weeks|runsPerWeek|milesPerRun|hoursPerRun|minVisitsPerWeek)$/,
  /^vf\.fence\.(miles|Lf|k|d)$/,
  /^settings\.landUnits\.\d+\.(leaseYears|share)$/,
];
/** The two inputs that never make the analysis the user's own: the rate and the payback target (9.5 item 5). */
const NOT_OWN = ["settings.discountRate", "settings.paybackTarget"];

/**
 * A typed value with the corrections of 9.2: a negative number is set to 0, and a ramp value above 1 is set to 1, in a
 * single number or in each entry of a per-year array.
 */
function corrected(path, value) {
  const ramp = /^ramp(\.\d+)?$/.test(path);
  const fix = (x) => (typeof x !== "number" ? x : x < 0 ? 0 : ramp && x > 1 ? 1 : x);
  return Array.isArray(value) ? value.map(fix) : fix(value);
}

const markOwn = (a, path) => {
  if (!NOT_OWN.includes(path)) a.settings.ownAnalysis = true;
};

/** Loads an example with its values and `prov`, as the user's starting point; neither flag is set (9.5 item 5). */
export const loadExample = (id) => example(id);

/** Reset: the example the state started from, as loaded (9.5 item 5). */
export const reset = (a) => example(a.example);

/** "Analyze my operation": the analysis becomes the user's own; no value changes (9.5 item 5). */
export function analyzeMine(a) {
  if (a.settings.ownAnalysis) return a;
  const next = clone(a);
  next.settings.ownAnalysis = true;
  return next;
}

/**
 * One typed or cleared value at a path (9.1, 9.5 items 5 and 7). A cleared field that keeps its last value is
 * unchanged; any other cleared field becomes blank and loses its `prov` record. A typed value gets the corrections of
 * 9.2 and the record {cls: "D", src: "your entry"} in place of any earlier one, so it is no longer a placeholder, a
 * reported price or a fill. An entry of a per-year list is part of one value: typing or clearing it gives the list
 * that record, and clearing its last entry clears the list (a ramp entry is its own value). A change to any value or record other than the rate and
 * the payback target makes the analysis the user's own, and typing the rate reviews it.
 */
export function setInput(a, path, value) {
  const composite = (v) => v !== null && typeof v === "object" && (!Array.isArray(v) || v.some((x) => x !== null && typeof x === "object"));
  if (composite(value)) throw new Error(`Cannot set "${path}": setInput takes one value, not an item or a list of items`);
  const cleared = blank(value);
  if (cleared && KEEPS_LAST_VALUE.some((r) => r.test(path))) return a;
  const key = provKey(a, path);
  const next = clone(a);
  next.prov = next.prov ?? {};
  // An entry of a per-year list: the list first takes its carried values through year T (9.2), so typing one year
  // leaves every other year at the value the engine already counted for it. A horizon past MAX_YEARS (an error) fills
  // through MAX_YEARS only, so the list still fits a link.
  const list = key !== path ? getAt(next, key) : undefined;
  const numbers = Array.isArray(list) && list.some((x) => typeof x === "number") && list.every((x) => x === null || typeof x === "number");
  if (numbers) for (let t = list.length; t <= lastShownYear(next); t++) list.push(at(list, t));
  setAt(next, path, cleared ? null : corrected(path, value));
  if (path === "startYear" || path === "settings.T") moveInstall(a, next);
  if (/^labor\.added\.\d+\.label$/.test(path)) toInstall(a, next, Number(path.split(".")[2]));
  const held = getAt(next, key);
  if (blank(held)) {
    if (key !== path) setAt(next, key, null);
    delete next.prov[key];
  } else {
    next.prov[key] = { cls: "D", src: "your entry" };
  }
  // Blank is blank whether the field is absent, null or "" (or a list of blanks): clearing a blank field changes nothing.
  const norm = (v) => (blank(v) ? null : v);
  const changed = !same(norm(getAt(a, key)), norm(getAt(next, key))) || !same(a.prov?.[key], next.prov[key]);
  if (path === "settings.discountRate") next.settings.rateReviewed = true;
  else if (!changed) return a;
  if (changed) markOwn(next, path);
  return next;
}

/**
 * Water's install time (9.4): the labor.added item named "install", whose hours are a list with the install hours in
 * entry startYear and 0 in the other years.
 */
export const isInstall = (a, i) => a.module === "water" && a.labor?.added?.[i]?.label === "install";

/** The install hours an install item's list holds: its first entry above 0, else its entry at the start year. */
export function installHours(a, hours) {
  if (!Array.isArray(hours)) return hours;
  return hours.find((x) => typeof x === "number" && x > 0) ?? hours[a.startYear ?? 0] ?? null;
}

/** The install list for start year s: v in entry s and 0 in every other year, ending in a 0 that carries forward. */
const installList = (s, v) => Array.from({ length: s + 2 }, (_, t) => (t === s ? v : 0));

/**
 * The start year an install list can be built at: a whole year before T (9.2), else null. While the start year or the
 * horizon is an error the page shows, the install hours wait in entry 0 and move once both are valid.
 */
function installYear(a) {
  const s = a.startYear ?? 0;
  return Number.isInteger(s) && s >= 0 && s < lastShownYear(a) ? s : null;
}

/** Install time typed or cleared (9.4): the whole list, so no other year keeps or carries install hours. */
export function setInstall(a, i, value) {
  return setInput(a, `labor.added.${i}.hours`, value === null ? null : installList(installYear(a) ?? 0, value));
}

/**
 * A new start year or horizon moves each install time to the start year's entry (9.4), or to entry 0 while the start
 * year or the horizon is an error; its record is unchanged, as no hours change. Only hours the page showed as an
 * install time move: hours by year stay as typed, also through an error and back.
 */
function moveInstall(a, next) {
  const from = installYear(a) ?? 0, to = installYear(next) ?? 0;
  (next.labor?.added ?? []).forEach((item, i) => {
    if (!isInstall(next, i) || !Array.isArray(item.hours) || !installShaped(a, item.hours)) return;
    item.hours = installList(to, item.hours[from] ?? null);
  });
}

/**
 * An added item renamed "install" in water (9.4): hours already typed as one number become its install time, so the
 * page shows what the engine counts. Hours by year stay as they are, and the page shows them by year.
 */
function toInstall(a, next, i) {
  const hours = next.labor?.added?.[i]?.hours;
  if (isInstall(a, i) || !isInstall(next, i) || typeof hours !== "number") return;
  next.labor.added[i].hours = installList(installYear(next) ?? 0, hours);
}

/**
 * Whether an install item's hours in state a are an install time the page can show as one value (9.4): blank, or the
 * list the page writes for one, installList(s, v), with s the start year (0 while the start year or the horizon is an
 * error): s + 2 entries, none above 0 but entry s. A list entered by year has an entry for every year shown, so it
 * stays by year even when only one of its years holds hours.
 */
export function installShaped(a, hours) {
  if (blank(hours)) return true;
  const s = installYear(a) ?? 0;
  return Array.isArray(hours) && hours.length === s + 2 && hours.every((x, t) => t === s || !(x > 0));
}

// The per-year inputs whose single number holds only in the operating years s+1..T, with 0 before (9.3 Timing).
const OPERATING_ONLY = [/^labor\.added\.\d+\.hours$/, /^labor\.handling\.trainingDays$/, /^labor\.cut\.unitsCut$/];

/** A single number at path as the engine reads it in year t (9.3): every year, or the operating years only. */
function singleAt(a, path, v, t) {
  return OPERATING_ONLY.some((re) => re.test(path)) ? (t > (a.startYear ?? 0) ? v : 0) : v;
}
const yearsOf = (a) => [...Array(lastShownYear(a) + 1).keys()];
const num0 = (x) => (typeof x === "number" ? x : 0);

/**
 * "By year" (9.4): a single number becomes the list of what it holds in each year 0..T, so no number changes; the
 * value keeps its record, and the analysis is not made the user's own. A list, or a blank, is unchanged.
 */
export function toByYear(a, path) {
  const v = getAt(a, path);
  if (blank(v) || Array.isArray(v) || typeof v !== "number" || !byYearReady(a, path)) return a;
  const next = clone(a);
  setAt(next, path, yearsOf(a).map((t) => singleAt(a, path, v, t)));
  return next;
}

/**
 * Whether a single number at path can be entered by year now: an input that holds only in the operating years needs a
 * start year that is a whole year before T to place them, so while the start year is an error it stays one number
 * (else its years before the unknown start would be stored as 0).
 */
export const byYearReady = (a, path) => !OPERATING_ONLY.some((re) => re.test(path)) || installYear(a) !== null;

/**
 * "Same value every year": a list becomes one number, its value in the first operating year (or its first value).
 * When that number holds the same values as the list in every year, nothing changes but the layout, and the value
 * keeps its record; otherwise it is the user's change (setInput).
 */
export function toFlat(a, path) {
  const v = getAt(a, path);
  if (!Array.isArray(v)) return a;
  const first = v[Math.min((a.startYear ?? 0) + 1, v.length - 1)] ?? v.find((x) => x !== null && x !== undefined) ?? null;
  const same = typeof first === "number" && yearsOf(a).every((t) => num0(at(v, t)) === num0(singleAt(a, path, first, t)));
  if (!same) return setInput(a, path, first);
  const next = clone(a);
  setAt(next, path, first);
  return next;
}

/**
 * A share typed on the page (9.4 Shared), as a fraction or null: for one land unit, at path.<unitId>, keeping the
 * other units' share when the line held one share for every unit; with no unit id, the line's one share.
 */
export function setShare(a, path, unitId, value) {
  if (!unitId) return setInput(a, path, value);
  let next = a;
  const stored = getAt(a, path);
  if (stored !== null && stored !== undefined && typeof stored !== "object") {
    next = setInput(next, path, null);
    for (const u of landUnitsOf(a)) if (u.id !== null && u.id !== unitId) next = setInput(next, `${path}.${u.id}`, stored);
  }
  return setInput(next, `${path}.${unitId}`, value);
}

/** The virtual fence pricing model (9.4): the lines it needs are added, blank, so each reads "Quote required". */
export function setPricing(a, value) {
  let next = setInput(a, "vf.pricing", value);
  for (const id of PRICING_LINES[value] ?? []) next = addKey(next, "costs", id, clone(LINE_TEMPLATES.vf[id]));
  return next;
}

/** A class, an enrolled or served class, or a cost line added from the page, with what a new one holds. */
export function addPart(a, path, key) {
  const value = path === "costs" ? LINE_TEMPLATES[a.module]?.[key]
    : path === "classes" ? { head: 0 } : path === "enrolled" ? { head: 0, months: 12 } : path === "served" ? { months: 12 } : undefined;
  return value === undefined ? a : addKey(a, path, key, clone(value));
}

/** "Keep this rate": the rate keeps its value and is reviewed (9.5 item 5). */
export function keepRate(a) {
  if (a.settings.rateReviewed) return a;
  const next = clone(a);
  next.settings.rateReviewed = true;
  return next;
}

/** "Keep this value": a placeholder keeps its value and label and is confirmed; no number changes (9.5 item 5). */
export function keepValue(a, path) {
  const p = a.prov?.[path];
  if (!p?.placeholder || p.confirmed) return a;
  const next = clone(a);
  next.prov[path] = { ...p, confirmed: true };
  return next;
}

/**
 * "Use published vendor price" (9.5 item 7): writes the input's fill with its [C] record. An input with no fill is
 * unchanged. A fill that changes the value or its record makes the analysis the user's own.
 */
export function useVendorPrice(a, path) {
  const fill = vendorFill(a, path);
  if (!fill || (same(getAt(a, path), fill.value) && same(a.prov?.[path], fill.prov))) return a;
  const next = clone(a);
  setAt(next, path, fill.value);
  next.prov = { ...next.prov, [path]: clone(fill.prov) };
  markOwn(next, path);
  return next;
}

// The line ids that hold a list index (9.2 field notes): a stored share keyed by one follows its item.
const INDEXED_IDS = { "labor.added": "added", riskLines: "risk" };

/**
 * Removes item i of the list at path (a season block, a labor.added item, a handling event, a risk line or a land unit;
 * 9.1). The item's `prov` records go with it, and the records of the items after it move to their new indexes; so do
 * the stored shares of a line whose id holds the index (added:<i>, risk:<i>), with their records. A removed land unit's
 * entries in the shares split by land unit are deleted (judgment: its id names no unit any more). The analysis
 * becomes the user's own.
 */
export function removeItem(a, path, i) {
  const list = getAt(a, path);
  if (!Array.isArray(list) || !Number.isInteger(i) || i < 0 || i >= list.length) return a;
  const next = clone(a);
  getAt(next, path).splice(i, 1);

  // An index after the removed item moves down by one; the removed item's own keys are dropped (null).
  const move = (j) => (j === i ? null : j > i ? j - 1 : j);
  const prefix = `${path}.`;
  const idPrefix = INDEXED_IDS[path];
  const idPattern = idPrefix && new RegExp(`^${idPrefix}:(\\d+)$`);
  const renameId = (id) => {
    const m = idPattern && id.match(idPattern);
    if (!m) return id;
    const j = move(Number(m[1]));
    return j === null ? null : `${idPrefix}:${j}`;
  };
  const renameKey = (key) => {
    if (key.startsWith(prefix)) {
      const [index, ...rest] = key.slice(prefix.length).split(".");
      if (/^\d+$/.test(index)) {
        const j = move(Number(index));
        return j === null ? null : [path, j, ...rest].join(".");
      }
    }
    const share = key.match(/^(costShares|benefitShares)\.([^.]+)(\..*)?$/);
    if (share) {
      const id = renameId(share[2]);
      return id === null ? null : `${share[1]}.${id}${share[3] ?? ""}`;
    }
    return key;
  };
  next.prov = Object.fromEntries(Object.entries(next.prov ?? {}).map(([k, v]) => [renameKey(k), v]).filter(([k]) => k !== null));
  for (const key of ["costShares", "benefitShares"]) {
    if (!next[key]) continue;
    next[key] = Object.fromEntries(Object.entries(next[key]).map(([id, v]) => [renameId(id), v]).filter(([id]) => id !== null));
  }

  if (path === "settings.landUnits") {
    const gone = list[i].id;
    const drop = (v) => {
      if (v !== null && typeof v === "object" && !Array.isArray(v)) delete v[gone];
    };
    Object.values(next.costs ?? {}).forEach((c) => drop(c.operatorShare));
    Object.values(next.costShares ?? {}).forEach(drop);
    Object.values(next.benefitShares ?? {}).forEach(drop);
    // A share's record ends in the unit's id: "<costShares|benefitShares>.<line>.<id>" or "….operatorShare.<id>".
    for (const k of Object.keys(next.prov)) {
      const parts = k.split(".");
      if (parts.at(-1) === gone && (parts.at(-2) === "operatorShare" || /Shares$/.test(parts.at(-3) ?? ""))) delete next.prov[k];
    }
    // A fence on the removed unit goes back to the first unit (blank), whose select the page may no longer show.
    if (next.vf?.fence?.landUnitId === gone) {
      delete next.vf.fence.landUnitId;
      delete next.prov["vf.fence.landUnitId"];
    }
  }
  next.settings.ownAnalysis = true;
  return next;
}

/** The most items a list may hold (B8: a value for each year of the 50-year limit, as a link may carry). */
export const MAX_ITEMS = 51;

/**
 * Adds an item at the end of the list at path (a season block, a labor.added item, a handling event, a risk line or a
 * land unit; the page builds the item, form.js newItem()). A list already at MAX_ITEMS is unchanged. The analysis
 * becomes the user's own.
 */
export function addItem(a, path, item) {
  const list = getAt(a, path);
  if (item === null || typeof item !== "object" || (list !== undefined && list !== null && !Array.isArray(list))) return a;
  if ((list?.length ?? 0) >= MAX_ITEMS) return a;
  const next = clone(a);
  setAt(next, `${path}.${list?.length ?? 0}`, clone(item));
  next.settings.ownAnalysis = true;
  return next;
}

/**
 * Adds a keyed part that the analysis does not hold yet: a class (`classes`), an enrolled or served class (`enrolled`,
 * `served`) or a cost line (`costs`, from form.js LINE_TEMPLATES). Unchanged when the key is already there. The
 * analysis becomes the user's own.
 */
export function addKey(a, path, key, value) {
  const parent = getAt(a, path);
  if (parent !== undefined && parent !== null && (typeof parent !== "object" || Array.isArray(parent))) return a;
  if (parent?.[key] !== undefined && parent?.[key] !== null) return a;
  if (Object.hasOwn(Object.prototype, key)) return a;
  const next = clone(a);
  setAt(next, `${path}.${key}`, clone(value));
  next.settings.ownAnalysis = true;
  return next;
}

/**
 * Removes a keyed part (a class, an enrolled or served class, or a cost line) with the `prov` records of every value
 * in it, and, for a line, its stored shares. Unchanged when the key is not there. The analysis becomes the user's own.
 */
export function removeKey(a, path, key) {
  const parent = getAt(a, path);
  if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, key)) return a;
  const next = clone(a);
  delete getAt(next, path)[key];
  const prefix = `${path}.${key}`;
  next.prov = Object.fromEntries(Object.entries(next.prov ?? {}).filter(([k]) => k !== prefix && !k.startsWith(`${prefix}.`)));
  if (path === "costs") {
    for (const s of ["costShares", "benefitShares"]) if (next[s]) delete next[s][key];
  }
  next.settings.ownAnalysis = true;
  return next;
}
