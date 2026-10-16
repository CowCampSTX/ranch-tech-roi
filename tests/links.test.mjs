// Tests of links.js, the shared links (docs/audit/phase1-spec.md 9.5 item 8, B8): writing and reading a version 2
// link, converting a version 1 link (migrateV1), and the link banners of 9.5 item 11. 10.1 rows 15, 28 (the link
// case), 29, 30 and 51, the link parts of rows 36 and 45, and the 9.7 "Links" cases.
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyze, validate, YEARS_MESSAGE, MAX_YEARS_MESSAGE, HORIZON_NOTE } from "../roi.js";
import { example, EXAMPLE_IDS, valuePaths } from "../examples.js";
import { setInput, removeItem, keepRate, keepValue, useVendorPrice, analyzeMine, getAt } from "../state.js";
import { readLink, writeLink, migrateV1, toBase64url, fromBase64url } from "../links.js";
import { linkBanner, verdictNotes, priceLabel, UNREADABLE_LINK } from "../text.js";

const close = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);
const cash = (a) => {
  assert.deepEqual(validate(a), []);
  return analyze(a).cashNPV;
};
/** The s parameter of a link, decoded. */
const sOf = (hash) => {
  const s = new URLSearchParams(hash).get("s");
  return s === null ? null : JSON.parse(fromBase64url(s));
};
const link = (x, s) => `v=2&m=${example(x).module}&x=${x}&s=${toBase64url(JSON.stringify(s))}`;
/** state → link → state. */
const roundTrip = (a) => {
  const r = readLink(`#${writeLink(a)}`);
  assert.equal(r.kind, "v2");
  assert.deepEqual(r.corrected, []);
  return r.state;
};

const V1_BANNER_START = "This link was made with an earlier version of the calculator and has been converted.";
const V1_BANNER_END = "The discount rate is now a real rate (net of expected inflation). Review it for your operation. "
  + "The subscription is now billed at the start of each year instead of at year end. Check whether your quote is per "
  + "device rather than per head. Confirm the operation type (set to cow-calf) and the land units (taken from ";

// ---------------------------------------------------------------- encoding

test("s is base64url of UTF-8 JSON: URL-safe, no padding, and an en dash survives (9.5 item 8)", () => {
  for (const text of ["", "a", "ab", "abc", "fall–winter", "{\"name\":\"fall–winter\"}", "ü€𝄞", "?>?>?>"]) {
    const s = toBase64url(text);
    assert.match(s, /^[A-Za-z0-9_-]*$/);
    assert.equal(fromBase64url(s), text);
  }
  assert.equal(toBase64url("?>?>"), "Pz4_Pg"); // "+" and "/" in standard base64 ("Pz4/Pg==") become "-" and "_"
  for (const bad of ["a", "ab=c", "ab+c", "a b", "/w"]) assert.throws(() => fromBase64url(bad));
  assert.throws(() => fromBase64url("_w")); // the byte 0xFF: not valid UTF-8
});

// ---------------------------------------------------------------- reading: the cases of 9.5 item 8

test("an empty hash is not a link: Synthetic Ranch A, no link banner", () => {
  for (const hash of ["", "#", undefined, null]) {
    const r = readLink(hash);
    assert.equal(r.kind, "none");
    assert.deepEqual(r.state, example("ranchA"));
    assert.equal(linkBanner(r), null);
  }
});

test("a v=2 hash without s loads the example unchanged; an example's own link has no s", () => {
  for (const x of EXAMPLE_IDS) {
    const a = example(x);
    assert.equal(writeLink(a), `v=2&m=${a.module}&x=${x}`);
    const r = readLink(`#v=2&m=${a.module}&x=${x}`);
    assert.equal(r.kind, "v2");
    assert.deepEqual(r.state, a);
    assert.equal(linkBanner(r), null);
  }
});

test("unreadable links open Synthetic Ranch A with the banner that says so (9.5 items 8 and 11)", () => {
  const good = writeLink(setInput(example("ranchB"), "vf.fence.miles", 6));
  const cases = [
    good.replace("v=2", "v=1"), good.replace("v=2", "v=3"), good.replace("v=2", "v="), good.replace("v=2&", "v=2.0&"),
    good.replace("&x=ranchB", ""), good.replace("x=ranchB", "x=ranchE"), good.replace("x=ranchB", "x="),
    good.replace("x=ranchB", "x=toString"), good.replace("x=ranchB", "x=__proto__"),
    good.replace("m=vf", "m=water"), good.replace("m=vf&", ""), good.replace("m=vf", "m=VF"),
    good.replace(/s=[^&]*/, "s=%%%"), good.replace(/s=[^&]*/, "s=not+base64"), good.replace(/s=[^&]*/, "s=a"),
    good.slice(0, -3), // a cut-off link
    `v=2&m=vf&x=ranchB&s=${toBase64url("not json")}`,
  ];
  for (const s of [[], "text", 5, null, true, { settings: 5 }, { settings: [] }, { prov: [] }, { prov: "x" },
    { prov: { "costs.subscription.unitCost": "x" } }, { classes: { cows: { head: "500" } } }, { vf: { fence: { miles: "8" } } },
    { costs: { subscription: { unitCost: true } } }, { ramp: [1, "half", 1, 1] },
    { vf: { ...example("ranchB").vf, fence: { ...example("ranchB").vf.fence, F: {} } } }, // computes NaN
    { classes: { yearlings: { head: [1200, null, "x"] } } }]) {
    cases.push(`v=2&m=vf&x=ranchB&s=${toBase64url(JSON.stringify(s))}`);
  }
  for (const hash of cases) {
    const r = readLink(`#${hash}`);
    assert.equal(r.kind, "unreadable", hash);
    assert.deepEqual(r.state, example("ranchA"));
    assert.equal(linkBanner(r), UNREADABLE_LINK);
  }
  assert.equal(UNREADABLE_LINK, "This link could not be read, so the page opened on Synthetic Ranch A.");
});

