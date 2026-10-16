// Tests of the payback target, the N-year test and "What would make it pay" (B9; docs/audit/phase1-spec.md 9.1 step 6,
// 9.3, 9.5 items 1 and 9, 9.7 "What would make it pay", 10.1 rows 1, 39–46 and 50, Appendix A).
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze, validate, targetTest, nYearRun, solveDrivers, rankDrivers, PAYBACK_DRIVERS, moveDriver, setPath, paybackTargetOf,
} from "../roi.js";
import { example } from "../examples.js";
import { setInput } from "../state.js";
import { readLink, writeLink } from "../links.js";
import { paybackTargetLine, wouldPaySentence, paybackPanel, verdictSentence, paybackText, noticeText, PANEL_CAPTION } from "../text.js";

const close = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);
/** An example with changes made in place by f, checked valid. */
const ex = (id, f) => {
  const a = example(id);
  f?.(a);
  assert.deepEqual(validate(a), []);
  return a;
};
/** Everything B9 gives for an analysis: the full run, the N-year test, the drivers' rows and the page's texts. */
const pay = (a) => {
  assert.deepEqual(validate(a), []);
  const r = analyze(a), t = targetTest(a, r), rows = solveDrivers(a, r, t), panel = paybackPanel(a, r, t, rows);
  const row = (label) => {
    const i = rows.findIndex((x) => x.label === label);
    assert.ok(i >= 0, `no row "${label}" in ${rows.map((x) => x.label)}`);
    return { ...rows[i], cells: panel.rows[i], driver: PAYBACK_DRIVERS(a)[i] };
  };
  return { a, r, t, rows, panel, row, line: paybackTargetLine(t), sentence: wouldPaySentence(t, rows) };
};
/** The N-year and full-horizon cash NPVs with driver d at value v. */
const at = (p, label, v) => {
  const d = p.row(label).driver, b = moveDriver(p.a, d, v);
  return { target: nYearRun(b).cashNPV, horizon: analyze(b).cashNPV };
};
const NONE_CELLS = (label, lo, hi, N, T) => [`No ${label} between ${lo} and ${hi} makes it pay for itself within ${N} years`,
  `No ${label} between ${lo} and ${hi} makes it break even over ${T} years`];

// The section 11 columns of Synthetic Ranches A, B and C, as changes to the expected case (Appendix A's prototype,
// docs/audit/prototype/examples.mjs: A, B and Cc).
const COLUMNS = {
  ranchA: {
    cons: (a) => {
      a.water.blocks[0].shareAvoided = 0.25;
      a.water.variableCostPerMile = 0.3;
      a.labor.cut.unitsCut = 0;
      a.labor.added[1].hours = 2 * 52;
      a.riskLines[0].eventsPerYear = 0;
    },
    opt: (a) => {
      a.water.variableCostPerMile = 0.5;
      a.labor.cut.unitsCut = 33;
      a.labor.added[1].hours = 0.5 * 52;
      Object.assign(a.riskLines[0], { eventsPerYear: 0.25, shareCaught: 0.9 });
    },
  },
  ranchB: {
    cons: (a) => {
      a.costs.infrastructure.unitCost = 9000;
      a.enrolled.yearlings.months = 12; // billed for 12 months: 1,200 × $7 × 12
      a.labor.handling.events.forEach((e) => Object.assign(e, { minutesPerHead: 2, crewSize: 4 }));
      Object.assign(a.labor.handling, { gathers: 3, gatherRiders: 3, hoursPerGather: 8, trainingDays: 10, trainingRiders: 2, hoursPerDay: 8 });
      a.vf.collarLoss = { pctPerYear: 0.025, chargePerCollar: 100 }; // $3,000 a year
      a.labor.cut.unitsCut = 0;
    },
    opt: (a) => {
      a.costs.subscription.unitCost = 5.5;
      a.enrolled.yearlings.months = 5;
      a.labor.handling.events.forEach((e) => Object.assign(e, { minutesPerHead: 1, crewSize: 3 }));
      Object.assign(a.labor.handling, { gathers: 2, gatherRiders: 2, hoursPerGather: 6, trainingDays: 5, trainingRiders: 1, hoursPerDay: 6 });
      a.labor.cut.unitsCut = 400;
      a.vf.gatherHoursCut = 400;
    },
  },
  ranchC: {
    cons: (a) => {
      a.eid.retagPct = 0.043;
      ["reader", "indicatorBars", "platform"].forEach((id) => (a.costs[id].residual.pct = 0));
      a.eid.dosing.perApplication = 0;
      a.labor.handling.events.forEach((e) => (e.minutesPerHead = 30 / 60));
      a.labor.added[0].hours = 20;
    },
    opt: (a) => {
      a.eid.freeTags = { qty: 300, years: [0] }; // the cow tags free
      ["reader", "indicatorBars", "platform"].forEach((id) => (a.costs[id].residual.pct = 0.25));
      a.eid.premium = { saleCwt: 5.5, premiumPerCwt: 2.25, verificationFee: 1.1 }; // 240 × (5.5 × $2.25 − $1.10)
      a.labor.handling.events.forEach((e) => (e.minutesPerHead = 15 / 60));
      a.labor.added[0].hours = 10;
    },
  },
};
const column = (id, k, f) => ex(id, (a) => { COLUMNS[id][k](a); f?.(a); });

// ---------------------------------------------------------------- the N-year test (9.3)

test("the 5-year test of each example; each headline unchanged; the line under the verdict (9.7, 10.1 row 39, Appendix A)", () => {
  const pinned = { ranchA: [-7648, -11079], ranchB: [-175519, -229531], ranchC: [-8678, -9895], ranchD: [-6871, -9789] };
  for (const [id, [five, headline]] of Object.entries(pinned)) {
    const a = ex(id);
    assert.equal(paybackTargetOf(a), 5);
    const t = targetTest(a);
    assert.deepEqual([t.years, t.pays, t.warnings], [5, false, []]);
    close(t.cashNPV, five, 1);
    close(analyze(a).cashNPV, headline, 1);
    assert.equal(paybackTargetLine(t), "Does not pay for itself within 5 years");
  }
  // Ranch D's payback over 5 years (Appendix A).
  const d5 = analyze(ex("ranchD", (a) => (a.settings.T = 5)));
  assert.equal(paybackText(d5.payback), "none within 5 years (no net outlay in year 0; cumulative negative from year 5)");
  close(d5.cashNPV, -6871, 1);
});

test("the 5-year test of the conservative and optimistic columns, and their full-horizon results (Appendix A, section 11)", () => {
  const pinned = {
    ranchA: { cons: [-23867, -38863], opt: [6000, 12299] },
    ranchB: { cons: [-470813, -616250], opt: [-76811, -99789] },
    ranchC: { cons: [-10906, -12608], opt: [3683, 5914] },
  };
  for (const [id, cols] of Object.entries(pinned)) {
    for (const [k, [five, full]] of Object.entries(cols)) {
      const a = column(id, k);
      close(targetTest(a).cashNPV, five, 1);
      close(analyze(a).cashNPV, full, 1);
    }
  }
});

test("Appendix A: Synthetic Ranch C optimistic's herd size, at least 177.24 cows in 5 years and 150.04 over 7", () => {
  const p = pay(column("ranchC", "opt"));
  const herd = p.row("Herd size");
  close(herd.target.value, 177.24, 0.01);
  close(herd.horizon.value, 150.04, 0.01);
  assert.deepEqual([herd.target.direction, herd.cells.entered, herd.cells.target, herd.cells.horizon],
    ["at least", "300 cows", "at least 178 cows", "at least 151 cows"]);
});

