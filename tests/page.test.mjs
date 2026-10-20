// Tests of the page switch (docs/audit/phase1-spec.md 9.1 step 6, 9.5, 9.7 "Page text"): the inputs as form.js lists
// them, the user actions the page adds to state.js, and the texts the page shows that text.js builds for it (the
// verdict area, the rate and placeholder labels, the year table, what was left out, the cumulative chart, the
// formulas, the assumptions list and the sources). 10.1 rows 1, 20, 31, 33, 34, 37, 38, 45 and 49 (its verdict area),
// the left-out list of 9.7 and the singular "year". The checks that need the rendered page are a by-hand checklist in
// the pull request (9.7).
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyze, solveDrivers, targetTest, tornado, twoWayGrid, validate, YEARS_MESSAGE } from "../roi.js";
import { example, EXAMPLE_IDS } from "../examples.js";
import { addItem, addKey, addPart, analyzeMine, getAt, keepRate, keepValue, loadExample, MAX_ITEMS, removeItem, removeKey,
  setInput, setShare, toByYear, useVendorPrice } from "../state.js";
import { readLink, writeLink } from "../links.js";
import { cutFrom, formFields, formGroups, LINE_TEMPLATES, newItem, PRICING_LINES, readYears, shownLabel, shownValue,
  yearsUnread } from "../form.js";