test("a hand-made v2 link whose values have another shape than the data model's is unreadable (9.2, judgment)", () => {
  const A = example("ranchA");
  const cases = {
    "a rate in a list": { settings: { ...A.settings, discountRate: [0.07] } },
    "a ramp entry in a list": { ramp: [1, [2], 1, 1] },
    "a ramp that is not a list": { ramp: 0.5 },
    "a head count in an object": { classes: { cows: { head: { a: 900 } } } },
    "a class that is not one": { classes: { goats: { head: 9 } } },
    "a timing not listed": { costs: { ...A.costs, monitors: { ...A.costs.monitors, timing: "foo" } } },
    "a billing not listed": { costs: { ...A.costs, subscription: { ...A.costs.subscription, billing: "foo" } } },
    "a cost line that is null": { costs: { ...A.costs, monitors: null } },
    "a season block that is null": { water: { ...A.water, blocks: [null] } },
    "an object that is null": { labor: { ...A.labor, cut: null } },
    "a key the data model does not have": { water: { ...A.water, monitorz: 3 } },
    "a [C] record without its source and date": { prov: { "costs.monitors.unitCost": { cls: "C" } } },
    "a record without its class": { prov: { "costs.monitors.unitCost": { src: "x" } } },
    "a record's class not listed": { prov: { "costs.monitors.unitCost": { cls: "F", src: "x" } } },
  };
  // With a validation error too, so that no analysis would run to catch them (9.5 item 7).
  for (const [what, s] of Object.entries(cases)) {
    for (const t of [{}, { settings: { ...A.settings, T: 2.5, ...s.settings } }]) {
      const r = readLink(link("ranchA", { ...s, ...t }));
      assert.equal(r.kind, "unreadable", what);
    }
  }
  assert.equal(readLink(`v=2&m=water&x=ranchA&s=${toBase64url('{"costs":{"__proto__":{"unitCost":1}}}')}`).kind, "unreadable");
  // A blank fits a number, a text, a choice, a list of classes or a share: a cleared ramp entry, class list or share loads.
  for (const s of [{ ramp: [1, null, 1, 1] }, { costs: { ...A.costs, subscription: { ...A.costs.subscription, classes: null, billing: null } } },
    { benefitShares: { vehicle: null, laborCut: { u1: null } } }, { classes: { cows: { head: [null, 300] } } }]) {
    assert.equal(readLink(link("ranchA", s)).kind, "v2", JSON.stringify(s));
  }
});

test("a hand-made v2 link loads only a state that computes once its errors are fixed, with ids and lists the page writes (judgment)", () => {
  const A = example("ranchA");
  const T0 = { ...A.settings, T: 0 }; // a validation error, so no analysis runs while reading (9.5 item 7)
  const two = (id) => [{ id: "u1", kind: "owned", share: 0.5 }, { id, kind: "owned", share: 0.5 }];
  const fixed = (i) => ({ label: `extra ${i}`, timing: "annual", basis: "fixed", unitCost: 10 });
  const cases = {
    "settings without a discount rate": { settings: { T: 60 } },
    "a cost line without a basis": { settings: T0, costs: { ...A.costs, extra: { label: "x", timing: "capital", unitCost: 100 } } },
    "a cost line whose basis is blank": { settings: T0, costs: { ...A.costs, mounting: { ...A.costs.mounting, basis: null } } },
    "a cost line without a timing": { settings: T0, costs: { ...A.costs, extra: { label: "x", basis: "fixed", unitCost: 100 } } },
    "a land unit named like a built-in member": {
      settings: { ...T0, landUnits: [{ id: "toString", kind: "owned", share: 1 }] },
      costs: { ...A.costs, monitors: { ...A.costs.monitors, operatorShare: {} } },
    },
    "a cost line named toString": { costs: { ...A.costs, toString: fixed(1) } },
    "a cost line named constructor": { costs: { ...A.costs, constructor: fixed(1) } },
    "a share keyed by hasOwnProperty": { benefitShares: { vehicle: { hasOwnProperty: 1 } } },
    "a land-unit id with a bracket": { settings: { ...A.settings, landUnits: two("u(") } },
    "a land-unit id with a dot": { settings: { ...A.settings, landUnits: two("u.2") } },
    "52 land units": { settings: { ...A.settings, landUnits: Array.from({ length: 52 }, (_, i) => ({ id: `u${i + 1}`, kind: "owned", share: i ? 0 : 1 })) } },
    "52 cost lines": { costs: Object.fromEntries(Array.from({ length: 52 }, (_, i) => [`x${i}`, fixed(i)])) },
    "52 risk lines": { riskLines: Array.from({ length: 52 }, (_, i) => ({ cause: `c${i}`, class: "cows", eventsPerYear: 1, headPerEvent: 1 })) },
    "52 ramp entries": { ramp: Array(52).fill(1) },
  };
  for (const [what, s] of Object.entries(cases)) assert.equal(readLink(link("ranchA", s)).kind, "unreadable", what);
  // Their sound versions load: ids of letters, digits, "-" and "_", and 51 of each list (a value for each year of the
  // longest horizon).
  const sound = [
    { settings: { ...A.settings, landUnits: two("u-2_b") } },
    { settings: { ...A.settings, landUnits: Array.from({ length: 51 }, (_, i) => ({ id: `u${i + 1}`, kind: "owned", share: i ? 0 : 1 })) } },
    { costs: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`x${i}`, fixed(i)])) },
    { settings: { ...A.settings, T: 50 }, ramp: Array(51).fill(1) },
  ];
  for (const s of sound) assert.equal(readLink(link("ranchA", s)).kind, "v2", JSON.stringify(s).slice(0, 80));
});

