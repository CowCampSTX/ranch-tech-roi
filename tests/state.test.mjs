// Tests of state.js, the user actions (docs/audit/phase1-spec.md 9.1 "state.js", 9.2, 9.5 items 5 and 7): each
// function's effect on the values, `prov` and the two flags, and the rows that drive them from step 5 (row 36) with
// the numbers of rows 33, 37 and 38, whose page text joins in step 6.
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { analyze, validate } from "../roi.js";
import { example, EXAMPLE_IDS, VENDOR_FILLS } from "../examples.js";
import { loadExample, reset, analyzeMine, setInput, keepRate, keepValue, useVendorPrice, removeItem, getAt } from "../state.js";
import { verdictNotes, priceLabel, exampleRate, noticeText, EID_RULE_NOTICE } from "../text.js";

const close = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);
const cash = (a) => {
  assert.deepEqual(validate(a), []);
  return analyze(a).cashNPV;
};
const flags = (a) => ({ own: a.settings.ownAnalysis, reviewed: a.settings.rateReviewed });
const YOURS = { cls: "D", src: "your entry" };
const RATE_NOTE = "Discount rate not yet reviewed.";
const PLACEHOLDER_NOTE = "Includes synthetic cost placeholders.";

/** Freezes a state all the way down, so an action that changed the state it is given would throw. */
function deepFreeze(o) {
  if (o !== null && typeof o === "object" && !Object.isFrozen(o)) {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

/** Everything but the two flags, to check that an action changed nothing else. */
const values = (a) => {
  const { ownAnalysis, rateReviewed, ...settings } = a.settings;
  return { ...a, settings };
};

// ---------------------------------------------------------------- load, reset, "Analyze my operation"

test("loadExample: each example with its values and prov, both flags false, a fresh copy each time (9.1, 9.5 item 5)", () => {
  for (const id of EXAMPLE_IDS) {
    const a = loadExample(id);
    assert.deepEqual(a, example(id));
    assert.deepEqual(flags(a), { own: false, reviewed: false });
    a.classes[Object.keys(a.classes)[0]].head = 1;
    a.prov["settings.discountRate"].cls = "D";
    assert.deepEqual(loadExample(id), example(id), `${id}: a change to one copy reached the next load`);
  }
});

test("reset: the example the state started from, as loaded, after any change (9.5 item 5)", () => {
  let a = analyzeMine(loadExample("ranchB"));
  a = setInput(a, "classes.yearlings.head", 900);
  a = keepRate(a);
  a = removeItem(a, "labor.handling.events", 1);
  assert.deepEqual(reset(a), example("ranchB"));
  assert.deepEqual(flags(reset(a)), { own: false, reviewed: false });
});

test("analyzeMine: the analysis becomes the user's own and no value changes; again, it is unchanged (9.5 item 5)", () => {
  const a = deepFreeze(loadExample("ranchA"));
  const b = analyzeMine(a);
  assert.deepEqual(flags(b), { own: true, reviewed: false });
  assert.deepEqual(values(b), values(a));
  assert.equal(analyzeMine(b), b);
  close(cash(b), cash(a), 0);
});

// ---------------------------------------------------------------- setInput (9.1, 9.2, 9.5 items 5 and 7)

test("setInput typed: the value, with {cls: 'D', src: 'your entry'} in place of a placeholder, a fill or a reported price", () => {
  const a = deepFreeze(loadExample("ranchA"));
  for (const [path, before] of [["costs.mounting.unitCost", "placeholder"], ["costs.monitors.unitCost", "C"], ["classes.cows.head", "E"]]) {
    const b = setInput(a, path, 800);
    assert.equal(getAt(b, path), 800);
    assert.deepEqual(b.prov[path], YOURS, `${path} (was ${before})`);
    assert.equal(b.settings.ownAnalysis, true);
    assert.deepEqual({ ...b.prov, [path]: a.prov[path] }, a.prov, "no other record changes");
  }
  // Over a reported price, the typed value drops the reported flag and its label (9.5 item 4).
  const b = deepFreeze(loadExample("ranchB"));
  const quote = setInput(b, "costs.subscription.unitCost", 6.5);
  assert.deepEqual(quote.prov["costs.subscription.unitCost"], YOURS);
  assert.equal(priceLabel(quote.prov["costs.subscription.unitCost"]), "your quote");
  assert.deepEqual(flags(quote), { own: true, reviewed: false });
  // A typed quote equal to the published price is still the user's quote [D] (9.5 item 8).
  const typed = setInput(a, "costs.monitors.unitCost", 1490);
  assert.deepEqual(typed.prov["costs.monitors.unitCost"], YOURS);
  assert.equal(typed.settings.ownAnalysis, true);
  assert.equal(priceLabel(typed.prov["costs.monitors.unitCost"]), "your quote");
  // Typing the same value again changes nothing.
  assert.equal(setInput(typed, "costs.monitors.unitCost", 1490), typed);
});

test("setInput cleared: a field becomes blank and loses its record; a lifeYears cleared is null (9.1, 9.2)", () => {
  const a = deepFreeze(loadExample("ranchA"));
  for (const path of ["costs.monitors.unitCost", "costs.monitors.lifeYears", "costs.batteries.unitCost", "water.blocks.0.shareAvoided"]) {
    for (const value of [null, undefined, ""]) {
      const b = setInput(a, path, value);
      assert.equal(getAt(b, path), null, path);
      assert.equal(path in b.prov, false, path);
      assert.equal(b.settings.ownAnalysis, true);
    }
  }
  // A field already blank with no record is unchanged, whether it is stored as null or absent: nothing changed, so the
  // analysis does not become the user's own.
  const b = loadExample("ranchB");
  assert.equal(b.vf.gatherHoursToday, null);
  assert.equal(setInput(b, "vf.gatherHoursToday", null), b);
  const fresh = deepFreeze(loadExample("ranchA"));
  for (const path of ["labor.otherHoursSaved", "labor.avoidedHire.salary", "production.lbPerHeadPerDay", "costs.subscription.minQty"]) {
    for (const value of [null, undefined, ""]) assert.equal(setInput(fresh, path, value), fresh, path);
  }
  const c = deepFreeze(loadExample("ranchC"));
  assert.equal(setInput(c, "eid.premium.saleCwt", ""), c);
});

test("setInput cleared on a field that keeps its last value: unchanged (9.5 items 5 and 7)", () => {
  const keeps = {
    ranchA: ["settings.T", "settings.discountRate", "settings.paybackTarget", "startYear", "classes.cows.head", "heifersRetained",
      "water.monitors", "water.blocks.0.weeks", "water.blocks.1.runsPerWeek", "water.blocks.0.milesPerRun", "water.blocks.0.hoursPerRun",
      "water.blocks.1.minVisitsPerWeek", "settings.landUnits.0.share"],
    ranchB: ["enrolled.yearlings.head", "enrolled.yearlings.months", "vf.fence.miles", "vf.fence.Lf", "vf.fence.k"],
    ranchC: ["classes.calvesBorn.head", "served.cows.months"],
  };
  for (const [id, paths] of Object.entries(keeps)) {
    const a = deepFreeze(loadExample(id));
    for (const path of paths) assert.equal(setInput(a, path, null), a, `${id} ${path}`);
  }
  // So does an entry of a per-year head count.
  const d = loadExample("ranchD");
  d.classes.cows.head = [400, 400, 380];
  assert.equal(setInput(d, "classes.cows.head.2", ""), d);
});

test("setInput corrections: a negative number is 0 and a ramp value above 1 is 1, typed singly or by year (9.2)", () => {
  const a = deepFreeze(loadExample("ranchA"));
  assert.equal(setInput(a, "costs.mounting.unitCost", -900).costs.mounting.unitCost, 0);
  assert.equal(setInput(a, "classes.cows.head", -5).classes.cows.head, 0);
  assert.equal(setInput(a, "water.blocks.0.shareAvoided", -0.2).water.blocks[0].shareAvoided, 0);
  assert.deepEqual(setInput(a, "labor.cut.unitsCut", [16, -4, 12]).labor.cut.unitsCut, [16, 0, 12]);
  assert.deepEqual(setInput(a, "ramp.1", 1.4).ramp, [1, 1, 1, 1]);
  assert.deepEqual(setInput(a, "ramp.2", -0.5).ramp, [1, 1, 0, 1]);
  assert.deepEqual(setInput(a, "ramp.1", 0.5).ramp, [1, 0.5, 1, 1]);
  // Only a ramp is capped at 1: a share above 1 is a validation error (9.2), not a correction.
  assert.equal(setInput(a, "water.blocks.0.shareAvoided", 1.5).water.blocks[0].shareAvoided, 1.5);
  assert.equal(setInput(a, "costs.mounting.unitCost", 0).costs.mounting.unitCost, 0);
});

test("setInput on a per-year entry: the list holds one record; the ramp's entries are each their own (9.2, 9.5 item 8)", () => {
  const d = deepFreeze(loadExample("ranchD"));
  let b = setInput(d, "labor.handling.trainingDays.2", 5);
  assert.deepEqual(b.labor.handling.trainingDays, [0, 7, 5]);
  assert.deepEqual(b.prov["labor.handling.trainingDays"], YOURS);
  assert.equal("labor.handling.trainingDays.2" in b.prov, false);
  b = setInput(b, "labor.handling.trainingDays.1", null);
  assert.deepEqual(b.labor.handling.trainingDays, [0, null, 5]);
  assert.deepEqual(b.prov["labor.handling.trainingDays"], YOURS);
  // Clearing every entry clears the list and its record.
  b = setInput(setInput(b, "labor.handling.trainingDays.0", null), "labor.handling.trainingDays.2", null);
  assert.equal(b.labor.handling.trainingDays, null);
  assert.equal("labor.handling.trainingDays" in b.prov, false);
  // An entry past the end extends the list: the years in between keep the last value they carried (9.2); an entry of
  // a field that holds no list yet starts one, with blanks before it.
  const a = deepFreeze(loadExample("ranchA"));
  const extended = setInput(setInput(a, "labor.added.0.hours", [30, 10]), "labor.added.0.hours.4", 20);
  assert.deepEqual(extended.labor.added[0].hours, [30, 10, 10, 10, 20]);
  assert.deepEqual(extended.prov["labor.added.0.hours"], YOURS);
  const herd = setInput(setInput(a, "classes.cows.head", [900, 900]), "classes.cows.head.4", 950);
  assert.deepEqual(herd.classes.cows.head, [900, 900, 900, 900, 950]);
  assert.ok(!analyze(herd).notices.some((n) => n.type === "noCattle"));
  const c = deepFreeze(loadExample("ranchC"));
  const started = setInput(c, "labor.cut.unitsCut.1", 3);
  assert.deepEqual(started.labor.cut, { unitsCut: [null, 3] });
  assert.deepEqual(started.prov["labor.cut.unitsCut"], YOURS);
  // An entry of a field entered as one number is an error: the page replaces the whole field. So is an item or a list
  // of items: setInput takes one value.
  assert.throws(() => setInput(a, "labor.cut.unitsCut.2", 12), /labor\.cut\.unitsCut.*single value/);
  assert.throws(() => setInput(a, "riskLines.1", { cause: "water", class: "cows" }), /one value/);
  assert.throws(() => setInput(a, "riskLines", [{ cause: "water" }]), /one value/);
  assert.equal(setInput(a, "costs.mounting.classes", ["cows"]).costs.mounting.classes[0], "cows"); // a list of classes is one value

  // The ramp is not a per-year array: "ramp.1" has its own record, as a version 1 link records it, and the engine's
  // inputs name that entry.
  const r = setInput(a, "ramp.1", 0.6);
  assert.deepEqual(r.prov["ramp.1"], YOURS);
  assert.equal("ramp" in r.prov, false);
  assert.ok(analyze(r).lines.find((l) => l.id === "vehicle").paths.includes("ramp.1"));
  assert.ok(!analyze(r).lines.find((l) => l.id === "vehicle").paths.includes("ramp.2"));
  // A cleared ramp entry counts as 0, like any other cleared advanced input (9.5 item 7), and stays an input of the
  // benefit lines; an absent one takes the default, 1 (9.2).
  const cleared = setInput(r, "ramp.1", null);
  assert.deepEqual(cleared.ramp, [1, null, 1, 1]);
  assert.equal("ramp.1" in cleared.prov, false);
  close(cash(cleared), cash(setInput(a, "ramp.1", 0)), 1e-6);
  close(cash(cleared), -15516.28, 0.01);
  assert.ok(analyze(cleared).lines.find((l) => l.id === "vehicle").paths.includes("ramp.1"));
  const absent = structuredClone(a);
  absent.ramp = [1];
  close(cash(absent), cash(a), 1e-6);
  // Typing an entry past the end of a short or absent ramp leaves the entries in between at the default, 1: the ramp is
  // not carried forward (9.2).
  assert.deepEqual(setInput(setInput(a, "ramp", [1, 0.5]), "ramp.3", 0.9).ramp, [1, 0.5, 1, 0.9]);
  const none = structuredClone(a);
  delete none.ramp;
  delete none.prov["ramp.1"];
  const typed = setInput(none, "ramp.2", 0.8);
  assert.deepEqual(typed.ramp, [1, 1, 0.8]);
  close(cash(typed), cash(setInput(a, "ramp.2", 0.8)), 1e-6);
  // A list of classes is not carried forward either: an index past its end leaves blanks, never a repeated class.
  const ranchC = loadExample("ranchC");
  assert.deepEqual(setInput(ranchC, "costs.cowTags.classes.2", "bulls").costs.cowTags.classes, ["cows", null, "bulls"]);
});

test("setInput: the rate and the payback target never make the analysis the user's own; a typed rate is reviewed (9.5 item 5)", () => {
  const a = deepFreeze(loadExample("ranchA"));
  const rate = setInput(a, "settings.discountRate", 0.06);
  assert.deepEqual(flags(rate), { own: false, reviewed: true });
  assert.deepEqual(rate.prov["settings.discountRate"], YOURS);
  assert.equal(exampleRate(rate), false);
  // The same rate typed again is still a review, and changes nothing else.
  const same = setInput(a, "settings.discountRate", 0.07);
  assert.deepEqual(flags(same), { own: false, reviewed: true });
  const target = setInput(a, "settings.paybackTarget", 7);
  assert.deepEqual(flags(target), { own: false, reviewed: false });
  assert.equal(target.settings.paybackTarget, 7);
  assert.deepEqual(target.prov["settings.paybackTarget"], YOURS);
});

test("row 33's flags: a herd change or 'Analyze my operation' asks for the rate; 'Keep this rate' or an edit clears it", () => {
  const a = loadExample("ranchA");
  assert.equal(a.settings.discountRate, 0.07);
  assert.equal(exampleRate(a), true);
  assert.deepEqual(verdictNotes(a), []);
  const herd = setInput(a, "classes.cows.head", 1000);
  assert.deepEqual(flags(herd), { own: true, reviewed: false });
  assert.equal(herd.settings.discountRate, 0.07);
  assert.ok(verdictNotes(herd).includes(RATE_NOTE));
  const kept = keepRate(herd);
  assert.deepEqual(flags(kept), { own: true, reviewed: true });
  assert.ok(!verdictNotes(kept).includes(RATE_NOTE));
  assert.equal(exampleRate(kept), true); // the example label stays, followed by "Reviewed"
  const edited = setInput(herd, "settings.discountRate", 0.06);
  assert.ok(!verdictNotes(edited).includes(RATE_NOTE));
  assert.equal(exampleRate(edited), false);
  const mine = analyzeMine(a);
  assert.ok(verdictNotes(mine).includes(RATE_NOTE));
  // A rate edited on the example counts as reviewed: no prompt after a later herd change. Loading Ranch B clears both.
  const later = setInput(setInput(a, "settings.discountRate", 0.06), "classes.cows.head", 1000);
  assert.deepEqual(flags(later), { own: true, reviewed: true });
  assert.ok(!verdictNotes(later).includes(RATE_NOTE));
  assert.deepEqual(flags(loadExample("ranchB")), { own: false, reviewed: false });
  for (const s of [a, herd, kept, edited, mine, later]) assert.ok(Number.isFinite(cash(s)), "results are computed at every step");
});

// ---------------------------------------------------------------- keepRate, keepValue, useVendorPrice

test("keepRate: the rate keeps its value and is reviewed; nothing else changes (9.5 item 5)", () => {
  const a = deepFreeze(analyzeMine(loadExample("ranchC")));
  const b = keepRate(a);
  assert.deepEqual(flags(b), { own: true, reviewed: true });
  assert.deepEqual(values(b), values(a));
  assert.equal(keepRate(b), b);
  // On the example as loaded it reviews the rate and does not make the analysis the user's own.
  const fresh = deepFreeze(loadExample("ranchA"));
  assert.deepEqual(flags(keepRate(fresh)), { own: false, reviewed: true });
  assert.deepEqual(values(keepRate(fresh)), values(fresh));
});

test("each action's effect on the two flags: only setInput, useVendorPrice and removeItem make the analysis the user's own, only keepRate or a typed rate reviews it, and nothing but a load or Reset clears either (9.1, 9.2, 9.5 item 5)", () => {
  const fresh = deepFreeze(loadExample("ranchA"));
  assert.deepEqual(flags(keepValue(fresh, "costs.batteries.unitCost")), { own: false, reviewed: false });
  assert.deepEqual(flags(useVendorPrice(setInput(fresh, "settings.discountRate", 0.07), "costs.monitors.unitCost")), { own: false, reviewed: true });
  assert.deepEqual(flags(useVendorPrice(loadExample("ranchC"), "eid.tagPrice")), { own: true, reviewed: false });
  assert.deepEqual(flags(removeItem(fresh, "water.blocks", 0)), { own: true, reviewed: false });
  assert.deepEqual(flags(analyzeMine(setInput(fresh, "settings.discountRate", 0.06))), { own: true, reviewed: true });

  // From a reviewed analysis of the user's own, no action clears either flag.
  const both = deepFreeze(keepRate(analyzeMine(fresh)));
  const after = {
    keepValue: keepValue(both, "costs.batteries.unitCost"),
    useVendorPrice: useVendorPrice(setInput(both, "costs.subscription.unitCost", 300), "costs.subscription.unitCost"),
    removeItem: removeItem(both, "water.blocks", 0),
    setInput: setInput(both, "costs.mounting.unitCost", 900),
    cleared: setInput(both, "costs.mounting.unitCost", null),
    paybackTarget: setInput(both, "settings.paybackTarget", 7),
    analyzeMine: analyzeMine(both),
    keepRate: keepRate(both),
  };
  for (const [name, s] of Object.entries(after)) assert.deepEqual(flags(s), { own: true, reviewed: true }, name);
  assert.deepEqual(flags(reset(both)), { own: false, reviewed: false });
  assert.deepEqual(flags(loadExample("ranchB")), { own: false, reviewed: false });
});

test("keepValue: a placeholder is confirmed with its value and label; any other path is unchanged (9.5 item 5)", () => {
  const a = deepFreeze(analyzeMine(loadExample("ranchA")));
  const b = keepValue(a, "costs.batteries.unitCost");
  assert.deepEqual(b.prov["costs.batteries.unitCost"], { ...a.prov["costs.batteries.unitCost"], confirmed: true });
  assert.equal(priceLabel(b.prov["costs.batteries.unitCost"]), "Synthetic placeholder, not a price. Replace with your quote.");
  assert.deepEqual(b.costs, a.costs);
  assert.equal(keepValue(b, "costs.batteries.unitCost"), b);
  assert.equal(keepValue(a, "costs.monitors.unitCost"), a); // a published price is not a placeholder
  assert.equal(keepValue(a, "costs.nothing.unitCost"), a);
});

test("useVendorPrice: writes the fill with its [C] record; no fill, or the fill already in place, is unchanged (9.5 item 7)", () => {
  const a = deepFreeze(analyzeMine(loadExample("ranchA")));
  assert.equal(useVendorPrice(a, "costs.monitors.unitCost"), a); // as loaded, the fill is already there
  const typed = setInput(a, "costs.subscription.unitCost", 300);
  const filled = useVendorPrice(typed, "costs.subscription.unitCost");
  assert.equal(filled.costs.subscription.unitCost, 365);
  assert.deepEqual(filled.prov["costs.subscription.unitCost"], VENDOR_FILLS.water["costs.subscription.unitCost"].prov);
  assert.equal(useVendorPrice(a, "costs.mounting.unitCost"), a); // a placeholder has no fill

  // The EID tag price fills unrounded, its label followed by the pack price; on the example it was rounded.
  const c = deepFreeze(loadExample("ranchC"));
  const tag = useVendorPrice(c, "eid.tagPrice");
  assert.equal(tag.eid.tagPrice, 156.99 / 50);
  assert.equal(tag.prov["eid.tagPrice"].note, "$156.99 per 50");
  assert.equal(tag.settings.ownAnalysis, true);
  assert.notEqual(tag.prov["eid.tagPrice"], VENDOR_FILLS.eid["eid.tagPrice"].prov, "the record is a copy");

  // The leased-collar subscription's reported price is never a fill (row 38(d)).
  const b = deepFreeze(analyzeMine(loadExample("ranchB")));
  for (const path of ["costs.subscription.unitCost", "costs.infrastructure.unitCost"]) assert.equal(useVendorPrice(b, path), b);
});

test("row 37's numbers: the placeholders through 'Analyze my operation', a typed $900 mounting, and 'Keep this value'", () => {
  const a = loadExample("ranchA");
  const label = "Synthetic placeholder, not a price. Replace with your quote.";
  assert.equal(a.costs.mounting.unitCost, 750);
  assert.equal(priceLabel(a.prov["costs.mounting.unitCost"]), label);
  assert.equal(priceLabel(a.prov["costs.batteries.unitCost"]), label);
  assert.deepEqual(verdictNotes(a), []);
  close(cash(a), -11079);
  const mine = analyzeMine(a);
  assert.ok(verdictNotes(mine).includes(PLACEHOLDER_NOTE));
  close(cash(mine), -11079);
  const quote = setInput(mine, "costs.mounting.unitCost", 900);
  assert.equal(priceLabel(quote.prov["costs.mounting.unitCost"]), "your quote");
  close(cash(quote), -11229);
  close(cash(mine) - cash(quote), 150, 1e-6);
  assert.ok(verdictNotes(quote).includes(PLACEHOLDER_NOTE));
  const kept = keepValue(quote, "costs.batteries.unitCost");
  assert.equal(priceLabel(kept.prov["costs.batteries.unitCost"]), label);
  assert.equal(kept.prov["costs.batteries.unitCost"].confirmed, true);
  assert.ok(!verdictNotes(kept).includes(PLACEHOLDER_NOTE));
  close(cash(kept), -11229);
});

test("row 38's numbers: a cleared monitor price, the vendor fill, a typed $1,600; Ranch B's subscription cleared", () => {
  const a = analyzeMine(loadExample("ranchA"));
  const cleared = setInput(a, "costs.monitors.unitCost", null);
  assert.equal(cleared.costs.monitors.unitCost, null);
  assert.equal(priceLabel(cleared.prov["costs.monitors.unitCost"]), null);
  const r = analyze(cleared);
  assert.deepEqual(r.notices.filter((n) => n.type === "quoteRequired"), [{ type: "quoteRequired", lineId: "monitors" }]);
  close(r.cashNPV, 3821);
  const filled = useVendorPrice(cleared, "costs.monitors.unitCost");
  assert.equal(filled.costs.monitors.unitCost, 1490);
  assert.equal(filled.prov["costs.monitors.unitCost"].cls, "C");
  assert.equal(priceLabel(filled.prov["costs.monitors.unitCost"]),
    "Vendor information: published list price (All-Tex dealer flyer, undated; checked 15 Oct 2026). Not an endorsement. Replace with your quote.");
  close(cash(filled), -11079);
  const quote = setInput(filled, "costs.monitors.unitCost", 1600);
  assert.equal(quote.prov["costs.monitors.unitCost"].cls, "D");
  assert.equal(priceLabel(quote.prov["costs.monitors.unitCost"]), "your quote");
  close(cash(quote), -12179);

  const b = analyzeMine(loadExample("ranchB"));
  assert.equal(b.costs.subscription.unitCost, 7);
  assert.equal(priceLabel(b.prov["costs.subscription.unitCost"]),
    "Vendor information: reported price (DTN, 31 Mar 2025), not a published list price. Not an endorsement. Replace with your quote.");
  const noSub = setInput(b, "costs.subscription.unitCost", null);
  const rb = analyze(noSub);
  assert.deepEqual(rb.notices.filter((n) => n.type === "quoteRequired"), [{ type: "quoteRequired", lineId: "subscription" }]);
  close(rb.cashNPV, 36884);
  close(rb.cashNPV - analyze(b).cashNPV, 266414, 1);
});

test("row 36 through setInput: the EID rule answered yes for the cows, then no again", () => {
  const c = loadExample("ranchC");
  const yes = setInput(c, "eid.ruleApplies.cows", true);
  assert.equal(yes.eid.ruleApplies.cows, true);
  assert.deepEqual(yes.prov["eid.ruleApplies.cows"], YOURS);
  assert.equal(yes.settings.ownAnalysis, true);
  const r = analyze(yes);
  close(r.cashNPV, -9895);
  assert.ok(r.notices.some((n) => n.type === "eidRulePending" && noticeText(n) === EID_RULE_NOTICE));
  const no = setInput(yes, "eid.ruleApplies.cows", false);
  assert.ok(!analyze(no).notices.some((n) => n.type === "eidRulePending"));
  close(cash(no), -9895);
});

// ---------------------------------------------------------------- removeItem (9.1, 9.2)

test("removeItem: Ranch A without its summer block; the fall–winter records move from index 1 to 0 (9.2, 9.7 Links)", () => {
  const a = deepFreeze(loadExample("ranchA"));
  const b = removeItem(a, "water.blocks", 0);
  assert.deepEqual(b.water.blocks, [a.water.blocks[1]]);
  const blockKeys = (s) => Object.keys(s.prov).filter((k) => k.startsWith("water.blocks."));
  assert.deepEqual(blockKeys(b), blockKeys(a).filter((k) => k.startsWith("water.blocks.1.")).map((k) => k.replace(".1.", ".0.")));
  for (const k of blockKeys(b)) assert.deepEqual(b.prov[k], a.prov[k.replace(".0.", ".1.")]);
  assert.ok(!Object.values(b.prov).some((p) => p.note?.includes("Utah State")), "the summer block's note goes with it");
  assert.equal(b.settings.ownAnalysis, true);
  // The remaining block saves no hours, so the 16 days cut are an error until unitsCut is set to 0.
  assert.deepEqual(validate(b).map((e) => e.path), ["labor.cut.unitsCut"]);
  const c = setInput(b, "labor.cut.unitsCut", 0);
  assert.deepEqual(validate(c), []);
  assert.equal(analyze(c).lines.find((l) => l.id === "vehicle").pv, 0);
});

test("removeItem: a labor.added item or a risk line takes its stored shares and records; later ones move down (9.2)", () => {
  const a = loadExample("ranchA");
  a.labor.added.push({ label: "hauling", hours: 10, doneBy: "paid", paidRate: 20, loadPct: 0 });
  a.costShares = { "added:0": 0.5, "added:2": 0.25, subscription: 0.5 };
  a.benefitShares = { "risk:0": 0.4, vehicle: 0.9 };
  Object.assign(a.prov, { "costShares.added:0": YOURS, "costShares.added:2": YOURS, "costShares.subscription": YOURS,
    "labor.added.2.hours": YOURS, "benefitShares.risk:0": YOURS });
  deepFreeze(a);
  const b = removeItem(a, "labor.added", 1);
  assert.deepEqual(b.labor.added.map((x) => x.label), ["install", "hauling"]);
  assert.deepEqual(b.costShares, { "added:0": 0.5, "added:1": 0.25, subscription: 0.5 });
  assert.deepEqual(b.prov["costShares.added:1"], YOURS);
  assert.equal("costShares.added:2" in b.prov, false);
  assert.deepEqual(b.prov["labor.added.1.hours"], YOURS);
  assert.equal("labor.added.2.hours" in b.prov, false);
  assert.deepEqual(b.benefitShares, a.benefitShares);
  const c = removeItem(a, "labor.added", 0);
  assert.deepEqual(c.costShares, { "added:1": 0.25, subscription: 0.5 }); // added:0 went with its item
  assert.equal("costShares.added:0" in c.prov, false);
  const d = removeItem(a, "riskLines", 0);
  assert.deepEqual(d.riskLines, []);
  assert.deepEqual(d.benefitShares, { vehicle: 0.9 });
  assert.ok(!Object.keys(d.prov).some((k) => k.startsWith("riskLines.") || k.includes("risk:")));
  assert.deepEqual(d.costShares, a.costShares);
});

test("removeItem: a land unit's records go, and its entries in the shares split by land unit are deleted (9.2)", () => {
  const a = loadExample("ranchA");
  a.settings.landUnits = [{ id: "u1", kind: "owned", share: 0.6 }, { id: "u2", kind: "leased", share: 0.4, leaseYears: 3 },
    { id: "u3", kind: "owned", share: 0 }];
  a.costs.subscription.operatorShare = { u1: 1, u2: 0.5 };
  a.benefitShares = { vehicle: { u1: 1, u2: 0 }, laborCut: 0.8 };
  a.costShares = { "added:0": { u2: 0.5 } };
  Object.assign(a.prov, { "settings.landUnits.1.share": YOURS, "settings.landUnits.1.leaseYears": YOURS, "settings.landUnits.2.share": YOURS,
    "costs.subscription.operatorShare.u2": YOURS, "costs.subscription.operatorShare.u1": YOURS, "benefitShares.vehicle.u2": YOURS,
    "costShares.added:0.u2": YOURS, "benefitShares.laborCut": YOURS });
  deepFreeze(a);
  const b = removeItem(a, "settings.landUnits", 1);
  assert.deepEqual(b.settings.landUnits.map((u) => u.id), ["u1", "u3"]);
  assert.deepEqual(b.costs.subscription.operatorShare, { u1: 1 });
  assert.deepEqual(b.benefitShares, { vehicle: { u1: 1 }, laborCut: 0.8 });
  assert.deepEqual(b.costShares, { "added:0": {} });
  assert.deepEqual(b.prov["settings.landUnits.1.share"], YOURS); // u3's record, moved from index 2
  for (const k of ["settings.landUnits.2.share", "settings.landUnits.1.leaseYears", "costs.subscription.operatorShare.u2",
    "benefitShares.vehicle.u2", "costShares.added:0.u2"]) assert.equal(k in b.prov, false, k);
  for (const k of ["costs.subscription.operatorShare.u1", "benefitShares.laborCut"]) assert.deepEqual(b.prov[k], YOURS, k);
});

test("removeItem: a land unit's id is matched as text, so another unit's share records stay", () => {
  const a = loadExample("ranchA");
  a.settings.landUnits = [{ id: "u1", kind: "owned", share: 0.5 }, { id: "u?1", kind: "owned", share: 0.5 }];
  a.costs.monitors.operatorShare = { u1: 0.8, "u?1": 1 };
  Object.assign(a.prov, { "costs.monitors.operatorShare.u1": YOURS, "costs.monitors.operatorShare.u?1": YOURS });
  const b = removeItem(a, "settings.landUnits", 1);
  assert.deepEqual(b.costs.monitors.operatorShare, { u1: 0.8 });
  assert.deepEqual([b.prov["costs.monitors.operatorShare.u1"], "costs.monitors.operatorShare.u?1" in b.prov], [YOURS, false]);
  assert.doesNotThrow(() => removeItem({ ...a, settings: { ...a.settings, landUnits: [a.settings.landUnits[0], { id: "u(", share: 0.5 }] } },
    "settings.landUnits", 1));
});

test("removeItem: removing the only land unit of a water or virtual fence analysis leaves a validation error (9.2)", () => {
  for (const id of ["ranchA", "ranchB"]) {
    const a = removeItem(loadExample(id), "settings.landUnits", 0);
    assert.deepEqual(a.settings.landUnits, []);
    assert.deepEqual(validate(a).filter((e) => e.path === "settings.landUnits").map((e) => e.message),
      ["Land units: add at least one land unit, owned or leased."]);
  }
});

test("removeItem: a handling event; an index out of range or a path that holds no list is unchanged", () => {
  const b = deepFreeze(loadExample("ranchB"));
  const c = removeItem(b, "labor.handling.events", 0);
  assert.deepEqual(c.labor.handling.events.map((e) => e.label), ["collar off"]);
  assert.deepEqual(c.prov["labor.handling.events.0.minutesPerHead"], b.prov["labor.handling.events.1.minutesPerHead"]);
  assert.equal("labor.handling.events.1.minutesPerHead" in c.prov, false);
  for (const [path, i] of [["labor.handling.events", 2], ["labor.handling.events", -1], ["labor.handling.events", 0.5], ["vf.fence", 0], ["riskLines", 0]]) {
    assert.equal(removeItem(b, path, i), b, `${path} ${i}`);
  }
});

test("every action leaves the state it is given unchanged, and returns it when nothing changes", () => {
  for (const id of EXAMPLE_IDS) {
    const a = deepFreeze(loadExample(id));
    const before = structuredClone(a);
    analyzeMine(a);
    keepRate(a);
    setInput(a, "settings.discountRate", 0.05);
    setInput(a, "startYear", 1);
    setInput(a, "ramp.3", 0.8);
    for (const path of Object.keys(a.prov)) {
      keepValue(a, path);
      useVendorPrice(a, path);
      setInput(a, path, null);
    }
    removeItem(a, "labor.added", 0);
    assert.deepEqual(a, before, id);
    assert.equal(reset(a).example, id);
  }
});
