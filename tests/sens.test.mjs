// Tests of the sensitivity port (docs/audit/phase1-spec.md 9.1 step 6, 9.5 items 1 and 6, 9.7 "Sensitivity, ported",
// 10.1 rows 25, 26 and 49): SENSITIVITY_INPUTS(a), the tornado and its lists, caption, legend and hover text, the
// two-way grid, and the verdict's "It turns most on" sentence.
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { analyze, validate, SENSITIVITY_INPUTS, tornado, twoWayGrid, GRID_STEPS, PAYBACK_DRIVERS, moveDriver } from "../roi.js";
import { example, EXAMPLE_IDS } from "../examples.js";
import { readLink } from "../links.js";
import { verdictSentence, tornadoCaption, tornadoHover, tornadoLists, TORNADO_CAPTION, TORNADO_LEGEND, gridNote, gridValue } from "../text.js";

const close = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);
/** An example with changes made in place by f, checked valid. */
const ex = (id, f) => {
  const a = example(id);
  f?.(a);
  assert.deepEqual(validate(a), []);
  return a;
};
const labels = (a) => SENSITIVITY_INPUTS(a).map((e) => e.label);
const bar = (t, label) => {
  const b = t.bars.find((x) => x.label === label);
  assert.ok(b, `no bar "${label}" in ${t.bars.map((x) => x.label)}`);
  return b;
};

// ---------------------------------------------------------------- the entries (9.5 item 6 table)

test("SENSITIVITY_INPUTS: the table's entries in order for each example, with their units and products", () => {
  const rows = (a) => SENSITIVITY_INPUTS(a).map((e) => [e.label, e.path, e.unit, e.product]);
  assert.deepEqual(rows(example("ranchA")), [
    ["Herd size", "herd", "cows", null],
    ["Discount rate", "settings.discountRate", "%/yr", null],
    ["Share of runs avoided in summer", "water.blocks.0.shareAvoided", "%", null],
    ["Share of runs avoided in fall–winter", "water.blocks.1.shareAvoided", "%", null],
    ["Vehicle cost per mile", "water.variableCostPerMile", "$/yr", "vehicle"],
    ["Hired labor cut", "labor.cut.unitsCut", "$/yr", "laborCut"],
    ["Added hours", "addedHours", "h/yr", null],
    ["Monitor price", "costs.monitors.unitCost", "$ per monitor", null],
    ["Subscription per monitor", "costs.subscription.unitCost", "$ per monitor per year", null],
    ["Losses avoided (water)", "riskLines.0.eventsPerYear", "$/yr", "risk:0"],
    ["Mounting", "costs.mounting.unitCost", "$", null],
    ["Batteries and repairs", "costs.batteries.unitCost", "$ per monitor", null],
  ]);
  assert.deepEqual(rows(example("ranchB")), [
    ["Herd size", "herd", "yearlings", null],
    ["Discount rate", "settings.discountRate", "%/yr", null],
    ["Hired moving and gathering hours cut", "labor.cut.unitsCut", "$/yr", "laborCut"],
    ["Added hours", "addedHours", "h/yr", null],
    ["Interior fence that would otherwise be built", "vf.fence.F", "$", "fence"],
    ["Subscription", "costs.subscription.unitCost", "$/head/month", null],
    ["Collar loss", "vf.collarLoss.pctPerYear", "$/yr", "collarLoss"],
    ["Infrastructure", "costs.infrastructure.unitCost", "$", null],
  ]);
  assert.deepEqual(labels(example("ranchC")), ["Herd size", "Discount rate", "Added hours", "Net program premium", "Tag price",
    "Retag rate", "Reader and scale cost", "Dosing savings", "Software"]);
  assert.deepEqual(labels(example("ranchD")), labels(example("ranchB")));
  // zeroRange only on collar loss; a set only where the table names a B9 driver's (9.3).
  const B = SENSITIVITY_INPUTS(example("ranchB"));
  assert.deepEqual(B.filter((e) => e.zeroRange).map((e) => [e.label, e.zeroRange]), [["Collar loss", [0, 0.07]]]);
  assert.deepEqual(B.filter((e) => e.set).map((e) => e.id), ["herd", "hoursCut", "addedHours"]);
  assert.deepEqual(SENSITIVITY_INPUTS(example("ranchC")).filter((e) => e.set).map((e) => e.id), ["herd", "addedHours", "premium", "readerScale"]);
});