test("round trip: each value of each example, typed, cleared or kept, comes back unchanged (9.7 Links)", () => {
  const choices = /(\.|^)(opType|kind|freedTimeUse|laborUnit|doneBy|timing|basis|billing|mode|pricing|classes|class)$/;
  for (const x of EXAMPLE_IDS) {
    const a = example(x);
    for (const p of valuePaths(a)) {
      const v = getAt(a, p);
      const values = typeof v === "boolean" ? [!v] : choices.test(p) ? [] : [null, typeof v === "string" ? `${v}2` : Array.isArray(v) ? v.map((y) => y + 1) : v * 1.1 + 1];
      for (const nv of values) {
        const b = setInput(a, p, nv);
        assert.deepEqual(roundTrip(b), b, `${x} ${p} = ${nv}`);
      }
      assert.deepEqual(roundTrip(keepValue(a, p)), keepValue(a, p), `${x} keep ${p}`);
    }
  }
});

test("no hash ever makes readLink throw: a sweep of malformed and random hashes", () => {
  // A null cost line with no T (the horizon prefill reads the cost lines), and a head count nested 5,000 deep.
  for (const s of ['{"settings":{},"costs":{"monitors":null}}', `{"classes":{"cows":{"head":${"[".repeat(5000)}1${"]".repeat(5000)}}}}`]) {
    assert.equal(readLink(`#v=2&m=water&x=ranchA&s=${toBase64url(s)}`).kind, "unreadable");
  }
  // A small deterministic generator (no Math.random), so a failure can be reproduced.
  let seed = 12345;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const pick = (xs) => xs[Math.floor(next() * xs.length)];
  const parts = ["v=2", "v=1", "m=vf", "m=water", "m=eid", "x=ranchA", "x=ranchB", "x=ranchC", "x=ranchD", "preset=EID+tags+and+scale",
    "head=-5", "years=2.5", "s=", "s=e30", `s=${toBase64url("{\"vf\":null}")}`, `s=${toBase64url("{\"settings\":{}}")}`,
    `s=${toBase64url("{\"costs\":null,\"labor\":null}")}`, "%", "&&", "=", "fixedCost=Infinity", "discountRate=1e400"];
  for (let i = 0; i < 400; i++) {
    const hash = "#" + Array.from({ length: 1 + Math.floor(next() * 5) }, () => pick(parts)).join("&");
    const r = readLink(hash);
    assert.ok(["none", "v1", "v2", "unreadable"].includes(r.kind), hash);
    assert.equal(typeof (linkBanner(r) ?? ""), "string");
  }
});

test("a v2 state that drops whole blocks still computes, or is unreadable, never a throw", () => {
  for (const x of EXAMPLE_IDS) {
    const a = example(x);
    for (const k of Object.keys(a).filter((k) => !["module", "example"].includes(k))) {
      const r = readLink(link(x, { [k]: null }));
      assert.ok(["v2", "unreadable"].includes(r.kind), `${x} without ${k}`);
      if (r.kind === "v2" && k !== "settings" && !validate(r.state).length) assert.ok(Number.isFinite(analyze(r.state).cashNPV));
    }
  }
});

// ---------------------------------------------------------------- round trips (9.7 Links)

test("round trip: a state changed in each way the page allows comes back unchanged", () => {
  // Two land units, a split operator share, a typed quote equal to its published price and a reviewed rate.
  let a = example("ranchA");
  a.settings.landUnits = [{ id: "u1", kind: "owned", share: 0.6 }, { id: "u2", kind: "leased", share: 0.4, leaseYears: 3 }];
  a = setInput(a, "costs.subscription.operatorShare.u2", 0.5);
  a = setInput(a, "costs.monitors.unitCost", 1490); // the published price, typed: [D] "your quote"
  a = keepRate(a);
  const back = roundTrip(a);
  assert.deepEqual(back, a);
  assert.equal(back.prov["costs.monitors.unitCost"].cls, "D");
  assert.equal(priceLabel(back.prov["costs.monitors.unitCost"]), "your quote");
  assert.equal(back.settings.rateReviewed, true);
  close(cash(back), cash(a), 1e-9);

  // A cleared price and a cleared placeholder: blank, with no record.
  let b = analyzeMine(example("ranchA"));
  b = setInput(setInput(b, "costs.monitors.unitCost", null), "costs.mounting.unitCost", null);
  const backB = roundTrip(b);
  assert.deepEqual(backB, b);
  assert.equal(backB.costs.monitors.unitCost, null);
  assert.equal(backB.prov["costs.mounting.unitCost"], undefined);
  assert.equal(sOf(writeLink(b)).prov["costs.mounting.unitCost"], null);

  // The fall–winter block's share at 50%: its name has an en dash, so the link must encode UTF-8.
  const c = setInput(example("ranchA"), "water.blocks.1.shareAvoided", 0.5);
  const backC = roundTrip(c);
  assert.deepEqual(backC, c);
  assert.equal(backC.water.blocks[1].name, "fall–winter");
  close(cash(backC), -965);

  // The summer block removed and the labor cut set to 0: the fall–winter block's records move to index 0 (9.2).
  const d = setInput(removeItem(example("ranchA"), "water.blocks", 0), "labor.cut.unitsCut", 0);
  assert.equal(d.water.blocks.length, 1);
  assert.equal(d.prov["water.blocks.0.name"], undefined);
  assert.deepEqual(d.prov["water.blocks.0.shareAvoided"], example("ranchA").prov["water.blocks.1.shareAvoided"]);
  const backD = roundTrip(d);
  assert.deepEqual(backD, d);
  close(cash(backD), cash(d), 1e-9);

  // A vendor fill, a removed handling event and the EID rule answered yes (row 36: the answer is kept in the link).
  let e = useVendorPrice(setInput(example("ranchC"), "eid.tagPrice", 3), "eid.tagPrice");
  e = setInput(removeItem(e, "labor.handling.events", 0), "eid.ruleApplies.cows", true);
  const backE = roundTrip(e);
  assert.deepEqual(backE, e);
  assert.equal(backE.eid.ruleApplies.cows, true);
  assert.equal(backE.prov["eid.tagPrice"].cls, "C");
  close(cash(backE), cash(e), 1e-9);
});