test("row 39: a case that passes the 5-year test, and the residual note on Ranch C's panel only", () => {
  // Ranch A expected with the optimistic column's cash inputs.
  const p = pay(ex("ranchA", (a) => { a.water.variableCostPerMile = 0.5; a.labor.cut.unitsCut = 33; }));
  close(p.t.cashNPV, 6000, 1);
  assert.equal(p.t.pays, true);
  close(p.r.cashNPV, 12299, 1);
  assert.equal(p.line, "Pays for itself within 5 years (counting equipment value left at year 5)");
  assert.equal(p.sentence, null);
  const residual = "Equipment value left at year 5 uses the residual you entered as a percentage of cost or an amount; it is not recalculated for year 5.";
  for (const id of ["ranchA", "ranchB", "ranchC", "ranchD"]) assert.equal(pay(ex(id)).panel.notes.includes(residual), id === "ranchC", id);
  assert.deepEqual(pay(ex("ranchC")).panel.notes, [residual]);
});

test("a test with no cash flows for the operator neither pays nor fails (rows 1, 41(e) and (f))", () => {
  // Row 1: no costs and no benefits.
  const zero = { module: "water", settings: { T: 5, discountRate: 0.07 }, startYear: 0, classes: { cows: { head: 100 } }, served: { cows: {} },
    water: { monitors: 0, blocks: [] } };
  assert.deepEqual(validate(zero), []);
  const t = targetTest(zero);
  assert.deepEqual([t.pays, t.cashNPV], [null, 0]);
  assert.equal(paybackTargetLine(t), "No cash flows for you within 5 years");
  assert.equal(verdictSentence(zero, analyze(zero)), "No cash flows for you in this analysis.");
  assert.equal(wouldPaySentence(t, solveDrivers(zero)), null);
  // The panel for row 1 has no NaN, Infinity or undefined in any string (9.7 Page text).
  const r0 = analyze(zero), p0 = paybackPanel(zero, r0, t, solveDrivers(zero, r0, t));
  const strings = [p0.title, p0.caption, ...p0.columns, ...p0.notes, ...p0.rows.flatMap((x) => [x.input, x.entered, x.target, x.horizon, ...x.notes])];
  assert.ok(strings.every((x) => typeof x === "string" && !/NaN|Infinity|undefined/.test(x)), JSON.stringify(strings));
  assert.deepEqual(p0.rows.map((x) => [x.input, x.entered, x.target, x.horizon]),
    [["Herd size", "100 cows", "n/a: no cash flows within 5 years", "n/a: no cash flows within 5 years"]]);
  assert.deepEqual(p0.notes, []);

  // (e) The module starts in year 5, the payback target: no flows in the 5-year test (its install hours fall in year 5);
  // the 10-year column is solved as usual.
  const e = pay(ex("ranchA", (a) => { a.startYear = 5; a.labor.added[0].hours = [0, 0, 0, 0, 0, 30, 0]; }));
  assert.equal(e.t.pays, null);
  assert.equal(e.line, "No cash flows for you within 5 years");
  assert.equal(e.sentence, null);
  assert.ok(e.panel.rows.every((x) => x.target === "n/a: no cash flows within 5 years"));
  assert.ok(e.rows.every((x) => x.horizon.state !== "n/a"));
  assert.equal(e.row("Vehicle cost per mile").horizon.state, "value");

  // (f) Every operator share 0.
  const f = pay(ex("ranchA", (a) => {
    for (const c of Object.values(a.costs)) c.operatorShare = 0;
    a.benefitShares = { vehicle: 0, laborCut: 0, hoursFreed: 0, "risk:0": 0, fewerChecks: 0 };
  }));
  assert.equal(verdictSentence(f.a, f.r), "No cash flows for you in this analysis.");
  assert.equal(f.line, "No cash flows for you within 5 years");
  assert.equal(f.sentence, null);
  for (const x of f.panel.rows) assert.deepEqual([x.target, x.horizon], ["n/a: no cash flows within 5 years", "n/a: no cash flows within 10 years"]);
  assert.deepEqual(f.r.paidByOthers.map((x) => x.lineId), Object.keys(f.a.costs));
  assert.deepEqual(f.r.receivedByOthers.map((x) => x.lineId), ["vehicle", "laborCut", "risk:0", "hoursFreed"]);
});

test("row 44(a): a payback target beyond the horizon runs to year N with every price and quantity unchanged", () => {
  const p = pay(ex("ranchD", (a) => (a.settings.paybackTarget = 10)));
  close(p.t.cashNPV, -15903, 1);
  assert.equal(p.line, "Does not pay for itself within 10 years");
  assert.deepEqual(p.panel.notes, ["This test assumes the same prices continue to year 10."]);
  close(p.r.cashNPV, -9789, 1);
  // Training days carry their last value, 0, to year 10: the handling hours stay 88 a year after year 1.
  assert.deepEqual(nYearRun(p.a).hours.handling.slice(1), [172, 88, 88, 88, 88, 88, 88, 88, 88, 88]);
  // The 7-year column is row 40's.
  const d = pay(ex("ranchD"));
  assert.deepEqual(p.rows.map((x) => x.horizon), d.rows.map((x) => x.horizon));
  assert.equal(p.panel.columns[2], "To pay for itself within 10 years");
});

test("row 30: each migrated version 1 link's panel, line under the verdict and sentence (9.3, 9.5 items 1 and 9)", () => {
  const links = ["#preset=Collar-based+virtual+fencing", "#preset=Remote+water+monitoring", "#preset=EID+tags+and+scale",
    "#preset=Remote+water+monitoring&head=500&years=5", "#preset=Remote+water+monitoring&years=5", "#head=500"];
  for (const hash of links) {
    const p = pay(readLink(hash).state);
    // The herd-size row and, for the EID link, the premium and added hours, both n/a; no other row.
    if (hash.includes("EID")) {
      assert.deepEqual(p.rows.map((x) => x.label), ["Herd size", "Net program premium", "Added hours"], hash);
      assert.deepEqual([p.panel.rows[1].target, p.panel.rows[1].horizon], ["n/a: no calves sold", "n/a: no calves sold"]);
      assert.deepEqual([p.panel.rows[2].target, p.panel.rows[2].horizon], ["n/a: no added hours entered", "n/a: no added hours entered"]);
    } else {
      assert.deepEqual(p.rows.map((x) => x.label), ["Herd size"], hash);
    }
    assert.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(p.panel)), hash);
  }
  const p = pay(readLink("#preset=Remote+water+monitoring&head=500&years=5").state);
  assert.deepEqual([p.panel.rows[0].target, p.panel.rows[0].horizon], NONE_CELLS("herd size", 1, "10,000 cows", 5, 5));
  assert.equal(p.line, "Does not pay for itself within 5 years");
  assert.equal(p.sentence, "No single input in the panel makes it pay for itself within 5 years.");
});

test("a test past the horizon carries year T's values: entries a list holds past year T are not used (9.3, 9.2)", () => {
  // The subscription entered by year with T at 10, then T set back to 7: years 8 to 10 still hold $12, which the page no
  // longer shows. The 10-year test carries year 7's $7, as for the example as loaded (row 44(a)), and so does its link.
  let a = setInput(example("ranchD"), "settings.paybackTarget", 10);
  a = setInput(a, "settings.T", 10);
  a = setInput(a, "costs.subscription.unitCost", [7, 7, 7, 7, 7, 7, 7, 7, 12, 12, 12]);
  a = setInput(a, "settings.T", 7);
  assert.deepEqual(validate(a), []);
  close(analyze(a).cashNPV, -9789, 1);
  close(targetTest(a).cashNPV, -15903, 1);
  const linked = readLink(writeLink(a)).state;
  assert.equal(linked.costs.subscription.unitCost.length, 11);
  close(targetTest(linked).cashNPV, -15903, 1);
  // The ramp is by operating year and the free tags' billing years are years, not values by year: neither is cut.
  const c = ex("ranchC", (x) => {
    x.settings.T = 2;
    x.ramp = [1, 1, 1, 0.5];
    x.eid.freeTags = { qty: 100, years: [1, 2, 3, 4] };
  });
  const t = nYearRun(c, 5);
  close(t.cashNPV, nYearRun(ex("ranchC", (x) => {
    x.settings.T = 5;
    x.ramp = [1, 1, 1, 0.5];
    x.eid.freeTags = { qty: 100, years: [1, 2, 3, 4] };
  }), 5).cashNPV, 1e-6);
});