test("row 26: the factors of one product are one entry, moved on its designated factor", () => {
  const A = SENSITIVITY_INPUTS(example("ranchA"));
  const cut = A.find((e) => e.label === "Hired labor cut");
  assert.deepEqual([cut.path, cut.unit, cut.inputUnit, cut.product, cut.entered], ["labor.cut.unitsCut", "$/yr", "days", "laborCut", 16]);
  // No entry for its hours per unit or pay rate, nor for runs or miles per run (the vehicle product holds them).
  assert.ok(!A.some((e) => /labor\.cut\.(hoursPerUnit|paidRate|loadPct)|runsPerWeek|milesPerRun/.test(e.path)));
  const t = tornado(example("ranchA"));
  assert.deepEqual([bar(t, "Hired labor cut").lowValue, bar(t, "Hired labor cut").highValue], [12.8, 19.2]);
  // The two-way grid never pairs two factors of one product: its axes are two entries.
  for (const id of EXAMPLE_IDS) {
    const g = twoWayGrid(example(id));
    const [r, c] = [g.rows.id, g.cols.id].map((x) => SENSITIVITY_INPUTS(example(id)).find((e) => e.id === x));
    assert.ok(r.id !== c.id && (r.product === null || r.product !== c.product), id);
  }
});

test("entries left out while their input has nothing to act on, and added by the analysis's lines (9.5 item 6)", () => {
  // Weight gain while production.classes is empty, avoided hire while its salary is blank, the retag rate without a
  // retags line: out. Entered: in.
  const out = ex("ranchC", (a) => {
    a.production = { lbPerHeadPerDay: 0.1, days: 200, classes: [], soldShare: 1 };
    a.labor.avoidedHire = { salary: null, loadPct: 0.1, startYear: 1, years: null };
    delete a.costs.retags;
  });
  for (const l of ["Weight gain", "Avoided hire", "Retag rate"]) {
    assert.ok(!labels(out).includes(l), l);
    assert.ok(!tornadoLists(tornado(out)).some((x) => x.includes(l)), l);
  }
  assert.ok(labels(example("ranchC")).includes("Retag rate"));
  const c = ex("ranchC", (a) => {
    a.production = { lbPerHeadPerDay: 0.1, days: 200, classes: ["calvesSold"], soldShare: 1 };
    a.classes.calvesSold.valueOfGain = 1;
    a.labor.avoidedHire = { salary: 30000, loadPct: 0.1, startYear: 1, years: 2 };
  });
  const C = SENSITIVITY_INPUTS(c);
  assert.deepEqual(C.filter((e) => ["Weight gain", "Avoided hire"].includes(e.label)).map((e) => [e.label, e.path, e.product]),
    [["Avoided hire", "labor.avoidedHire.salary", "avoidedHire"], ["Weight gain", "production.lbPerHeadPerDay", "production"]]);
  // Purchased collars: the service fee in place of the subscription, and the collars as another cost line.
  const b = ex("ranchB", (a) => {
    a.vf.pricing = "purchased";
    a.costs.collars = { timing: "capital", basis: "perDevice", unitCost: 250, lifeYears: 5 };
    a.costs.serviceFee = { timing: "annual", basis: "perDevice", unitCost: 30 };
  });
  assert.deepEqual(labels(b), ["Herd size", "Discount rate", "Hired moving and gathering hours cut", "Added hours",
    "Interior fence that would otherwise be built", "Service fee", "Collar loss", "Infrastructure", "Purchased collars"]);
  // A version 1 state: its lines by their labels.
  const v1 = readLink("#preset=Remote+water+monitoring&head=500&years=5").state;
  assert.deepEqual(labels(v1), ["Herd size", "Discount rate", "Base station, setup and install", "Subscription per head"]);
});

// ---------------------------------------------------------------- the tornado

test("row 49: Synthetic Ranch B's bars, widest first, no list, and the verdict that names the top two", () => {
  const a = example("ranchB"), r = analyze(a), t = tornado(a, r);
  const pinned = [["Herd size", 119500], ["Subscription", 106566], ["Interior fence that would otherwise be built", 25823],
    ["Added hours", 20048], ["Discount rate", 18646], ["Hired moving and gathering hours cut", 10779], ["Infrastructure", 1800]];
  assert.deepEqual(t.bars.map((b) => b.label), pinned.map(([l]) => l));
  t.bars.forEach((b, i) => close(b.width, pinned[i][1], 1));
  close(t.base, -229531, 1);
  // The collar-loss charge is blank on a share of 0, so it is not listed.
  assert.deepEqual([t.leftBlank, t.zeroNotTested, t.noEffect, t.zeroTested, tornadoLists(t)], [[], [], [], [], []]);
  assert.equal(verdictSentence(a, r, t.bars), "Over 7 years at the example's 7% real rate (an assumption, not a recommendation), "
    + "before tax, this costs about $230,000 more than it saves in cash. It does not pay. Cash benefits would need to rise "
    + "about 3.5-fold. It turns most on herd size and subscription.");
  // Herd size moves the subscription and the collar handling hours together, through the B9 driver's set.
  const herd = bar(t, "Herd size");
  assert.deepEqual([herd.lowValue, herd.highValue], [960, 1440]);
  const d = PAYBACK_DRIVERS(a).find((x) => x.id === "herd");
  close(herd.low, analyze(moveDriver(a, d, 960)).cashNPV, 1e-6);
});