test("round trip: every version 1 snapshot's migrated state comes back unchanged, with the same cash NPV", () => {
  for (const { hash } of SNAPSHOTS) {
    const migrated = readLink(hash).state;
    const back = roundTrip(migrated);
    assert.deepEqual(back, migrated, hash);
    close(cash(back), cash(migrated), 1e-9);
  }
  // The virtual fence one comes back with no vf key: the link writes it as null and reading deletes it.
  const vf = readLink("#preset=Collar-based+virtual+fencing").state;
  assert.equal("vf" in vf, false);
  assert.equal(sOf(writeLink(vf)).vf, null);
  assert.equal("vf" in roundTrip(vf), false);
});

test("a link carries only what differs from the example, each key whole, and prov by path", () => {
  const a = setInput(example("ranchB"), "vf.fence.miles", 6);
  const s = sOf(writeLink(a));
  assert.deepEqual(Object.keys(s).sort(), ["prov", "settings", "vf"]); // settings: ownAnalysis is now true
  assert.deepEqual(s.vf, a.vf);
  assert.deepEqual(s.prov, { "vf.fence.miles": { cls: "D", src: "your entry" } });
  assert.equal("paybackTarget" in s.settings, false);
  // A removal: a list is carried whole, so a removed item stays removed.
  const b = removeItem(example("ranchD"), "labor.handling.events", 0);
  assert.deepEqual(b.labor.handling.events, []);
  assert.deepEqual(sOf(writeLink(b)).labor.handling.events, b.labor.handling.events);
  assert.deepEqual(roundTrip(b), b);
});

// ---------------------------------------------------------------- the payback target in a link (row 45)

test("row 45: a payback target of 7 rides in s.settings and opens as 7; at 5 the link carries none", () => {
  const d = setInput(example("ranchD"), "settings.paybackTarget", 7);
  assert.equal(d.settings.ownAnalysis, false); // the good-fit banner stays
  const s = sOf(writeLink(d));
  assert.equal(s.settings.paybackTarget, 7);
  const back = roundTrip(d);
  assert.equal(back.settings.paybackTarget, 7);
  assert.equal(back.settings.ownAnalysis, false);
  assert.deepEqual(back, d);
  // Back at 5 (a typed 5 keeps its record): settings carry no paybackTarget, and the link reads as 5.
  const five = setInput(d, "settings.paybackTarget", 5);
  const s5 = sOf(writeLink(five));
  assert.equal(s5.settings, undefined); // settings equal the example's again
  assert.deepEqual(s5.prov["settings.paybackTarget"], { cls: "D", src: "your entry" });
  assert.equal(roundTrip(five).settings.paybackTarget, 5);
  // A state changed elsewhere at the default target: settings are carried whole, without paybackTarget.
  const own = setInput(example("ranchD"), "vf.gatherHoursCut", 250);
  assert.equal("paybackTarget" in sOf(writeLink(own)).settings, false);
  assert.equal(roundTrip(own).settings.paybackTarget, 5);
  // A hand-made link whose settings have no paybackTarget reads as 5; 2.5 or 0 is a validation error.
  const { paybackTarget, ...rest } = example("ranchD").settings;
  assert.equal(readLink(link("ranchD", { settings: rest })).state.settings.paybackTarget, 5);
  for (const bad of [2.5, 0]) {
    const r = readLink(link("ranchD", { settings: { ...rest, paybackTarget: bad } }));
    assert.equal(r.kind, "v2");
    assert.deepEqual(validate(r.state).map((e) => [e.path, e.message]), [["settings.paybackTarget", YEARS_MESSAGE]]);
  }
  // The version 1 link opens with the default target.
  assert.equal(readLink("#preset=Remote+water+monitoring&head=500&years=5").state.settings.paybackTarget, 5);
});

// ---------------------------------------------------------------- values a link sets that are not allowed

test("row 29: a negative value in a v2 link is set to 0 and named in the banner", () => {
  const vf = { ...example("ranchB").vf };
  vf.fence = { ...vf.fence, miles: -8 };
  const r = readLink(`#${link("ranchB", { vf })}`);
  assert.equal(r.kind, "v2");
  assert.equal(r.state.vf.fence.miles, 0);
  assert.deepEqual(r.corrected, [{ path: "vf.fence.miles", from: -8, to: 0 }]);
  assert.equal(linkBanner(r), "Changed from the link to a valid value: Interior fence that would otherwise be built (−8 mi to 0 mi).");
  close(cash(r.state), -294088); // no fence avoided, as in row 22(a)
});