test("row 44(b): Ranch C optimistic over 2 years: one verdict, and a 5-year test past the horizon that passes", () => {
  const p = pay(column("ranchC", "opt", (a) => (a.settings.T = 2)));
  close(p.r.cashNPV, -283, 1);
  assert.ok(verdictSentence(p.a, p.r).startsWith("Over 2 years at the example's 7% real rate (an assumption, not a recommendation), "
    + "before tax, this is within $500 of breaking even in cash. It does not pay. Cash benefits would need to rise by about 5%."));
  close((p.r.pv.C - p.r.pv.R) / p.r.pv.B, 1.05, 0.0005);
  assert.equal(paybackText(p.r.payback), "1.92 years");
  close(p.t.cashNPV, 3683, 1);
  assert.equal(p.line, "Pays for itself within 5 years (counting equipment value left at year 5)");
  assert.deepEqual(p.panel.notes, ["This test assumes the same prices continue to year 5.",
    "Equipment value left at year 5 uses the residual you entered as a percentage of cost or an amount; it is not recalculated for year 5."]);
  assert.deepEqual(p.panel.columns, ["Input", "You entered", "To pay for itself within 5 years", "To break even over 2 years"]);
});

test("the N-year test's warnings: a contract that runs past year N; the same notice is not repeated (rows 50(b) and (c))", () => {
  const b = pay(ex("ranchB", (a) => Object.assign(a.costs.subscription, { commitYears: 6, earlyTerminationFee: 10000 })));
  assert.deepEqual(b.t.warnings.map((w) => [w.type, w.lineId]), [["commitPastHorizon", "subscription"]]);
  assert.deepEqual(b.panel.notes, ["5-year test: The horizon (5 years) ends inside the 6-year contract on Subscription, so its early-termination fee ($10,000) is charged in year 5."]);
  close(b.t.cashNPV, targetTest(ex("ranchB")).cashNPV - 10000 / 1.07 ** 5, 0.01);
  close(b.t.cashNPV, -182649, 1);
  assert.ok(!b.r.notices.some((n) => n.type === "commitPastHorizon"));
  close(b.r.cashNPV, -229531, 1);

  // (c) The Ranch A case of row 35(b): its leased unit, land unit 2, ends in year 3 inside both horizons.
  const c = pay(ex("ranchA", (a) => {
    a.settings.landUnits = [{ id: "u1", kind: "owned", share: 0.4 },
      { id: "u2", kind: "leased", share: 0.6, leaseYears: 3, renewalExpected: false, waterBy: "tenant" }];
  }));
  assert.deepEqual(c.r.notices.filter((n) => n.type === "leaseEnds").map(noticeText),
    ["The lease on land unit 2 ends in year 3, inside the 10-year horizon. Its share of each benefit stops then; its costs run as entered, except improvements that stay with the land, which stop at the lease end and are credited any reimbursement."]);
  assert.ok(nYearRun(c.a).notices.some((n) => n.type === "leaseEnds" && n.unit === 2 && n.horizon === 5));
  assert.deepEqual(c.t.warnings, []);
  assert.deepEqual(c.panel.notes, []);
});

test("the N-year test keeps the full horizon's allocation of a lease-end reimbursement (9.3, 9.7 Engine)", () => {
  // T = 7; a $10,000 purchase in year 0 (life 10, straight line) that stays with the land; owned 0.6, leases of 0.3
  // and 0.1 ending in year 3 and in year `end`; a reimbursement of $1,000.
  const units = (end) => [{ id: "home", kind: "owned", share: 0.6 }, { id: "a", kind: "leased", share: 0.3, leaseYears: 3 },
    { id: "b", kind: "leased", share: 0.1, leaseYears: end }];
  const analysis = (end, N) => ({
    module: "water", settings: { T: 7, discountRate: 0.07, paybackTarget: N, landUnits: units(end) }, startYear: 0,
    classes: { cows: { head: 100 } }, served: { cows: {} }, water: { monitors: 0, blocks: [] },
    costs: { pipe: { label: "Pipeline", timing: "capital", basis: "perDevice", unitCost: 10000, qty: 1, lifeYears: 10,
      residual: { mode: "straightLine" }, staysWithLand: true, leaseReimbursement: 1000 } },
  });
  const R = (a) => nYearRun(a).R.map((x) => Math.round(x * 100) / 100);
  // The second lease ends in year 6: the full run gives $750 in year 3 and $250 in year 6; the 5-year test gives $750 in
  // year 3 (not $1,000), and the 0.1 part, whose lease runs past year 5, its straight-line $500 at year 5.
  const six = analysis(6, 5);
  assert.deepEqual(validate(six), []);
  assert.deepEqual(analyze(six).R.map(Math.round), [0, 0, 0, 750, 0, 0, 250, 1800]);
  assert.deepEqual(R(six), [0, 0, 0, 750, 0, 0.6 * 10000 * 5 / 10 + 500]);
  // The second lease ends in year 9: the full run gives the 0.3 part $1,000 and the 0.1 part its straight-line $300 at
  // year 7; a 10-year test gives the 0.3 part $1,000 and the 0.1 part $0 in year 9 (the entered total covers only the
  // leases that end within T).
  assert.deepEqual(analyze(analysis(9, 5)).R.map(Math.round), [0, 0, 0, 1000, 0, 0, 0, 2100]);
  assert.deepEqual(R(analysis(9, 10)), [0, 0, 0, 1000, 0, 0, 0, 0, 0, 0, 0]);
});

test("a line that starts in year N or later has no flows in the test, and no early-termination fee (9.3)", () => {
  const a = ex("ranchB", (x) => Object.assign(x.costs.subscription, { startYear: 5, commitYears: 3, earlyTerminationFee: 10000 }));
  const run = nYearRun(a);
  assert.ok(!run.notices.some((n) => n.type === "commitPastHorizon"));
  const sub = run.lines.find((l) => l.id === "subscription");
  assert.ok(sub.series.every((x) => x === 0));
});

test("an amount residual counts only for a line bought within the test: none when it starts or first rises in year N or later (9.3)", () => {
  const base = targetTest(ex("ranchA")).cashNPV;
  close(base, -7648, 1);
  const line = (x) => ({ label: "Spare monitors", timing: "capital", lifeYears: 10, residual: { mode: "amount", dollars: x.dollars }, ...x });
  // Starts in year 5 (N) or 6: no purchase within 5 years, so no residual at year 5 and the test is unchanged.
  for (const startYear of [5, 6]) {
    const a = ex("ranchA", (x) => (x.costs.extra = line({ basis: "fixed", unitCost: 9000, startYear, dollars: 9000 })));
    const extra = nYearRun(a).lines.find((l) => l.id === "extra");
    assert.deepEqual([extra.series, extra.residual], [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], `start ${startYear}`);
    close(targetTest(a).cashNPV, base, 1e-6);
  }
  // Its quantity first rises in year 6: the same. Bought within the test (one in year 0), it counts as entered.
  const late = ex("ranchA", (x) => (x.costs.extra = line({ basis: "perDevice", qty: [0, 0, 0, 0, 0, 0, 4], unitCost: 1000, dollars: 3000 })));
  close(targetTest(late).cashNPV, base, 1e-6);
  close(analyze(late).cashNPV, -12219, 1);
  const early = ex("ranchA", (x) => (x.costs.extra = line({ basis: "perDevice", qty: [1, 1, 1, 1, 1, 1, 4], unitCost: 1000, dollars: 3000 })));
  close(targetTest(early).cashNPV, -6509, 1);
  // An analysis whose only flows come from such a line has no cash flows in the test.
  const only = { module: "water", settings: { T: 7, discountRate: 0.07 }, startYear: 0, classes: { cows: { head: 100 } }, served: { cows: {} },
    water: { monitors: 0, blocks: [] }, costs: { extra: line({ basis: "fixed", unitCost: 6000, startYear: 5, dollars: 6000 }) } };
  assert.deepEqual(validate(only), []);
  const t = targetTest(only);
  assert.deepEqual([t.pays, t.cashNPV], [null, 0]);
  assert.equal(paybackTargetLine(t), "No cash flows for you within 5 years");
  close(analyze(only).cashNPV, -6000 / 1.07 ** 5 + 6000 / 1.07 ** 7, 0.01);
});