test("row 25: collar loss, entered as 0 with a charge, is tested over its zeroRange", () => {
  const a = ex("ranchB", (x) => (x.vf.collarLoss.chargePerCollar = 150));
  const t = tornado(a);
  const loss = bar(t, "Collar loss");
  close(t.base, -229531, 1);
  assert.deepEqual([loss.lowValue, loss.highValue, loss.unit, loss.inputUnit], [0, 0.07, "$/yr", "%"]);
  close(loss.low, -229531, 1);
  close(loss.low - loss.high, 67905, 1); // 0.07 × 1,200 × $150 = $12,600 a year in years 1–7, × 5.389289
  close(loss.width, 67905, 1);
  close(12600 * 5.389289, 67905, 1);
  assert.deepEqual(t.zeroTested, [{ label: "Collar loss", lo: 0, hi: 0.07, unit: "%" }]);
  assert.equal(tornadoCaption(t), `${TORNADO_CAPTION} Collar loss, entered as 0, is tested from 0% to 7%.`);
});

test("the lists under the chart: left blank, entered as 0 and no effect, each in the order of the entries (9.5 item 6)", () => {
  // Ranch A as loaded: the fall–winter share is 0; herd size, the unpaid added hours and the risk line have no cash effect.
  const A = tornado(example("ranchA"));
  assert.deepEqual(tornadoLists(A), ["Entered as 0, not tested: Share of runs avoided in fall–winter.",
    "No effect on cash NPV: Herd size; Added hours; Losses avoided (water)."]);
  // A blank price is not counted, and a cleared benefit input counts as 0 (9.5 item 7).
  assert.deepEqual(tornadoLists(tornado(ex("ranchA", (a) => (a.costs.monitors.unitCost = null))))[0], "Not counted, left blank: Monitor price.");
  const vehicle = tornado(ex("ranchA", (a) => (a.water.variableCostPerMile = null)));
  assert.deepEqual(vehicle.zeroNotTested, ["Share of runs avoided in fall–winter", "Vehicle cost per mile"]);
  // The collar-loss charge blank on a share above 0: "Quote required", so not counted and listed.
  assert.deepEqual(tornado(ex("ranchB", (a) => (a.vf.collarLoss.pctPerYear = 0.025))).leftBlank, ["Collar loss"]);
  // An entry with a set is tested while its own value is entered, even when a line it moves has a blank price.
  const sub = tornado(ex("ranchB", (a) => (a.costs.subscription.unitCost = null)));
  assert.deepEqual(sub.leftBlank, ["Subscription"]);
  close(bar(sub, "Herd size").width, 12934, 1);
  // EID: the premium entered as 0; added hours done unpaid.
  assert.deepEqual(tornadoLists(tornado(example("ranchC"))), ["Entered as 0, not tested: Net program premium.", "No effect on cash NPV: Added hours."]);
});