test("row 29: a negative v1 value is set to 0 before it is mapped, so it creates no line", () => {
  const r = readLink("#preset=Collar-based+virtual+fencing&fixedCost=-5000");
  assert.equal(r.kind, "v1");
  assert.equal(r.state.costs.v1Fixed, undefined);
  assert.deepEqual(r.v1.corrected, [{ field: "fixedCost", from: -5000, to: 0 }]);
  assert.equal(linkBanner(r), `${V1_BANNER_START} Not carried over: Death loss avoided; Value per head; Extra weight sold; `
    + "Price; Fuel, vehicle and fence savings. Changed from the link to a valid value: Base station, setup and install "
    + `(−$5,000 to $0). ${V1_BANNER_END}Synthetic Ranch B).`);
});

test("corrections in a v2 link: array entries and a ramp above 1, each named with its unit (9.2, 9.5 item 11)", () => {
  const a = example("ranchA");
  const r = readLink(link("ranchA", { classes: { cows: { head: [900, -10, 900], valuePerHead: 2700 } }, ramp: [1, 1.5, 1, 1],
    labor: { ...a.labor, otherHoursSaved: -52 } }));
  assert.equal(r.kind, "v2");
  assert.deepEqual(r.state.classes.cows.head, [900, 0, 900]);
  assert.deepEqual(r.state.ramp, [1, 1, 1, 1]);
  assert.equal(linkBanner(r), "Changed from the link to a valid value: Head by class and year (−10 cows to 0 cows); "
    + "Other hours saved (−52 h/yr to 0 h/yr); Ramp in operating year 1 (150% to 100%).");
  // The same corrections as typed values: a v2 link's values pass the same validation (9.5 item 7).
  const typed = setInput(setInput(a, "classes.cows.head", -10), "ramp.1", 1.5);
  assert.equal(typed.classes.cows.head, 0);
  assert.equal(typed.ramp[1], 1);
});

test("a corrected value is named in the page's own unit: EID seconds per read, water monitoring hours a week (9.4)", () => {
  const c = example("ranchC"), a = example("ranchA");
  const events = c.labor.handling.events.map((e, i) => (i ? e : { ...e, minutesPerHead: -20 / 60 }));
  const eid = readLink(link("ranchC", { labor: { ...c.labor, handling: { ...c.labor.handling, events } } }));
  assert.equal(linkBanner(eid), `Changed from the link to a valid value: Seconds per read (${events[0].label}) (−20 s to 0 s).`);
  const added = a.labor.added.map((x) => (x.label === "monitoring time" ? { ...x, hours: -104 } : x));
  const water = readLink(link("ranchA", { labor: { ...a.labor, added } }));
  assert.equal(linkBanner(water), "Changed from the link to a valid value: Added monitoring time (−2 h/wk to 0 h/wk).");
  const install = a.labor.added.map((x) => (x.label === "install" ? { ...x, hours: [-30, 0] } : x));
  assert.equal(linkBanner(readLink(link("ranchA", { labor: { ...a.labor, added: install } }))),
    "Changed from the link to a valid value: Install time (−30 h to 0 h).");
  const upkeep = { ...c.labor, added: [{ ...c.labor.added[0], hours: -15 }] };
  assert.equal(linkBanner(readLink(link("ranchC", { labor: upkeep }))), "Changed from the link to a valid value: Added data and desk time (−15 h/yr to 0 h/yr).");
});

test("a v2 link's values pass the same validation as typed values: whole numbers, labor fields, shares", () => {
  const a = example("ranchA");
  const r = readLink(link("ranchA", { labor: { ...a.labor, cut: { ...a.labor.cut, unitsCut: 16.5 } } }));
  assert.equal(r.kind, "v2");
  assert.deepEqual(validate(r.state).map((e) => e.label), ["Hired labor cut"]);
  const units = readLink(link("ranchA", { settings: { ...a.settings, landUnits: [{ id: "u1", kind: "owned", share: 0.5 }] } }));
  assert.deepEqual(validate(units.state).map((e) => e.path), ["settings.landUnits"]);
});

// ---------------------------------------------------------------- row 28: a non-integer horizon in a link

test("row 28: T = 2.5 loaded from a link is a validation error, in either version; nothing is computed", () => {
  const a = example("ranchA");
  const v2 = readLink(link("ranchA", { settings: { ...a.settings, T: 2.5 } }));
  assert.equal(v2.kind, "v2");
  assert.deepEqual(validate(v2.state).map((e) => [e.path, e.message]), [["settings.T", YEARS_MESSAGE]]);
  const v1 = readLink("#preset=Remote+water+monitoring&years=2.5");
  assert.equal(v1.kind, "v1");
  assert.equal(v1.state.settings.T, 2.5);
  assert.deepEqual(validate(v1.state).map((e) => [e.path, e.message]), [["settings.T", YEARS_MESSAGE]]);
});

// ---------------------------------------------------------------- row 51: the horizon prefill