// ---------------------------------------------------------------- what would make it pay (9.3, 9.5 item 9)

test("row 40: Synthetic Ranch D's drivers, values and cells; each value pays; the ranking and the verdict's sentence", () => {
  const p = pay(ex("ranchD"));
  assert.deepEqual(p.rows.map((x) => x.label), ["Interior fence that would otherwise be built", "Fence cost per mile",
    "Hired moving and gathering hours cut", "Subscription", "Herd size"]);
  const pinned = [
    ["Interior fence that would otherwise be built", 14.859, 14.932, "at least 14.86 mi", "at least 14.94 mi", "14.14 mi"],
    ["Fence cost per mile", 15865.63, 15943.0, "at least $15,866/mi", "at least $15,943/mi", "$15,100/mi"],
    ["Hired moving and gathering hours cut", 267.04, 272.65, "at least 268 h/yr", "at least 273 h/yr", "200 h/yr"],
    ["Subscription", 6.674, 6.646, "at most $6.67/head/month", "at most $6.64/head/month", "$7/head/month"],
    ["Herd size", 381.86, 380.34, "at most 381 cows", "at most 380 cows", "400 cows"],
  ];
  for (const [label, five, seven, cellFive, cellSeven, entered] of pinned) {
    const x = p.row(label);
    close(x.target.value, five, 0.01);
    close(x.horizon.value, seven, 0.01);
    assert.deepEqual([x.cells.target, x.cells.horizon, x.cells.entered, x.cells.notes], [cellFive, cellSeven, entered, []], label);
    assert.deepEqual([x.clippedLo, x.clippedHi], [null, null], label); // no range is clipped
    // At each unrounded value the matching cash NPV is within $1 of zero.
    close(at(p, label, x.target.value).target, 0, 1);
    close(at(p, label, x.horizon.value).horizon, 0, 1);
  }
  // Each value shown, entered as is, passes its test: 381 cows +$325, 382 cows −$53.
  close(at(p, "Herd size", 381).target, 325, 1);
  close(at(p, "Herd size", 382).target, -53, 1);
  const shown = [["Interior fence that would otherwise be built", 14.86, 14.94], ["Fence cost per mile", 15866, 15943],
    ["Hired moving and gathering hours cut", 268, 273], ["Subscription", 6.67, 6.64], ["Herd size", 381, 380]];
  for (const [label, five, seven] of shown) {
    assert.ok(at(p, label, five).target >= 0, label);
    assert.ok(at(p, label, seven).horizon >= 0, label);
  }
  // Relative changes: herd size 4.54%, subscription 4.66%, each fence driver 5.07%, hours cut 33.52%.
  const change = (x) => Math.abs(x.target.value - x.entered) / x.entered;
  assert.deepEqual(p.rows.map((x) => Math.round(change(x) * 10000) / 100), [5.07, 5.07, 33.52, 4.66, 4.54]);
  assert.deepEqual(rankDrivers(p.rows).map((x) => x.label), ["Herd size", "Subscription", "Interior fence that would otherwise be built",
    "Fence cost per mile", "Hired moving and gathering hours cut"]);
  assert.equal(p.sentence, "It would pay for itself within 5 years if: herd size at most 381 cows (you entered 400 cows), or "
    + "subscription at most $6.67/head/month (you entered $7/head/month).");
});

test("the panel's title, caption and columns (9.5 item 9)", () => {
  const p = pay(ex("ranchD"));
  assert.equal(p.panel.title, "What would make it pay");
  assert.equal(p.panel.caption, PANEL_CAPTION);
  assert.equal(PANEL_CAPTION, "Each row changes one input and keeps every other input as entered. Cash only, before tax, at your share "
    + "of each cost and saving. Values are rounded up where a row says 'at least' and down where it says 'at most'.");
  assert.deepEqual(p.panel.columns, ["Input", "You entered", "To pay for itself within 5 years", "To break even over 7 years"]);
  assert.deepEqual(p.panel.rows.map((x) => x.input), p.rows.map((x) => x.label));
});

test("row 39: Ranch A's and Ranch C's sentences, values and ranking", () => {
  const A = pay(ex("ranchA"));
  assert.equal(A.sentence, "It would pay for itself within 5 years if: subscription per monitor at most $190 per monitor per year "
    + "(you entered $365 per monitor per year), or hired labor cut at least 28 days (you entered 16 days).");
  close(A.row("Subscription per monitor").target.value, 190.68, 0.01);
  close(A.row("Hired labor cut").target.value, 27.32, 0.01);
  close(A.row("Monitor price").target.value, 301.57, 0.01);
  close(A.row("Vehicle cost per mile").target.value, 0.753, 0.001);
  // Relative changes: 47.76%, 70.76%, 79.76% and 88.31%; herd size and both blocks' shares give "none".
  const change = (label) => { const x = A.row(label); return Math.round(Math.abs(x.target.value - x.entered) / x.entered * 10000) / 100; };
  assert.deepEqual(["Subscription per monitor", "Hired labor cut", "Monitor price", "Vehicle cost per mile"].map(change), [47.76, 70.76, 79.76, 88.31]);
  for (const label of ["Herd size", "Share of runs avoided in summer", "Share of runs avoided in fall–winter"]) {
    assert.equal(A.row(label).target.state, "none", label);
  }
  // Monitor price: one expression on the 5-year test (Appendix A).
  const v = targetTest(A.a).cashNPV;
  close(A.row("Monitor price").target.value, 1490 + v / (10 * (1 - 0.5 / 1.07 ** 5)), 1e-6);
  close(A.row("Subscription per monitor").target.value, 365 + v / (10 * [0, 1, 2, 3, 4].reduce((s, t) => s + 1.07 ** -t, 0)), 1e-6);
  close(at(A, "Subscription per monitor", 190).target, 30, 1); // at $190 the 5-year test gives +$30

  const C = pay(ex("ranchC"));
  close(C.row("Net program premium").target.value, 2116.53, 0.01);
  close(C.row("Net program premium").horizon.value, 1836.0, 0.01);
  for (const label of ["Herd size", "Tag price", "Reader and scale cost", "Added hours"]) assert.equal(C.row(label).target.state, "none", label);
  assert.equal(C.sentence, "It would pay for itself within 5 years if: net program premium at least $2,117/yr (you entered $0/yr).");
  assert.equal(C.row("Net program premium").cells.entered, "$0/yr");
});

test("row 41(a): the summer share's range clipped at the low end, and the fall–winter share's not clipped", () => {
  const p = pay(ex("ranchA"));
  const summer = p.row("Share of runs avoided in summer");
  assert.deepEqual([summer.lo, summer.hi, summer.clipReasonLo, summer.clippedHi], [0, 0.5, "paidHours", null]);
  close(summer.clippedLo, 128 / 528, 1e-9);
  assert.deepEqual([summer.cells.target, summer.cells.horizon], NONE_CELLS("share of runs avoided in summer", "24.24%", "50%", 5, 10));
  assert.deepEqual(summer.cells.notes, ["Values below 24.24% are not valid with your other inputs: paid hours cut cannot be more than the hours saved."]);
  const winter = p.row("Share of runs avoided in fall–winter");
  assert.deepEqual([winter.lo, winter.hi, winter.clippedLo, winter.clippedHi, winter.cells.notes], [0, 0.5, null, null, []]);
  assert.deepEqual([winter.cells.target, winter.cells.horizon], NONE_CELLS("share of runs avoided in fall–winter", "0%", "50%", 5, 10));
  const half = at(p, "Share of runs avoided in fall–winter", 0.5);
  close(half.target, -1743, 1);
  close(half.horizon, -965, 1);
});