test("a moved value that breaks a 9.2 rule is set to the nearest value that passes, as the solver clips (9.5 item 6)", () => {
  // Ranch A with the summer share at 25%: 20% more days cut would be more paid hours than the hours saved, and 20% less
  // share would leave fewer hours saved than the paid hours cut.
  const a = ex("ranchA", (x) => (x.water.blocks[0].shareAvoided = 0.25));
  const t = tornado(a);
  const cut = bar(t, "Hired labor cut"), share = bar(t, "Share of runs avoided in summer");
  assert.equal(cut.lowValue, 12.8);
  close(cut.highValue, 16.5, 1e-6); // 132 hours saved ÷ 8 hours a day
  close(share.lowValue, 128 / 528, 1e-9);
  assert.equal(share.highValue, 0.3);
  // Each bar's cash NPVs are taken at its clipped values, not at the values refused.
  const entry = (path) => SENSITIVITY_INPUTS(a).find((x) => x.path === path);
  close(cut.high, analyze(moveDriver(a, entry("labor.cut.unitsCut"), cut.highValue)).cashNPV, 1e-6);
  close(share.low, analyze(moveDriver(a, entry("water.blocks.0.shareAvoided"), share.lowValue)).cashNPV, 1e-6);
  close(cut.high, -17917.49, 0.01);
  close(cut.width, 4281.04, 0.01);
  // Each clipped end passes every rule but the whole-number ones, which trial values do not meet (9.2).
  for (const [path, v] of [["labor.cut.unitsCut", cut.highValue], ["water.blocks.0.shareAvoided", share.lowValue]]) {
    const e = SENSITIVITY_INPUTS(a).find((x) => x.path === path);
    assert.deepEqual(validate(moveDriver(a, e, v)).filter((x) => !/whole number/.test(x.message)), [], path);
  }
  // A share moves at most to its block's cap, the most the analysis uses.
  assert.equal(bar(tornado(example("ranchA")), "Share of runs avoided in summer").highValue, 0.5);
});