test("the horizon prefill reads the corrected values, and a line it cannot schedule makes the link unreadable (9.2, F2)", () => {
  const a = example("ranchA");
  const { T, ...noT } = a.settings;
  // A line starting in year −1 starts in year 0 once corrected, so the monitors are the largest year-0 purchase.
  const tank = { timing: "capital", basis: "fixed", unitCost: 500, lifeYears: 4 };
  const r = readLink(link("ranchA", { settings: noT, costs: { tank, ...a.costs, monitors: { ...a.costs.monitors, startYear: -1 } } }));
  assert.deepEqual([r.kind, r.state.settings.T, r.corrected.map((c) => c.path)], ["v2", 10, ["costs.monitors.startYear"]]);
  // A capital line with no basis cannot be scheduled: unreadable, with or without T.
  for (const settings of [noT, a.settings]) {
    const odd = { timing: "capital", unitCost: 5, lifeYears: 3 };
    assert.equal(readLink(link("ranchA", { settings, costs: { ...a.costs, odd } })).kind, "unreadable");
  }
});

test("a horizon of a million years in a link is a validation error; nothing is computed while reading it (judgment)", () => {
  const a = example("ranchA");
  for (const r of [readLink(link("ranchA", { settings: { ...a.settings, T: 1e6 } })), readLink("#preset=Remote+water+monitoring&years=1e9")]) {
    assert.ok(["v1", "v2"].includes(r.kind));
    assert.deepEqual(validate(r.state).map((e) => [e.path, e.message]), [["settings.T", MAX_YEARS_MESSAGE]]);
  }
  // A commitment of a million years, with no T in the link, prefills T and is caught the same way.
  const r = readLink(link("ranchA", { settings: { discountRate: 0.07 }, costs: { ...a.costs, subscription: { ...a.costs.subscription, commitYears: 1e6 } } }));
  assert.deepEqual([r.kind, r.state.settings.T], ["v2", 1e6]);
  assert.deepEqual(validate(r.state).map((e) => e.message), [MAX_YEARS_MESSAGE]);
});

test("row 51: a hand-made v2 link whose settings have no T is prefilled per F2", () => {
  const without = (x) => {
    const { T, ...rest } = example(x).settings;
    return rest;
  };
  const a = readLink(link("ranchA", { settings: without("ranchA") }));
  assert.equal(a.state.settings.T, 10); // the monitors' life
  assert.equal(a.horizonAssumed, false);
  const costs = example("ranchA").costs;
  costs.subscription.commitYears = 3;
  const b = readLink(link("ranchA", { settings: without("ranchA"), costs }));
  assert.equal(b.state.settings.T, 3); // the contract term
  assert.equal(b.horizonAssumed, false);
  const c = readLink(link("ranchC", { settings: without("ranchC") }));
  assert.equal(c.state.settings.T, 5);
  assert.equal(c.horizonAssumed, true);
  assert.equal(HORIZON_NOTE, "5 years assumed: no contract term or asset life entered.");
  for (const r of [a, b, c]) assert.ok(Number.isFinite(cash(r.state)));
  // Every example and every version 1 link sets T, so nothing else reaches the prefill.
  for (const x of EXAMPLE_IDS) assert.ok(Number.isInteger(example(x).settings.T));
  for (const { state } of SNAPSHOTS) assert.ok(state.settings.T !== undefined);
});

// ---------------------------------------------------------------- version 1 links (rows 15 and 30)

const SNAPSHOTS = JSON.parse(readFileSync(new URL("./snapshots/v1-links.json", import.meta.url), "utf8"));

test("row 30: migrateV1() output matches the stored snapshot of each v1 link, state and banner", () => {
  assert.deepEqual(SNAPSHOTS.map((x) => x.hash), ["#preset=Collar-based+virtual+fencing", "#preset=Remote+water+monitoring",
    "#preset=EID+tags+and+scale", "#preset=Remote+water+monitoring&head=500&years=5", "#preset=Remote+water+monitoring&years=5",
    "#head=500"]);
  for (const { hash, state, banner } of SNAPSHOTS) {
    const r = readLink(hash);
    assert.equal(r.kind, "v1", hash);
    assert.deepEqual(r.state, state, hash);
    assert.equal(linkBanner(r), banner, hash);
    assert.deepEqual(migrateV1(new URLSearchParams(hash.slice(1))), { state: r.state, v1: r.v1 });
  }
});

test("row 30: the &head=500&years=5 link gives exactly the state written out in 9.5 item 8", () => {
  const ranchA = example("ranchA");
  const expected = {
    module: "water", example: "ranchA",
    settings: { T: 5, discountRate: 0.08, paybackTarget: 5, ownAnalysis: true, rateReviewed: false,
      opType: "cowCalf", oppCostPerHour: 28, landUnits: ranchA.settings.landUnits },
    classes: { cows: { head: 500 } },
    heifersRetained: 0,
    served: { cows: { months: 12 } },
    labor: { freedTimeUse: "absorbed", otherHoursSaved: 624 },
    startYear: 0,
    ramp: [1, 0.9, 1, 1],
    costs: {
      v1Fixed: { id: "v1Fixed", label: "Base station, setup and install", kind: "cost", timing: "capital",
        basis: "fixed", unitCost: 14900, lifeYears: null, residual: { mode: "none" } },
      v1Subscription: { id: "v1Subscription", label: "Subscription per head", kind: "cost", timing: "annual",
        basis: "perHeadYear", classes: ["cows"], unitCost: 3.65 / 12, billing: "advance" },
    },
    benefitShares: {}, costShares: {},
    riskLines: [],
    prov: {
      "classes.cows.head": { cls: "D", src: "version 1 link" },
      "settings.T": { cls: "D", src: "version 1 link" },
      "settings.discountRate": { cls: "E", src: "version 1 link" },
      "settings.oppCostPerHour": { cls: "E", src: "version 1 link" },
      "labor.otherHoursSaved": { cls: "E", src: "version 1 link" },
      "ramp.1": { cls: "E", src: "version 1 link" },
      "costs.v1Fixed.unitCost": { ...ranchA.prov["costs.monitors.unitCost"], note: "10 monitors × $1,490 (version 1 link)" },
      "costs.v1Subscription.unitCost": { cls: "E", src: "version 1 link", placeholder: true },
      ...Object.fromEntries(Object.entries(ranchA.prov).filter(([p]) => p.startsWith("settings.landUnits"))),
    },
  };
  const r = readLink("#preset=Remote+water+monitoring&head=500&years=5");
  assert.deepEqual(r.state, expected);
  // The subscription bills 500 × 12 × $3.65 ÷ 12 = $1,825 a year, in advance; the monitor price is [C], the
  // subscription a placeholder.
  const sub = analyze(r.state).lines.find((l) => l.id === "v1Subscription");
  assert.deepEqual(sub.series.map((x) => Math.round(x * 100) / 100), [1825, 1825, 1825, 1825, 1825, 0]);
  assert.equal(linkBanner(r), `${V1_BANNER_START} Not carried over: Death loss avoided; Value per head; Price; Fuel, vehicle `
    + `and fence savings. ${V1_BANNER_END}Synthetic Ranch A).`);
  assert.deepEqual(verdictNotes(r.state), ["Discount rate not yet reviewed.", "Includes synthetic cost placeholders."]);
});

