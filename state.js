// What each user action does to the state (docs/audit/phase1-spec.md: 9.1 "state.js", 9.2, 9.5 items 5 and 7). Pure
// functions, no DOM: each takes a state (an analysis, 9.2) and returns the next one, and never changes the one it is
// given. A call that changes nothing returns its state unchanged. The page connects its buttons and inputs to these
// from step 6; until then node tests drive them.
import { example, vendorFill } from "./examples.js";

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
    if (o[k] === null || o[k] === undefined) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
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

/**
 * The `prov` key of the value a path writes (9.2): the path itself, except for an entry of a per-year list of numbers
 * ("classes.cows.head.3", "labor.cut.unitsCut.2"), which is part of one value with its record on the list's path. The
 * ramp is not a per-year array (9.2): each entry is its own value, "ramp.1" (as 9.5 item 8 records it).
 */
function provKey(a, path) {
  const keys = path.split(".");
  if (keys.length < 2 || keys[0] === "ramp" || !/^\d+$/.test(keys[keys.length - 1])) return path;
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
  setAt(next, path, cleared ? null : corrected(path, value));
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
    for (const k of Object.keys(next.prov)) if (new RegExp(`(Shares\\.[^.]+|operatorShare)\\.${gone}$`).test(k)) delete next.prov[k];
  }
  next.settings.ownAnalysis = true;
  return next;
}