test("row 50(d): the summer share typed as 80% is solved at its 50% cap; the panel shows the share used", () => {
  const p = pay(ex("ranchA", (a) => (a.water.blocks[0].shareAvoided = 0.8)));
  assert.equal(p.a.water.blocks[0].shareAvoided, 0.8); // the input keeps what was typed
  close(p.r.cashNPV, -11079, 1);
  const summer = p.row("Share of runs avoided in summer");
  assert.deepEqual([summer.entered, summer.lo, summer.hi, summer.clipReasonLo, summer.clippedHi, summer.cells.entered], [0.5, 0, 0.5, "paidHours", null, "50%"]);
  close(summer.clippedLo, 128 / 528, 1e-9);
  assert.deepEqual([summer.cells.target, summer.cells.horizon], NONE_CELLS("share of runs avoided in summer", "24.24%", "50%", 5, 10));
  assert.deepEqual(summer.cells.notes, ["Values below 24.24% are not valid with your other inputs: paid hours cut cannot be more than the hours saved."]);
});

test("row 41(b) and (c): herd size gives \"none\" for Ranch C and \"all\" where no cash line depends on head", () => {
  const C = pay(ex("ranchC"));
  const herd = C.row("Herd size");
  assert.deepEqual([herd.cells.target, herd.cells.horizon], NONE_CELLS("herd size", "1", "10,000 cows", 5, 7));
  close(at(C, "Herd size", 1).target, -5652, 1);
  close(at(C, "Herd size", 10000).target, -106852, 1);
  const A = pay(ex("ranchA", (a) => { a.water.variableCostPerMile = 0.5; a.labor.cut.unitsCut = 33; }));
  const all = A.row("Herd size");
  assert.deepEqual([all.target.state, all.horizon.state], ["all", "all"]);
  assert.deepEqual([all.cells.target, all.cells.horizon], ["Pays for itself within 5 years at any herd size between 1 and 10,000 cows",
    "Breaks even or better over 10 years at any herd size between 1 and 10,000 cows"]);
});

test("row 41(d): no calves sold makes the premium n/a, and no single input makes it pay", () => {
  const p = pay(ex("ranchC", (a) => (a.classes.calvesSold.head = 0)));
  const premium = p.row("Net program premium");
  assert.deepEqual([premium.cells.target, premium.cells.horizon], ["n/a: no calves sold", "n/a: no calves sold"]);
  assert.equal(p.row("Herd size").target.state, "none");
  close(at(p, "Tag price", 0).target, -4009, 1);
  close(at(p, "Reader and scale cost", 0).target, -4616, 1);
  assert.equal(p.row("Added hours").target.state, "none"); // unpaid: no cash effect
  assert.ok(p.rows.every((x) => x.target.state !== "value"));
  assert.equal(p.sentence, "No single input in the panel makes it pay for itself within 5 years.");
});

test("row 41(g) and (h): the hired labor cut is n/a while freed time is absorbed or its pay is not entered", () => {
  const g = pay(ex("ranchA", (a) => (a.labor.freedTimeUse = "absorbed")));
  const cut = g.row("Hired labor cut");
  assert.deepEqual([cut.cells.target, cut.cells.horizon, cut.cells.notes], ["n/a: freed time is absorbed", "n/a: freed time is absorbed", []]);
  assert.ok(!rankDrivers(g.rows).some((x) => x.label === "Hired labor cut"));
  // No paid hours are cut, so the summer share is not clipped (0% to 50%).
  const summer = g.row("Share of runs avoided in summer");
  assert.deepEqual([summer.clippedLo, summer.clippedHi, summer.cells.notes], [null, null, []]);

  const h = pay(ex("ranchA", (a) => { a.labor.cut.unitsCut = 0; a.labor.cut.paidRate = null; }));
  const none = h.row("Hired labor cut");
  assert.deepEqual([none.cells.target, none.cells.horizon, none.cells.notes],
    ["n/a: pay rate, hours per unit or load not entered", "n/a: pay rate, hours per unit or load not entered", []]);
  // The same with hoursPerUnit 0 (the solver never divides by it) or the load cleared.
  for (const f of [(a) => (a.labor.cut.hoursPerUnit = 0), (a) => (a.labor.cut.loadPct = null)]) {
    const x = pay(ex("ranchA", (a) => { a.labor.cut.unitsCut = 0; f(a); })).row("Hired labor cut");
    assert.deepEqual([x.target.reason, x.horizon.reason], ["payNotEntered", "payNotEntered"]);
  }
});

test("the hours-cut driver shows the paid hours cut on an n/a row, or the units cut when they have no hours (9.3, 9.5 item 9)", () => {
  const day = (f) => pay(ex("ranchD", (a) => {
    Object.assign(a.labor.cut, { laborUnit: "day", hoursPerUnit: 8, unitsCut: 25 });
    a.labor.freedTimeUse = "absorbed";
    f?.(a);
  })).row("Hired moving and gathering hours cut");
  const absorbed = day();
  assert.deepEqual([absorbed.entered, absorbed.cells.entered, absorbed.cells.target, absorbed.cells.horizon],
    [200, "200 h/yr", "n/a: freed time is absorbed", "n/a: freed time is absorbed"]);
  // With no hours per unit there are no hours to show: the units cut in their own unit (judgment).
  for (const hoursPerUnit of [null, 0]) {
    const x = day((a) => (a.labor.cut.hoursPerUnit = hoursPerUnit));
    assert.deepEqual([x.entered, x.cells.entered, x.cells.target], [25, "25 days", "n/a: freed time is absorbed"]);
  }
  // Paid (Ranch D as loaded, in hours) it is the same number of hours.
  assert.equal(pay(ex("ranchD")).row("Hired moving and gathering hours cut").cells.entered, "200 h/yr");
});

test("row 42: the validation clip of the hired labor cut, and the vehicle cost per mile not clipped", () => {
  const p = pay(ex("ranchA"));
  const cut = p.row("Hired labor cut");
  assert.deepEqual([cut.lo, cut.hi, cut.unit, cut.clippedLo, cut.clipReasonHi], [0, 365, "days", null, "paidHours"]);
  close(cut.clippedHi, 33, 1e-9);
  assert.deepEqual(cut.cells.notes, ["Values above 33 days are not valid with your other inputs: paid hours cut cannot be more than the hours saved."]);
  close(cut.target.value, 27.32, 0.01);
  close(cut.horizon.value, 25.58, 0.01);
  assert.deepEqual([cut.cells.target, cut.cells.horizon, cut.cells.entered], ["at least 28 days", "at least 26 days", "16 days"]);
  const vehicle = p.row("Vehicle cost per mile");
  close(vehicle.target.value, 0.753, 0.001);
  close(vehicle.horizon.value, 0.699, 0.001);
  assert.deepEqual([vehicle.cells.target, vehicle.cells.horizon, vehicle.cells.entered, vehicle.cells.notes],
    ["at least $0.76/mi", "at least $0.70/mi", "$0.40/mi", []]);
  assert.deepEqual([vehicle.clippedLo, vehicle.clippedHi], [null, null]);
});