test("row 30: every migrated state is cow-calf, valid and computed, with its placeholders and the two vendor prices", () => {
  for (const { hash } of SNAPSHOTS) {
    const { state } = readLink(hash);
    assert.equal(state.settings.opType, "cowCalf");
    assert.ok(Number.isFinite(cash(state)), hash);
    assert.ok(verdictNotes(state).includes("Includes synthetic cost placeholders."), hash);
    for (const id of ["v1Hardware", "v1Fixed", "v1Subscription"]) {
      const p = state.prov[`costs.${id}.unitCost`];
      if (!state.costs[id]) {
        assert.equal(p, undefined);
        continue;
      }
      const vendor = (state.module === "water" && id === "v1Fixed") || (state.module === "vf" && id === "v1Subscription");
      assert.equal(p.cls, vendor ? "C" : "E", `${hash} ${id}`);
      assert.equal(!!p.placeholder, !vendor, `${hash} ${id}`);
    }
  }
  const water = readLink("#preset=Remote+water+monitoring").state;
  assert.equal(priceLabel(water.prov["costs.v1Fixed.unitCost"]), "Vendor information: published list price (All-Tex dealer flyer, "
    + "undated; checked 15 Oct 2026). Not an endorsement. Replace with your quote. (10 monitors × $1,490)");
  const vf = readLink("#preset=Collar-based+virtual+fencing").state;
  assert.equal(priceLabel(vf.prov["costs.v1Subscription.unitCost"]), priceLabel(example("ranchB").prov["costs.subscription.unitCost"]));
  assert.equal(vf.costs.v1Subscription.unitCost, 7); // $84 a head a year
  // The &years=5 link opens with T = 5; one without years keeps the 12-month horizon it was made with.
  assert.equal(readLink("#preset=Remote+water+monitoring&years=5").state.settings.T, 5);
  assert.equal(readLink("#preset=Remote+water+monitoring").state.settings.T, 1);
  // A cost the link set is the user's [D] value and not flagged.
  const typed = readLink("#preset=EID+tags+and+scale&fixedCost=12000&hardwarePerHead=4").state;
  assert.deepEqual(typed.prov["costs.v1Fixed.unitCost"], { cls: "D", src: "version 1 link" });
  assert.deepEqual(typed.prov["costs.v1Hardware.unitCost"], { cls: "D", src: "version 1 link" });
  assert.deepEqual(typed.prov["costs.v1Hardware.repairPct"], { cls: "E", src: "version 1 link" });
});

test("row 15: an old hash that names no known technology loads as Collar-based virtual fencing, with no exception", () => {
  const r = readLink("#preset=Unknown+tool");
  assert.equal(r.kind, "v1");
  assert.equal(r.state.module, "vf");
  assert.equal(r.state.example, "ranchB");
  assert.equal(linkBanner(r), "This link was made with an earlier version of the calculator and has been converted. It "
    + "named no known technology, so it opened as Collar-based virtual fencing. Not carried over: Death loss avoided; Value "
    + "per head; Extra weight sold; Price; Fuel, vehicle and fence savings. The discount rate is now a real rate (net of "
    + "expected inflation). Review it for your operation. The subscription is now billed at the start of each year instead "
    + "of at year end. Check whether your quote is per device rather than per head. Confirm the operation type (set to "
    + "cow-calf) and the land units (taken from Synthetic Ranch B).");
  // No preset at all is the same; a preset given in another case is not one of the three names.
  for (const hash of ["#head=500", "#preset=remote+water+monitoring", "#preset=", "#preset=__proto__", "#preset=toString"]) {
    const x = readLink(hash);
    assert.equal(x.state.module, "vf", hash);
    assert.equal(x.v1.unknownPreset, true, hash);
  }
});