import * as T from "../text.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const close = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);
const cash = (a) => {
  assert.deepEqual(validate(a), []);
  return analyze(a).cashNPV;
};
/** Every string the page shows for analysis a, from text.js (9.7: no NaN or Infinity anywhere on the page). */
function pageStrings(a) {
  const r = analyze(a), test = targetTest(a, r), rows = solveDrivers(a, r, test), t = tornado(a, r), g = twoWayGrid(a, t);
  const panel = T.paybackPanel(a, r, test, rows);
  const year = T.yearTable(a, r);
  const left = T.leftOut(a, r);
  const cum = T.cumulativeChart(r);
  const f = T.formulas(a, r);
  return [
    ...T.verdictArea(a, r, test, rows, t.bars), ...T.tiles(a, r).flatMap((x) => [x.label, x.value]),
    panel.title, panel.caption, ...panel.columns, ...panel.notes, ...panel.rows.flatMap((x) => [x.input, x.entered, x.target, x.horizon, ...x.notes]),
    ...r.notices.map(T.noticeText).filter(Boolean), ...left.items, left.ending ?? "", left.warning ?? "",
    year.note, ...year.columns.map((c) => c.label), ...year.rows.flatMap((x) => [...x.cells, x.note ?? ""]),
    ...T.othersLists(a, r).filter(Boolean).flatMap((l) => [l.title, ...l.columns, ...l.rows.flat()]),
    T.CUMULATIVE_CAPTION, cum.mark?.text ?? "", cum.state ?? "", ...cum.points.map((p) => String(p.value)),
    T.tornadoCaption(t), ...T.tornadoLists(t), ...t.bars.flatMap(T.tornadoHover), T.gridNote(g) ?? "",
    ...(g ? [...g.rows.values.map((v) => T.gridValue(g.rows, v)), ...g.cols.values.map((v) => T.gridValue(g.cols, v)), ...g.cells.flat().map((v) => (v === null ? "n/a" : T.money(v)))] : []),
    ...f.sections.flatMap((s) => [s.title, ...s.rows.flatMap((x) => [x.name, x.expr, x.result])]), f.note,
    ...T.assumptions(a).flatMap((x) => [x.label, x.value, x.classText, x.source, x.note ?? ""]),
    ...formFields(a).flatMap((x) => [x.label, x.unit ?? "", x.help ?? "", String(shownValue(a, x) ?? "")]),
  ];
}
const noBadNumbers = (strings) => {
  const bad = strings.filter((x) => typeof x !== "string" || /NaN|Infinity|undefined|\[object/.test(x));
  assert.deepEqual(bad, []);
};

// ---------------------------------------------------------------- row 1, and every example: no NaN on the page

test("row 1: no costs and no benefits shows no NaN or Infinity, and reads 'No cash flows for you'", () => {
  const zero = { module: "water", example: "ranchA", settings: { T: 5, discountRate: 0.07 }, startYear: 0, classes: { cows: { head: 100 } },
    served: { cows: {} }, water: { monitors: 0, blocks: [] } };
  assert.deepEqual(validate(zero), []);
  const r = analyze(zero), test = targetTest(zero, r);
  const area = T.verdictArea(zero, r, test, solveDrivers(zero, r, test), tornado(zero, r).bars);
  assert.deepEqual(area.slice(0, 2), ["No cash flows for you in this analysis.", "No cash flows for you within 5 years"]);
  assert.ok(!area.some((l) => /pays\./.test(l)));
  noBadNumbers(pageStrings(zero));
  assert.equal(T.cumulativeChart(r).state, "Cash payback (before tax): n/a: no cash flows");
});

test("every example and version 1 link: no NaN, Infinity or undefined in any page string", () => {
  const states = [...EXAMPLE_IDS.map(example), ...["#preset=Remote+water+monitoring&head=500&years=5", "#preset=Collar-based+virtual+fencing",
    "#preset=EID+tags+and+scale", "#preset=Unknown"].map((h) => readLink(h).state)];
  for (const a of states) noBadNumbers(pageStrings(a));
});

// ---------------------------------------------------------------- rows 20 and 34: real rate and before tax

test("rows 20 and 34: the rate is labeled real and every result says before tax; no input asks for escalation or tax", () => {
  for (const id of EXAMPLE_IDS) {
    const a = example(id), r = analyze(a);
    const fields = formFields(a);
    const rate = fields.find((f) => f.path === "settings.discountRate");
    assert.equal(rate.label, "Discount rate (real, %/yr)");
    assert.equal(rate.help, "real rate ≈ your loan rate + a risk premium − expected inflation");
    const step2 = formGroups(a).find((g) => g.id === "settings").rows.find((x) => x.type === "note");
    assert.equal(step2.text, "All amounts are in today's US dollars, with prices held flat, so the discount rate is a real rate. Every result is before tax.");
    assert.match(T.yearTableNote(r), /discounted at 7% a year \(real\)\. Your share of each line, before tax\.$/);
    assert.match(T.verdictSentence(a, r), /real rate .*before tax/);
    for (const tile of T.tiles(a, r)) assert.ok(tile.label.endsWith(" (before tax)"), tile.label);
    assert.match(T.CUMULATIVE_CAPTION, /before tax/);
    // No input offers price escalation or asks for a tax rate (rows 20 and 34).
    for (const f of fields) assert.ok(!/escalat|inflation|tax/i.test(`${f.path} ${f.label}`), f.path);
  }
});

// ---------------------------------------------------------------- row 31: Indicative only

test("row 31: Synthetic Ranch A reads 'Indicative only', also with the monitor price typed as a quote", () => {
  const A = example("ranchA");
  assert.equal(T.indicativeOnly(A, analyze(A)), true);
  const quoted = setInput(A, "costs.monitors.unitCost", 1600);
  assert.equal(quoted.prov["costs.monitors.unitCost"].cls, "D");
  assert.equal(T.indicativeOnly(quoted, analyze(quoted)), true);
  // With every input of its cash lines and residuals typed [D], the benefit is from the user's records.
  let mine = A;
  for (const l of analyze(A).lines.filter((x) => x.kind === "cash" || (x.kind === "cost" && x.pvResidual))) {
    for (const p of l.paths) if (typeof getAt(mine, p) === "number" || Array.isArray(getAt(mine, p))) mine = setInput(mine, p, getAt(mine, p));
  }
  for (const p of Object.keys(mine.prov).filter((k) => k.startsWith("ramp."))) mine = setInput(mine, p, getAt(mine, p));
  assert.equal(T.indicativeOnly(mine, analyze(mine)), false);
  const r = analyze(mine), test = targetTest(mine, r);
  assert.notEqual(T.verdictArea(mine, r, test, solveDrivers(mine, r, test), [])[0], T.INDICATIVE);
  // The half-way test (9.3): Ranch A's vehicle line is 44.5% of PV(B) and its labor cut 55.5%.
  const type = (x, paths) => paths.reduce((s, p) => setInput(s, p, getAt(s, p)), x);
  const LABOR = ["labor.cut.unitsCut", "labor.cut.hoursPerUnit", "labor.cut.paidRate", "labor.cut.loadPct"];
  const VEHICLE = analyze(A).lines.find((l) => l.id === "vehicle").paths;
  assert.equal(T.indicativeOnly(type(A, LABOR), analyze(A)), false); // 44.5% estimated
  assert.equal(T.indicativeOnly(type(A, VEHICLE), analyze(A)), true); // 55.5% estimated
  // A line stays estimated while any input it multiplies is [B], [C] or [E].
  assert.equal(T.indicativeOnly(type(A, LABOR.slice(0, 3)), analyze(A)), true);
  // A capital line's residual counts as estimated with its price: Ranch C with its dosing typed at $0.05 a dose.
  const C = example("ranchC"), dosing = analyze(C).lines.find((l) => l.id === "dosing").paths;
  const typedC = setInput(type(C, dosing), "eid.dosing.perApplication", 0.05), rc = analyze(typedC);
  assert.ok(rc.pv.R > 0.5 * (rc.pv.B + rc.pv.R));
  assert.equal(T.indicativeOnly(typedC, rc), true);
  assert.equal(T.indicativeOnly(type(C, dosing), analyze(type(C, dosing))), false);
});

test("row 31: a residual rests on its own share as well as its price, and the fence on its life and build year (9.3)", () => {
  const type = (x, paths) => paths.reduce((s, p) => setInput(s, p, getAt(s, p)), x);
  // Ranch C with its dosing typed at $0.05 a dose and every price typed: the residuals (15% of cost, [E]) still decide.
  const C = example("ranchC"), dosing = analyze(C).lines.find((l) => l.id === "dosing").paths;
  const PRICES = ["costs.reader.unitCost", "costs.indicatorBars.unitCost", "costs.platform.unitCost"];
  const PCTS = ["costs.reader.residual.pct", "costs.indicatorBars.residual.pct", "costs.platform.residual.pct"];
  for (const p of PCTS) assert.equal(C.prov[p].cls, "E", p);
  const priced = type(setInput(type(C, dosing), "eid.dosing.perApplication", 0.05), PRICES);
  assert.equal(T.indicativeOnly(priced, analyze(priced)), true);
  assert.equal(T.indicativeOnly(type(priced, PCTS), analyze(priced)), false);
  // Ranch D with every input its fence and labor lines multiply typed: the fence's life [B] or build year [E] keeps it.
  const D = example("ranchD"), rd = analyze(D);
  let typedD = D;
  for (const l of rd.lines.filter((x) => x.kind === "cash")) typedD = type(typedD, l.paths.filter((p) => getAt(typedD, p) !== undefined));
  assert.deepEqual([typedD.prov["vf.fence.Lf"].cls, typedD.prov["vf.fence.k"].cls], ["B", "E"]);
  assert.equal(T.indicativeOnly(typedD, analyze(typedD)), true);
  assert.equal(T.indicativeOnly(type(typedD, ["vf.fence.Lf"]), rd), true);
  assert.equal(T.indicativeOnly(type(typedD, ["vf.fence.k"]), rd), true);
  assert.equal(T.indicativeOnly(type(typedD, ["vf.fence.Lf", "vf.fence.k"]), rd), false);
  // Deferred, the fence also rests on its years deferred: [E] keeps it estimated, typed [D] does not.
  const deferred = structuredClone(setInput(type(typedD, ["vf.fence.Lf", "vf.fence.k"]), "vf.fence.mode", "deferred"));
  deferred.vf.fence.d = 5;
  deferred.prov["vf.fence.d"] = { cls: "E", src: "Synthetic Ranch D: made-up example value" };
  assert.deepEqual([validate(deferred), T.indicativeOnly(deferred, analyze(deferred))], [[], true]);
  const dTyped = type(deferred, ["vf.fence.d"]);
  assert.equal(T.indicativeOnly(dTyped, analyze(dTyped)), false);
  // A residual entered as an amount rests on that amount alone: [E] amounts keep Ranch C estimated, typed ones do not.
  const amounts = structuredClone(type(priced, PCTS));
  for (const id of ["reader", "indicatorBars", "platform"]) {
    amounts.costs[id].residual = { mode: "amount", dollars: 400 };
    amounts.prov[`costs.${id}.residual.dollars`] = { cls: "E", src: "Synthetic Ranch C: made-up example value" };
  }
  assert.deepEqual([validate(amounts), T.indicativeOnly(amounts, analyze(amounts))], [[], true]);
  const dollarsTyped = type(amounts, ["reader", "indicatorBars", "platform"].map((id) => `costs.${id}.residual.dollars`));
  assert.equal(T.indicativeOnly(dollarsTyped, analyze(dollarsTyped)), false);
});

test("row 31: a vehicle line whose share is set by its block's minimum visits rests on those visits (9.3)", () => {
  const type = (x, paths) => paths.reduce((s, p) => setInput(s, p, getAt(s, p)), x);
  const A = example("ranchA");
  const LABOR = ["labor.cut.unitsCut", "labor.cut.hoursPerUnit", "labor.cut.paidRate", "labor.cut.loadPct"];
  // Summer's share typed at 90%, above its cap of 50% ((4 − 2 visits) / 4 runs a week), and the labor cut at 10 days:
  // the vehicle line is more than half the benefit, and every input of it is typed but the minimum visits [E].
  let a = setInput(setInput(type(A, LABOR), "water.blocks.0.shareAvoided", 0.9), "labor.cut.unitsCut", 10);
  const vehicle = analyze(a).lines.find((l) => l.id === "vehicle").paths;
  assert.ok(vehicle.includes("water.blocks.0.minVisitsPerWeek"));
  a = type(a, [...vehicle.filter((p) => p !== "water.blocks.0.minVisitsPerWeek"), ...Object.keys(A.prov).filter((k) => k.startsWith("ramp."))]);
  assert.equal(a.prov["water.blocks.0.minVisitsPerWeek"].cls, "E");
  assert.equal(T.indicativeOnly(a, analyze(a)), true);
  const visits = type(a, ["water.blocks.0.minVisitsPerWeek"]);
  assert.equal(T.indicativeOnly(visits, analyze(visits)), false);
  // At the cap, as Ranch A loads (50%), the visits still set the share; below it (40%) they do not.
  for (const [share, rests] of [[0.5, true], [0.4, false]]) {
    let b = setInput(setInput(type(A, LABOR), "water.blocks.0.shareAvoided", share), "labor.cut.unitsCut", 10);
    const paths = analyze(b).lines.find((l) => l.id === "vehicle").paths;
    assert.equal(paths.includes("water.blocks.0.minVisitsPerWeek"), rests, String(share));
    b = type(b, [...paths.filter((p) => p !== "water.blocks.0.minVisitsPerWeek"), ...Object.keys(A.prov).filter((k) => k.startsWith("ramp."))]);
    assert.equal(T.indicativeOnly(b, analyze(b)), rests, String(share));
  }
});

// ---------------------------------------------------------------- row 49: the verdict area in full and in order

test("row 49: Synthetic Ranch B's verdict area, in order", () => {
  const B = example("ranchB"), r = analyze(B), test = targetTest(B, r), rows = solveDrivers(B, r, test);
  assert.deepEqual(T.verdictArea(B, r, test, rows, tornado(B, r).bars), [
    "Indicative only: most of the benefit is estimated, not from your records.",
    "Over 7 years at the example's 7% real rate (an assumption, not a recommendation), before tax, this costs about $230,000 more than it saves in cash. It does not pay. Cash benefits would need to rise about 3.5-fold. It turns most on herd size and subscription.",
    "Does not pay for itself within 5 years",
    T.wouldPaySentence(test, rows),
    "Published prices describe what the equipment costs. They do not support the projected savings, which come from your entries or the example's assumptions.",
  ]);
  assert.match(T.wouldPaySentence(test, rows), /^It would pay for itself within 5 years if: herd size at most /);
  assert.equal(T.tiles(B, r)[0].value, "about −$230,000");
});

test("the verdict area in its full order: Synthetic Ranch A as the user's own, with the capacity line and both notes", () => {
  const A = analyzeMine(example("ranchA")), r = analyze(A), test = targetTest(A, r), rows = solveDrivers(A, r, test);
  const area = T.verdictArea(A, r, test, rows, tornado(A, r).bars);
  assert.deepEqual(area, [
    T.INDICATIVE, T.verdictSentence(A, r, tornado(A, r).bars), "Does not pay for itself within 5 years", T.wouldPaySentence(test, rows),
    "It also frees about 84 hours a year of your time (not cash).", "Discount rate not yet reviewed.",
    "Includes synthetic cost placeholders.", T.PUBLISHED_PRICES,
  ]);
  assert.match(area[1], /costs about \$11,000 more than it saves in cash\. It does not pay\. Cash benefits would need to rise by about 33%\. It turns most on /);
  // A test that passes has no "It would pay" sentence.
  const D = setInput(example("ranchD"), "costs.subscription.unitCost", 6), rd = analyze(D), td = targetTest(D, rd);
  assert.deepEqual(T.verdictArea(D, rd, td, solveDrivers(D, rd, td), []).slice(2), [
    "Pays for itself within 5 years (counting equipment value left at year 5)", "Discount rate not yet reviewed.",
    "Includes synthetic cost placeholders.", T.PUBLISHED_PRICES,
  ]);
});

// ---------------------------------------------------------------- row 33: the example rate and the review prompt

test("row 33: the example rate, the review prompt, 'Keep this rate', an edit, and loading another example", () => {
  const notes = (a) => T.verdictNotes(a);
  let A = loadExample("ranchA");
  assert.equal(A.settings.discountRate, 0.07);
  assert.deepEqual(T.rateField(A), { label: T.RATE_EXAMPLE_LABEL, cls: "E", prompt: false, help: T.RATE_HELP });
  assert.equal(T.RATE_EXAMPLE_LABEL, "Example assumption (real rate), not a recommendation. Review it for your operation.");
  assert.deepEqual(notes(A), []);
  const herd = setInput(A, "classes.cows.head", 950);
  assert.equal(herd.settings.discountRate, 0.07);
  assert.equal(T.rateField(herd).prompt, true);
  assert.equal(T.rateField(herd).label, T.RATE_EXAMPLE_LABEL);
  assert.ok(notes(herd).includes("Discount rate not yet reviewed."));
  // "Keep this rate": the example label stays, followed by "Reviewed"; prompt and note clear.
  const kept = keepRate(herd);
  assert.deepEqual([T.rateField(kept).label, T.rateField(kept).prompt], [`${T.RATE_EXAMPLE_LABEL} Reviewed`, false]);
  assert.ok(!notes(kept).includes("Discount rate not yet reviewed."));
  // An edit instead: the [D] badge and no example label.
  const edited = setInput(herd, "settings.discountRate", 0.06);
  assert.deepEqual(T.rateField(edited), { label: null, cls: "D", prompt: false, help: T.RATE_HELP });
  assert.ok(!notes(edited).includes("Discount rate not yet reviewed."));
  // "Analyze my operation" with no change: the prompt and the note.
  const mine = analyzeMine(A);
  assert.equal(T.rateField(mine).prompt, true);
  assert.ok(notes(mine).includes("Discount rate not yet reviewed."));
  // A rate edited on the example counts as reviewed, so the later herd change brings no prompt and no note.
  A = setInput(A, "settings.discountRate", 0.06);
  assert.equal(A.settings.ownAnalysis, false);
  const later = setInput(A, "classes.cows.head", 950);
  assert.equal(T.rateField(later).prompt, false);
  assert.ok(!notes(later).includes("Discount rate not yet reviewed."));
  // Loading Synthetic Ranch B sets both flags back: its 7% with the example label and no prompt.
  const B = loadExample("ranchB");
  assert.deepEqual([B.settings.ownAnalysis, B.settings.rateReviewed, B.settings.discountRate], [false, false, 0.07]);
  assert.deepEqual([T.rateField(B).label, T.rateField(B).prompt], [T.RATE_EXAMPLE_LABEL, false]);
  // Results are computed at every step.
  for (const a of [herd, kept, edited, mine, later, B]) assert.ok(Number.isFinite(cash(a)));
  // A version 1 link's rate shows its source, not the example label, and the prompt until kept.
  const v1 = readLink("#preset=Remote+water+monitoring&head=500&years=5").state;
  assert.deepEqual(T.rateField(v1), { label: "version 1 link", cls: "E", prompt: true, help: T.RATE_HELP });
  assert.equal(T.rateField(keepRate(v1)).label, "version 1 link Reviewed");
});

test("row 33 and 9.4: the prompt reads 'Review this rate'; the page marks the rate field and exactly the price inputs", () => {
  assert.equal(T.RATE_PROMPT, "Review this rate");
  const PRICE = /^costs\.[^.]+\.unitCost$|^eid\.tagPrice$|^vf\.collarLoss\.chargePerCollar$/;
  for (const a of [...EXAMPLE_IDS.map(example), setInput(example("ranchB"), "vf.pricing", "purchased")]) {
    const fields = formFields(a);
    assert.deepEqual(fields.filter((f) => f.rate).map((f) => f.path), ["settings.discountRate"], a.example);
    const nums = fields.filter((f) => f.type === "num");
    assert.deepEqual(nums.filter((f) => f.price).map((f) => f.path), nums.filter((f) => PRICE.test(f.path)).map((f) => f.path), a.example);
  }
  const prices = (id) => formFields(example(id)).filter((f) => f.price).map((f) => f.path);
  assert.deepEqual(prices("ranchA"), ["costs.monitors.unitCost", "costs.mounting.unitCost", "costs.subscription.unitCost", "costs.batteries.unitCost"]);
  assert.deepEqual(prices("ranchB"), ["vf.collarLoss.chargePerCollar", "costs.subscription.unitCost", "costs.infrastructure.unitCost"]);
  assert.deepEqual(prices("ranchC"), ["eid.tagPrice", "costs.reader.unitCost", "costs.indicatorBars.unitCost", "costs.platform.unitCost",
    "costs.software.unitCost"]);
});

// ---------------------------------------------------------------- row 37: the synthetic cost placeholders

test("row 37: the placeholder label, flag, 'Keep this value' and verdict note, with cash NPV at each step", () => {
  const PLACEHOLDER = "Synthetic placeholder, not a price. Replace with your quote.";
  const A = loadExample("ranchA");
  for (const p of ["costs.mounting.unitCost", "costs.batteries.unitCost"]) {
    assert.equal(T.priceNote(A, p, getAt(A, p)).text, PLACEHOLDER);
    assert.equal(T.placeholderFlag(A, p), null);
  }
  assert.ok(!T.verdictNotes(A).includes("Includes synthetic cost placeholders."));
  close(cash(A), -11079);
  const mine = analyzeMine(A);
  for (const p of ["costs.mounting.unitCost", "costs.batteries.unitCost"]) {
    assert.deepEqual(T.placeholderFlag(mine, p), { text: "Not yet replaced or confirmed.", keep: true });
  }
  assert.ok(T.verdictNotes(mine).includes("Includes synthetic cost placeholders."));
  close(cash(mine), -11079);
  const quoted = setInput(mine, "costs.mounting.unitCost", 900);
  assert.equal(quoted.prov["costs.mounting.unitCost"].cls, "D");
  assert.equal(T.priceNote(quoted, "costs.mounting.unitCost", 900).text, "your quote");
  assert.equal(T.placeholderFlag(quoted, "costs.mounting.unitCost"), null);
  close(cash(quoted), -11229);
  close(cash(mine) - cash(quoted), 150, 0.001);
  assert.ok(T.verdictNotes(quoted).includes("Includes synthetic cost placeholders."));
  assert.equal(T.tiles(quoted, analyze(quoted))[0].value, "about −$11,000");
  const kept = keepValue(quoted, "costs.batteries.unitCost");
  assert.equal(T.priceNote(kept, "costs.batteries.unitCost", getAt(kept, "costs.batteries.unitCost")).text, PLACEHOLDER);
  assert.deepEqual(T.placeholderFlag(kept, "costs.batteries.unitCost"), { text: "Confirmed", keep: false });
  assert.ok(!T.verdictNotes(kept).includes("Includes synthetic cost placeholders."));
  close(cash(kept), -11229);
});

// ---------------------------------------------------------------- row 38: the vendor fill and a quote

test("row 38: a cleared price, the vendor fill, a typed quote, and a reported price with no fill", () => {
  const mine = analyzeMine(loadExample("ranchA"));
  const p = "costs.monitors.unitCost";
  // (a) Cleared: "Quote required" at the input and in the result, with the warning.
  const cleared = setInput(mine, p, null);
  assert.equal(T.priceNote(cleared, p, getAt(cleared, p)).text, "Quote required");
  const left = T.leftOut(cleared, analyze(cleared));
  assert.ok(left.items.includes("Monitors: Quote required: not counted"), JSON.stringify(left.items));
  assert.equal(left.warning, "Costs marked 'Quote required' are left out, so this result overstates the case.");
  close(cash(cleared), 3821);
  assert.ok(formFields(cleared).find((f) => f.path === p).fill);
  // A price entered by year with every year blank is blank too (9.5 item 7).
  const byYear = setInput(mine, "costs.subscription.unitCost", Array(11).fill(null));
  assert.equal(T.priceNote(byYear, "costs.subscription.unitCost", getAt(byYear, "costs.subscription.unitCost")).text, "Quote required");
  assert.ok(T.leftOut(byYear, analyze(byYear)).items.includes("Subscription: Quote required: not counted"));
  assert.equal(T.priceNote(mine, p, [null, ""]).text, "Quote required");
  // (b) "Use published vendor price": $1,490 [C], with its label and linked source.
  const filled = useVendorPrice(cleared, p);
  assert.equal(getAt(filled, p), 1490);
  const note = T.priceNote(filled, p, 1490);
  assert.equal(note.text, "Vendor information: published list price (All-Tex dealer flyer, undated; checked 15 Oct 2026). Not an endorsement. Replace with your quote.");
  assert.equal(note.cite, "All-Tex dealer flyer, undated; checked 15 Oct 2026");
  assert.match(note.url, /^https:\/\//);
  close(cash(filled), -11079);
  // (c) A typed quote: [D], "your quote".
  const typed = setInput(filled, p, 1600);
  assert.deepEqual([typed.prov[p].cls, T.priceNote(typed, p, 1600).text], ["D", "your quote"]);
  close(cash(typed), -12179);
  // (d) Synthetic Ranch B's subscription: the reported-price label, no fill; cleared, "Quote required".
  const B = example("ranchB");
  const sub = "costs.subscription.unitCost";
  assert.equal(T.priceNote(B, sub, 7).text, "Vendor information: reported price (DTN, 31 Mar 2025), not a published list price. Not an endorsement. Replace with your quote.");
  assert.equal(formFields(B).find((f) => f.path === sub).fill, false);
  const none = setInput(B, sub, null);
  assert.equal(T.priceNote(none, sub, null).text, "Quote required");
  const leftB = T.leftOut(none, analyze(none));
  assert.ok(leftB.items.includes("Subscription: Quote required: not counted"), JSON.stringify(leftB.items));
  assert.equal(leftB.warning, T.QUOTE_WARNING);
  close(cash(none), 36884);
});

// ---------------------------------------------------------------- row 45: the payback target input

test("row 45: the payback target input, its line, its link and its validation", () => {
  const D = example("ranchD");
  const field = formGroups(D).find((g) => g.id === "settings").rows;
  assert.deepEqual(field.slice(0, 2).map((f) => [f.path, f.label]), [["settings.T", "Horizon"], ["settings.paybackTarget", "Payback target"]]);
  assert.equal(field[1].help, "The page tests whether the analysis pays for itself within this many years.");
  assert.equal(shownValue(D, field[1]), 5);
  const seven = setInput(D, "settings.paybackTarget", 7);
  assert.equal(seven.settings.ownAnalysis, false); // the good-fit banner stays
  const r = analyze(seven), test = targetTest(seven, r);
  assert.equal(T.paybackTargetLine(test), "Does not pay for itself within 7 years");
  close(test.cashNPV, -9789);
  const panel = T.paybackPanel(seven, r, test, solveDrivers(seven, r, test));
  assert.deepEqual(panel.columns.slice(2), ["To pay for itself within 7 years", "To break even over 7 years"]);
  for (const row of panel.rows) assert.equal(row.target.replace("pay for itself within", "break even over").replace("Pays for itself within", "Breaks even or better over"), row.horizon);
  assert.equal(readLink(writeLink(seven)).state.settings.paybackTarget, 7);
  for (const bad of [2.5, 0]) {
    const errors = validate(setInput(D, "settings.paybackTarget", bad));
    assert.deepEqual(errors.map((e) => [e.path, e.message]), [["settings.paybackTarget", YEARS_MESSAGE]]);
  }
});

// ---------------------------------------------------------------- what was left out (9.5 item 4, 9.7)

test("what was left out: a cleared risk line once with the blank-benefits ending; a blank input of a counted line", () => {
  const A = example("ranchA");
  const before = analyze(A);
  close(before.cashNPVWithRisk, -412);
  const cleared = setInput(A, "riskLines.0.eventsPerYear", null);
  const r = analyze(cleared), left = T.leftOut(cleared, r);
  assert.equal(left.items.filter((x) => x === "Losses avoided (water): not entered, not counted").length, 1);
  assert.equal(left.ending, "Benefits left blank are not counted, so they can only make this result look worse.");
  close(r.cashNPV, -11079);
  close(r.cashNPVWithRisk, -11079);
  // A water analysis whose list names only a blank price and "Losses from fewer physical checks": no ending.
  const price = setInput(A, "costs.monitors.unitCost", null), lp = T.leftOut(price, analyze(price));
  assert.deepEqual(lp.items, ["Monitors: Quote required: not counted", "Losses from fewer physical checks: not entered, not counted"]);
  assert.equal(lp.ending, null);
  // A blank input that a counted benefit line multiplies counts as 0 and is listed under its own label (9.5 item 7).
  const cut = setInput(A, "labor.cut.unitsCut", null), lc = T.leftOut(cut, analyze(cut));
  assert.equal(lc.items[0], "Hired labor cut: not entered, not counted");
  assert.equal(lc.ending, T.BLANK_BENEFITS);
  // A blank verification fee is a cost left out of the premium, so it gets no ending: Ranch C with its premium and
  // weight gain entered and the fee blank.
  let C = example("ranchC");
  for (const [path, v] of [["eid.premium.saleCwt", 5.5], ["eid.premium.premiumPerCwt", 2], ["production.lbPerHeadPerDay", 0.05],
    ["production.days", 60], ["production.classes", ["calvesSold"]], ["classes.calvesSold.valueOfGain", 1]]) C = setInput(C, path, v);
  assert.deepEqual(T.leftOut(C, analyze(C)), { items: ["Verification fee: not entered, not counted"], ending: null, warning: null });
});

test("what was left out: in 9.4's order; a blank cost, hours or capacity input is listed, and only a benefit input adds the ending", () => {
  const left = (a) => T.leftOut(a, analyze(a));
  const not = (label) => `${label}: not entered, not counted`;
  // The owner time rate is optional and counts as 0 when blank (9.3 capacity). The virtual fence examples free no
  // hours in any year, so their blank rate counts nothing and is not listed.
  for (const id of ["ranchB", "ranchD"]) {
    assert.deepEqual(left(example(id)), { items: [not("Weight gain")], ending: T.BLANK_BENEFITS, warning: null }, id);
  }
  // A blank cost input: Ranch C's retag rate, listed before the premium and gain, as in 9.4 (cash NPV −$9,895 → −$9,819).
  const C = example("ranchC"), retag = setInput(C, "eid.retagPct", null);
  close(cash(C), -9895);
  close(cash(retag), -9819);
  assert.deepEqual(left(retag).items, [not("Retag rate"), not("Net program premium"), not("Weight gain")]);
  // With the premium and gain entered, the blank retag rate and verification fee are costs: no ending.
  let typed = retag;
  for (const [path, v] of [["eid.premium.saleCwt", 5.5], ["eid.premium.premiumPerCwt", 2], ["production.lbPerHeadPerDay", 0.05],
    ["production.days", 60], ["production.classes", ["calvesSold"]], ["classes.calvesSold.valueOfGain", 1]]) typed = setInput(typed, path, v);
  assert.deepEqual(left(typed), { items: [not("Retag rate"), not("Verification fee")], ending: null, warning: null });
  // A blank handling input of Ranch B (cash NPV −$229,531 → −$223,063), listed under its own label.
  const B = example("ranchB"), gathers = setInput(B, "labor.handling.gathers", null);
  close(cash(B), -229531);
  close(cash(gathers), -223063);
  assert.deepEqual(left(gathers).items, [not("Refit gathers"), not("Weight gain")]);
  // Hours the technology takes are a cost in time: Ranch A's added monitoring time, before its fewer-checks line.
  const A = example("ranchA"), added = setInput(A, "labor.added.1.hours", null);
  assert.deepEqual(left(added), { items: [not("Added monitoring time"), not("Losses from fewer physical checks")], ending: null, warning: null });
  // Hours saved are a benefit: Ranch C's recording time today, listed in its place in 9.4.
  assert.deepEqual(left(setInput(C, "eid.recordingHoursToday", null)).items,
    [not("Recording time today"), not("Net program premium"), not("Weight gain")]);
  // Ranch A frees hours, so its rate cleared is listed first, as 9.4 lists it among the shared inputs, with the ending.
  const noRate = setInput(A, "settings.oppCostPerHour", null);
  assert.deepEqual(left(noRate), { items: [not("Owner time rate"), not("Losses from fewer physical checks")], ending: T.BLANK_BENEFITS, warning: null });
  // When the technology takes more hours than it frees, entering the rate would lower the result: listed, no ending.
  const takes = setInput(setInput(noRate, "labor.freedTimeUse", "absorbed"), "labor.added.1.hours", 520);
  assert.ok(analyze(takes).hours.freed.slice(1).every((h) => h < 0));
  assert.deepEqual(left(takes), { items: [not("Owner time rate"), not("Losses from fewer physical checks")], ending: null, warning: null });
  // An owner time rate entered is not listed.
  assert.deepEqual(left(A).items, [not("Losses from fewer physical checks")]);
  // A residual's own share of cost or amount, cleared, counts as 0: listed under the residual (cash NPV changes).
  const res = setInput(C, "costs.reader.residual.pct", null);
  assert.ok(cash(res) < cash(C) - 100);
  assert.deepEqual(left(res).items, [not("Residual (Reader)"), not("Net program premium"), not("Weight gain")]);
  const amount = setInput(setInput(C, "costs.reader.residual.mode", "amount"), "costs.reader.residual.dollars", null);
  assert.deepEqual(left(amount).items, [not("Residual (Reader)"), not("Net program premium"), not("Weight gain")]);
  // A blank that leaves a whole line not entered is listed once, under the line, not again under another line's input.
  const share = setInput(setInput(analyzeMine(A), "labor.freedTimeUse", "absorbed"), "water.blocks.0.shareAvoided", null);
  assert.deepEqual(left(share).items, [not("Vehicle"), not("Losses from fewer physical checks")]);
  // A removed class that a line still uses is named.
  const noCalves = removeKey(removeKey(C, "classes", "calvesSold"), "classes", "calvesBorn");
  assert.equal(left(noCalves).items[0], not("Head by class and year (calves)"));
  // It stays listed when a benefit line that also uses it is left out: the calf tags still count none.
  const noDosing = setInput(noCalves, "eid.dosing.perApplication", null);
  assert.deepEqual(left(noDosing).items, [not("Head by class and year (calves)"), not("Net program premium"), not("Dosing savings"), not("Weight gain")]);
  // Hours per unit count only once a unit other than the hour is chosen, so they are not listed before.
  const noUnit = setInput(setInput(C, "labor.cut.paidRate", 20), "labor.freedTimeUse", "replacesPaidWork");
  assert.deepEqual(left(noUnit).items, [not("Paid hours cut at the chute"), not("Payroll load"), not("Net program premium"), not("Weight gain")]);
});

// ---------------------------------------------------------------- one year: the singular (9.5 item 1)

test("one year: 'Over 1 year', 'none within 1 year', 'within 1 year' and the panel's headers", () => {
  const one = setInput(setInput(example("ranchA"), "settings.T", 1), "settings.paybackTarget", 1);
  const r = analyze(one), test = targetTest(one, r);
  close(r.cashNPV, -2330);
  assert.ok(T.verdictSentence(one, r).startsWith("Over 1 year at the example's 7% real rate (an assumption, not a recommendation), before tax, this costs about $2,000 more than it saves in cash."));
  assert.equal(T.tiles(one, r).find((x) => x.label === "Cash payback (before tax)").value, "none within 1 year");
  assert.equal(T.paybackTargetLine(test), "Does not pay for itself within 1 year");
  assert.deepEqual(T.paybackPanel(one, r, test, solveDrivers(one, r, test)).columns.slice(2), ["To pay for itself within 1 year", "To break even over 1 year"]);
});

// ---------------------------------------------------------------- the year table, cumulative chart and formulas

test("the year table: years 0..T, each line with its badge, totals, risk apart, and hours (9.5 item 3)", () => {
  const A = example("ranchA"), r = analyze(A), y = T.yearTable(A, r);
  assert.deepEqual(y.rows.map((x) => x.year), [...Array(11).keys()]);
  const labels = y.columns.map((c) => c.label);
  assert.ok(labels.indexOf("Net cash") < labels.indexOf("Losses avoided (water)"));
  assert.equal(labels.at(-1), "Hours freed");
  assert.deepEqual(y.columns.find((c) => c.label === "Monitors").classes, ["C", "E"]);
  // Every line the user did not type carries a class: a badge on each cost and cash benefit column.
  for (const c of y.columns.filter((x) => ["cost", "benefit"].includes(x.group))) assert.ok(c.classes.length, c.label);
  const net = labels.indexOf("Net cash"), cum = labels.indexOf("Cumulative");
  assert.equal(y.rows[0].cells[net], T.money(r.N[0]));
  assert.equal(y.rows.at(-1).cells[cum], T.money(r.N.reduce((s, x) => s + x, 0)));
  assert.equal(T.cumulativeChart(r).points.at(-1).value, r.N.reduce((s, x) => s + x, 0));
});

test("the formulas: each line with its values, the results with their state texts, and the 'Not included' note", () => {
  const A = example("ranchA"), r = analyze(A), f = T.formulas(A, r);
  const monitors = f.sections[0].rows.find((x) => x.name === "Monitors");
  assert.match(monitors.expr, /10 × \$1,490 in year 0/);
  assert.equal(f.sections[2].rows.find((x) => x.name === "Cash payback").result, T.paybackText(r.payback));
  assert.equal(f.note, "Not included: taxes (results are before tax), financing (the lender's view comes later) and price changes (amounts are in today's dollars with a real discount rate).");
  assert.ok(!/folded into the inputs|adjusting the inputs/.test(f.note));
});

// ---------------------------------------------------------------- the assumptions list and the sources

test("the assumptions list gives every value its class; the sources describe each value as what it is", () => {
  for (const id of EXAMPLE_IDS) {
    const a = example(id);
    const rows = T.assumptions(a);
    assert.equal(rows.length, Object.keys(a.prov).length);
    for (const x of rows) assert.ok(["A", "B", "C", "D", "E"].includes(x.cls) && x.classText, x.path);
  }
  // A value entered by year names the years that differ from the rest.
  const A = example("ranchA"), value = (a, p) => T.assumptions(a).find((x) => x.path === p).value;
  assert.equal(value(A, "costs.batteries.unitCost"), "$100 per monitor in years 4 and 8, $0 per monitor in the other years");
  const sub = "costs.subscription.unitCost";
  assert.equal(value(setInput(A, sub, [365, 365, 365]), sub), "$365 per monitor per year in every year");
  // A shorter list carries its last value forward through T (9.2), as the list says.
  assert.equal(value(setInput(A, sub, [300, 310, null]), sub), "$300 per monitor per year in year 0, $310 per monitor per year in year 1, blank in the other years");
  assert.equal(value(setInput(A, sub, [365, 365, 400]), sub), "$365 per monitor per year in years 0 and 1, $400 per monitor per year in the other years");
  assert.equal(value(setInput(A, sub, [300, 310, 320]), sub), "$300 per monitor per year in year 0, $310 per monitor per year in year 1, $320 per monitor per year in the other years");
  const twelve = setInput(setInput(A, sub, [...Array(10).fill(365), 400]), "settings.T", 12);
  assert.equal(value(twelve, sub), "$400 per monitor per year in years 10, 11 and 12, $365 per monitor per year in the other years");
  assert.equal(value(A, "labor.added.0.hours"), "30 h in year 0, 0 h in the other years");
  assert.equal(value(setInput(setInput(A, "settings.T", 2), sub, [300, 310, 320]), sub), "by year from year 0: $300 per monitor per year; $310 per monitor per year; $320 per monitor per year");
  // Years 0..T only: with T 5, the year-8 battery entry is past the horizon and is not named.
  assert.equal(value(setInput(A, "settings.T", 5), "costs.batteries.unitCost"), "$100 per monitor in year 4, $0 per monitor in the other years");
  // The free tags' billing years are a list of years, not a value by year (9.2).
  const C = setInput(setInput(example("ranchC"), "eid.freeTags.qty", 100), "eid.freeTags.years", [1, 2]);
  assert.equal(value(C, "eid.freeTags.years"), "years 1 and 2");
  assert.equal(value(setInput(C, "eid.freeTags.years", [3]), "eid.freeTags.years"), "year 3");
  const sources = T.exampleSources(EXAMPLE_IDS.map(example));
  // Every vendor price has a linked citation; a reported price says so and is dated; placeholders say what they are.
  for (const x of sources.filter((s) => s.cls === "C")) assert.match(x.url, /^https:\/\//, x.label);
  assert.ok(sources.some((x) => x.example === "Synthetic Ranch B" && x.label === "Subscription" && x.source.includes("reported price (DTN, 31 Mar 2025)")));
  assert.ok(sources.some((x) => x.example === "Synthetic Ranch C" && x.source === "Synthetic placeholder, not a price. Replace with your quote."));
  assert.ok(!sources.some((x) => x.cls === "E" && !x.source.startsWith("Synthetic placeholder")));
});

// ---------------------------------------------------------------- form.js and the state actions the page adds

test("form.js: every input has the label the page gives it and a value the page can show", () => {
  const states = [...EXAMPLE_IDS.map(example), readLink("#preset=EID+tags+and+scale").state, readLink("#preset=Collar-based+virtual+fencing").state];
  for (const a of states) {
    assert.deepEqual(formGroups(a).map((g) => g.id), ["operation", "settings", "module", "labor", "costs", "shares", "advanced"]);
    for (const f of formFields(a)) {
      assert.ok(f.label && f.label !== f.path, `${a.example} ${f.path} has no label`);
      if (f.type === "num") assert.equal(typeof f.unit, "string", f.path);
      const v = shownValue(a, f);
      for (const x of [v].flat()) assert.ok(x === null || x === undefined || typeof x !== "number" || Number.isFinite(x), f.path);
    }
  }
  // A price input offers a fill only where 9.5 item 7's table has one.
  const fills = (id) => formFields(example(id)).filter((f) => f.fill).map((f) => f.path);
  assert.deepEqual(fills("ranchA"), ["costs.monitors.unitCost", "costs.subscription.unitCost"]);
  assert.deepEqual(fills("ranchB"), []);
  assert.deepEqual(fills("ranchC"), ["eid.tagPrice", "costs.reader.unitCost", "costs.indicatorBars.unitCost"]);
});

test("form.js: new items and lines are blank but for their defaults, and every added price reads 'Quote required'", () => {
  const A = example("ranchA");
  for (const path of ["settings.landUnits", "water.blocks", "labor.added", "riskLines"]) {
    const next = addItem(A, path, newItem(A, path));
    assert.equal(getAt(next, path).length, getAt(A, path).length + 1, path);
    assert.equal(next.settings.ownAnalysis, true);
  }
  assert.equal(newItem(A, "settings.landUnits").id, "u2");
  for (const [m, lines] of Object.entries(LINE_TEMPLATES)) {
    for (const [id, line] of Object.entries(lines)) if ("unitCost" in line) assert.equal(line.unitCost, null, `${m} ${id}`);
  }
  // Choosing purchased collars: its lines are added blank and each is "Quote required".
  let B = setInput(example("ranchB"), "vf.pricing", "purchased");
  for (const id of PRICING_LINES.purchased) B = addKey(B, "costs", id, structuredClone(LINE_TEMPLATES.vf[id]));
  assert.deepEqual(validate(B), []);
  const left = T.leftOut(B, analyze(B));
  assert.ok(left.items.includes("Purchased collars: Quote required: not counted"), JSON.stringify(left.items));
  assert.equal(left.warning, T.QUOTE_WARNING);
});

test("state.js: addItem stops at MAX_ITEMS; addKey adds only a missing key; removeKey takes its records and shares", () => {
  let A = example("ranchA");
  const full = { ...A, riskLines: Array.from({ length: MAX_ITEMS }, () => newItem(A, "riskLines")) };
  assert.equal(addItem(full, "riskLines", newItem(A, "riskLines")), full);
  assert.equal(addKey(A, "classes", "cows", { head: 1 }), A);
  assert.equal(addKey(A, "classes", "__proto__", { head: 1 }), A);
  assert.equal(addKey(A, "classes", "constructor", { head: 1 }), A);
  const bulls = addKey(A, "classes", "bulls", { head: 0 });
  assert.deepEqual([bulls.classes.bulls, bulls.settings.ownAnalysis, A.classes.bulls], [{ head: 0 }, true, undefined]);
  A = setInput(A, "costs.mounting.operatorShare", 0.5);
  A = setInput(A, "costShares.mounting", 0.5);
  const removed = removeKey(A, "costs", "mounting");
  assert.equal(removed.costs.mounting, undefined);
  assert.ok(!Object.keys(removed.prov).some((k) => k.startsWith("costs.mounting")));
  assert.equal(removed.costShares?.mounting, undefined);
  assert.equal(removeKey(removed, "costs", "mounting"), removed);
  assert.deepEqual(validate(removed), []);
});

test("the labels the page shows: each input's unit once, in parentheses, as 9.5 item 7 writes them (rows 20 and 45)", () => {
  const D = example("ranchD");
  const settings = formGroups(D).find((g) => g.id === "settings").rows.filter((f) => f.type === "num");
  assert.deepEqual(settings.slice(0, 3).map(shownLabel), ["Horizon (years)", "Payback target (years)", "Discount rate (real, %/yr)"]);
  assert.equal(shownLabel({ label: "Monitors", unit: "monitors" }), "Monitors");
  assert.equal(shownLabel({ label: "Number of base stations", unit: "" }), "Number of base stations");
  const states = [...EXAMPLE_IDS.map(example), readLink("#preset=EID+tags+and+scale").state, readLink("#preset=Collar-based+virtual+fencing").state];
  for (const a of states) {
    for (const f of formFields(a).filter((x) => x.type === "num")) {
      const label = shownLabel(f);
      assert.ok(!/undefined|null/.test(label), `${a.example} ${f.path}: ${label}`);
      assert.ok(!/\(([^()]+)\) \(\1\)$/.test(label) && !label.endsWith(`) ${f.unit}`), `${a.example} ${f.path}: ${label}`);
    }
  }
  // The billing basis and the base-station count each have their own label (9.4).
  const B = addPart(example("ranchB"), "costs", "baseStations");
  const label = (a, p) => formFields(a).find((f) => f.path === p).label;
  assert.equal(label(B, "costs.subscription.basis"), "Billing basis (Subscription)");
  assert.equal(label(B, "costs.baseStations.qty"), "Number of base stations");
  assert.notEqual(label(B, "costs.baseStations.unitCost"), label(B, "costs.baseStations.qty"));
});

test("the paid labor unit has no default (9.2): the hours cut show no unit until one is chosen, and a paid cut without one is an error", () => {
  const C = example("ranchC");
  assert.equal(C.labor.cut, undefined);
  const field = (a) => formFields(a).find((f) => f.path === "labor.cut.unitsCut");
  assert.equal(shownLabel(field(C)), "Paid hours cut at the chute");
  assert.ok(!formFields(C).some((f) => f.path === "labor.cut.hoursPerUnit"));
  // A pay rate alone: nothing is cut, no error, and no "undefined" anywhere on the page.
  const rate = setInput(C, "labor.cut.paidRate", 20);
  assert.deepEqual(validate(rate), []);
  for (const x of pageStrings(rate)) assert.ok(!/undefined|NaN/.test(x), x);
  // Units cut while the freed time replaces paid work, with no unit: the error names the unit and the result waits.
  const cut = setInput(setInput(rate, "labor.freedTimeUse", "replacesPaidWork"), "labor.cut.unitsCut", 10);
  assert.deepEqual(validate(cut).map((e) => e.path), ["labor.cut.laborUnit", "labor.cut.loadPct"]);
  assert.equal(validate(cut)[0].message, "Paid labor is cut in: choose hours, days, weeks or a position, because the paid hours cut at the chute needs it.");
  // Chosen as hours, with a payroll load and 20 h of recording saved to cover them: the label carries the unit and
  // the result shows.
  const hours = setInput(setInput(setInput(cut, "labor.cut.laborUnit", "hour"), "labor.cut.loadPct", 0), "eid.recordingHoursToday", 20);
  assert.deepEqual(validate(hours), []);
  assert.equal(shownLabel(field(hours)), "Paid hours cut at the chute (hours)");
  const days = setInput(hours, "labor.cut.laborUnit", "day");
  assert.equal(shownLabel(field(days)), "Paid hours cut at the chute (days)");
  assert.ok(formFields(days).some((f) => f.path === "labor.cut.hoursPerUnit"));
});

test("form.js: paid labor cut by year says which years count; one value needs no such note (9.3 Timing)", () => {
  const A = example("ranchA");
  const field = (a) => formFields(a).find((f) => f.path === "labor.cut.unitsCut");
  assert.equal(field(A).help, undefined);
  const byYear = toByYear(A, "labor.cut.unitsCut");
  assert.equal(field(byYear).help, "Counted from year 1, the first operating year; an entry for an earlier year is not counted.");
  assert.equal(field(setInput(byYear, "startYear", 2)).help, cutFrom(3));
  // As the note says, an entry in year 0 changes nothing.
  assert.equal(analyze(setInput(byYear, "labor.cut.unitsCut.0", 1000)).cashNPV, analyze(byYear).cashNPV);
});

test("form.js: the EID notice beside the question, the cow-tag classes, the lease parties and the fence's land unit (9.4)", () => {
  const C = example("ranchC");
  const rows = (a) => formGroups(a).find((g) => g.id === "module").rows;
  const notice = (a) => rows(a).filter((f) => f.type === "note" && f.rule);
  assert.deepEqual(notice(C), []);
  const yes = setInput(C, "eid.ruleApplies.cows", true);
  assert.deepEqual(notice(yes).map((f) => f.text), [T.EID_RULE_NOTICE]);
  // It follows the questions, before the tag price.
  const order = rows(yes).map((f) => f.path ?? f.type);
  assert.equal(order.indexOf("note"), order.indexOf("eid.tagPrice") - 1);
  assert.ok(order.indexOf("eid.ruleApplies.calvesBorn") < order.indexOf("note"));
  assert.deepEqual(notice(setInput(yes, "eid.ruleApplies.cows", false)), []);
  assert.equal(formFields(C).find((f) => f.path === "eid.ruleApplies.cows").label, "Does the EID rule apply to cattle you move? (cows)");
  // The classes that get cow tags, cows by default (9.2).
  const tags = formFields(C).find((f) => f.path === "costs.cowTags.classes");
  assert.deepEqual([tags.type, tags.dflt, tags.options.map((o) => o[0])], ["classes", ["cows"], ["cows", "bulls", "replacementHeifers", "calvesBorn", "yearlings"]]);
  // A leased land unit asks who provides the water, the tenant by default (9.4).
  const leased = setInput(example("ranchA"), "settings.landUnits.0.kind", "leased");
  const party = formFields(leased).find((f) => f.path === "settings.landUnits.0.waterBy");
  assert.deepEqual([party.type, party.dflt], ["select", "tenant"]);
  const fence = formFields(setInput(example("ranchD"), "settings.landUnits.0.kind", "leased")).filter((f) => /fence(Built|Maintained)By$/.test(f.path));
  assert.deepEqual(fence.map((f) => f.dflt), ["tenant", "tenant"]);
  // The fence's land unit: asked with two units, or when the stored unit names none of them.
  const unitField = (a) => formFields(a).find((f) => f.path === "vf.fence.landUnitId");
  const D = example("ranchD");
  assert.equal(unitField(D), undefined);
  const two = addItem(D, "settings.landUnits", newItem(D, "settings.landUnits"));
  assert.deepEqual(unitField(two).options, [["u1", "Land unit 1"], ["u2", "Land unit 2"]]);
  const stray = setInput(D, "vf.fence.landUnitId", "u9");
  assert.ok(validate(stray).some((e) => e.path === "vf.fence.landUnitId"));
  assert.deepEqual(unitField(stray).options, [["u1", "Land unit 1"]]);
  // Items are told apart: Ranch C's two weighings by their classes, its classes served by what removing one does.
  const titles = [];
  const walk = (rows) => rows.forEach((x) => (x.type === "item" ? (titles.push([x.title, x.removeLabel ?? null]), walk(x.rows)) : x.rows && walk(x.rows)));
  formGroups(example("ranchC")).forEach((g) => walk(g.rows));
  assert.deepEqual(titles.filter(([t]) => t.startsWith("Handling")).map(([t]) => t), ["Handling: weighing (cows)", "Handling: weighing (calves)"]);
  assert.deepEqual(titles.filter(([, r]) => r).map(([, r]) => r), ["Remove cows from the classes served", "Remove calves from the classes served"]);
  // Risk lines with the same cause and class (Add a loss on Ranch A adds water and cows again) are told apart by number,
  // in the form, the year table and the line labels alike.
  let R = example("ranchA");
  R = addItem(addItem(R, "riskLines", newItem(R, "riskLines")), "riskLines", newItem(R, "riskLines"));
  const risks = [];
  const walkRisk = (rows) => rows.forEach((x) => (x.type === "item" ? (x.path === "riskLines" && risks.push(x.title), walkRisk(x.rows)) : x.rows && walkRisk(x.rows)));
  formGroups(R).forEach((g) => walkRisk(g.rows));
  assert.deepEqual(risks, [1, 2, 3].map((n) => `Losses avoided (water, cows), line ${n}`));
  const columns = T.yearTable(R, analyze(R)).columns.map((c) => c.label);
  assert.equal(new Set(columns).size, columns.length);
  assert.equal(columns.filter((c) => c.startsWith("Losses avoided")).length, 1);
  const filled = setInput(setInput(setInput(R, "riskLines.1.eventsPerYear", 0.2), "riskLines.1.headPerEvent", 2), "riskLines.1.shareCaught", 0.5);
  assert.deepEqual(T.yearTable(filled, analyze(filled)).columns.filter((c) => c.group === "risk").map((c) => c.label),
    ["Losses avoided (water, cows), line 1", "Losses avoided (water, cows), line 2", "Expected losses avoided (not in net cash)"]);
  // A link's risk lines with a cause and no class read without "undefined".
  const noClass = readLink("#v=2&m=water&x=ranchA&s=" + Buffer.from(JSON.stringify({ riskLines: [{ cause: "water" }, { cause: "water" }] })).toString("base64url")).state;
  risks.length = 0;
  formGroups(noClass).forEach((g) => walkRisk(g.rows));
  assert.deepEqual(risks, ["Losses avoided (water), line 1", "Losses avoided (water), line 2"]);
  noBadNumbers(pageStrings(noClass));
  // Only one line with that cause: no class, no number.
  assert.equal(T.yearTable(example("ranchA"), analyze(example("ranchA"))).columns.find((c) => c.group === "risk").label, "Losses avoided (water)");
  // A sale flow among the classes served, from a hand-made link, is listed with its error and a Remove button only.
  const sold = structuredClone(C);
  sold.served.calvesSold = { months: 12 };
  assert.deepEqual(validate(sold).map((e) => e.path), ["served.calvesSold"]);
  const items = [];
  const walkAll = (rows) => rows.forEach((x) => (x.type === "item" ? (items.push(x), walkAll(x.rows)) : x.rows && walkAll(x.rows)));
  formGroups(sold).forEach((g) => walkAll(g.rows));
  const flow = items.find((x) => x.path === "served" && x.i === "calvesSold");
  assert.deepEqual([flow.removable, flow.removeLabel, flow.rows.map((x) => [x.type, x.error, x.text])], [true, "Remove calves sold from the classes served",
    [["note", true, "A sale flow drawn from another class cannot be served. Remove it to see results."]]]);
  assert.equal(cash(removeKey(sold, "served", "calvesSold")), cash(C));
  // The same among the enrolled classes of a virtual fence analysis.
  const B = example("ranchB"), enrolledSale = structuredClone(B);
  enrolledSale.enrolled.calvesSold = { head: 5, months: 2 };
  assert.deepEqual(validate(enrolledSale).map((e) => e.path), ["enrolled.calvesSold"]);
  items.length = 0;
  formGroups(enrolledSale).forEach((g) => walkAll(g.rows));
  const enrolledFlow = items.find((x) => x.path === "enrolled" && x.i === "calvesSold");
  assert.deepEqual([enrolledFlow.removeLabel, enrolledFlow.rows[0].text], ["Remove calves sold from the enrolled classes",
    "A sale flow drawn from another class cannot be enrolled. Remove it to see results."]);
  assert.equal(cash(removeKey(enrolledSale, "enrolled", "calvesSold")), cash(B));
  // Classes under the other module's key (enrolled in a water analysis) are listed the same way, each with a Remove.
  const otherKey = structuredClone(example("ranchA"));
  otherKey.enrolled = { calvesSold: { head: 1, months: 1 }, cows: { head: 5 } };
  assert.deepEqual(validate(otherKey).map((e) => e.path), ["enrolled.calvesSold", "enrolled.cows.months"]);
  items.length = 0;
  formGroups(otherKey).forEach((g) => walkAll(g.rows));
  assert.deepEqual(items.filter((x) => x.path === "enrolled").map((x) => [x.i, x.title, x.removeLabel, x.rows[0].text]), [
    ["calvesSold", "Calves sold (enrolled)", "Remove calves sold from the enrolled classes", "Only a virtual fence analysis enrolls classes. Remove it."],
    ["cows", "Cows (enrolled)", "Remove cows from the enrolled classes", "Only a virtual fence analysis enrolls classes. Remove it."]]);
  assert.equal(cash(removeKey(removeKey(otherKey, "enrolled", "calvesSold"), "enrolled", "cows")), cash(example("ranchA")));
  // An added item with no name is "added item <n>" everywhere; a new item takes a name no other item has.
  const unnamed = setInput(setInput(setInput(example("ranchA"), "labor.added.1.label", null), "labor.added.1.doneBy", "paid"), "labor.added.1.paidRate", 20);
  assert.equal(T.yearTable(unnamed, analyze(unnamed)).columns.find((c) => c.label === "added item 2")?.group, "cost");
  assert.ok(T.formulas(unnamed, analyze(unnamed)).sections.flatMap((x) => x.rows).some((x) => x.name === "added item 2"));
  const A = example("ranchA");
  let renamed = addItem(A, "labor.added", newItem(A, "labor.added"));
  renamed = removeItem(renamed, "labor.added", 0);
  renamed = addItem(renamed, "labor.added", newItem(renamed, "labor.added"));
  assert.deepEqual(renamed.labor.added.map((x) => x.label), ["monitoring time", "added item 3", "added item 4"]);
  // A list of years is read with commas, spaces or semicolons; anything else is not read, and the page says what the
  // analysis still uses.
  assert.deepEqual([readYears("1, 2;3 4"), readYears(""), readYears("1-3"), readYears("1, 2a")], [[1, 2, 3, 4], [], null, null]);
  assert.equal(yearsUnread([1, 2]), "Not read: enter whole years separated by commas, such as 0, 1. The analysis still uses 1, 2.");
  // Blank, the fence is on the first land unit (9.2): the field shows it as its default.
  const blankUnit = setInput(two, "vf.fence.landUnitId", null);
  assert.deepEqual([getAt(blankUnit, "vf.fence.landUnitId") ?? null, unitField(blankUnit).dflt], [null, "u1"]);
});

test("text.js: the class names in badge titles, the linked part of each source, and the written-out formulas (9.5 items 4 and 11)", () => {
  assert.deepEqual(["A", "B", "C", "D", "E"].map(T.badgeTitle), ["official statistics", "research or extension", "vendor information", "your entry", "made-up example value"]);
  // A vendor is named only in a linked citation: a vendor price whose link is missing or not a web page names no source.
  assert.deepEqual(["https://x.org/a", "http://x.org", "javascript:alert(1)", "data:text/html,x", "vbscript:x", null, "not a url"].map(T.safeUrl),
    ["https://x.org/a", "http://x.org", null, null, null, null, null]);
  const A = example("ranchA"), rec = A.prov["costs.monitors.unitCost"];
  for (const url of [undefined, "javascript:alert(1)"]) {
    const bad = { ...A, prov: { ...A.prov, "costs.monitors.unitCost": { ...rec, url } } };
    const note = T.priceNote(bad, "costs.monitors.unitCost", 1490), row = T.assumptions(bad).find((x) => x.path === "costs.monitors.unitCost");
    assert.equal(note.text, "Vendor information: published list price (source link missing). Not an endorsement. Replace with your quote.");
    assert.deepEqual([note.cite, note.url, row.cite], [null, null, null]);
    assert.ok(!row.source.includes(rec.src) && !note.text.includes(rec.src), String(url));
  }
  assert.equal(T.badgeTitle("X"), "");
  // The cite is the linked part of the source: "<src>, <pub>" for a vendor price, the source alone otherwise.
  for (const id of EXAMPLE_IDS) {
    const a = example(id);
    for (const x of T.assumptions(a).filter((y) => y.url)) {
      const p = a.prov[x.path];
      assert.equal(x.cite, x.cls === "C" ? `${p.src}, ${p.pub}` : p.src, `${id} ${x.path}`);
      assert.ok(x.source.includes(x.cite), `${id} ${x.path}`);
    }
    assert.ok(T.assumptions(a).filter((y) => !y.url).every((y) => y.cite === null), id);
  }
  const expr = (id, name) => {
    const a = example(id), f = T.formulas(a, analyze(a));
    return f.sections.flatMap((x) => x.rows).find((x) => x.name === name).expr;
  };
  assert.equal(expr("ranchA", "Vehicle"), "44 runs avoided a year × 120 mi per run × vehicle cost $0.40/mi");
  assert.equal(expr("ranchA", "Hired labor cut"), "16 days cut × 8 h per day × pay rate $18.72/h × (1 + payroll load 10%), within the hours saved");
  assert.equal(expr("ranchB", "Handling labor"), "372 handling hours in year 1 × pay rate $25/h × (1 + payroll load 0%)");
  assert.equal(expr("ranchC", "Dosing savings"), "(300 cows × 2 applications + 285 calves × 1 application) × $0.45 per application");
  assert.equal(expr("ranchD", "Interior fence avoided"), "14.14 mi × $15,100/mi built in year 0, every 25 years, with upkeep 5% of its cost a year, less its residual at the end");
  for (const id of EXAMPLE_IDS) {
    const a = example(id), f = T.formulas(a, analyze(a));
    for (const x of f.sections.flatMap((y) => y.rows)) assert.ok(!/undefined|NaN|\$-|\bnull\b/.test(`${x.expr} ${x.result}`), `${id} ${x.name}`);
  }
  // With a ramp below 100% and a share below 100%, the formula names them, so the shown values multiply to the result.
  const of = (a, name) => T.formulas(a, analyze(a)).sections.flatMap((x) => x.rows).find((x) => x.name === name);
  const halfA = setInput(setInput(example("ranchA"), "ramp.1", 0.5), "costs.subscription.operatorShare", 0.5);
  assert.deepEqual(of(halfA, "Vehicle"), { name: "Vehicle", expr: "44 runs avoided a year × 120 mi per run × vehicle cost $0.40/mi × ramp 50%", result: "$1,056 in year 1; PV $13,847" });
  close(44 * 120 * 0.4 * 0.5, analyze(halfA).lines.find((l) => l.id === "vehicle").series[1], 1e-9);
  assert.equal(of(halfA, "Hired labor cut").expr, "16 days cut × 8 h per day × pay rate $18.72/h × (1 + payroll load 10%) × ramp 50%, within the hours saved");
  assert.equal(of(halfA, "Subscription").expr, "10 × $365 per monitor per year each season × your share 50%, billed at its start");
  assert.equal(of(setInput(example("ranchA"), "labor.cut.unitsCut", 1), "Hired labor cut").expr.slice(0, 13), "1 day cut × 8");
  // Ranch C's premium names the calves sold; its dosing the ramp; Ranch B's subscription its head-months.
  let C = setInput(setInput(setInput(example("ranchC"), "ramp.1", 0.5), "eid.premium.saleCwt", 5.5), "eid.premium.premiumPerCwt", 2);
  assert.deepEqual(of(C, "Net program premium"), { name: "Net program premium", expr: "240 calves sold × (5.50 cwt × $2/cwt − verification fee $0) × ramp 50%", result: "$1,320 in year 1; PV $12,994" });
  assert.equal(of(C, "Dosing savings").result, "$199 in year 1; PV $1,960");
  assert.equal(of(example("ranchB"), "Subscription").expr, "6,600 head-months × $7/head/month each season, billed at its start");
  // Weight gain from records names each class sold once ("calves sold", "yearlings sold").
  const W = structuredClone(example("ranchC"));
  W.production = { fromRecords: true, lbPerHeadPerDay: 0.2, days: 90, classes: ["calvesSold"] };
  W.classes.calvesSold.valueOfGain = 1.1;
  assert.deepEqual(of(W, "Weight gain"), { name: "Weight gain", expr: "0.20 lb/head/day × 90 days × (240 calves sold × $1.10/lb)", result: "$4,752 in year 1; PV $25,610" });
  close(0.2 * 90 * 240 * 1.1, analyze(W).lines.find((l) => l.id === "production").series[1], 1e-9);
  // Paid added hours name their hours in the year the result names.
  const added = setInput(setInput(setInput(example("ranchC"), "labor.added.0.doneBy", "paid"), "labor.added.0.paidRate", 20), "labor.added.0.loadPct", 0);
  assert.equal(of(added, "data upkeep").expr, "15 h in year 1 × pay rate $20/h × (1 + payroll load 0%)");
});

test("text.js: each written-out formula names every factor, so its shown values multiply to its result (9.5 item 10)", () => {
  const of = (a, name) => T.formulas(a, analyze(a)).sections.flatMap((x) => x.rows).find((x) => x.name === name);
  const line = (a, id) => analyze(a).lines.find((l) => l.id === id).series;
  // Dosing at a 50% ramp: (600 + 285) × $0.45 × 50% = $199.
  const C = setInput(example("ranchC"), "ramp.1", 0.5);
  assert.deepEqual(of(C, "Dosing savings"), { name: "Dosing savings", expr: "(300 cows × 2 applications + 285 calves × 1 application) × $0.45 per application × ramp 50%", result: "$199 in year 1; PV $1,960" });
  close((300 * 2 + 285) * 0.45 * 0.5, line(C, "dosing")[1], 1e-9);
  // A purchase and a benefit at a 50% share.
  const A = example("ranchA");
  assert.deepEqual(of(setInput(A, "costs.monitors.operatorShare", 0.5), "Monitors"), { name: "Monitors", expr: "quantity × unit price: 10 × $1,490 in year 0 × your share 50%", result: "$7,450 in all; PV $7,450" });
  const vehicle = setInput(A, "benefitShares.vehicle", 0.5);
  assert.deepEqual(of(vehicle, "Vehicle"), { name: "Vehicle", expr: "44 runs avoided a year × 120 mi per run × vehicle cost $0.40/mi × your share 50%", result: "$1,056 in year 1; PV $7,417" });
  close(44 * 120 * 0.4 * 0.5, line(vehicle, "vehicle")[1], 1e-9);
  // Paid install hours at a 50% share: the hours typed, then the share (30 h × $25 × 50% = $375).
  const paid = setInput(setInput(setInput(A, "labor.added.0.doneBy", "paid"), "labor.added.0.paidRate", 25), "labor.added.0.loadPct", 0);
  const half = setShare(paid, "costShares.added:0", null, 0.5);
  assert.deepEqual(of(half, "install"), { name: "install", expr: "30 h in year 0 × pay rate $25/h × (1 + payroll load 0%) × your share 50%", result: "$375 at most in a year in year 0; PV $375" });
  close(30 * 25 * 0.5, line(half, "added:0")[0], 1e-9);
  // Free tags: (300 − 100) × $3.14 = $628 in year 0; 285 × $3.14 less 100 × $3.14 = $581 in year 1.
  const free = setInput(setInput(example("ranchC"), "eid.freeTags.qty", 100), "eid.freeTags.years", [0, 1]);
  assert.deepEqual(of(free, "Cow tags"), { name: "Cow tags", expr: "quantity × unit price: (300 − 100 free) × $3.14 in year 0", result: "$628 in all; PV $628" });
  assert.equal(of(free, "Calf tags").expr, "285 × $3.14/tag each season, less 100 free in year 1, billed at its end");
  close((285 - 100) * 3.14, line(free, "calfTags")[1], 1e-9);
  // A price per head per month billed for the year counts head-months, and a version 1 price shows its own digits.
  const v1 = readLink("#preset=Remote+water+monitoring&head=900").state;
  assert.deepEqual(of(v1, "Subscription per head"), { name: "Subscription per head", expr: "10,800 head-months × $0.30417/head/month each season, billed at its start", result: "$3,285 in year 0; PV $3,285" });
  assert.equal(of(setInput(example("ranchB"), "costs.subscription.basis", "perHeadYear"), "Subscription").expr,
    "14,400 head-months × $7/head/month each season, billed at its start");
  // Unequal shares by land unit: the factor left after the values (two units at 50%, the second's share of the vehicle
  // saving 50%: 75% in all).
  let units = addItem(A, "settings.landUnits", newItem(A, "settings.landUnits"));
  units = setInput(setInput(units, "settings.landUnits.0.share", 0.5), "settings.landUnits.1.share", 0.5);
  units = setShare(units, "benefitShares.vehicle", units.settings.landUnits[1].id, 0.5);
  assert.equal(of(units, "Vehicle").expr, "44 runs avoided a year × 120 mi per run × vehicle cost $0.40/mi × 75% (your share on each land unit, the land units and limits in the year table)");
  close(44 * 120 * 0.4 * 0.75, line(units, "vehicle")[1], 1e-9);
  // A share, a ramp or a pay rate of 0 is named, or the hours typed shown, though nothing is counted (10.1 row 41(f)).
  assert.equal(of(setInput(A, "benefitShares.vehicle", 0), "Vehicle").expr, "44 runs avoided a year × 120 mi per run × vehicle cost $0.40/mi × your share 0%");
  assert.equal(of(setInput(A, "ramp.1", 0), "Vehicle").expr, "44 runs avoided a year × 120 mi per run × vehicle cost $0.40/mi × ramp 0%");
  const monitoring = setInput(setInput(setInput(A, "labor.added.1.doneBy", "paid"), "labor.added.1.paidRate", 20), "labor.added.1.loadPct", 0.1);
  assert.equal(of(setShare(monitoring, "costShares.added:1", null, 0), "monitoring time").expr, "52 h in year 1 × pay rate $20/h × (1 + payroll load 10%) × your share 0%");
  const unpaidRate = setInput(setInput(example("ranchC"), "labor.added.0.doneBy", "paid"), "labor.added.0.paidRate", 0);
  assert.equal(of(unpaidRate, "data upkeep").expr, "15 h in year 1 × pay rate $0/h × (1 + payroll load 0%)");
  // Weight gain names yearlings sold, and the share of them sold when it is set.
  const Y = structuredClone(example("ranchB"));
  Y.production = { fromRecords: true, lbPerHeadPerDay: 0.2, days: 90, classes: ["yearlings"] };
  Y.classes.yearlings.valueOfGain = 1;
  assert.deepEqual(of(Y, "Weight gain"), { name: "Weight gain", expr: "0.20 lb/head/day × 90 days × (1,200 yearlings sold × $1/lb)", result: "$21,600 in year 1; PV $116,409" });
  Y.production.soldShare = 0.5;
  assert.equal(of(Y, "Weight gain").expr, "0.20 lb/head/day × 90 days × (600 yearlings sold × $1/lb)");
  close(0.2 * 90 * 600, line(Y, "production")[1], 1e-9);
});

test("the year table's cells, its notes and the chart's payback mark (9.5 items 3 and 10)", () => {
  const cells = (y, t, label) => y.rows[t].cells[y.columns.findIndex((c) => c.label === label)];
  // Ranch C in year 7: the residual of the reader, bars and platform, and each total from the analysis.
  const C = example("ranchC"), rc = analyze(C), yc = T.yearTable(C, rc);
  assert.deepEqual(["Residual value", "Total cost", "Total cash benefit", "Net cash", "Cumulative", "Discounted"].map((l) => cells(yc, 7, l)),
    ["$682", "$909", "$398", "$172", "−$10,904", "$107"]);
  assert.equal(cells(yc, 7, "Residual value"), T.money(rc.R[7]));
  assert.equal(cells(yc, 7, "Discounted"), T.money(rc.N[7] / 1.07 ** 7));
  assert.deepEqual([cells(yc, 0, "Total cost"), cells(yc, 1, "Hours freed")], [T.money(rc.C[0]), "−30"]);
  // Ranch A: the risk line and its subtotal apart from net cash, and the hours freed (−30 in year 0 for the install).
  const A = example("ranchA"), ra = analyze(A), ya = T.yearTable(A, ra);
  assert.deepEqual(["Losses avoided (water)", "Expected losses avoided (not in net cash)", "Net cash", "Hours freed"].map((l) => cells(ya, 1, l)),
    ["$1,519", "$1,519", "$1,098", "84"]);
  assert.deepEqual([cells(ya, 0, "Hours freed"), cells(ya, 0, "Expected losses avoided (not in net cash)")], ["−30", "$0"]);
  assert.equal(cells(ya, 1, "Expected losses avoided (not in net cash)"), T.money(ra.X[1]));
  // A cleared price: its column says "Quote required: not counted".
  const cleared = setInput(A, "costs.monitors.unitCost", null);
  assert.equal(T.yearTable(cleared, analyze(cleared)).columns.find((c) => c.label === "Monitors").note, T.QUOTE_REQUIRED);
  assert.equal(T.QUOTE_REQUIRED, "Quote required: not counted");
  assert.equal(ya.columns.find((c) => c.label === "Monitors").note, null);
  // A year with no cattle (row 16): its row carries the message.
  let B = setInput(example("ranchB"), "classes.yearlings.head", [1200, 1200, 1200, 0, 1200]);
  B = setInput(B, "enrolled.yearlings.head", [1200, 1200, 1200, 0, 1200]);
  assert.deepEqual(T.yearTable(B, analyze(B)).rows.map((x) => x.note), [null, null, null, "No cattle in year 3: benefits not counted.", null, null, null, null]);
  // The cumulative chart marks payback when it is a number of years, and only then.
  const free = setInput(A, "costs.subscription.unitCost", 0), rf = analyze(free);
  assert.deepEqual(T.cumulativeChart(rf).mark, { at: rf.payback.years, text: "Payback: 3.38 years (before tax)" });
  assert.equal(T.cumulativeChart(ra).mark, null);
});

test("exact page texts: the year-table note, the chart caption, the lists of what others pay and receive, the share questions", () => {
  const A = example("ranchA"), r = analyze(A);
  assert.equal(T.yearTableNote(r), "Year 0 is the start. Fees billed in advance, such as a subscription, are paid at the start of the season they "
    + "cover, so the first season's fee is in year 0. Purchases, and fence the technology avoids, fall in the year of purchase; other costs "
    + "and every benefit fall at the end of their year. Money in today's US dollars, discounted at 7% a year (real). Your share of each line, "
    + "before tax.");
  assert.equal(T.CUMULATIVE_CAPTION, "Year 0 holds purchases, fees billed in advance and any avoided capital; each later point adds that "
    + "year's cash benefits and residual value, less its costs. Your share, before tax. Payback is the point after which the line stays at or "
    + "above zero.");
  // Row 35(a): a landowner pays half the subscription.
  const half = setInput(A, "costs.subscription.operatorShare", 0.5), lists = T.othersLists(half, analyze(half));
  assert.equal(lists[0].title, "Paid by others");
  assert.deepEqual(lists[0].rows[0].slice(0, 4), ["Subscription", "land unit 1", "$1,825", "$1,825"]);
  assert.equal(lists[0].rows[0].at(-1), "$13,715");
  assert.equal(lists[1], null);
  assert.deepEqual(T.othersLists(A, r), [null, null]);
  // A landowner who receives half the vehicle saving (F6): listed under "Received by others".
  const received = setInput(A, "benefitShares.vehicle", 0.5), got = T.othersLists(received, analyze(received));
  assert.equal(got[0], null);
  assert.equal(got[1].title, "Received by others");
  assert.deepEqual(got[1].rows[0].slice(0, 4), ["Vehicle", "land unit 1", "$0", "$1,056"]);
  assert.equal(got[1].rows[0].at(-1), "$7,417");
  const shares = formGroups(A).find((g) => g.id === "shares").rows;
  assert.deepEqual([...new Set(shares.map((f) => f.label))], ["Who pays for this?", "Who receives this saving?"]);
  assert.equal(shares.find((f) => f.lineId === "monitors").label, "Who pays for this?");
  assert.equal(shares.find((f) => f.lineId === "vehicle").label, "Who receives this saving?");
});

// ---------------------------------------------------------------- the files the page is built from

test("the page runs on the new engine; version 1's model and the outlook views are gone (9.1 step 6, F2)", () => {
  const html = read("index.html"), app = read("app.js");
  for (const s of ["5-year outlook", "12 months at a time", "fiveTable", "Break-even values"]) assert.ok(!html.includes(s), s);
  assert.ok(!/from "\.\/v1\.js"/.test(app));
  assert.match(app, /from "\.\/roi\.js"/);
  // v1.js keeps only version 1's fields and presets, for reading old links (B8); its model is gone.
  assert.ok(!/export function/.test(read("v1.js")));
});

test("no sentence calls every starting cost a published list price, and the page names no product (F10, owner rules)", () => {
  for (const file of ["index.html", "README.md", "roi.js", "v1.js", "text.js", "app.js", "form.js"]) {
    const text = read(file).toLowerCase();
    for (const s of ["1,000-cow operation", "come from published", "starting values are published"]) assert.ok(!text.includes(s), `${file} still says "${s}"`);
  }
  // Company and product names appear only in linked source citations, which come from examples.js (9.5 item 4).
  const names = ["All-Tex", "Jeffers", "Valley Vet", "Ranchbot", "Vence", "Halter", "Nofence", "eShepherd", "Tru-Test", "Gallagher", "Allflex"];
  for (const file of ["index.html", "app.js", "form.js", "text.js"]) {
    const text = read(file).replace(/\/\/.*$/gm, "");
    for (const n of names) assert.ok(!text.includes(n), `${file} names ${n}`);
  }
  // The page shows the example's banner from text.js while the analysis is not the user's own (9.5 item 5).
  assert.match(read("app.js"), /if \(!a\.settings\.ownAnalysis\) .*T\.EXAMPLE_BANNERS\[a\.example\]/);
  for (const s of ["made-up numbers for demonstration, not any real", "before tax"]) assert.ok(read("index.html").includes(s), s);
});

test("the README describes the page it ships with (9.5 item 5)", () => {
  const readme = read("README.md");
  for (const s of ["can be folded into the inputs", "light and dark mode", "being built", "Break-even table", "Return on cost",
    "the page does not use it yet", "today's model"]) assert.ok(!readme.includes(s), `README still says "${s}"`);
  for (const s of ["BCR", "What would make it pay", "Two inputs at once", "before tax", "made-up numbers for demonstration, not any real"]) {
    assert.ok(readme.includes(s), s);
  }
  // Its sources are the examples' own: every linked source, the reported price dated, every placeholder said to be one.
  const sources = T.exampleSources(EXAMPLE_IDS.map(example));
  for (const x of sources.filter((y) => y.url)) assert.ok(readme.includes(`](${x.url})`), x.url);
  assert.ok(readme.includes("reported price ([DTN, 31 Mar 2025]("));
  const placeholders = sources.filter((x) => x.source.startsWith("Synthetic placeholder")).length;
  assert.equal(readme.match(/\| Synthetic placeholder, not a price\. Replace with your quote\. \|/g).length, placeholders);
  // The outcomes it gives are the tiles the page shows for each example.
  for (const id of EXAMPLE_IDS) {
    const a = example(id);
    assert.ok(readme.includes(`| ${T.tiles(a, analyze(a))[0].value} | does not pay for itself |`), id);
  }
});