test("row 43: herd size with a per-head subscription reads \"at most\"", () => {
  const p = pay(ex("ranchB"));
  const pinned = [
    ["Herd size", 273.33, 278.04, "at most 273 yearlings", "at most 278 yearlings", "1,200 yearlings"],
    ["Subscription", 0.938, 0.969, "at most $0.93/head/month", "at most $0.96/head/month", "$7/head/month"],
    ["Hired moving and gathering hours cut", 1912.3, 1903.61, "at least 1,913 h/yr", "at least 1,904 h/yr", "200 h/yr"],
    ["Fence cost per mile", 19608.69, 19588.4, "at least $19,609/mi", "at least $19,589/mi", "$4,300/mi"],
  ];
  for (const [label, five, seven, cellFive, cellSeven, entered] of pinned) {
    const x = p.row(label);
    close(x.target.value, five, 0.01);
    close(x.horizon.value, seven, 0.01);
    assert.deepEqual([x.cells.target, x.cells.horizon, x.cells.entered], [cellFive, cellSeven, entered], label);
  }
  assert.equal(p.row("Herd size").target.direction, "at most");
  assert.equal(p.sentence, "It would pay for itself within 5 years if: herd size at most 273 yearlings (you entered 1,200 yearlings), "
    + "or subscription at most $0.93/head/month (you entered $7/head/month).");
});

test("row 45: the payback target as an input, in the line under the verdict, and in a link", () => {
  let a = ex("ranchD");
  a = setInput(a, "settings.paybackTarget", 7);
  assert.equal(a.settings.ownAnalysis, false); // the good-fit banner stays
  const p = pay(a);
  close(p.t.cashNPV, -9789, 1); // the 7-year test is the full horizon
  assert.equal(p.line, "Does not pay for itself within 7 years");
  assert.deepEqual(p.rows.map((x) => x.target), p.rows.map((x) => x.horizon)); // the panel's two columns agree
  assert.deepEqual(p.panel.rows.map((x) => x.target), p.panel.rows.map((x) => x.horizon));
  const back = readLink(writeLink(a));
  assert.equal(back.state.settings.paybackTarget, 7);
  assert.equal(paybackTargetLine(targetTest(back.state)), "Does not pay for itself within 7 years");
  for (const bad of [2.5, 0]) {
    assert.deepEqual(validate(setInput(a, "settings.paybackTarget", bad)).map((e) => e.message), ["Enter a whole number of years, 1 or more."]);
  }
  // A target of 1 year: "year" in the line, the columns, the cells and the notes (9.5 items 1 and 9).
  const one = pay(ex("ranchA", (x) => (x.settings.paybackTarget = 1)));
  assert.equal(one.line, "Does not pay for itself within 1 year");
  assert.equal(one.panel.columns[2], "To pay for itself within 1 year");
  assert.ok(one.panel.rows[0].target.endsWith("makes it pay for itself within 1 year"));
  assert.ok(one.sentence.startsWith("It would pay for itself within 1 year if: "));
});

test("the singular year: Synthetic Ranch A with T 1 and the payback target 1 (9.7 Page text, 9.5 item 1)", () => {
  const p = pay(ex("ranchA", (x) => { x.settings.T = 1; x.settings.paybackTarget = 1; }));
  close(p.r.cashNPV, -2330.12, 1);
  close(p.t.cashNPV, -2330.12, 1);
  assert.ok(verdictSentence(p.a, p.r).startsWith("Over 1 year at the example's 7% real rate"));
  assert.equal(p.line, "Does not pay for itself within 1 year");
  assert.deepEqual(p.panel.columns, ["Input", "You entered", "To pay for itself within 1 year", "To break even over 1 year"]);
  const h = p.row("Herd size").cells;
  assert.deepEqual([h.target, h.horizon], ["No herd size between 1 and 10,000 cows makes it pay for itself within 1 year",
    "No herd size between 1 and 10,000 cows makes it break even over 1 year"]);
});

test("row 46(a): free tags and head counts scale together with herd size", () => {
  const p = pay(ex("ranchC", (a) => {
    a.classes = { cows: { head: 1000 }, calvesBorn: { head: 950 }, calvesSold: { head: 800 } };
    a.eid.freeTags = { qty: 1000, years: [0, 1, 2, 3, 4, 5, 6, 7] };
  }));
  close(p.r.cashNPV, 954, 1);
  close(p.t.cashNPV, -199, 1);
  const herd = p.row("Herd size");
  close(herd.target.value, 1036.54, 0.01);
  close(herd.horizon.value, 866.62, 0.01);
  assert.deepEqual([herd.cells.target, herd.cells.horizon, herd.cells.entered], ["at least 1,037 cows", "at least 867 cows", "1,000 cows"]);
  // The set scales every head count and the free tags: at 500 cows, 475 calves born, 400 sold and 500 free tags.
  const half = moveDriver(p.a, herd.driver, 500);
  assert.deepEqual([half.classes.cows.head, half.classes.calvesBorn.head, half.classes.calvesSold.head, half.eid.freeTags.qty], [500, 475, 400, 500]);
  assert.deepEqual(p.a.eid.freeTags.qty, 1000); // the analysis itself is unchanged
  // With the free tags held at 1,000, the 7-year cash NPV would be −$6,193 at 1 cow and −$109,296 at 10,000 cows.
  const held = (v) => analyze({ ...moveDriver(p.a, herd.driver, v), eid: { ...moveDriver(p.a, herd.driver, v).eid, freeTags: p.a.eid.freeTags } }).cashNPV;
  close(held(1), -6193, 1);
  close(held(10000), -109296, 1);
});

test("row 46(b): a commitment's minimum quantity scales with herd size", () => {
  const p = pay(ex("ranchB", (a) => Object.assign(a.costs.subscription, { minQty: 6600, commitYears: 3 })));
  const herd = p.row("Herd size");
  close(herd.target.value, 273.33, 0.01);
  close(herd.horizon.value, 278.04, 0.01);
  assert.deepEqual([herd.cells.target, herd.cells.horizon], ["at most 273 yearlings", "at most 278 yearlings"]);
  assert.equal(moveDriver(p.a, herd.driver, 600).costs.subscription.minQty, 3300);
});

test("row 46(c): a per-year labor cut moves in proportion, with its label and clip", () => {
  const p = pay(ex("ranchA", (a) => (a.labor.cut.unitsCut = [0, 16, 16, 24])));
  close(p.t.cashNPV, -4627, 1);
  close(p.r.cashNPV, -4206, 1);
  const cut = p.row("Hired labor cut (year 1; other years in proportion)");
  assert.equal(cut.cells.entered, "16 days");
  close(cut.clippedHi, 22, 1e-9);
  assert.deepEqual(cut.cells.notes, ["Values above 22 days are not valid with your other inputs: paid hours cut cannot be more than the hours saved."]);
  close(cut.target.value, 21.35, 0.01);
  close(cut.horizon.value, 18.65, 0.01);
  assert.deepEqual([cut.cells.target, cut.cells.horizon], ["at least 22 days", "at least 19 days"]);
  assert.deepEqual(moveDriver(p.a, cut.driver, 22).labor.cut.unitsCut, [0, 22, 22, 33]);
  close(at(p, "Hired labor cut (year 1; other years in proportion)", 22).target, 559, 1);
  // An array whose entries are all equal is treated like a single number, with no suffix.
  assert.ok(pay(ex("ranchA", (a) => (a.labor.cut.unitsCut = [16, 16]))).rows.some((x) => x.label === "Hired labor cut"));
  // Every entry 0: a trial sets every entry to the value.
  const zero = pay(ex("ranchA", (a) => (a.labor.cut.unitsCut = [0, 0, 0])));
  assert.deepEqual(moveDriver(zero.a, zero.row("Hired labor cut").driver, 20).labor.cut.unitsCut, [20, 20, 20]);
});

test("a late start: Ranch C starting in year 2 reads its herd, premium and added hours in year 3 (9.7)", () => {
  const p = pay(ex("ranchC", (a) => (a.startYear = 2)));
  assert.ok(p.rows.every((x) => x.target.state !== "n/a" && x.horizon.state !== "n/a"));
  assert.deepEqual([p.row("Herd size").entered, p.row("Net program premium").entered], [300, 0]);
  const hours = p.row("Added hours");
  close(hours.entered, 29.75, 1e-9);
  assert.deepEqual([hours.cells.entered, hours.target.state, hours.horizon.state], ["30 h/yr", "none", "none"]);
});