test("an input given by year moves every year in proportion, through setPath (9.5 item 6)", () => {
  const a = ex("ranchA", (x) => (x.labor.cut.unitsCut = [0, 8, 16, 16, 16, 16, 16, 16, 16, 16, 16]));
  const e = SENSITIVITY_INPUTS(a).find((x) => x.label === "Hired labor cut"), cut = bar(tornado(a), "Hired labor cut");
  assert.deepEqual([e.entered, cut.lowValue, cut.highValue], [8, 6.4, 9.6]); // the first operating year's value
  assert.deepEqual(moveDriver(a, e, cut.highValue).labor.cut.unitsCut, [0, 9.6, 19.2, 19.2, 19.2, 19.2, 19.2, 19.2, 19.2, 19.2, 19.2]);
  close(analyze(moveDriver(a, e, cut.highValue)).cashNPV, cut.high, 1e-6);
  // A price given by year: the same, and a constant list moves as its single number does.
  const b = ex("ranchA", (x) => (x.costs.subscription.unitCost = Array(11).fill(365)));
  close(bar(tornado(b), "Subscription per monitor").width, bar(tornado(example("ranchA")), "Subscription per monitor").width, 1e-6);
  const s = SENSITIVITY_INPUTS(b).find((x) => x.label === "Subscription per monitor");
  assert.deepEqual(moveDriver(b, s, 438).costs.subscription.unitCost, Array(11).fill(438));
  // A capital line's price by year is read in its purchase years: bought in year 0 only, it is tested from year 0's value.
  const m = ex("ranchA", (x) => (x.costs.mounting.unitCost = [750, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
  const me = SENSITIVITY_INPUTS(m).find((x) => x.label === "Mounting"), mb = bar(tornado(m), "Mounting");
  assert.deepEqual([me.entered, mb.lowValue, mb.highValue], [750, 600, 900]);
  assert.deepEqual(moveDriver(m, me, 900).costs.mounting.unitCost, [900, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  // A price whose list is blank in every year the line uses it is left blank, whatever an unused year holds.
  const blankUsed = ex("ranchA", (x) => (x.costs.batteries.unitCost = [100, null]));
  assert.ok(analyze(blankUsed).notices.some((n) => n.type === "quoteRequired" && n.lineId === "batteries"));
  assert.deepEqual(tornadoLists(tornado(blankUsed)), ["Not counted, left blank: Batteries and repairs.",
    "Entered as 0, not tested: Share of runs avoided in fall–winter.", "No effect on cash NPV: Herd size; Added hours; Losses avoided (water)."]);
});

test("bars that tie keep the order of the entries; widest first otherwise", () => {
  // Ranch D with the handling done unpaid: the per-head subscription is the only head-based cash line, so herd size and
  // subscription move the same cash.
  const t = tornado(ex("ranchD", (a) => (a.labor.handling.doneBy = "unpaid")));
  assert.deepEqual(t.bars.slice(0, 2).map((b) => b.label), ["Herd size", "Subscription"]);
  close(t.bars[0].width, t.bars[1].width, 1e-6);
  // Widths taken to 10 significant figures, so a tie in exact arithmetic is a tie whatever the round-off of each run
  // (here the subscription's run comes out 1.5e-11 wider).
  const r = tornado(ex("ranchB", (a) => ((a.labor.handling.doneBy = "unpaid"), (a.costs.subscription.unitCost = 1.74))));
  assert.deepEqual(r.bars.slice(0, 2).map((b) => b.label), ["Herd size", "Subscription"]);
  assert.ok(r.bars[1].width > r.bars[0].width);
  for (const id of EXAMPLE_IDS) {
    const w = tornado(example(id)).bars.map((b) => b.width);
    assert.ok(w.every((x, i) => i === 0 || x <= w[i - 1] + 1e-6), id);
  }
});

test("the caption, legend and hover text (9.5 item 6)", () => {
  assert.equal(TORNADO_CAPTION, "Cash NPV, your share, before tax, with each input moved 20% down and 20% up, one at a time. "
    + "The longest bars are the numbers worth checking first.");
  assert.equal(tornadoCaption(tornado(example("ranchB"))), TORNADO_CAPTION);
  assert.deepEqual(TORNADO_LEGEND, ["Lower value", "Higher value"]);
  // Today's first line, "<label> (now <value>)", is kept; the two NPV lines take the new wording.
  assert.deepEqual(tornadoHover(tornado(example("ranchB")).bars[0]), ["Herd size (now 1,200 yearlings)", "Lower value: cash NPV −$169,781",
    "Higher value: cash NPV −$289,281"]);
  assert.equal(tornadoHover(bar(tornado(example("ranchA")), "Share of runs avoided in summer"))[0], "Share of runs avoided in summer (now 50%)");
});

test("the verdict's driver sentence: two bars, one bar, or none (9.5 item 1)", () => {
  const a = example("ranchA"), r = analyze(a), t = tornado(a, r);
  assert.ok(verdictSentence(a, r, t.bars).endsWith(" It turns most on subscription per monitor and hired labor cut."));
  assert.ok(verdictSentence(a, r, t.bars.slice(0, 1)).endsWith(" It turns most on subscription per monitor."));
  assert.ok(verdictSentence(a, r, []).endsWith("by about 33%."));
  assert.equal(verdictSentence(a, r), verdictSentence(a, r, []));
});

test("tornado: every example and version 1 link gives finite bars, and each bar's ends are its cash NPVs", () => {
  const states = [...EXAMPLE_IDS.map((id) => example(id)),
    ...["#preset=Remote+water+monitoring&head=500&years=5", "#preset=Collar-based+virtual+fencing", "#preset=EID+tags+and+scale"].map((h) => readLink(h).state)];
  for (const a of states) {
    const t = tornado(a), entries = SENSITIVITY_INPUTS(a);
    for (const b of t.bars) {
      assert.ok([b.low, b.high, b.width, b.lowValue, b.highValue].every(Number.isFinite), b.label);
      assert.ok(b.width >= 0.005);
      close(analyze(moveDriver(a, entries[b.i], b.highValue)).cashNPV, b.high, 1e-6);
    }
    // Every entry is a bar or in exactly one list, or (a blank price on a line with no quantity) in none: the collar
    // loss charge of Ranches B and D, blank on a loss share of 0 (row 49).
    assert.deepEqual(appearances(a, t), expected(a, ["ranchB", "ranchD"].includes(a.example) && a.vf?.collarLoss?.pctPerYear === 0 ? ["Collar loss"] : []));
  }
});

/** How many times each entry's label shows in the tornado's bars and lists. */
const appearances = (a, t) => {
  const seen = [...t.bars.map((b) => b.label), ...t.leftBlank, ...t.zeroNotTested, ...t.noEffect];
  return Object.fromEntries(SENSITIVITY_INPUTS(a).map((e) => [e.label, seen.filter((l) => l === e.label).length]));
};
/** The same, as 9.5 item 6 says: once, except the labels given, each a blank price on a line with no quantity (item 7). */
const expected = (a, hidden = []) => Object.fromEntries(SENSITIVITY_INPUTS(a).map((e) => [e.label, hidden.includes(e.label) ? 0 : 1]));

test("every entry is a bar or in one list across edited states, never dropped (9.5 item 6)", () => {
  const states = [
    [ex("ranchA", (a) => (a.costs.monitors.unitCost = null))],
    // No monitors: the batteries line has no quantity in any year, so its blank price is in no list.
    [ex("ranchA", (a) => { a.water.monitors = 0; a.costs.batteries.unitCost = null; }), ["Batteries and repairs"]],
    [ex("ranchA", (a) => (a.water.blocks[1].shareAvoided = 0.3))],
    [ex("ranchA", (a) => (a.costs.mounting.unitCost = null))],
    [ex("ranchB", (a) => (a.vf.collarLoss.pctPerYear = 0.025))],
    [ex("ranchB", (a) => (a.costs.subscription.unitCost = null)), ["Collar loss"]],
    [ex("ranchB", (a) => (a.costs.infrastructure.unitCost = null)), ["Collar loss"]],
    [ex("ranchB", (a) => (a.labor.freedTimeUse = "absorbed")), ["Collar loss"]],
    [example("ranchB"), ["Collar loss"]],
    [ex("ranchC", (a) => (a.costs.software.unitCost = 0))],
    [ex("ranchC", (a) => (a.eid.tagPrice = null))],
    [ex("ranchD", (a) => { a.vf.collarLoss.chargePerCollar = 150; })],
  ];
  for (const [a, hidden] of states) assert.deepEqual(appearances(a, tornado(a)), expected(a, hidden));
  // "No effect" is a bar under half a cent: Mounting at $0.01 moves cash NPV $0.004, at $1 it moves $0.40.
  const at = (v) => tornado(ex("ranchA", (a) => (a.costs.mounting.unitCost = v)));
  assert.ok(at(0.01).noEffect.includes("Mounting"));
  close(bar(at(1), "Mounting").width, 0.4, 1e-9);
  // The lists in full for a blank vendor price, a blank placeholder and a blank tag price.
  const lists = (id, f) => tornadoLists(tornado(ex(id, f)));
  assert.deepEqual(lists("ranchB", (a) => (a.costs.infrastructure.unitCost = null)), ["Not counted, left blank: Infrastructure."]);
  assert.equal(lists("ranchA", (a) => (a.costs.mounting.unitCost = null))[0], "Not counted, left blank: Mounting.");
  assert.equal(lists("ranchC", (a) => (a.eid.tagPrice = null))[0], "Not counted, left blank: Tag price.");
  assert.ok(!lists("ranchA", (a) => { a.water.monitors = 0; a.costs.batteries.unitCost = null; }).some((l) => l.includes("Batteries")));
});

test("review fixes: other cost lines, units, a share above its cap, the premium with no calves, a negative premium", () => {
  // A virtual fence state without vf.pricing has no price entry, so its billed subscription is another cost line.
  const noPricing = ex("ranchB", (a) => delete a.vf.pricing);
  const sub = SENSITIVITY_INPUTS(noPricing).find((e) => e.label === "Subscription");
  assert.deepEqual([sub.id, sub.path, sub.unit], ["cost:subscription", "costs.subscription.unitCost", "$/head/month"]);
  const t = tornado(noPricing);
  assert.deepEqual(t.bars.slice(0, 2).map((b) => b.label), ["Herd size", "Subscription"]);
  close(bar(t, "Subscription").width, 106566, 1);
  assert.ok(verdictSentence(noPricing, analyze(noPricing), t.bars).endsWith(" It turns most on herd size and subscription."));
  // A per-head-per-year line's price is per head per month (9.2), as on the page.
  const v1 = readLink("#preset=Collar-based+virtual+fencing").state;
  assert.equal(SENSITIVITY_INPUTS(v1).find((e) => e.label === "Subscription per head").unit, "$/head/month");
  assert.deepEqual(gridValue({ inputUnit: "$/head/month" }, 4.2), "$4.20/head/month");
  // The units of the page (9.4): monitors, collars and batteries by their device, dosing per head and application.
  const purchased = ex("ranchB", (a) => {
    a.vf.pricing = "purchased";
    a.costs.collars = { timing: "capital", basis: "perDevice", unitCost: 250, lifeYears: 5 };
    a.costs.serviceFee = { timing: "annual", basis: "perDevice", unitCost: 30 };
  });
  const unit = (a, label) => SENSITIVITY_INPUTS(a).find((e) => e.label === label).inputUnit;
  assert.deepEqual([unit(purchased, "Purchased collars"), unit(purchased, "Service fee"), unit(example("ranchC"), "Dosing savings"),
    unit(example("ranchC"), "Retag rate")], ["$ per collar", "$ per collar per year", "$/head/application", "%/yr"]);
  // A share typed above a cap of 0 is tested (both moves capped to 0), not "entered as 0".
  const capped = tornado(ex("ranchA", (a) => {
    a.water.blocks[1].minVisitsPerWeek = a.water.blocks[1].runsPerWeek;
    a.water.blocks[1].shareAvoided = 0.3;
  }));
  assert.ok(!capped.zeroNotTested.includes("Share of runs avoided in fall–winter"));
  assert.ok(capped.noEffect.includes("Share of runs avoided in fall–winter"));
  // The hours-cut entry, n/a with freed time absorbed and a cut by year, keeps its label without "(year y; …)".
  const absorbed = ex("ranchB", (a) => { a.labor.freedTimeUse = "absorbed"; a.labor.cut.unitsCut = [0, 100, 200]; });
  assert.ok(labels(absorbed).includes("Hired moving and gathering hours cut"));
  assert.ok(!labels(absorbed).some((l) => /other years in proportion/.test(l)));
  // With no calves sold, the premium has nothing to act on and is left out, like added hours with none (9.3).
  const noCalves = ex("ranchC", (a) => {
    a.eid.premium = { saleCwt: 5.5, premiumPerCwt: 5, verificationFee: 1 };
    a.classes.calvesSold.head = 0;
  });
  assert.ok(!labels(noCalves).includes("Net program premium"));
  assert.ok(!tornadoLists(tornado(noCalves)).some((l) => l.includes("Net program premium")));
  // A net premium below its fee: the lower value is × 1.2, and the hover's "Lower value" is its cash NPV.
  const neg = ex("ranchC", (a) => (a.eid.premium = { saleCwt: 5.5, premiumPerCwt: 0.1, verificationFee: 3 }));
  const nb = bar(tornado(neg), "Net program premium");
  assert.ok(nb.lowValue < nb.highValue && nb.lowValue < 0);
  close(nb.low, analyze(moveDriver(neg, SENSITIVITY_INPUTS(neg).find((e) => e.id === "premium"), nb.lowValue)).cashNPV, 1e-6);
  assert.ok(nb.low < nb.high);
  assert.equal(tornadoHover(nb)[1], `Lower value: cash NPV −$${Math.round(-nb.low).toLocaleString("en-US")}`);
});

// ---------------------------------------------------------------- the two-way grid

test("two-way grid: the top two bars, 40% below to 40% above, and the base cell is the base cash NPV", () => {
  const a = example("ranchB"), t = tornado(a), g = twoWayGrid(a, t);
  assert.deepEqual([g.rows.label, g.cols.label, g.base], ["Herd size", "Subscription", [2, 2]]);
  assert.deepEqual(GRID_STEPS, [0.6, 0.8, 1, 1.2, 1.4]);
  g.rows.values.forEach((v, k) => close(v, [720, 960, 1200, 1440, 1680][k], 1e-9));
  g.cols.values.forEach((v, k) => close(v, [4.2, 5.6, 7, 8.4, 9.8][k], 1e-9));
  close(g.cells[2][2], t.base, 1e-6);
  assert.ok(g.cells.flat().every(Number.isFinite));
  // Each cell is the cash NPV with both values moved, off the base row and column too.
  const [re, ce] = [0, 1].map((k) => SENSITIVITY_INPUTS(a)[t.bars[k].i]);
  for (const [r, c] of [[0, 0], [4, 4], [0, 4], [4, 0], [1, 3]]) {
    close(g.cells[r][c], analyze(moveDriver(moveDriver(a, re, g.rows.values[r]), ce, g.cols.values[c])).cashNPV, 1e-6);
  }
  // Here more head and a higher subscription both lower the cash NPV.
  assert.ok(g.cells[0][2] > g.cells[4][2]);
  assert.ok(g.cells[2][4] < g.cells[2][0]);
  close(g.cells[0][0], -46091, 1);
  assert.equal(gridNote(g), "Cash NPV for the two inputs that matter most: herd size (rows), from 40% below to 40% above what you "
    + "entered, and subscription (columns), from 40% below to 40% above what you entered. The outlined cell is what you entered.");
  for (const id of EXAMPLE_IDS) {
    const x = example(id), gx = twoWayGrid(x);
    close(gx.cells[gx.base[0]][gx.base[1]], analyze(x).cashNPV, 1e-6);
  }
});

test("two-way grid: herd size and the net program premium move together as each does alone, in either order", () => {
  // Ranch C with a premium typed and free tags: herd size is the widest bar and the premium the next.
  const a = ex("ranchC", (x) => { x.eid.tagPrice = 0; x.eid.premium = { saleCwt: 5, premiumPerCwt: 4, verificationFee: 1 }; });
  const t = tornado(a), g = twoWayGrid(a, t), entries = SENSITIVITY_INPUTS(a);
  assert.deepEqual([g.rows.label, g.cols.label], ["Herd size", "Net program premium"]);
  const [herd, premium] = [entries[t.bars[0].i], entries[t.bars[1].i]];
  // The base column is herd size moved alone, the base row the premium moved alone (the tornado's ends among them).
  g.rows.values.forEach((v, r) => close(g.cells[r][2], analyze(moveDriver(a, herd, v)).cashNPV, 1e-6));
  g.cols.values.forEach((v, c) => close(g.cells[2][c], analyze(moveDriver(a, premium, v)).cashNPV, 1e-6));
  close(g.cells[1][2], t.bars[0].low, 1e-6);
  close(g.cells[3][2], t.bars[0].high, 1e-6);
  close(g.cells[3][2], 25866, 1);
  // Every cell is the same whichever entry moves first.
  g.rows.values.forEach((rv, r) => g.cols.values.forEach((cv, c) => {
    close(g.cells[r][c], analyze(moveDriver(moveDriver(a, premium, cv), herd, rv)).cashNPV, 1e-6);
  }));
});

test("two-way grid: a share held at its cap, values moved to pass a rule, and pairs not valid together", () => {
  // Only the cap: the share's axis repeats the cap, and the note says why, without calling the values not valid.
  const capped = ex("ranchA", (x) => {
    x.labor.cut.unitsCut = 0;
    for (const k of ["subscription", "monitors", "batteries", "mounting"]) x.costs[k].unitCost = 1;
    x.water.variableCostPerMile = 3;
  });
  const g = twoWayGrid(capped);
  assert.deepEqual([g.rows.label, g.cols.label, g.cols.values, g.cols.capped, g.cols.clipped],
    ["Vehicle cost per mile", "Share of runs avoided in summer", [0.3, 0.4, 0.5, 0.5, 0.5], true, false]);
  assert.ok(gridNote(g).endsWith(" The outlined cell is what you entered. A share of runs avoided stops at its block's cap, the most the analysis counts."));
  // The cap, the paid-hours clip and n/a cells together.
  const both = ex("ranchA", (x) => {
    x.water.blocks[0].shareAvoided = 0.4;
    x.costs.subscription.unitCost = 0;
    x.costs.monitors.unitCost = 0;
    x.settings.discountRate = 0;
  });
  const h = twoWayGrid(both);
  assert.deepEqual([h.rows.label, h.cols.label, h.cols.capped, h.cols.clipped], ["Hired labor cut", "Share of runs avoided in summer", true, true]);
  close(h.cols.values[0], 128 / 528, 1e-9);
  assert.equal(h.cols.values[4], 0.5);
  assert.deepEqual(h.cells.flatMap((row, r) => row.flatMap((x, c) => (x === null ? [[r, c]] : []))), [[3, 0], [4, 0], [4, 1]]);
  assert.equal(gridNote(h), "Cash NPV for the two inputs that matter most: hired labor cut (rows), from 40% below to 40% above what you "
    + "entered, and share of runs avoided in summer (columns), from 40% below to 40% above what you entered. The outlined cell is "
    + "what you entered. A share of runs avoided stops at its block's cap, the most the analysis counts. A value that is not valid "
    + "with your other inputs is moved to the nearest one that is. A cell marked n/a pairs values that are not valid together.");
});

test("two-way grid: an entry entered as 0 runs across its zeroRange, and its base is the first step", () => {
  const a = ex("ranchB", (x) => (x.vf.collarLoss.chargePerCollar = 3000));
  const g = twoWayGrid(a);
  assert.deepEqual([g.rows.label, g.cols.label, g.base, g.rows.zeroRange], ["Collar loss", "Herd size", [0, 2], [0, 0.07]]);
  assert.deepEqual(g.rows.values.map((v) => gridValue(g.rows, v)), ["0%", "1.75%", "3.50%", "5.25%", "7%"]);
  close(g.cells[0][2], analyze(a).cashNPV, 1e-6);
  assert.equal(gridNote(g), "Cash NPV for the two inputs that matter most: collar loss (rows), entered as 0, from 0% to 7%, and herd "
    + "size (columns), from 40% below to 40% above what you entered. The outlined cell is what you entered.");
});

test("two-way grid: none with fewer than two bars", () => {
  const a = { module: "water", settings: { T: 5, discountRate: 0.07 }, startYear: 0, classes: { cows: { head: 100 } }, served: { cows: {} },
    water: { monitors: 0, blocks: [] } };
  assert.deepEqual(validate(a), []);
  const t = tornado(a);
  assert.deepEqual(t.bars, []);
  assert.equal(twoWayGrid(a, t), null);
  assert.equal(gridNote(null), null);
  assert.equal(verdictSentence(a, analyze(a), t.bars), "No cash flows for you in this analysis.");
});