test("version 1 links from the pages before d0fd9b8 open as the technology they named (spec issue; judgment)", () => {
  // 73ac97d's two presets had d0fd9b8's values under brand names.
  for (const [old, now] of [["Ranchbot+water+monitoring", "Remote+water+monitoring"], ["Halter+virtual+fencing", "Collar-based+virtual+fencing"]]) {
    const r = readLink(`#preset=${old}&head=500&fixedCost=9000`), same = readLink(`#preset=${now}&head=500&fixedCost=9000`);
    assert.deepEqual([r.kind, r.state, r.v1], [same.kind, same.state, same.v1], old);
    assert.equal(r.v1.unknownPreset, false);
    assert.ok(!linkBanner(r).includes("no known technology"));
  }
  assert.equal(readLink("#preset=Ranchbot+water+monitoring").state.module, "water");
  // "Virtual fencing" (457025c to 28366f1) had other values, so its banner keeps the unknown-name sentence (9.5 item 8).
  const vf = readLink("#preset=Virtual+fencing&head=500");
  assert.deepEqual([vf.state, vf.v1.unknownPreset], [readLink("#preset=Collar-based+virtual+fencing&head=500").state, true]);
  assert.ok(linkBanner(vf).includes("It named no known technology, so it opened as Collar-based virtual fencing."));
});

test("the version 1 banner of an example with no land units asks to confirm only the operation type (spec issue; judgment)", () => {
  const r = readLink("#preset=EID+tags+and+scale&head=250");
  assert.equal(r.state.settings.landUnits, undefined);
  assert.ok(linkBanner(r).endsWith("per device rather than per head. Confirm the operation type (set to cow-calf)."));
  assert.ok(linkBanner(readLink("#preset=Remote+water+monitoring")).endsWith("Confirm the operation type (set to cow-calf) and the land units (taken from Synthetic Ranch A)."));
});

test("migrateV1: the mapping table of 9.5 item 8, field by field", () => {
  const { state, v1 } = migrateV1("preset=EID+tags+and+scale&head=250&years=7&discountRate=6&hardwarePerHead=5&"
    + "maintenancePct=3&fixedCost=1000&subscriptionPerHead=2.4&laborHoursPerWeek=2&wage=30&year1Realized=40&deathLossPts=0");
  assert.equal(state.module, "eid");
  assert.equal(state.example, "ranchC");
  assert.deepEqual(state.classes, { cows: { head: 250 } });
  assert.deepEqual(state.served, { cows: { months: 12 } });
  assert.equal(state.settings.T, 7);
  assert.equal(state.settings.discountRate, 0.06);
  assert.equal(state.settings.oppCostPerHour, 30);
  assert.equal("landUnits" in state.settings, false); // Synthetic Ranch C has none
  assert.deepEqual(state.costs.v1Hardware, { id: "v1Hardware", label: "Hardware per head", kind: "cost", timing: "capital",
    basis: "perDevice", classes: ["cows"], unitCost: 5, lifeYears: null, residual: { mode: "none" }, repairPct: 0.03 });
  assert.equal(state.costs.v1Fixed.unitCost, 1000);
  close(state.costs.v1Subscription.unitCost, 0.2, 1e-12); // 2.4 ÷ 12, billed in advance
  assert.equal(state.costs.v1Subscription.billing, "advance");
  assert.deepEqual(state.labor, { freedTimeUse: "absorbed", otherHoursSaved: 104 });
  assert.deepEqual(state.ramp, [1, 0.4, 1, 1]);
  assert.deepEqual(state.eid, { ruleApplies: { cows: false, calvesBorn: false } });
  assert.equal(state.heifersRetained, 0);
  assert.deepEqual(state.riskLines, []);
  for (const k of ["water", "vf", "enrolled", "production"]) assert.equal(k in state, false, k);
  // Every link-set value is [D], the rest [E]; the dropped fields that are not 0 are named, in V1_FIELDS order.
  assert.equal(state.prov["classes.cows.head"].cls, "D");
  assert.equal(state.prov["settings.oppCostPerHour"].cls, "D");
  assert.deepEqual(v1.notCarried, ["replacementPct", "valuePerHead", "gainLbsPerHead", "pricePerLb", "otherSavings"]);
  // The hardware: 250 cows × $5 in year 0, with 3% repairs a year after, and no residual.
  const hw = analyze(state).lines.find((l) => l.id === "v1Hardware");
  assert.deepEqual(hw.series.map((x) => Math.round(x * 100) / 100), [1250, 37.5, 37.5, 37.5, 37.5, 37.5, 37.5, 37.5]);
  // Repairs with no hardware line are named; a year-1 share above 100% is set to 100% (the ramp's limit).
  const noHw = migrateV1("preset=EID+tags+and+scale&hardwarePerHead=0&year1Realized=150");
  assert.equal(noHw.state.costs.v1Hardware, undefined);
  assert.ok(noHw.v1.notCarried.includes("maintenancePct"));
  assert.equal(noHw.state.ramp[1], 1);
  assert.match(linkBanner({ kind: "v1", ...noHw }), /Not carried over: Repairs, as % of hardware; Devices lost or replaced;/);
  assert.match(linkBanner({ kind: "v1", ...noHw }), /Changed from the link to a valid value: Benefit reached in year 1 \(150% to 100%\)\./);
  // Version 1 read a value that is not a number as absent; so does the conversion (and one that is not finite).
  const odd = migrateV1("preset=Remote+water+monitoring&head=abc&years=Infinity&wage=");
  assert.equal(odd.state.classes.cows.head, 1000);
  assert.equal(odd.state.settings.T, 1);
  assert.equal(odd.state.settings.oppCostPerHour, 0); // "" read as 0, as version 1 did
  // With no subscription, the billing sentence is left out.
  const noSub = readLink("#preset=Remote+water+monitoring&subscriptionPerHead=0");
  assert.equal(noSub.state.costs.v1Subscription, undefined);
  assert.doesNotMatch(linkBanner(noSub), /billed at the start of each year/);
});