// ---------------------------------------------------------------- the drivers (9.2, 9.3 table)

test("PAYBACK_DRIVERS: the table's order, labels, units and ranges by module", () => {
  const drivers = (a) => PAYBACK_DRIVERS(a).map((d) => [d.label, d.unit, d.lo, d.hi]);
  assert.deepEqual(drivers(ex("ranchA")), [
    ["Share of runs avoided in summer", "%", 0, 0.5], ["Share of runs avoided in fall–winter", "%", 0, 0.5],
    ["Vehicle cost per mile", "$/mi", 0, 5], ["Hired labor cut", "days", 0, 365], ["Monitor price", "$ per monitor", 0, 10000],
    ["Subscription per monitor", "$ per monitor per year", 0, 5000], ["Herd size", "cows", 1, 10000]]);
  assert.deepEqual(drivers(ex("ranchB")), [["Interior fence that would otherwise be built", "mi", 0, 200], ["Fence cost per mile", "$/mi", 0, 50000],
    ["Hired moving and gathering hours cut", "h/yr", 0, 10000], ["Subscription", "$/head/month", 0, 20], ["Herd size", "yearlings", 1, 10000]]);
  assert.deepEqual(drivers(ex("ranchC")), [["Herd size", "cows", 1, 10000], ["Net program premium", "$/yr", 0, 100000],
    ["Tag price", "$/tag", 0, 20], ["Reader and scale cost", "$", 0, 50000], ["Added hours", "h/yr", 0, 2000]]);
  // Purchased collars: the service fee in place of the subscription.
  const bought = ex("ranchB", (a) => {
    a.vf.pricing = "purchased";
    a.costs.collars = { unitCost: 300, lifeYears: 5 };
    a.costs.serviceFee = { unitCost: 50 };
  });
  assert.deepEqual(drivers(bought)[3], ["Service fee", "$ per collar per year", 0, 1000]);
  // The hired-labor driver's unit and top by labor unit.
  for (const [unit, name, hi] of [["hour", "hours", 10000], ["week", "weeks", 52], ["position", "positions", 10]]) {
    const a = example("ranchA");
    a.labor.cut.laborUnit = unit;
    assert.deepEqual(PAYBACK_DRIVERS(a)[3].unit === name && PAYBACK_DRIVERS(a)[3].hi, hi);
  }
});

test("PAYBACK_DRIVERS leaves out a driver whose input has nothing to act on (9.3)", () => {
  const ids = (a) => PAYBACK_DRIVERS(a).map((d) => d.id);
  assert.deepEqual(ids(example("ranchA")), ["share:0", "share:1", "vehicle", "laborCut", "monitors", "subscription", "herd"]);
  const a = example("ranchA");
  delete a.costs.monitors;
  delete a.costs.subscription;
  a.water.blocks[1].weeks = 0; // a block with no runs
  delete a.labor.cut;
  assert.deepEqual(ids(a), ["share:0", "vehicle", "herd"]);
  a.water.blocks = [];
  assert.deepEqual(ids(a), ["herd"]);
  const b = example("ranchB");
  delete b.vf.fence;
  delete b.vf.pricing;
  assert.deepEqual(ids(b), ["hoursCut", "herd"]);
  const c = example("ranchC");
  for (const id of ["cowTags", "calfTags", "retags", "reader", "indicatorBars", "platform"]) delete c.costs[id];
  assert.deepEqual(ids(c), ["herd", "premium", "addedHours"]); // herd size, the premium and added hours are always returned
  // The version 1 lines have no driver.
  for (const hash of ["#preset=Remote+water+monitoring&head=500&years=5", "#preset=Collar-based+virtual+fencing&head=500&years=5", "#preset=EID+tags+and+scale"]) {
    const v1 = readLink(hash).state;
    assert.ok(!PAYBACK_DRIVERS(v1).some((d) => /^costs\.v1/.test(d.path)), hash);
    assert.deepEqual(validate(v1), []);
    solveDrivers(v1); // runs without throwing
  }
});

test("n/a drivers: no head, no reader or scale cost, no added hours (9.3, 9.5 item 9)", () => {
  const herd = pay(ex("ranchA", (a) => (a.classes.cows.head = 0))).row("Herd size");
  assert.deepEqual([herd.cells.target, herd.cells.horizon], ["n/a: no head entered", "n/a: no head entered"]);
  const reader = pay(ex("ranchC", (a) => ["reader", "indicatorBars", "platform"].forEach((id) => (a.costs[id].unitCost = 0)))).row("Reader and scale cost");
  assert.deepEqual([reader.cells.target, reader.cells.horizon], ["n/a: no reader or scale cost entered", "n/a: no reader or scale cost entered"]);
  const hours = pay(ex("ranchC", (a) => { delete a.labor.handling; a.labor.added = []; })).row("Added hours");
  assert.deepEqual([hours.cells.target, hours.cells.horizon], ["n/a: no added hours entered", "n/a: no added hours entered"]);
});

test("the linked drivers' sets: fence miles with the plan, hours cut with the hours, the premium, reader and scale, added hours (9.3)", () => {
  // Fence miles: a plan below the miles keeps its ratio, so the trial at the entered value reproduces the clamp.
  const clamped = ex("ranchB", (a) => (a.vf.fence.planMiles = 6));
  const miles = PAYBACK_DRIVERS(clamped)[0];
  const moved = moveDriver(clamped, miles, 16);
  assert.deepEqual([moved.vf.fence.miles, moved.vf.fence.planMiles], [16, 12]);
  close(analyze(moveDriver(clamped, miles, 8)).cashNPV, analyze(clamped).cashNPV, 1e-6);
  // A plan at or above the miles is raised to cover them; a blank plan stays blank.
  const raised = moveDriver(example("ranchB"), miles, 10).vf.fence;
  assert.deepEqual([raised.miles, raised.planMiles], [10, 10]);
  assert.equal(moveDriver(example("ranchB"), miles, 5).vf.fence.planMiles, 8);
  assert.equal(moveDriver(example("ranchD"), PAYBACK_DRIVERS(example("ranchD"))[0], 20).vf.fence.planMiles, undefined);
  // Hours cut: units cut and the hours cut move together.
  const b = example("ranchB");
  const hoursCut = moveDriver(b, PAYBACK_DRIVERS(b)[2], 500);
  assert.deepEqual([hoursCut.labor.cut.unitsCut, hoursCut.vf.gatherHoursCut], [500, 500]);
  // The premium: one premium per cwt on 1 cwt, the net premium at the head in program.
  const c = example("ranchC");
  const premium = moveDriver(c, PAYBACK_DRIVERS(c)[1], 2400);
  assert.deepEqual(premium.eid.premium, { saleCwt: 1, premiumPerCwt: 10, verificationFee: 0 });
  close(analyze(premium).lines.find((l) => l.id === "premium").series[1], 2400, 1e-9);
  // Reader and scale: each price in proportion. Added hours: each handling time input and added item's hours.
  const half = moveDriver(c, PAYBACK_DRIVERS(c)[3], 4549 / 2);
  assert.deepEqual(["reader", "indicatorBars", "platform"].map((id) => half.costs[id].unitCost), [959.5, 915, 400]);
  const double = moveDriver(c, PAYBACK_DRIVERS(c)[4], 59.5);
  close(double.labor.handling.events[0].minutesPerHead, 40 / 60, 1e-12);
  assert.equal(double.labor.added[0].hours, 30);
});

test("a residual clip, and a price left blank: \"Quote required\", solved like any other and never named (9.3, 9.5 item 9)", () => {
  // Monitors with a $5,000 residual: below $500 a monitor, the residual is more than the purchase.
  const p = pay(ex("ranchA", (a) => (a.costs.monitors.residual = { mode: "amount", dollars: 5000 })));
  const price = p.row("Monitor price");
  assert.equal(price.clipReasonLo, "residual");
  close(price.clippedLo, 500, 1e-6);
  assert.deepEqual(price.cells.notes, ["Values below $500 per monitor are not valid with your other inputs: a residual cannot be more than the cost of the purchase."]);
  // Ranch C's tag price cleared: "Quote required", its range not widened, "none" at every price, and never named.
  const q = pay(ex("ranchC", (a) => (a.eid.tagPrice = null)));
  const tags = q.row("Tag price");
  assert.deepEqual([tags.cells.entered, tags.blank, tags.lo, tags.hi, tags.target.state], ["Quote required", true, 0, 20, "none"]);
  assert.ok(!rankDrivers(q.rows).includes(q.rows.find((x) => x.label === "Tag price")));
  // A blank non-price driver: "Left blank".
  assert.equal(pay(ex("ranchA", (a) => (a.water.variableCostPerMile = null))).row("Vehicle cost per mile").cells.entered, "Left blank");
});

test("the \"It would pay\" sentence names a driver left blank with \"(left blank)\" (9.5 item 1, 9.7 Page text)", () => {
  assert.equal(pay(ex("ranchA", (a) => (a.water.variableCostPerMile = null))).sentence,
    "It would pay for itself within 5 years if: vehicle cost per mile at least $0.76/mi (left blank).");
  // A fixture: an entered driver ranked first, the blank one second.
  const row = (x) => ({ lo: 0, clippedLo: null, clippedHi: null, clipReasonLo: null, clipReasonHi: null, price: false,
    horizon: { state: "none", value: null, direction: null, reason: null }, ...x });
  const rows = [
    row({ id: "herd", label: "Herd size", unit: "cows", entered: 400, blank: false, hi: 10000,
      target: { state: "value", value: 381.86, direction: "at most", reason: null } }),
    row({ id: "vehicle", label: "Vehicle cost per mile", unit: "$/mi", entered: null, blank: true, hi: 5,
      target: { state: "value", value: 0.755, direction: "at least", reason: null } }),
  ];
  assert.equal(wouldPaySentence({ years: 5, pays: false, cashNPV: -1, warnings: [] }, rows),
    "It would pay for itself within 5 years if: herd size at most 381 cows (you entered 400 cows), or vehicle cost per mile at least $0.76/mi (left blank).");
});

test("the ranking: smallest relative change first; entered as 0 or left blank after the others; ties in order (9.3)", () => {
  const row = (label, entered, value, more = {}) => ({ label, entered, blank: entered === null, price: false, target: { state: "value", value }, ...more });
  const rows = [row("a", 10, 12), row("b", 0, 5), row("c", 10, 8), row("d", null, 3), row("e", 100, 120),
    row("f", 10, 11, { target: { state: "none", value: null } }), row("g", null, 1, { price: true })];
  assert.deepEqual(rankDrivers(rows).map((x) => x.label), ["a", "c", "e", "b", "d"]);
});

test("the ranking: drivers that tie in exact arithmetic keep the table order, whatever their searches' round-off (9.3)", () => {
  // Fence miles and fence cost per mile always tie (the fence stream is miles × cost per mile).
  const b = pay(ex("ranchB", (a) => Object.assign(a.vf.fence, { F: 15100, miles: 10, planMiles: 10 })));
  assert.deepEqual(rankDrivers(b.rows).map((x) => x.label).slice(0, 3), ["Herd size", "Interior fence that would otherwise be built", "Fence cost per mile"]);
  assert.equal(b.sentence, "It would pay for itself within 5 years if: herd size at most 1,155 yearlings (you entered 1,200 yearlings), or "
    + "interior fence that would otherwise be built at least 10.39 mi (you entered 10 mi).");
  // Subscription and herd size tie when the per-head subscription is the only head-based cash line.
  const d = pay(ex("ranchD", (a) => { a.labor.handling.doneBy = "unpaid"; a.costs.subscription.unitCost = 9; }));
  assert.deepEqual(rankDrivers(d.rows).map((x) => x.label).slice(0, 2), ["Subscription", "Herd size"]);
  assert.equal(d.sentence, "It would pay for itself within 5 years if: subscription at most $7.19/head/month (you entered $9/head/month), or "
    + "herd size at most 319 cows (you entered 400 cows).");
});

test("display rounding: \"at least\" up and \"at most\" down, unrounded when that would leave the clipped range (9.5 item 9)", () => {
  const t = { years: 5, pays: false, cashNPV: -1, warnings: [] };
  const base = { id: "x", path: "x", blank: false, price: false, lo: 0, hi: 100000, clippedLo: null, clippedHi: null, clipReasonLo: null, clipReasonHi: null,
    horizon: { state: "none", value: null, direction: null, reason: null } };
  const cell = (row) => paybackPanel(example("ranchA"), { T: 10 }, t, [{ ...base, ...row }]).rows[0];
  const value = (v, direction) => ({ state: "value", value: v, direction, reason: null });
  assert.equal(cell({ label: "Hired labor cut", unit: "days", entered: 16, target: value(27.32, "at least") }).target, "at least 28 days");
  assert.equal(cell({ label: "Herd size", unit: "cows", entered: 400, target: value(381.86, "at most") }).target, "at most 381 cows");
  assert.equal(cell({ label: "Herd size", unit: "cows", entered: 400, target: value(1.4, "at most") }).target, "at most 1 cow");
  assert.equal(cell({ label: "Fee", unit: "$/yr", entered: 400, target: value(99.996, "at least") }).target, "at least $100/yr");
  assert.equal(cell({ label: "Fee", unit: "$/yr", entered: 400, target: value(150.2, "at most") }).target, "at most $150/yr");
  assert.equal(cell({ label: "Share", unit: "%", entered: 0.5, target: value(0.24241, "at least") }).target, "at least 24.25%");
  // Rounded up past a clipped top of 21.5 days: shown unrounded, to two decimals.
  assert.equal(cell({ label: "Cut", unit: "days", entered: 16, clippedHi: 21.5, clipReasonHi: "paidHours", target: value(21.35, "at least") }).target,
    "at least 21.35 days");
  assert.equal(cell({ label: "Cost", unit: "$/mi", entered: 15100, clippedHi: 15865.9, clipReasonHi: "residual", target: value(15865.63, "at least") }).target,
    "at least $15,865.63/mi");
});

test("setPath sets one value without changing the analysis it is given (9.5 item 6)", () => {
  const a = example("ranchA");
  const before = structuredClone(a);
  const b = setPath(a, "water.blocks.0.shareAvoided", 0.3);
  assert.equal(b.water.blocks[0].shareAvoided, 0.3);
  assert.deepEqual(a, before);
  assert.equal(b.water.blocks[1], a.water.blocks[1]); // the rest is shared
  const c = setPath({}, "labor.added.1.hours", 4);
  assert.deepEqual([c.labor.added.length, c.labor.added[1]], [2, { hours: 4 }]);
});

test("solveDrivers and targetTest never give NaN, and each value pays its test, on every example and column", () => {
  const cases = [...["ranchA", "ranchB", "ranchC", "ranchD"].map((id) => ex(id)),
    ...Object.entries(COLUMNS).flatMap(([id, cols]) => Object.keys(cols).map((k) => column(id, k)))];
  for (const a of cases) {
    const p = pay(a);
    assert.ok(Number.isFinite(p.t.cashNPV));
    for (const x of p.rows) {
      for (const c of ["target", "horizon"]) {
        if (x[c].state !== "value") continue;
        assert.ok(Number.isFinite(x[c].value));
        const npv = at(p, x.label, x[c].value)[c];
        assert.ok(npv >= 0 && npv < 1, `${a.example} ${x.label} ${c}: ${npv}`);
      }
    }
    for (const r of p.panel.rows) assert.ok(![r.entered, r.target, r.horizon, ...r.notes].some((s) => /NaN|undefined|Infinity/.test(s)), JSON.stringify(r));
  }
});
