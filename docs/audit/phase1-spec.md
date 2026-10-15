# Ranch Tech ROI: phase-1 specification, validation plan and pinned outputs

Part of the Ranch Tech ROI audit and improvement plan. Section numbers run across the files: header, §1–§8, §11 and §12 are in [`ranch-tech-roi-audit.md`](ranch-tech-roi-audit.md); §9, §10 and Appendix A in [`phase1-spec.md`](phase1-spec.md); the §5.3 table in [`evidence-table.md`](evidence-table.md); §13 in [`sources.md`](sources.md). The evidence table with full URLs is [`evidence-table.csv`](evidence-table.csv) and the reference prototype is in [`prototype/`](prototype/).

## 9. Developer-ready specification: phase 1 (F1–F10, B3, B4a, B7, B8, B9)

This specification is a recommendation. It states the phase-1 rules precisely enough to implement and test. Where
a rule is my judgment rather than a convention from a source, it is marked "(judgment)"; where it follows an owner
decision, it says so.

### 9.1 Scope and non-goals

- **In scope:**
  - A line-item engine inside `roi.js` (pure functions, no dependencies), built by generalizing `cashFlows()` and
    extending the existing `npv()`, `irr()` and `payback()` with the 9.3 rules, step by step (build order below).
    `app.js` keeps its structure and adds the page changes in 9.5.
  - F1–F10 (section 8.1).
  - B3: ramp and implementation lines.
  - B4a: the split of tags (with free tags), reader, scale, software and premium, and the recorded answer to "Does
    the EID rule apply to cattle you move?" with its notice.
  - B7: the water module in ranch units.
  - B8: versioned links and `migrateV1()`.
  - B9: the payback target, the N-year test and the "What would make it pay" panel (9.3, 9.5 item 9). The panel
    replaces today's break-even table (judgment: its full-horizon column is the break-even on cash NPV, in ranch
    units).
  - Three modules with the inputs of 9.4: water monitoring (B7), virtual fence (built from F3, F5, F6, F9 and B3)
    and EID and scale (B4a). Each starts from its synthetic example (section 11 and Appendix A; the virtual fence
    module has two, Synthetic Ranch B and the good-fit Synthetic Ranch D) and has a pinned regression test (9.7).
  - A pure `combine([a, b])` that applies the pool caps across analyses (9.6). It is tested with two fixture modules
    in `tests/`; phase 1 has no multi-module page.
  - The existing tornado and two-way grid, ported to path-addressed inputs (9.5 item 6).
  - The page rules that follow the owner decisions of 15 Oct 2026: land units and the "Who pays for this?" and "Who
    receives this saving?" answers (F6); the vendor fill and price labels, the example rate's label and review
    prompt, and the synthetic cost placeholders' label and flag (9.5 items 4, 5 and 7); and the "before tax" labels
    (9.5 items 1–3).
  - New DOM-free files, so that everything except the page wiring runs in node tests: `v1.js` (today's model during
    the build, then only the frozen `V1_FIELDS` and `V1_PRESETS`), `examples.js` (the four synthetic examples with
    their `prov`), `links.js` (reading and writing the link, and `migrateV1()`), `state.js` (what each user action
    does to the state, next item) and `text.js` (the verdict sentence, labels and notices, built from `analyze()`
    output). `app.js` imports them and only connects the page's events to them.
  - `state.js` (judgment): pure functions, each taking a state and returning the next one, so that the user actions
    of 9.5 items 5 and 7 run in node. `loadExample(id)` and `reset(a)` return the example (for Reset, `a.example`)
    with its values and `prov`, and with `ownAnalysis` and `rateReviewed` false. `analyzeMine(a)` sets `ownAnalysis`
    and changes no value. `setInput(a, path, value)` applies one typed or cleared value. A cleared field that keeps
    its last value (9.5 item 7) is unchanged; any other cleared field becomes blank, and its `prov` record is
    deleted. A typed value gets the corrections of 9.2 (a negative number set to 0, a ramp value above 1 set to 1)
    and the record {cls: "D", src: "your entry"} in place of any earlier one, so it is no longer a placeholder, a
    reported price or a fill. `keepRate(a)` sets `rateReviewed`; `keepValue(a, path)` sets `prov[path].confirmed`;
    `useVendorPrice(a, path)` writes the fill of 9.5 item 7 with its [C] record; and `removeItem(a, path, i)`
    removes item i of the list at `path` (a season block, a `labor.added` item, a handling event, a risk line or a
    land unit) and moves the stored shares and `prov` records of the items after it (9.2). A call to `setInput`,
    `useVendorPrice` or `removeItem` that changes a value or a `prov` record sets `ownAnalysis` unless its path is
    `settings.discountRate` or `settings.paybackTarget` (9.5 item 5), and a typed `settings.discountRate` sets
    `rateReviewed`.
  - Provenance metadata and tests.
- **Not in scope:**
  - Scenario columns and the drought option (B1)
  - Break-evens for risk drivers and the "Today vs with the technology" table (B2)
  - Financing and cost share (B5)
  - The owner and lender business case (B6), the first item after phase 1
  - The EID compliance baseline (B4b), which waits for research task R1 (8.4)
  - New modules (L1–L3), the update helper (L4), the tax view (L5, not in the initial version), and the multi-module
    page with user allocation (L6)
- **No framework, no build step, no rewrite:** the page stays plain HTML and ES modules.
- **Build order (recommendation).** Phase 1 changes the existing files in small pull requests rather than starting
  with a rewrite. Every pull request leaves the whole suite green as CI runs it (9.7). A current test that 9.7
  replaces is deleted or rewritten in the pull request that makes it obsolete. A test that needs an item from a later
  step joins the suite in the pull request that builds that item, and the earlier pull request says so. Today's page
  keeps working on today's model until step 6.
  1. **F2 and the text fixes of F10, on today's model.** One whole-number horizon (`years`, with the row-28
     validation error from a pure `validate()` in `roi.js`), year 0 as its own row, and `fiveYear()` with its merged
     12-month view (and its card, `index.html:101-108`) removed. The presets' forced 12-month starting value becomes
     F2's fallback of 5 years with its note (9.2). `writeHash()` (`app.js:33-37`) then writes `years` into every
     link, even when it equals the preset's, so every link made from this step on carries its horizon, and
     `migrateV1()`'s `V1_PRESETS` value (`years: 1`) applies only to links made before it (10.1 row 30). Until step 6,
     `readHash()` (`app.js:28-32`) reads a non-empty hash that has no `years` as `years` 1, the value at `d0fd9b8`,
     so a link made before this step keeps its 12-month horizon and its verdict; from step 6, `migrateV1()` applies
     the same rule. Because `app.js` cannot be imported in node (B8), this pull request checks by hand that
     `#preset=Remote+water+monitoring` opens with 1 year. The §3.4 L2 fixes: the DTN date corrected in
     both sources lists, the EID costs labeled as having no published source, each of the five sentences that call
     the starting values' costs published list prices (the second sentence at `index.html:90`, `index.html:138`,
     `README.md:12`, `README.md:67` and the comment at `roi.js:26`) corrected so that each describes the costs as
     they are: the water monitor's $1,490 and $365 a year as a published dealer price (an undated flyer); the
     virtual fence's $4,500 infrastructure and "less than $7 per head per month" as vendor statements reported by DTN
     (31 Mar 2025), not published list prices; the $3,000 base station as a figure from university comparison slides
     (16 Apr 2024), given when the slides said those collars were "not yet available" in the US, so not a published
     US price; and the EID costs as having no published source (F10 criterion (1) checks that the old wording is
     gone), the benefit values labeled as assumptions in the input panel, and the three "1,000-cow operation" sentences
     replaced with the banner wording (9.5 item 5). README's "What the example shows" (`README.md:56-63`) also drops
     its 12-month and 5-year-outlook sentences, which this step makes untrue, and says that the example counts saved
     hours and assumed weight gain as cash, so its results are not cash results (§3.4 L1). Each pull request that
     adds tests updates the count at `README.md:85`. F10 criterion (1) joins here.
  2. **F5 and F1, in the new engine.** Today's model (`FIELDS`, `PRESETS` and its functions) moves unchanged from
     `roi.js` to `v1.js`, and `app.js` and today's tests import it from there. `v1.js` also gets `V1_FIELDS` and
     `V1_PRESETS`, exact copies of `FIELDS` and `PRESETS` as at commit `d0fd9b8` (before step 1), for B8. The new
     engine starts in `roi.js` from today's `npv()`, `irr()` and `payback()`. Today's hand-checked case (nets
     −1,000, 400, 400, 400), rebuilt as a $1,000 capital line (`lifeYears: null`), a $100 annual line billed in
     arrears and a $500 cash benefit line with `requiresCattle: false` (the case has no cattle, so the test still
     passes after F3), must reproduce its NPV at 10% (−$5.26), IRR (9.70%) and payback (2.5 years). The new
     engine's `validate(analysis)` starts here, in `roi.js`, with the 9.2 rule for `settings.T` (row 28, typed) and
     the 9.2 rules for the F5 and F1 fields; each later item adds its own 9.2 rules and their tests in its pull request
     (for example the class rules with F3, the land-unit and fence rules with F6, and `paybackTarget` with B9). Step
     1's `validate()` moves to `v1.js` with today's model.
  3. **F9, then F3**, with `combine()` tested on two fixture modules defined in `tests/` (10.1 row 9). Rows 6 and
     32, which need head-months, join with F3, and so do F5 criterion (1) and the head-based bases of F5
     (perHeadMonth and perHeadYear quantities, and a capital line's qty taken from head). `text.js` starts here,
     DOM-free: from this step on, each item adds the notices, warnings and labels that its acceptance criteria and
     10.1 rows name (first F3's "No cattle in year t" message), so their text assertions join the suite with the item
     and check the text that `text.js` builds from `analyze()` output. The page shows that text from step 6.
  4. **F8, then F4, F7 and F6.** F1 criterion (2), F3's cost-per-head-month criterion and the payback and IRR texts
     of row 19 join the suite with F8 (row 19's billing amounts join with F5, step 2), and F8 adds the verdict sentence and the tiles' labels to `text.js`
     (9.5 items 1 and 2; the verdict's "It turns most on" sentence joins with the sensitivity port in step 6).
     Row 13 joins with F4, and row 12 with F7. F6 criteria 1–8 run on fixture lines.
  5. **The modules and their examples.** B3 first. Then each module, with its synthetic examples in `examples.js`,
     their pinned regressions (9.7; the 5-year test and the row-31 verdict join in step 6) and the 10.1 rows that
     start from them: B7 and the water module with Synthetic Ranch A (rows 10, 23, 35, 47(a) and (b), and 50(a));
     the virtual fence module with Synthetic Ranch B (rows 2, 8, 16, 17, 22 and 24) and the good-fit Synthetic Ranch
     D (row 47(c)); B4a and the EID module with Synthetic Ranch C (row 36 and the free-tag cases).
     F10 criterion (2) joins here. `state.js` (In scope, above) is built with the first example, with node tests of
     each function's effect on the values, `prov` and the two flags; row 36 drives it from this step, and rows 33,
     37, 38 and 45 from step 6, when their text joins.
  6. **B8, then B9, then the page switch.** `links.js` and `migrateV1()` are built against the final state shape,
     including `settings.paybackTarget` (rows 15, 29, 30 and 51, and row 28's link case); row 30's panel rows, its
     line under the verdict and its "No single input" sentence join with B9. B9 adds `setPath()` (9.5 item 6),
     `targetTest()`, `solveDrivers()` and each module's `PAYBACK_DRIVERS(a)` to the engine, and to `text.js` the
     payback-target line, the "It would pay for itself within N years if:" sentence and the panel's strings (rows
     39–44 and 46, row 50(b) and (c), and row 1's line under the verdict); the 5-year-test regressions of 9.7 join
     with it.
     Then `app.js` moves to the new engine, in one or more pull requests that each leave the page working: the 9.4
     inputs, the 9.5 page changes (including the "What would make it pay" panel in place of today's break-even
     table, and the kept sections of item 10), the rest of `text.js`, the sensitivity port on `setPath()` with each
     module's `SENSITIVITY_INPUTS(a)` (rows 25 and 26), and the synthetic examples in place of today's presets,
     with the page opening on Synthetic Ranch A. Today's model and its tests then leave `v1.js`, which keeps only
     `V1_FIELDS` and `V1_PRESETS`. F10 criterion (3), rows 20, 31, 33, 34, 37, 38, 45 and 49, and row 1's page check
     join here; the parts that need the rendered page are a by-hand checklist in the pull request (9.7, Page text).

### 9.2 Data model (`roi.js`)

```js
// One analysis = shared settings + one module's inputs. combine([a, b]) applies pool caps across analyses (9.6).
// Money is in today's US dollars, before tax. discountRate is a real rate.
// Years t = 0..T; T is a whole number >= 1.
// Arrays have T+1 entries indexed t = 0..T; a shorter array carries its last value forward.
// Operator shares are never per-year arrays: a share split by land unit is an object keyed by land-unit id.
// In head and month arrays, entry t (t >= 1) is the grazing season or operating year that ends at year t.
// Every rate, share and percentage is stored as a fraction (0.07 = 7%): discountRate, loadPct, repairPct, residual
// pct, the fence's m, shareAvoided, shareCaught, ramp, operatorShare, land-unit share, retagPct, soldShare and
// collarLoss.pctPerYear. The page shows and accepts percents and divides by 100 on input.
// The analysis is plain data, with no functions. setPath() edits it by path (9.5 item 6), a link carries it
// (9.5 item 8), and buildLines(analysis) builds the cost and benefit lines below from it.

analysis = {
  module: "water"|"vf"|"eid",
  example: "ranchA"|"ranchB"|"ranchC"|"ranchD",  // the synthetic example the state started from (9.5 items 5, 8)
  settings, classes, heifersRetained,
  enrolled,                               // virtual fence only
  served,                                 // water and EID only
  labor,
  startYear: 0,                           // the module's start year, a whole number < T (9.3 Timing)
  ramp: [1, 1, 1, 1],                     // ramp[i], i = 1..3: share of the full benefit (0..1) in the module's i-th
                                          // operating year, year startYear + i (B3); ramp[0] is unused and stays 1.
                                          // ramp is indexed by operating year, not by calendar year: it is not a
                                          // per-year array, so the carry-forward rule above and the N-year test's
                                          // cut (9.3) do not apply to it, and the factor is 1 from operating year 4
                                          // on, whatever ramp[3] is
  costs: { [id]: costLine },              // the module's cost lines, keyed by the ids in 9.4; qty and classes, and
                                          // the unitCost of the cowTags, calfTags, retags and collarLoss lines
                                          // (taken from eid.tagPrice and vf.collarLoss.chargePerCollar), are left
                                          // out where the module derives them
  benefitShares: { [id]: number | { [landUnitId]: number } },  // a benefit line's operator share, kept only when
                                          // the user changes it from the land-unit default (9.3)
  costShares: { [id]: number | { [landUnitId]: number } },  // the same for a derived cost line (9.4 intro), such
                                          // as paid handling
  riskLines: [{ cause, class, eventsPerYear, headPerEvent, shareCaught }],  // F7; none by default
  production: { lbPerHeadPerDay, days, classes: [], soldShare: 1, fromRecords: false, sourceNote },
                                          // F4, advanced, blank by default
  water: {…} | vf: {…} | eid: {…},        // the module's own inputs, below
  prov: { [path]: prov },                 // the provenance of each value, keyed by its path ("costs.monitors.unitCost",
                                          // "water.blocks.0.shareAvoided"); a typed value has {cls: "D", src: "your
                                          // entry"} (a typed price is labeled "your quote", 9.5 item 4); a blank
                                          // value and a removed line have no record (9.5 item 8)
}

// prov = {cls: "A"|"B"|"C"|"D"|"E", src, url, pub, dataYear, region, currency, note,
//         reported: false, placeholder: false, confirmed: false}
// pub: the publication date as the label shows it ("31 Mar 2025"); for an undated source, "undated; checked <date>"
// ("undated; checked 15 Oct 2026").
// region: where the evidence comes from ("US", a US region, or another country and its state or province);
// currency: "USD", the source's own currency, or null when the value is not money. A non-US value is never a
// default and is never converted to US dollars.
// reported: true for a [C] price that the press or extension reported second-hand. It is never a fill and carries
// the reported-price label (9.5 item 4).
// placeholder: true for a synthetic example's cost placeholder, or a cost a version 1 link took from V1_PRESETS
// other than the two that are vendor prices (9.5 item 8); an [E] value only. confirmed: true once the user keeps it
// (9.5 item 5).

settings = {
  T, discountRate,                        // T: whole number >= 1, set by the example or the link; a state without
                                          // one is prefilled per F2: the largest commitYears above 0 among the
                                          // module's lines, else the lifeYears of the capital line with the largest
                                          // year-0 cost among those with a lifeYears (the first in costs order on
                                          // a tie), else 5 with the note "5 years assumed: no contract term or asset
                                          // life entered."; only cost lines count, so the fence block does not. In
                                          // phase 1 this prefill gives today's presets their 5 years at 9.1 step 1;
                                          // in the new engine only a hand-made version 2 link whose s.settings has
                                          // no T reaches it, because every example and every version 1 link sets T
                                          // (10.1 row 51). discountRate: real, never blank; an example loads its
                                          // own example rate (the synthetic examples use 0.07 [E])
  paybackTarget: 5,                       // N, whole years >= 1: the horizon of the N-year test and the "What would
                                          // make it pay" panel (B9; 9.3, 9.5 item 9). Default 5 (owner decision,
                                          // 15 Oct 2026), shown in step 2 next to T; every example uses 5
  ownAnalysis: false,                     // true once the user chooses "Analyze my operation" or changes any input
                                          // other than the rate or the payback target away from the example (9.5
                                          // item 5)
  rateReviewed: false,                    // true once the user presses "Keep this rate" or edits the rate, at any
                                          // time after the example loads: an edit made while ownAnalysis is still
                                          // false counts. Loading an example or Reset sets both flags to false
  opType: "cowCalf"|"stocker"|"seedstock"|"other",  // preselected "cowCalf" (the primary user), editable; an
                                          // example sets its own type (Synthetic Ranch B: "stocker")
  oppCostPerHour,                         // optional; economic view only
  landUnits: [{                           // step 1: one or more, each owned or leased; an operation can have both.
    id, kind: "owned"|"leased",           // Required for water and virtual fence; optional for EID, whose lines
                                          // are not split (9.3)
    leaseYears, renewalExpected: false,   // leased units only; leaseYears: whole years left from year 0, so the
                                          // lease ends at T' = leaseYears
    share,                                // the unit's share of the module's head-months (virtual fence) or water
                                          // points (water); the shares sum to 1
    fenceBuiltBy: "tenant", fenceMaintainedBy: "tenant",  // or "landlord"; these defaults (the operator's own
    waterBy: "tenant", careInLeaseRate: false,            // work) are shown and editable
    fenceReimbursement: 0,                // $ the lease pays the tenant for fence at lease end
  }],
}

// c in: cows, bulls, replacementHeifers, calvesBorn, calvesSold, cullCowsSold, yearlings
// calvesSold and cullCowsSold are sale flows drawn from other classes: never enrolled or served, never in HM (9.3)
classes[c]      = { head: number|number[], valuePerHead, valueOfGain }        // inventory; a class not entered has
                                                                              // 0 head
heifersRetained = number|number[]                                             // calves born kept as replacements;
                                                                              // 0 by default
enrolled[c]     = { head: number|number[], months: number|number[] }          // virtual fence: the enrolled classes;
                                                                              // months required, no default
served[c]       = { months: number|number[] }                                 // water, EID: the classes the module
                                                                              // serves, with months on the served
                                                                              // pastures (default 12); a class not
                                                                              // listed is not served

// Labor block (per module)
labor = {
  freedTimeUse: "absorbed"|"replacesPaidWork",  // the F1 question; "absorbed" until the user answers (field notes)
  cut: { laborUnit: "hour"|"day"|"week"|"position", unitsCut: number|number[],
         hoursPerUnit, paidRate, salary /* position only */, loadPct },
                                                                     // hoursPerUnit is 1, not editable, for "hour";
                                                                     // no other default (validation, field notes).
                                                                     // Every paidRate in labor is $/h; a position's
                                                                     // pay is cut.salary, $/yr
  avoidedHire: { salary, loadPct, startYear, years },                // optional
  added: [{ label, hours: number|number[], doneBy: "paid"|"unpaid", paidRate, loadPct }],  // hours per year
  otherHoursSaved: 0,                                                // h/yr saved that no module input covers
  handling: {                                                        // virtual fence and EID
    events: [{ label, classes, timesPerYear, minutesPerHead, crewSize }],
    gathers, gatherRiders, hoursPerGather,
    trainingDays: number|number[], trainingRiders, hoursPerDay,      // training days by year when the herd is
                                                                     // trained once (Synthetic Ranch D: [0, 7, 0])
    doneBy: "paid"|"unpaid", paidRate, loadPct,
  },
}

// Module inputs (one module per analysis; 9.4 gives the units and the ids of each module's lines)
water = {
  monitors,                               // count: the qty of the monitors, subscription and batteries lines
  blocks: [{ name, weeks, runsPerWeek, milesPerRun, hoursPerRun, minVisitsPerWeek,
             freezeOrFeedRoute: false, shareAvoided }],
  variableCostPerMile,                    // $/mi
  fewerChecksLoss: { headPerYear, class },  // optional offset, a negative risk line (9.3); blank by default
}
vf = {
  pricing: "leased"|"purchased",
  batteriesPerCollar: 0,                  // per collar per year, for collars with replaceable batteries
  collarLoss: { pctPerYear, chargePerCollar },
  fence: { landUnitId, miles, planMiles, F, k, Lf, m, mode: "avoided"|"deferred", d },
                                          // landUnitId: the land unit the whole fence is on (9.3); defaults to the
                                          // id of the first land unit.
                                          // planMiles: interior fence miles in the ranch's plan, the fenceMiles
                                          // baseline (9.6); defaults to miles
  gatherHoursToday,                       // h/yr, the gatherHours baseline; blank skips the clamp (9.6)
  gatherHoursCut,                         // h/yr, the module's one claim on gatherHours
  healthCheckHoursCut: 0, validatedAlert: false,  // h/yr, outside the gatherHours pool (9.3 Labor)
}
eid = {
  ruleApplies: { [c]: false },            // the step-3 answer by class, "no" by default; recorded only until B4b
  freeTags: { qty, years: [] },           // qty: number|number[], tags free in each listed billing year (9.3)
  tagPrice,                               // $/tag: the unitCost of the cowTags, calfTags and retags lines
  retagPct,                               // per year, of the head on the cowTags line
  recordingHoursToday: 0,                 // h/yr of hand recording that the reader and scale replace
  premium: { saleCwt, premiumPerCwt, verificationFee, quoteNote },  // head in program = calvesSold; blank by
                                          // default. quoteNote: a note on the buyer's quote, text that enters
                                          // no formula
  dosing: { perApplication, applications: { [c]: number } },  // blank by default
}

// Each module also exports, beside SENSITIVITY_INPUTS(a) (9.5 item 6), its "What would make it pay" drivers (B9):
PAYBACK_DRIVERS(a) => [{ path, label, unit, lo, hi, set }]  // module code, not analysis data; the lists are in 9.3
// A pure function of the analysis a: it returns the drivers in the order of the 9.3 table, with one water row per
// entry of a.water.blocks (labeled with the block's name), the virtual fence price row chosen by a.vf.pricing, and
// the water labor row's unit and hi taken from a.labor.cut.laborUnit. It leaves out a driver whose input has
// nothing to act on, such as a cost line that is not in a.costs (the rule follows the 9.3 table).
// path: the input setPath() moves, or "herd" for herd size; label and unit: as the panel shows them (9.5 item 9);
// lo, hi: the search range as numbers in the stored unit of the input (a fraction for a % driver, so a season
// block's cap of 50% is 0.5; for a driver with a set, the unit of its value in 9.3), computed from a where the 9.3
// table says so. entered, clippedLo, clippedHi and the solved values (9.3) use the same scale, and the panel
// converts them to its display unit (9.5 item 9);
// set: an optional pure (a, v) => analysis, built from setPath() calls, for a driver that moves linked inputs (9.3)

// Cost line (stored in analysis.costs[id]; buildLines also builds derived cost lines, such as paid labor)
{ id, label, kind: "cost",
  timing: "capital"|"annual",
  basis: "fixed"|"perDevice"|"perHeadMonth"|"perHeadYear",   // quantity only
  classes: [],                    // required for head-based bases, and for a perDevice qty taken from head counts
  unitCost,                       // $ per unit (a number, or a number[] by season or purchase year, field
                                  // notes); for perHeadMonth and perHeadYear, $/head/month; null (blank) =
                                  // "Quote required", not counted
  qty,                            // perDevice: number|number[]; fixed: 1; head-based: from classes
  startYear,                      // defaults to the module's startYear; must be < T
  operatorShare: 1,               // 0..1 of this cost the operator pays ("Who pays for this?"); for a line split
                                  // by land unit, an object keyed by land-unit id, { [landUnitId]: number } (9.3)
  // capital lines only
  lifeYears: null|number, repairPct: 0,
  residual: {mode: "straightLine"} | {mode: "none"} | {mode: "pctOfCost", pct} | {mode: "amount", dollars},
                                  // default "straightLine" when lifeYears is a number, "none" when it is null
  perAnimal: false,               // true for an item that leaves with the animal, set by the module (the EID
                                  // cowTags line); it changes how the scheduler counts new cohorts (9.3)
  staysWithLand: false,           // true for an improvement left on the land when a lease ends (9.3)
  leaseReimbursement: 0,          // $ the leases that end within T pay the tenant in total for that improvement at
                                  // lease end (9.3)
  // annual lines only (never have a residual)
  billing: "advance"|"arrears",   // default "advance" for subscriptions and service fees, "arrears" otherwise
  minQty: 0, commitYears: 0, earlyTerminationFee: 0,
  paths: [] }                     // the paths of the inputs the line multiplies (9.3 provenance rules)

// Benefit line (built by buildLines from the module inputs; never stored)
{ id, label, kind: "cash"|"risk"|"capacity"|"production",
  pool: null|"waterRuns"|"gatherHours"|"deathLoss:<cause>"|"fenceMiles",
  claim: (t, ctx) => qty,         // physical quantity, in the pool's unit
  valuePerUnit: (t, ctx) => $,    // dollars per unit
  requiresCattle: true,           // true for every line a module builds (the fence has its own rule, 9.3); a test
                                  // fixture may set false
  classes: [],
  fromRecords: false,             // production effects: true makes the line kind "cash"
  operatorShare: 1,               // 0..1 of this benefit the operator receives ("Who receives this saving?"):
                                  // benefitShares[id], else the land-unit default; for a line split by land
                                  // unit, an object keyed by land-unit id (9.3)
  paths: [] }
// ctx = { a, HM }: the analysis being computed and its head-months by year (HM[t], 9.3).
// Residual (R_t) is generated by capital cost lines; users never enter it as a line.
```

Field notes:
- `minQty` is in the line's billing unit per season: devices (perDevice), head-months (perHeadMonth) or head
  (perHeadYear). Inside the commitment, for perHeadYear, `billedQty = 12 × max(Σ head_c,t, minQty)`; for the other
  bases, `billedQty = max(qty, minQty)`. Outside the commitment, `billedQty = qty`.
- A per-animal item such as a calf tag is a perDevice line whose `qty` array the module takes from a class's head
  counts (calf tags from `calvesBorn`). The line lists that class in `classes`.
- For a capital line, `qty_t` is the quantity owned from year t. For an annual line, `qty_t` is the quantity in
  season t. A `unitCost` array is indexed the same way. On an annual line, entry t is the price for season t, paid
  in year t − 1 when billed in advance and in year t when billed in arrears (Synthetic Ranch A's batteries: seasons 4
  and 8, billed in arrears in years 4 and 8). On a capital line, entry t is the price of a purchase in year t, and
  that purchase's repairs and residual use the same price.
- When a capital line's qty comes from head counts (for example, purchased collars from enrolled head),
  `qty_t = head_c,t+1` (devices bought in year t serve the season that ends at t + 1), and `qty_T = qty_{T−1}`. A
  per-animal item used up each season, such as a calf tag, is an annual line billed in arrears, so the cost in year t
  covers season t (calf tags in years 1..7 in Appendix A, Ranch C).
- Each module's cost and benefit lines have the fixed ids listed in 9.4, so per-line edits (an operator share, a
  typed quote and its `prov`) survive a rebuild and a link. The lines that `buildLines` derives have fixed ids too
  (9.4 intro): `handling`, `added:<i>` and `hoursFreed`. An id with an index (`risk:<i>`, `added:<i>`) follows its
  item: when an item is removed, its stored share goes with it and the stored shares of the items after it move to
  their new indexes (judgment). The same applies to `prov`, whose paths hold list indexes
  ("water.blocks.0.shareAvoided", "labor.added.0.hours", "riskLines.0.eventsPerYear"): when an item of a list (a
  season block, a `labor.added` item, a handling event, a risk line or a land unit) is removed, its records are
  deleted and the records of the items after it move to their new indexes (judgment; `removeItem`, 9.1).
- Validation errors (no result is computed until they are fixed; the page names the field): `T`, `paybackTarget`, an
  entered `lifeYears` (blank is null), `Lf` (while `vf.fence.miles` is above 0) or a leased unit's `leaseYears` not a
  whole number ≥ 1 (message: "Enter a whole number of years, 1 or more."); a `startYear` (of a line or the module),
  `commitYears`, `k` (while `vf.fence.miles` is above 0), `d` (while `vf.fence.mode` is "deferred") or
  `avoidedHire.years` not a whole number; while `avoidedHire.years` is above 0, `avoidedHire.startYear` not a whole
  number or below the module's `startYear` + 1; a line's or the module's `startYear` ≥ T; an entry of an `hours` array
  above 0 for a year before the module's `startYear`, or an entry of a `trainingDays` array above 0 for a year up to it
  (9.3 Timing); `unitsCut` not a whole number for day, week and position; while `freedTimeUse` is "replacesPaidWork" and
  `unitsCut` is above 0, a blank or 0 `hoursPerUnit` (day, week, position; judgment: such a unit has paid hours, so 0
  counts as not entered), a blank `paidRate` (hour, day, week), `salary` (position) or `loadPct`; a blank `paidRate` or `loadPct` on a `labor.added` item, or on `labor.handling`, whose `doneBy` is
  "paid"; a blank `salary` or `loadPct` on an `avoidedHire` with `years` above 0; an enrolled class without `months`;
  `calvesSold` or `cullCowsSold` in `enrolled` or `served`; `enrolled[c].head` above `classes[c].head` in any year;
  `calvesSold` above `calvesBorn − heifersRetained` in any year; while `vf.fence.miles` is above 0, a fence build year
  `k` below the module's `startYear` (judgment: a fence the ranch builds before the technology starts cannot be avoided
  by it) or a `vf.fence.landUnitId` that is not the id of a land unit; `paidHoursCutₜ` (0 while `freedTimeUse` is
  "absorbed") above the hours saved that can support it (9.3 Labor); a residual above the cost of the purchase it
  belongs to (for `pctOfCost`, a `pct` above 1; for `amount`, which is dollars for the whole line, `dollars` above
  the cost of the last purchase of every cohort combined, Σ unitCost × cohortQty over those purchases, the base a
  straight-line residual uses); land-unit shares that do not sum to 1 within 1e-9 (water and virtual fence); an operator share outside
  0–1. A field with a condition is not validated while the
  condition does not hold, so an avoided fence needs no `d`, an owned unit no `leaseYears`, and an unused avoided hire
  no start year. These rules apply to typed values and to values loaded from a link. The engine itself accepts the
  fractional values that the sensitivity features, the driver solver (9.3), the land-unit split and the pool scale
  produce (for example, 12.8 days cut in a tornado run, 27.32 days in the solver, or 6.4 of 16 days on a land unit with
  share 0.4).
- Money, count and percentage fields cannot be negative. A negative number is set to 0, and a ramp value above 1 is
  set to 1, whether it is typed or loaded from a link; a link's corrected fields are named in the banner.
- `freedTimeUse` is "absorbed" until the user answers. With "absorbed", the engine counts `unitsCut` as 0 (no paid
  hours cut and no cash labor saved), and the page shows "Freed time is absorbed, so no cash labor saving is
  counted." A typed `unitsCut` is kept for when the answer changes, and it is not checked against the hours saved
  (9.3 Labor). This is a notice, not a validation error.
- `operatorShare` is a number from 0 to 1 or, for a line split by land unit, an object keyed by `landUnits[u].id`
  with one such number per unit; a unit missing from the object takes that unit's default. It is never a per-year
  array. Its default comes from `landUnits` (9.3) and is always shown and editable. A line stored in `costs` keeps
  it in `costs[id].operatorShare`; a derived cost line's is kept in `costShares[id]`, and a benefit line's
  (including the capacity line `hoursFreed`) in `benefitShares[id]`, once the user changes it.
- A price filled by "Use published vendor price" has `prov.cls` "C" with its source and date (9.5 item 7); a typed
  quote replaces it with `cls` "D" and the label "your quote". A price with no first-hand published source has no
  fill: it stays blank (`unitCost` null, "Quote required") and is never filled with an estimate (9.5 item 7). Two
  kinds of value load with a synthetic example without a fill: its cost placeholders, [E] values with
  `prov.placeholder` true (9.5 items 4 and 5; Synthetic Ranch C's software is one), and its second-hand reported
  vendor prices, [C] values with `prov.reported` true (9.5 item 4; Synthetic Ranches B and D). Both keep their value
  and label after "Analyze my operation"; only a placeholder is flagged and raises a verdict note (9.3; judgment: a
  reported price carries a dated source). Typing a value or clearing the field replaces either one: it is then the
  user's [D] value, or blank. A version 1 link's starting costs are kept as placeholders too, except two that are
  vendor prices as they stand and get the matching [C] record (9.5 item 8).

### 9.3 Formulas

**Notation.**
- `r` is the real discount rate and `T` the horizon. `PV(Z) = Σ_{t=0}^{T} Zₜ / (1 + r)^t`.
- `Cₜ` is total cost, `Bₜ` total **cash** benefit, `Rₜ` residual value of purchased assets (nonzero only at T, except
  a lease-end residual at T', "Who pays and who receives"), `Xₜ` expected losses avoided (risk lines), `Kₜ` capacity
  value, `Pₜ` production effects not marked "from my records", and `HMₜ` the module's head-months.
- `Cₜ`, `Bₜ`, `Rₜ`, `Xₜ`, `Kₜ` and `Pₜ` are the operator's: each line counts at its operator share ("Who pays and who
  receives" below).
- Net cash `Nₜ = Bₜ + Rₜ − Cₜ`.
- All flows and results are before income tax. The initial version has no after-tax module (L5; owner decision,
  15 Oct 2026).

**Timing.**
- Capital purchases fall in the purchase year.
- An annual line that starts at year `s` and is billed in advance falls in years s..T−1: the bill in year t pays for
  the season that ends at t + 1. Billed in arrears, it falls in years s+1..T.
- Other operating costs arrive at year end, in years s+1..T for a line that starts at s. Benefits arrive at year end,
  in years startYear+1..T, where `startYear` is the module's (default 0, so years 1..T); a cost line's `startYear`
  defaults to the module's. The one exception is avoided capital (fence), which falls in the year it would have been
  bought, its build year `k`, which may not be before the module's `startYear` (9.2).
- Labor follows the module's `startYear` s (judgment). Like every per-year array, an `hours`, `trainingDays` or
  `unitsCut` array is indexed by calendar year t (9.2). One-time setup hours, such as install (B3), go in entry s of
  an `hours` array and fall in year s; unpaid ones enter `K_s` as a negative. Handling hours, recurring added hours,
  paid hours cut and cash labor saved count only in years s+1..T, and a single number entered for `hours` or
  `trainingDays` applies in those years only. An entry of an `hours` array above 0 for a year before s, or an entry of
  a `trainingDays` array above 0 for a year up to s, is a validation error (9.2), and `avoidedHire.startYear` must be
  at least s + 1.

**Head-months and quantities.**
- `HM_c,t = enrolled[c].head_t × enrolled[c].months_t` for virtual fence. For modules without enrollment (water,
  EID): `HM_c,t = classes[c].head_t × served[c].months_t`, with months defaulting to 12. `HMₜ` sums the classes
  listed in `enrolled` (virtual fence) or `served` (water, EID). The sale flows `calvesSold` and `cullCowsSold` are
  never in it (Synthetic Ranch C serves cows and calvesBorn: (300 + 285) × 12 = 7,020 head-months a year).
- In every head-based formula, `head_c,t` means enrolled head for a module with enrollment and inventory head
  otherwise.
- perHeadMonth quantity for season t: `Σ_{c ∈ line.classes} HM_c,t`. perHeadYear: `Σ head_c,t × 12`, with a warning
  when any class's months are below 12. perDevice: `qtyₜ`. fixed: 1.
- Annual line cost in billing year t: `unitCost × billedQty`, each taken for the season the bill pays for (9.2
  field notes).
- **Commitments:** `billedQty` as defined in the 9.2 field notes applies to the seasons inside the commitment
  (seasons s+1..s+commitYears). For an advance-billed line that starts at year 0, those are the bills in years
  t < commitYears. If the horizon ends inside the commitment (s + commitYears > T), `earlyTerminationFee` is charged
  in year T and the page warns that the horizon is shorter than the contract.

**Capital scheduler** (every capital line, and the fence).
- The initial cohort is `qty_s`, bought at `startYear = s`. Each rise above the largest quantity of the years before,
  `Δq_t = max(0, q_t − max_{s≤u<t} q_u)`, t > s, is a new cohort bought in year t. A decrease neither refunds nor
  cancels any cohort, so the devices it leaves idle serve again when the quantity recovers (judgment). The exception
  is a line whose items leave with the animal (`perAnimal: true`; the EID `cowTags` line): it counts each rise over
  the year before, `Δq_t = max(0, q_t − q_{t−1})`, because tags leave with the cattle sold (judgment).
- A cohort first bought at `b₀` is rebought at `b₀ + n·L` for every `b₀ + n·L < T`. No purchase falls in year T.
- `lifeYears: null` means one purchase, no replacement, and residual 0 unless the residual mode says otherwise.
  With `lifeYears: null`, mode `straightLine` gives 0. Only `pctOfCost` or `amount` give a nonzero residual.
- Repairs for each purchase `b`: `repairPct × unitCost × cohortQty` in each service year b+1..min(b+L, T)
  (b+1..T when the life is null).
- Residual at T, for the last purchase `b` of each cohort:
  - `straightLine`: `unitCost × cohortQty × min(1, max(0, (b + L − T) / L))`
  - `none`: 0
  - `pctOfCost`: `pct × unitCost × cohortQty`
  - `amount`: `dollars` for the whole line
- Annual lines never have a residual.

**Cattle-presence rule.**
- In any year t ≥ 1 with `HMₜ = 0`, every benefit line with `requiresCattle` is 0 in year t, capacity hours freed
  are 0, and handling hours are 0. The page says "No cattle in year t: benefits not counted."
- Avoided-capital terms (the fence purchase, rebuilds and the year-T residual) count only if the module has
  `HMₜ > 0` in at least one year 1..T; otherwise the whole stream is 0. Fence upkeep follows the per-year rule.
  (judgment: a one-season destock does not un-build a fence the ranch would otherwise own)
- Costs are not zeroed. Head-based quantities fall to 0 by themselves, and committed minimums are still billed.

**Who pays and who receives** (F6; owner decision, 15 Oct 2026).
- Land units: `landUnits[u].share` is unit u's share of the module's head-months (virtual fence) or water points
  (water); the shares sum to 1. Each water and virtual fence line is split by unit in proportion to `share`: the
  cost lines and every benefit line, including the labor cut with its paid hours cut, the hours saved, and the risk
  and production lines. The fence block names the land unit it is on. The fence line is the one virtual fence line
  that is not split by `share`: all of it lies on the land unit that `vf.fence.landUnitId` names (the first land unit
  by default), and that unit's tenure decides it (Fence, below). A `landUnitId` that names no land unit is a
  validation error (9.2). EID lines are not split: tenure does not affect them.
- Every line, or each unit's part of a split line, has an operator share `s` from 0 to 1. It is 1 unless a land-unit
  answer sets it (the water and fence rules below), and it is always shown and editable. A cost the landowner pays,
  such as a water-monitor subscription, is answered "landowner or other" on its line, giving operator share 0. The
  operator's flow is `s × flow`, taken after the pool scale (9.6) and the ramp; `Cₜ`, `Bₜ`, `Rₜ`, `Xₜ`, `Kₜ` and `Pₜ`
  sum these. The rest, `(1 − s) × flow`, is listed under "Paid by others" (costs) or "Received by others" (benefits)
  and never enters a result.
- A leased unit whose lease ends at year `T' = leaseYears ≤ T` with `renewalExpected` false: that unit's part of
  each benefit line is 0 in years after T', for the operator and for others. Its part of a capital line with
  `staysWithLand` (an improvement left on the land) runs through the scheduler with horizon T': no purchase in year
  T' or later, no repair after T', and, when that part had a purchase before T', a residual at T' equal to its part
  of the line's `leaseReimbursement` (default 0). `leaseReimbursement` is the total the leases pay for the line's
  parts on the leased units, not expected to renew, whose lease ends within the analysis horizon T
  (`leaseYears` ≤ T) and whose part had a purchase before its T'; each such unit's part receives
  `leaseReimbursement × share_u ÷ Σ share` over those units, at its own T'. The full-horizon analysis fixes this
  allocation, and the N-year test (B9, below) keeps it rather than splitting the total again (judgment): in the
  test, a unit of that set whose T' ≤ N receives the same amount at its T', and a unit whose T' > N is treated like
  ownership, with no reimbursement within the test. When N > T, a unit whose lease ends after T and no later than N
  follows the lease-end rule in the test with a reimbursement of 0, because the entered total covers only the leases
  that end within T (judgment). The fence follows the same rule with its land unit's `fenceReimbursement`, which
  belongs to that one lease and is used as entered, in the N-year test too (Fence, below). These lease-end residuals
  are the one exception to Rₜ being nonzero only at T, and the year table shows them in year T'. The parts on other units
  keep the line's own residual mode at T, and devices the operator takes away keep their residual (judgment). Other
  cost lines are not cut at T': they run as entered, and when T' < T the page warns that the horizon runs past the
  lease (judgment).
- A lease that runs past T (`leaseYears` > T), or is expected to renew, is treated like ownership within the horizon
  (simplification). A lease that ends exactly at T follows the lease-end rule above, so an improvement left on the
  land has the reimbursement as its residual at T, not its straight-line residual.
- `analyze()` returns the amounts that are not the operator's as `paidByOthers` and `receivedByOthers`: lists of
  `{lineId, unitId, series, pv}`, where `series` holds the amount in each year 0..T and `pv` its present value. For
  the capacity line `hoursFreed`, `series` holds hours and `pv` is null. The page lists them below the year table, by
  line and year, with the PV, and lists hours freed in hours, without a PV (9.5 item 3).

**Order of operations**, for each benefit line and year:
1. the raw claim;
2. the land-unit split, with a leased unit's part set to 0 after T';
3. the ramp (not for avoided capital);
4. the cattle-presence rule;
5. the single-module clamp or the `combine()` scale (9.6), computed on the claims after steps 2–4;
6. × `valuePerUnit`;
7. the operator share.

Hours saved derived from a claim take the same factors in steps 2–5; paid hours cut and cash labor saved follow
them through the factor `fₜ` (Labor, below).

**Labor** (F1).
- `paidHoursCutₜ = unitsCutₜ × hoursPerUnit`. `unitsCut` is a whole number for day, week and position. For a
  position, `hoursPerUnit` is the position's paid hours a year.
- Cash labor saved (in Bₜ): `cashLaborₜ = unitsCutₜ × hoursPerUnit × paidRate × (1 + loadPct)`; for a position,
  `unitsCutₜ × salary × (1 + loadPct)`. If `freedTimeUse` is "absorbed", `unitsCut` counts as 0, so paid hours cut
  and cash labor saved are 0 (with the notice in 9.2).
- Avoided hire (in Bₜ): `avoidedHireₜ = salary × (1 + loadPct)` in years startYear..min(startYear + years − 1, T),
  with startYear ≥ s + 1, where s is the module's `startYear` (Timing).
- Paid added hours (in Cₜ): `paidAddedₜ = paidHoursAddedₜ × paidRate × (1 + loadPct)`, in the year the hours are
  worked. Entry s of an `hours` array (install and other one-time setup, B3; entry 0 with the default `startYear`
  0) falls in year s; recurring hours fall at year end, in years s+1..T. A single number entered for `hours` is
  hours per year, recurring in years s+1..T; an array gives the hours in each year t.
- Handling hours (virtual fence and EID), computed at year end in years s+1..T, and only in years with `HMₜ > 0`:
  `handlingHoursₜ = Σ_events timesPerYear × head(classes, t) × minutesPerHead × crewSize ÷ 60 + gathers ×
  gatherRiders × hoursPerGather + trainingDaysₜ × trainingRiders × hoursPerDay`, where `trainingDaysₜ`
  is entry t of `trainingDays` when it is given by year (9.2).
  They count as paid or unpaid added hours according to `doneBy`.
- Paid hours cut and cash labor saved follow the hours that support them (judgment). The eligible hours saved are
  the hours saved (below), less the health-check hours when `validatedAlert` is not set. The ramp and the
  cattle-presence rule apply to every part of them; the single-module clamp or the `combine()` scale (9.6) applies
  only to the part that comes from a pooled claim (water runs, gathering hours). `fₜ` is the eligible hours of year
  t after steps 3–5 of the order of operations ÷ the eligible hours of year t before them (1 when that is 0). Each
  land unit's part of `paidHoursCutₜ` and of cash labor saved is multiplied by `fₜ`. The validation rule of 9.2
  compares the entered paid hours cut with the eligible hours before steps 2–5. While `freedTimeUse` is "absorbed",
  the paid hours cut are 0 for that rule and for the solver's clip (What would make it pay, below); the typed
  `unitsCut` is kept but not checked against the hours saved. When every eligible hour comes from
  one pooled claim, `fₜ` is that claim's scale times its ramp factor, as in 10.1 row 9.
- Hours saved, `hoursSavedₜ`, after the order of operations above: water `Σ_b runs_b × shareAvoided_b ×
  hoursPerRun_b`; virtual fence `gatherHoursCut + healthCheckHoursCut`; EID `recordingHoursToday`; and, in every
  module, `labor.otherHoursSaved`. Health-check hours support paid hours cut (cash) only when the user cites a
  validated alert function (`validatedAlert`, 9.4). Without it, `paidHoursCutₜ` may not exceed
  `hoursSavedₜ − healthCheckHoursCutₜ`, and the health-check hours count as capacity only.
- Capacity: `hoursFreedₜ = (hoursSavedₜ − paidHoursCutₜ) − unpaidHoursAddedₜ`, shown in hours.
  `Kₜ = hoursFreedₜ × oppCostPerHour` (0 if no rate is entered). Unpaid install hours enter `K_s` as a negative.
- `loadPct` is user-entered, with a help range of about 10% (legally required benefits) to 42% (all benefits) of
  wages; see the Labor load row in §5.3.

**Water runs and vehicle** (B7).
- Per season block b: `runs_b = runsPerWeek_b × weeks_b`.
- `shareAvoided_b` is capped at `max(0, (runsPerWeek_b − minVisitsPerWeek_b) ÷ runsPerWeek_b)`, and at 0 when
  `runsPerWeek_b` is 0. A block flagged "tanks freeze / water checked on the feeding route" defaults to 0%; a user
  override shows a warning.
- The cap applies to the share as entered, before every other step (judgment): the claim on `waterRuns` (step 1 of
  the order of operations), the vehicle saving, the hours saved, the 9.2 paid-hours check, the tornado (9.5 item 6)
  and the B9 driver (its entered value, shown under "You entered", and its range) all use the capped share. A share
  typed above the cap is kept and shown in its input, used at the cap, and, on a block with runs, noted (9.5 item
  11).
- Claim on `waterRuns`: `Σ_b runs_b × shareAvoided_b` runs/yr, against the baseline `Σ_b runs_b`.
- Vehicle (cash): `Σ_b runs_b × shareAvoided_b × scale × milesPerRun_b × variableCostPerMile`. The help text says
  variable cost is fuel, maintenance and tires, *not* the IRS rate.
- Hours saved: `Σ_b runs_b × shareAvoided_b × scale × hoursPerRun_b`.
- Tenure: on a land unit where the landlord provides and checks water, or care is included in the lease rate, that
  unit's part of the lines that value water runs (the vehicle `vehicle`, the labor cut `laborCut`, an avoided hire
  `avoidedHire` and the hours freed `hoursFreed`) defaults to operator share 0, the saving is listed under "Received
  by others", and the page explains why (judgment: the operator would neither drive those runs nor hire for them).

**Fence** (F6; one function).
- `fenceCost_b(t)` is the stream of a capital line with unitCost `F`, qty `miles`, startYear `b`, lifeYears `Lf`,
  repairPct `m` and a straight-line residual: purchases and upkeep, minus the residual at T. If b ≥ T, the stream is
  0 in every year (a purchase in year T would net to zero against its 100% residual).
- Avoided: `fenceBenefitₜ = fenceCost_k(t)`.
- Deferred by d: `fenceBenefitₜ = fenceCost_k(t) − fenceCost_{k+d}(t)`.
- The line claims `miles` on the `fenceMiles` pool, against the baseline `planMiles` (9.6), so a pool scale below 1
  scales the whole stream.
- Tenure rule (for the fence's land unit; see "Who pays and who receives"):
  - Owned, or leased for more than T years (or expected to renew) with the tenant building the fence: as above, at
    operator share 1. (Simplification: a lease that runs past T is treated like ownership within the horizon.)
  - Leased and the landlord provides the fence: operator share 0, so the operator's `fenceBenefitₜ = 0`; the stream
    is listed under "Received by others".
  - Leased, tenant builds, and the lease ends at year `T' ≤ T` with no renewal expected: run `fenceCost` with
    horizon T' and residual `{mode: "amount", dollars: fenceReimbursement}` at T'. All fence flows after T' are 0.
  - If the landlord maintains a fence the tenant would build, the tenant's upkeep `m` is 0.

**Death loss and other risk lines** (F7).
- One line per `riskLines` entry: `claimₜ = eventsPerYear × headPerEvent × shareCaught` head/yr on
  `deathLoss:<cause>`, against the pool's baseline: the sum of `eventsPerYear × headPerEvent` over the analysis's
  `riskLines` entries with that cause (9.6). An analysis may hold several entries with one cause, for example one per
  class, and their claims are clamped together (9.6). `valuePerUnit = classes[c].valuePerHead`.
  Blank gives 0.
- Kind `risk`: it enters `Xₜ` only.
- The optional water offset "losses from fewer physical checks" (`water.fewerChecksLoss`) is a negative risk line
  with no pool: `−headPerYear × classes[c].valuePerHead` a year for its class. Blank by default.

**Production** (F4).
- `gainₜ = Σ_{c ∈ production.classes} lbsPerHead × headSold_c,t × valueOfGain_c`, at year end, over sold classes
  (calvesSold, cullCowsSold, yearlings), with `lbsPerHead = lbPerHeadPerDay × days`. `headSold_c,t` is
  `classes[c].head_t` for calvesSold and cullCowsSold, and `classes.yearlings.head_t × soldShare` for yearlings.
  Kind `production` (in Pₜ) unless `fromRecords` is true, in which case it is a cash line.
- `valueOfGain_c` is user-entered or computed as `(W_heavy × P_heavy − W_base × P_base) ÷ (W_heavy − W_base)` from
  two dated AMS weight-class quotes. Help text: "not the sale price per pound". NASS's "calves" price covers animals
  under 500 lb.

**Ramp** (B3). Each benefit line's claim in the module's first three operating years (years startYear+1 to
startYear+3) is multiplied by `ramp[1]`, `ramp[2]` and `ramp[3]` (default 1). Avoided capital is not ramped. Every
part of the hours saved is ramped, including health-check hours and `labor.otherHoursSaved`, and paid hours cut and
cash labor saved follow through `fₜ` (Labor).

**Virtual fence lines.**
- Purchased collars (`collars`): a capital line whose qty comes from enrolled head (9.2 field notes); the service
  fee (`serviceFee`) is an annual perDevice line billed in advance with `qtyₜ = Σ_c enrolled head_c,t` for season t,
  the collars in use that season (billed in year t − 1).
- Collar batteries (`collarBatteries`, annual, billed in arrears):
  `qtyₜ = batteriesPerCollar × Σ_c enrolled head_c,t`, at the battery price.
- Collar loss (`collarLoss`, annual, billed in arrears): `qtyₜ = collarLoss.pctPerYear × Σ_c enrolled head_c,t`,
  with `unitCost = collarLoss.chargePerCollar`.

**EID lines and premium** (B4a).
- Tags (`cowTags`, `calfTags`, `retags`), reader, indicator and load bars, platform and software are separate lines.
  Retags: `qtyₜ = retagPct × Σ head_c,t` over the cowTags line's classes, billed in arrears.
- Free tags, `freeTags = {qty, years}`: in each listed billing year t, up to `qty` tags (`qty[t]` for an array) cost
  $0. They apply first to the tags billed in year t on the cow-tag line, then calf tags, then retags, and free tags
  not used in a year do not carry over. They lower the tag lines whether or not the rule applies (Synthetic Ranch C:
  `{qty: 300, years: [0]}` frees the 300 cow tags; `{qty: [300, 285], years: [0, 1, 2, 3, 4, 5, 6, 7]}` also frees
  the 285 calf tags of years 1–7).
- `ruleApplies[c]` is recorded but changes no line: every tag is a project cost until B4b is built. A "yes" shows
  the B4a notice (9.4).
- Premium (cash): `premiumₜ = headInProgramₜ × saleCwt × premiumPerCwt − headInProgramₜ × verificationFee`, with
  `headInProgram` drawn from `calvesSold`. Default blank.
- Dosing (cash benefit `dosing`, at year end): `dosingₜ = Σ_c head_c,t × applications_c × perApplication`, over the
  classes in `dosing.applications` (Synthetic Ranch C: (300 × 2 + 285 × 1) × $0.45 = $398.25 a year). Blank
  gives 0.

**EID compliance baseline** (B4b; not in phase 1, built only after research task R1, 8.4).
- For each class with `ruleApplies[c]`, the baseline holds the tags the rule requires for that class, at the same
  price, less free tags in the years and quantities available. The project holds the same tags, so they net to
  zero. Voluntary tags are project costs only.
- The analysis uses `incrementₜ = projectCostₜ − baselineCostₜ` in Cₜ.

**Metrics.**
- Cash NPV `= PV(B) + PV(R) − PV(C)`.
- Cash NPV including expected losses avoided `= Cash NPV + PV(X)`.
- Economic NPV `= Cash NPV + PV(X) + PV(K) + PV(P)`.
- BCR `= (PV(B) + PV(R)) / PV(C)`, or "n/a" if PV(C) = 0. Avoided capital and its lost residual are inside B. Risk,
  capacity and production lines never enter BCR, IRR or payback.
- **First year with cash flows**, `s₀`: the first year t in which `Cₜ`, `Bₜ` or `Rₜ` is $0.005 or more in absolute
  value (0 when there is none). When the module or its lines start after year 0, the years before s₀ hold no flows,
  so the IRR and payback rules read year s₀ where they would otherwise read year 0 (judgment; 10.1 row 48).
  `irr()` and `payback()` take s₀ as an argument, 0 by default, so a raw cash-flow series (10.1 rows 3, 4, 5, 17
  and 27) is read from year 0; `analyze()` passes its own s₀, which is 0 for every example.
- **IRR**, on Nₜ, checked in this order:
  1. All Nₜ = 0: "n/a: no cash flows".
  2. N_{s₀} ≥ 0: "n/a: no net outlay in year `<s₀>`" ("n/a: no net outlay in year 0" when s₀ is 0).
  3. More than one sign change, ignoring zeros: "n/a: cash flows change sign more than once".
  4. Σ Nₜ < 0 (undiscounted): "below 0%".
  5. Σ Nₜ = 0: the IRR is 0 ("0.0%").
  6. Otherwise solve by bisection on [0%, 10,000%]. If NPV at 10,000% is still positive, show "above 10,000%".
- **Payback**, on Nₜ, with `cumₜ = Σ_{u≤t} N_u`:
  1. All Nₜ = 0: "n/a: no cash flows".
  2. cum_T < 0: "none within T years" ("none within 1 year" when T is 1, 9.5 item 1). If N_{s₀} ≥ 0, add " (no net outlay in year `<s₀>`; cumulative negative from year
     j)", where j is the first year with cumⱼ < 0. In addition, if cumulative was zero or positive in any year after the
     first year it was negative (any year after s₀ when N_{s₀} < 0; any year after j when N_{s₀} ≥ 0), add " (positive
     in year(s) a, b, …, negative again by year T)", listing each such year, separated by commas. Each part has its own
     parentheses after a space: Nₜ = 100, −150, 100, −100 gives "none within 3 years (no net outlay in year 0;
     cumulative negative from year 1) (positive in year(s) 2, negative again by year 3)" (10.1 row 17).
  3. Otherwise let k be the smallest t such that cum_u ≥ 0 for every u ≥ t. If k = 0: "no net outlay: cumulative
     cash never negative". Otherwise payback = (k − 1) + (−cum_{k−1} / N_k) years. N_k > 0 is guaranteed because
     cum_{k−1} < 0 ≤ cum_k. If cumulative was zero or positive in some year from s₀ to k − 2, add " (cumulative was
     positive in year a, then negative again before year k)", where a is the first such year (10.1 row 4). Payback
     is counted from year 0; when s₀ is above 0, the text then ends " (counted from year 0; the first cash flow is
     in year `<s₀>`)" (judgment; 10.1 row 48).
  4. Discounted payback applies the same rule, with the same s₀, to `Nₜ / (1 + r)^t`.
- Comparisons with 0 in the IRR and payback rules use a tolerance of $0.005: a value, sum or cumulative with
  |x| < 0.005 counts as 0.
- Display: payback in years to two decimals ("4.00 years", "2.31 years"); IRR as a percent to one decimal with
  thousands separators ("18.7%", "1,900.0%"). `analyze()` returns the IRR as a fraction (19.000 for 1,900.0%).
- Cost per head-month `= PV(C) / PV(HM)`, with `PV(HM) = Σ_{t=1}^{T} HMₜ / (1 + r)^t`; "n/a" when PV(HM) = 0.
- Hours freed per year: the yearly values of `hoursFreedₜ`, with their average over years 1..T on the tile.

**Payback target and the N-year test** (B9; owner decision, 15 Oct 2026).
- `N = settings.paybackTarget`, a whole number of years ≥ 1 (default 5).
- `targetTest(a)` runs the whole analysis again with horizon N in place of T and every other input unchanged. A
  per-year array longer than N + 1 entries is cut to N + 1; a shorter one carries its last value (9.2). Every rule
  of this section then applies with N as the horizon: purchases at b₀ + n·L < N, repairs and fence upkeep through
  year N, advance billing in years s..N−1, commitments (an `earlyTerminationFee` in year N when a commitment runs
  past it) and the leased-land rules (a lease that ends at T' ≤ N follows "Who pays and who receives", where a capital
  line's `leaseReimbursement` keeps its full-horizon allocation; one that runs past N years, or is expected to renew,
  is treated like ownership).
- Residuals are valued at year N. `straightLine` residuals are recomputed at N, including the lost residual of
  avoided fence. `pctOfCost` and `amount` residuals are used as entered (judgment: they are the user's estimates for
  the asset, and the tool cannot re-derive them for another year); the panel notes this when such a line exists
  (9.5 item 9).
- A line, or the module, that starts in year N or later has no flows in the test; the rule `startYear` < T (9.2) is
  not applied to the test.
- The analysis "pays for itself within N years" when the test's cash NPV ≥ 0: the operator's share, before tax,
  cash lines only (risk, capacity and production lines never count), discounted at the analysis's real rate.
- A test with no cash flows for the operator (Cₜ, Bₜ and Rₜ each below $0.005 in absolute value in every year 0..N)
  neither pays nor fails (judgment), for example when the module starts in year N or later or every operator share
  is 0. The line under the verdict then reads "No cash flows for you within N years", the verdict carries no
  "It would pay" sentence, and each driver's N-year result is "n/a" (9.5 item 9).
- If N > T, the test runs past the main horizon with every price and quantity unchanged, and the page says that the
  test "assumes the same prices continue to year N" (9.5 item 9).
- The headline stays the full-horizon cash NPV. The test gives the line under the verdict sentence (9.5 item 1). It
  is not called payback, because it counts residual value (judgment).
- `targetTest(a)` returns `{ years: N, cashNPV, pays, warnings }`, with `pays` true when `cashNPV ≥ 0`, false when
  it is below 0, and null when the test has no cash flows for the operator (above). `warnings` lists the warnings
  that the N-year run raises and the full-horizon run does not, such as a contract that runs past year N; the
  panel shows them (9.5 item 9). Two warnings are the same when they come from the same notice of 9.5 item 11 about
  the same line, class, land unit or pool, whatever horizon or year their text names; a warning is listed only when
  the full-horizon run raises none that is the same (judgment; 10.1 row 50).

**What would make it pay** (B9; the panel and its strings are in 9.5 item 9).
- `solveDrivers(a)` takes each driver that the module's `PAYBACK_DRIVERS(a)` returns (table below) and, holding
  every other input fixed, finds (a) the value at which the N-year test's cash NPV is 0 and (b) the value at which
  the full-horizon cash NPV is 0.
- Search range: [lo, hi], widened to include the entered value, then clipped to the values that pass the two 9.2
  validation rules that bound a value, paid hours cut within the hours saved and a residual within the cost of its
  purchase, with every other input fixed. No other validation rule is applied to trial values, and the
  whole-number rules do not apply to them (9.2). Each bounding rule is linear in a phase-1 driver, so the valid
  values form one interval around the entered value; the solver finds each end of it by bisection on those two
  rules (100 halvings, keeping the valid end). An end that the clip moves is reported on the driver's row with the
  rule that moved it (9.5 item 9). A driver that moves one input whose entered value is blank ("Quote required") widens
  nothing and is solved like any other.
- At the two ends of the clipped range: if the cash NPV is below 0 at both, the result is "none"; if it is 0 or more
  at both, the result is "all". Otherwise bisection on the cash NPV gives the value: each phase-1 driver moves the
  cash NPV in one direction only, or not at all (for herd size, because every quantity that depends on head scales
  in proportion, below), so there is one crossing. The bisection keeps one end of its bracket where the cash NPV is
  below 0 and one where it is 0 or more, halves the bracket 100 times, and returns the second end, so the value
  returned pays. The direction is "at least" when the cash NPV is higher at the top of the range
  than at the bottom, and "at most" otherwise.
- `solveDrivers(a)` returns one row per driver: `{ path, label, unit, entered, lo, hi, clippedLo, clippedHi,
  clipReasonLo, clipReasonHi, target, horizon }`. `clippedLo` and `clippedHi` are the ends after the clip, or null where
  the clip did not move an end; `clipReasonLo` and `clipReasonHi` name the rule that moved that end, "paidHours" or
  "residual", or are null; `target` (the N-year test) and `horizon` (the full horizon) are each `{ state, value,
  direction }`, with `state` "value", "none", "all" or "n/a".
- Drivers that move linked inputs (`set`), each built from `setPath()` calls:
  - Herd size (every module): its value is the head in year y of the module's first served or enrolled class, in the
    class order of 9.2, whose head is above 0 in some operating year (Synthetic Ranches A, C and D: cows; Synthetic
    Ranch B: yearlings). Every head count in the analysis (`classes[c].head` for every class, `heifersRetained` and
    `enrolled[c].head`, in every year) is multiplied by the value ÷ the entered value, so the counts the module takes
    from head follow (head-months, collars, tags, weighings, doses and head in program). Device counts entered directly
    (monitors, base stations), fence miles, labor units and hours, and risk-line inputs do not change. Free-tag
    quantities (every entry of `eid.freeTags.qty`) and the `minQty` of every line whose quantity comes from head
    (perHeadMonth and perHeadYear lines, and perDevice lines such as tags and purchased collars) are multiplied by the
    same factor (judgment: both are allowances sized to the herd). Every quantity that depends on head then scales in
    proportion, so the cash NPV changes in a straight line with herd size (10.1 row 46).
  - Interior fence that would otherwise be built: sets `vf.fence.miles` to the value. When the entered `planMiles` is
    below the entered miles, so that the analysis clamps the fence claim (9.6), it multiplies `planMiles` by the
    value ÷ the entered miles, which keeps the clamp's ratio; otherwise it raises `planMiles` to the value when it is
    lower, so the plan covers the miles. A blank `planMiles` keeps defaulting to `miles`. Either way the trial at the
    entered value reproduces the analysis, including any clamp (judgment).
  - Hired moving and gathering hours cut: its value is the paid hours cut a year (`unitsCut × hoursPerUnit`). It sets
    `labor.cut.unitsCut` to the value ÷ `hoursPerUnit` and moves `vf.gatherHoursCut` by the same number of hours, so
    the paid hours cut stay within the hours cut (judgment).
  - Net program premium: its value is the net premium a year at the head in program in year y (a blank premium
    counts as 0). It sets `eid.premium` to `{ saleCwt: 1, premiumPerCwt: value ÷ head in program in year y,
    verificationFee: 0 }`, which gives that net premium per head (judgment: only the net amount enters cash).
  - Reader and scale cost: its value is the sum of the `reader`, `indicatorBars` and `platform` unit costs; each is
    multiplied by the value ÷ the entered sum.
  - Added hours (EID): its value is the added hours of year y (handling hours and `labor.added` hours). Every
    handling time input (`minutesPerHead`, `hoursPerGather`, `hoursPerDay`) and every `labor.added` item's hours are
    multiplied by the value ÷ the entered value.
  - For these three drivers, y is the first operating year (years s + 1 to T, with s the module's `startYear`) in
    which the quantity read is above 0: year 1 in every example. When that quantity varies across the operating
    years, the row's label ends " (year `<y>`; other years in proportion)", as for an array (below).
  - Herd size, reader and scale cost, and added hours scale what is entered, so each is "n/a" when there is nothing
    to scale: no served or enrolled head in any operating year, an entered reader and scale sum of 0, or no added
    hours in any operating year. The premium is "n/a" when there is no head in program in any operating year; an
    entered premium of 0 is solved like any other.
  - The hired-labor drivers (water "Hired labor cut", virtual fence "Hired moving and gathering hours cut") are "n/a"
    in both columns while `freedTimeUse` is "absorbed", because the engine then counts no units cut (9.2), and while
    a field that 9.2 requires for `unitsCut` above 0 is blank (`hoursPerUnit`, `paidRate`, `salary` or `loadPct`, by
    labor unit) or `hoursPerUnit` is 0, because a cut then has no cash value to compute or no paid hours to check
    against the hours saved (judgment). This holds even when the entered `unitsCut` is 0, so the solver never divides
    by a `hoursPerUnit` of 0.
- A driver whose path holds a per-year array (`labor.cut.unitsCut`, or a `unitCost` given by year) moves the whole
  array in proportion (judgment). Its value is entry y of the array: the first entry above 0 in the years the input
  is used (from the module's `startYear` + 1 for `labor.cut.unitsCut`; for a `unitCost`, from season s + 1 on an
  annual line and from purchase year s on a capital line, with s the line's `startYear`, 9.2 field notes). A trial
  value multiplies every entry by the value ÷ the entered entry y, or, when every entry is 0 or
  blank, sets every entry to the value. The row's label then ends " (year `<y>`; other years in proportion)", and
  "You entered" shows entry y. For the virtual fence's hired hours driver, `vf.gatherHoursCut` moves by the change
  in entry y's hours. An array whose entries are all equal is treated like a single number, with no suffix (10.1
  row 46).
- Every driver's N-year result is "n/a" when the N-year test has no cash flows for the operator, and every
  full-horizon result is "n/a" when the analysis has none in years 0..T (Verdict rules, below).
- Ranking, for the verdict's sentence (9.5 item 1): among the drivers whose N-year result is a value, the smallest
  |value − entered| ÷ |entered| comes first; a driver entered as 0 or left blank ranks after the others; ties keep the
  order of `PAYBACK_DRIVERS(a)`. A price left blank is never named: the sentence appears only when the N-year test
  fails, a blank price already counts as $0, and a higher price only lowers the cash NPV, so its N-year result is
  "none".

Phase-1 drivers, in the order `PAYBACK_DRIVERS(a)` returns them. The ranges are judgment, wide enough to hold every
value in section 11. Miles per run and \$ per mile are factors of one product (runs × miles × \$/mile, 9.5 item 6), so
they are one driver, solved on \$ per mile.

| Module | Driver (label on the page) | Moves | Unit | lo | hi |
|---|---|---|---|---|---|
| Water | Share of runs avoided in `<block name>` (one per season block) | `water.blocks.<b>.shareAvoided` | % | 0 | the block's cap ("Water runs and vehicle", above) |
| Water | Vehicle cost per mile | `water.variableCostPerMile` | \$/mi | 0 | 5 |
| Water | Hired labor cut | `labor.cut.unitsCut` | the labor unit (hours, days, weeks or positions) | 0 | 10,000 hours, 365 days, 52 weeks or 10 positions |
| Water | Monitor price | `costs.monitors.unitCost` | \$ per monitor | 0 | 10,000 |
| Water | Subscription per monitor | `costs.subscription.unitCost` | \$ per monitor per year | 0 | 5,000 |
| Water | Herd size | `herd` (set) | head of the class, by its name (cows, yearlings, …) | 1 | 10,000 |
| Virtual fence | Interior fence that would otherwise be built | `vf.fence.miles` (set) | mi | 0 | 200 |
| Virtual fence | Fence cost per mile | `vf.fence.F` | \$/mi | 0 | 50,000 |
| Virtual fence | Hired moving and gathering hours cut | `labor.cut.unitsCut` (set) | h/yr | 0 | 10,000 |
| Virtual fence | Subscription (leased collars), or Service fee (purchased collars), by `vf.pricing` | `costs.subscription.unitCost`, or `costs.serviceFee.unitCost` | \$/head/month, or \$ per collar per year | 0 | 20, or 1,000 |
| Virtual fence | Herd size | `herd` (set) | as for water | 1 | 10,000 |
| EID | Herd size | `herd` (set) | as for water | 1 | 10,000 |
| EID | Net program premium | `eid.premium` (set) | \$/yr | 0 | 100,000 |
| EID | Tag price | `eid.tagPrice` | \$/tag | 0 | 20 |
| EID | Reader and scale cost | `costs.reader`, `costs.indicatorBars` and `costs.platform` (set) | \$ | 0 | 50,000 |
| EID | Added hours | handling and `labor.added` hours (set) | h/yr | 0 | 2,000 |

`PAYBACK_DRIVERS(a)` leaves out a driver whose input has nothing to act on (judgment): a price driver whose cost line
is not in `a.costs` (the monitor price, the subscription per monitor, and the virtual fence subscription or service
fee; the reader and scale cost when none of `reader`, `indicatorBars` and `platform` is there; the tag price when none
of `cowTags`, `calfTags` and `retags` is there); the share driver of a season block with no runs (`runsPerWeek` or
`weeks` 0); the vehicle cost per mile when `a.water.blocks` is empty; the hired-labor drivers when `a.labor.cut` is
absent; the two fence drivers when `a.vf.fence` is absent; and the virtual fence price driver when `a.vf.pricing` is
not set. Herd size, the net program premium and added hours are always returned, with their "n/a" states. The
version 1 lines `v1Hardware`, `v1Fixed` and `v1Subscription` (9.5 item 8) have no driver.

**Verdict and provenance rules** (the texts are in 9.5 item 1; 7.2 and 7.3 give the reasons).
- "Pays" only if Cash NPV ≥ 0. If Cash NPV < 0 but Cash NPV including expected losses avoided ≥ 0: "pays only if
  the loss estimate holds". Otherwise: "does not pay".
- The exception: an analysis with no cash flows for the operator (Cₜ, Bₜ and Rₜ each below $0.005 in absolute value
  in every year 0..T) gets the verdict "No cash flows for you in this analysis", never "pays" (judgment; 10.1
  row 1).
- A line is *estimated* if any input it multiplies is [B], [C] or [E]. When PV of estimated cash and residual
  lines > 0.5 × (PV(B) + PV(R)), the verdict adds "Indicative only: most of the benefit is estimated, not from your
  records." A [C] published price on a cost line never counts as support for a benefit line, and a benefit line
  built on an [E] assumption stays estimated whatever the source of the price (owner decision, 15 Oct 2026).
- An input is *material* if its line's |PV| ≥ 10% of PV(B) + PV(R). Rounding follows 7.3, for the figures that 9.5
  item 2 names.
- The verdict sentence (except "No cash flows for you in this analysis.", which states no amount) and the headline
  figures say "before tax". While `ownAnalysis` is true and `rateReviewed`
  is false, the verdict also carries "Discount rate not yet reviewed"; results are computed either way.
- While `ownAnalysis` is true and any value with `prov.placeholder` is not yet `confirmed`, the verdict also carries
  "Includes synthetic cost placeholders"; results are computed either way. A placeholder that the user replaces (by
  typing a value or clearing the field) is no longer one (9.2).
- The line under the verdict sentence comes from the N-year test (B9): "Pays for itself within N years (counting
  equipment value left at year N)" when `targetTest(a).pays` is true, "Does not pay for itself within N years" when
  it is false, and "No cash flows for you within N years" when it is null. When the test fails, the verdict also
  carries the sentence of 9.5 item 1 that names the first two drivers of the ranking above.

### 9.4 Module inputs (phase 1)

Units are in brackets and field names in code type: paths in the analysis of 9.2, with each cost line's id in
`costs`. Money is in today's US dollars and quantities are in US units (lb, cwt, miles, acres, head); percentages
are shown as percents and stored as fractions (9.2). The table in section 5 gives the evidence class and any
suggested value for each input. A price input is a cost line's unit cost (`costs.<id>.unitCost`, and
`vf.collarLoss.chargePerCollar` for the `collarLoss` line) or the tag price `eid.tagPrice`; wages and labor rates,
vehicle cost per mile, the fence cost per mile `F` and benefit inputs are not price inputs. A price input offers "Use
published vendor price" only where 9.5 item 7 lists a fill: a first-hand published price (the vendor's or a
dealer's own page, listing or flyer). A price reported second-hand by the press or extension is never a fill
(section 4 context only). Every other price input is blank and marked "Quote required", except two kinds of value
that load with a synthetic example: its cost placeholders and its second-hand reported vendor prices (9.5 items 4
and 7). A version 1 link's starting costs are kept as placeholders too, except two that are vendor prices as they
stand (9.5 item 8).

Besides the lines listed below, `buildLines` derives lines with fixed ids (9.2): `handling` (the handling hours of
virtual fence and EID, a cost line when `doneBy` is "paid"), `added:<i>` (the hours of `labor.added[i]`, a cost
line when its `doneBy` is "paid") and `hoursFreed` (the capacity line). Each shows "Who pays for this?" or "Who
receives this saving?" like the lines below.

Labels on the page (judgment). The year table, the tornado, the notices and the validation errors name each line
and input by these labels, and tests assert them (9.5 item 11).
- Lines: water `monitors` "Monitors", `mounting` "Mounting", `subscription` "Subscription", `batteries` "Batteries
  and repairs", `vehicle` "Vehicle", `laborCut` "Hired labor cut", `fewerChecks` "Losses from fewer physical
  checks"; virtual fence `subscription` "Subscription", `collars` "Purchased collars", `serviceFee` "Service fee",
  `collarBatteries` "Collar batteries", `baseStations` "Base stations", `infrastructure` "Infrastructure",
  `collarLoss` "Collar loss", `fence` "Interior fence avoided" ("Interior fence deferred" when `mode` is
  "deferred"), `laborCut` "Hired moving and gathering hours cut"; EID `cowTags` "Cow tags", `calfTags` "Calf tags",
  `retags` "Retags", `reader` "Reader", `indicatorBars` "Indicator and load bars", `platform` "Platform", `software`
  "Software", `premium` "Net program premium", `dosing` "Dosing savings", `laborCut` "Hired labor cut"; in every
  module `avoidedHire` "Avoided hire", `production` "Weight gain", `risk:<i>` "Losses avoided (`<cause>`)" (when
  several risk lines share a cause, each adds its class by its name, 9.5 item 9: "Losses avoided (water, cows)"),
  `handling` "Handling labor", `added:<i>` its item's `label`, and `hoursFreed` "Hours freed"; and the version 1
  lines `v1Hardware`, `v1Fixed` and `v1Subscription` their version 1 labels, "Hardware per head", "Base station,
  setup and install" and "Subscription per head" (`roi.js:10-12`).
- Inputs: an input that a B9 driver moves takes the driver's label (9.3 table; for example "Interior fence that
  would otherwise be built" for `vf.fence.miles` and "Hired labor cut" for the water module's
  `labor.cut.unitsCut`); the rate and the payback target take the labels of 9.5 item 7; any other input takes its
  description in the list below with its first letter capitalized, and a field listed by name only, such as a
  block's `runsPerWeek`, takes that name in words ("Runs per week"). The page follows the label with the input's
  unit in parentheses, as 9.5 item 7 does ("Payback target (years)"); a notice or a validation error names the
  input without its unit (9.5 item 11).

- **Shared (steps 1 and 2 of 7.1):**
  - horizon `T` [whole years] (prefilled per F2; the user can change it) and real discount rate `discountRate`
    [%/yr] (the example's rate, shown and editable and labeled as an example assumption; the review prompt and
    `rateReviewed` in 9.5 item 5; never blocks results)
  - payback target `settings.paybackTarget` [whole years ≥ 1; default 5], shown next to the horizon (B9; 9.3)
  - operation type `opType` (commercial cow-calf preselected, as the primary user; stocker supported as a secondary
    type; editable)
  - land units `landUnits[]` (required for water and virtual fence; optional for EID): one or more, each owned or
    leased (lease term `leaseYears` [whole years left from year 0]; whether renewal is expected; who builds and
    maintains fence and who provides and checks water, each the tenant by default; whether care is in the lease
    rate, no by default; fence reimbursement at lease end [\$]), each with its share of the module's head-months or
    water points [%]
  - who pays each cost and who receives each benefit: `operatorShare` on every line ("Who pays for this?", "Who
    receives this saving?": operator / landowner or other / split %), prefilled from the land units and editable
  - head by class and year `classes[c].head`, value per head `valuePerHead` [\$/head], value of gain
    `valueOfGain` [\$/lb added] (advanced), calves kept as heifers `heifersRetained`
  - the labor question `freedTimeUse` ("absorbed" until answered) and owner time rate `oppCostPerHour` [\$/h]
    (optional)
  - pay and payroll load, asked beside each labor item and stored on it, so each item has its own (there is no
    shared load field, 9.2): on the hired labor cut `labor.cut`, pay rate `paidRate` [\$/h] (hour, day or week) or
    `salary` [\$/yr] (position) and payroll load `loadPct` [%]; on handling `labor.handling` and on each
    `labor.added` item, pay rate `paidRate` [\$/h] and payroll load `loadPct` [%], asked while its `doneBy` is
    "paid"; and on the avoided hire, its `salary` and payroll load `loadPct` (below)
  - the year the module starts `startYear` [year; default 0]
  - other hours saved `labor.otherHoursSaved` [h/yr] (advanced, blank by default): time saved that no module input
    covers; capacity only unless paid units are cut
  - avoided hire `labor.avoidedHire` (advanced, blank by default; the `avoidedHire` benefit line of each module):
    `salary` [\$/yr], payroll load `loadPct` [%], first year `startYear` [year, at least the module's `startYear` + 1]
    and `years` [whole years] (9.3 Labor)
  - on each capital line, asked only while a leased land unit exists: whether it stays with the land when a lease
    ends, `staysWithLand` [yes/no; no by default], and what the leases that end within the horizon pay the tenant for
    it at lease end, in total, `leaseReimbursement` [\$; 0 by default] (9.3, "Who pays and who receives")
- **Water monitoring** (cost lines `monitors`, `mounting`, `subscription`, `batteries`; benefit lines `vehicle`,
  `laborCut`, `avoidedHire`, `risk:<i>` for each `riskLines[i]`, `fewerChecks`):
  - monitors `water.monitors` [count]; unit price `costs.monitors.unitCost` [\$/monitor], life `lifeYears` [yr],
    residual mode
  - mounting `costs.mounting` [\$] and install time [h; entry `startYear` (0 by default) of a `labor.added` item's
    `hours` array, with 0 in the other years], with `doneBy` and, while it is "paid", pay rate `paidRate` and payroll
    load `loadPct` (Shared) (B3)
  - subscription `costs.subscription` [\$/monitor/yr], billed in advance; commitment terms (`minQty`, `commitYears`,
    `earlyTerminationFee`)
  - batteries or repairs: `repairPct` on the monitors line, or `costs.batteries`, an annual perDevice line billed in
    arrears whose `unitCost` [\$ per monitor] is given by year (nonzero in the stated years)
  - season blocks `blocks[]`: `name`, `weeks`, `runsPerWeek`, `milesPerRun`, `hoursPerRun`, `minVisitsPerWeek`,
    `freezeOrFeedRoute` [yes/no], `shareAvoided` [%]. Help text for the minimum visits cites PIRSA (South Australia,
    Feb 2022 prices; monitors "do not eliminate the need to inspect tanks and troughs") and MLA B.NBP.0505
    (Queensland, Australia, 2011; data about 2009–11; a producer withdrew because visual inspections were still
    needed), and says that both describe Australian stations and are cited for the practice, not as a US value or
    default. Help text for the freeze flag: a frozen tank can still read full
  - classes served and months on the served pastures `served[c].months` [months; default 12]
  - who drives: `labor.cut` (`laborUnit`, `unitsCut`, `hoursPerUnit` [h per unit], pay rate `paidRate` [\$/h],
    `salary` [\$/yr, position only], payroll load `loadPct` [%])
  - added monitoring time [h/wk], stored as a `labor.added` item with `hours` = h/wk × 52 (Synthetic Ranch A: 1 h/wk
    = 52 h/yr), with `doneBy` and, while it is "paid", pay rate `paidRate` and payroll load `loadPct` (Shared)
  - variable vehicle cost `water.variableCostPerMile` [\$/mi]
  - outage history (advanced, risk), a `riskLines` entry with cause "water": `eventsPerYear`, `headPerEvent`,
    `class`, share caught early `shareCaught` [%]
  - losses from fewer physical checks `water.fewerChecksLoss` (advanced, risk, blank by default) [head/yr and class]
  - ramp `ramp[1..3]` [% of full benefit in the module's first three operating years] (B3)
- **Virtual fence** (cost lines `subscription`, or `collars` and `serviceFee`; `collarBatteries`, `baseStations`,
  `infrastructure`, `collarLoss`; benefit lines `fence`, `laborCut`, `avoidedHire`, `production`, `risk:<i>`):
  - pricing model `vf.pricing`: leased collars with a subscription, or purchased collars plus a service fee
  - subscription `costs.subscription.unitCost` [\$/head/month] with basis perHeadMonth or perHeadYear, billed in
    advance; commitment terms
  - purchased collars `costs.collars` [\$/collar, life], service fee `costs.serviceFee` [\$/collar/yr]
  - collar batteries, for collars with replaceable batteries: price `costs.collarBatteries.unitCost` [\$/battery]
    and `vf.batteriesPerCollar` [per collar per year]
  - base stations `costs.baseStations` [count, \$, life] or "none (satellite)"; other infrastructure
    `costs.infrastructure` [\$]
  - enrolled head by class and months `enrolled[c]` [head, months per year]. Help text: months include trap
    training before turnout and collar removal at shipping, unless the quote bills grazing months only
  - collar loss `vf.collarLoss.pctPerYear` [%/yr of enrolled collars] and loss charge `vf.collarLoss.chargePerCollar`
    [\$/collar], the cost line `collarLoss` (9.3)
  - handling `labor.handling`: events (collar on, collar off) with `minutesPerHead` and `crewSize`; refit gathers ×
    riders × hours; training days × riders × hours per day, with training days by year when the herd is trained
    once (Synthetic Ranch D: 7 days in year 1 only); `doneBy` and, while it is "paid", pay rate `paidRate` and payroll
    load `loadPct` (Shared)
  - interior fence block `vf.fence` (F6): the land unit it is on `landUnitId`, `miles` [mi], interior fence miles in
    your plan `planMiles` [mi] (the `fenceMiles` baseline; defaults to `miles`), `F` [\$/mi], `k` [year], `Lf` [yr],
    `m` [%/yr], avoided or deferred by `d` [yr] (`mode`)
  - moving and gathering hours today `vf.gatherHoursToday` [h/yr] (the `gatherHours` baseline; blank skips the
    clamp)
  - moving and gathering hours cut `vf.gatherHoursCut` [h/yr], the module's one claim on `gatherHours`, with
    `labor.cut` for paid or contract hours (cash-eligible; its inputs as in the water module's "who drives")
  - health-check riding hours cut `vf.healthCheckHoursCut` [h/yr], outside the `gatherHours` pool: not counted as
    cash unless the user cites a validated alert function (`vf.validatedAlert`), in which case the line is labeled
    [C]. Help text: collars do not replace pulling and doctoring sick cattle
  - no separate input for unpaid hours saved: the hours cut that no paid unit covers are capacity (hours freed,
    9.3)
  - production `production` (advanced): gain `lbPerHeadPerDay` [lb/head/day] × `days`, classes sold `classes`, share
    of yearlings sold `soldShare` [%; default 100%], `valueOfGain` by class, `fromRecords`, source note `sourceNote`
  - losses avoided (advanced, risk): `riskLines` entries, each with its `cause`, `eventsPerYear`, `headPerEvent`,
    `class` and share caught early `shareCaught` [%] (F7)
  - ramp (B3)
- **EID and scale** (cost lines `cowTags`, `calfTags`, `retags`, `reader`, `indicatorBars`, `platform`, `software`;
  benefit lines `premium`, `dosing`, `laborCut`, `avoidedHire`, `production`):
  - "Does the EID rule apply to cattle you move?", asked for each inventory class (not the sale flows `calvesSold`
    and `cullCowsSold`, 9.2) whose head is above 0 in any year, in the class order of 9.2, and stored per class in
    `eid.ruleApplies[c]`, "no" by default (sexually intact cattle 18 months and older, dairy cattle, and rodeo,
    recreation, show and exhibition cattle, moved interstate
    other than directly to slaughter; see §4.3), recorded as an input (B4a). Until B4b is built, a "yes" counts all
    tags as project costs and shows: "Compliance treatment is pending verification of the rule's current status. All
    tags are counted as project costs here, which may understate the case for EID if your tags are required anyway.
    Check with your state veterinarian." The notice shows beside the question and in the result's notes while any
    class is answered yes, and disappears when every class is no.
  - free tags `eid.freeTags`: `qty` [tags free in each listed billing year, or a per-year array] and `years`
    [billing years], applied as in 9.3 (B4a)
  - classes served and months on the served pastures `served[c].months` [months; default 12]
  - tag price `eid.tagPrice` [\$/tag]; tags per year by class (cow tags from the classes on `cowTags`, calf tags from
    `calvesBorn`); retag rate `eid.retagPct` [%/yr]
  - reader `costs.reader`, indicator and load bars `costs.indicatorBars` (one line, as the published listings sell
    them), platform `costs.platform` [\$ and life each], residual mode
  - software `costs.software` [\$/yr, billed in advance, or one-time \$]
  - weighings `labor.handling.events` (classes, times per year), seconds per read (stored as `minutesPerHead`),
    `crewSize`, `doneBy` and, while it is "paid", the handling pay rate `paidRate` and payroll load `loadPct` (Shared)
  - recording time today `eid.recordingHoursToday` [h/yr], if weights were recorded by hand before (hours saved)
  - added data and desk time [h/yr; a `labor.added` item], with `doneBy` and, while it is "paid", pay rate `paidRate`
    and payroll load `loadPct` (Shared) (B3)
  - paid hours cut at the chute (`labor.cut`, whole units; its inputs as in the water module's "who drives")
  - program premium `eid.premium`: head in program (from `calvesSold`), sale weight `saleCwt` [cwt], premium
    `premiumPerCwt` [\$/cwt], verification fee `verificationFee` [\$/head], buyer quote note `quoteNote` [text]
  - dosing savings `eid.dosing`: `perApplication` [\$/head/application] and `applications` [per head per year, by
    class], no default; a cash benefit line (9.3)
  - production (advanced), as for virtual fence

### 9.5 Page changes (minimum for phase 1)

1. **Verdict.** It reads from the cash NPV, using the "pays" rule in 9.3 (with no cash flows for the operator, it
   reads "No cash flows for you in this analysis"), and adds a second line for capacity hours. The texts below are
   exact (judgment, following the example in 7.2 item 1), and `text.js` builds them from `analyze()` output.
   Where N, T, T' or another count of years is 1, "years" reads "year" in these texts, in those of items 9 and 11 and
   in the 9.3 state texts ("Over 1 year", "within 1 year", "none within 1 year"), and an hour count of 1 reads "hour";
   payback and IRR values keep their formats ("1.00 years") (judgment).
   The "Indicative only" rule and its definitions are in 7.3 and 9.3. The verdict sentence says "before tax" (except
   the no-cash-flow sentence below, which states no amount), and it carries "Discount rate not yet reviewed" while the rate is unreviewed in the user's own analysis (item 5). Near the
   verdict, the page says: "Published prices describe what the equipment costs. They do not support the projected
   savings, which come from your entries or the example's assumptions."
   - The verdict sentence has four parts, in this order:
     - "Over `<T>` years at `<rate>`, before tax, this `<amount>` in cash." `<rate>` is "the example's `<r>`% real
       rate (an assumption, not a recommendation)" while the rate shows the example label (item 5), and "your `<r>`%
       real rate" otherwise. `<amount>` is "saves about `<X>` more than it costs" when cash NPV is 0 or more, "costs
       about `<X>` more than it saves" when it is below 0, and "is within `<H>` of breaking even" when `<X>` rounds to
       $0. `<X>` is the cash NPV without its sign, rounded as 7.3 says (to the nearest $1,000, or $100 when every
       material input is [A] or [D]); `<H>` is half that unit ($500 or $50).
     - The state, by the 9.3 rule: "It pays.", "It pays only if the loss estimate holds." or "It does not pay."
       The verdict names no payback year: payback is undiscounted and can come inside the horizon while cash NPV is
       below 0 (10.1 row 44), so it stays on its tile.
     - Only when cash NPV is below 0 and PV(B) is above 0, the rise needed, from `f = (PV(C) − PV(R)) ÷ PV(B)`, the
       factor by which the cash benefits would have to grow for cash NPV to reach 0: "Cash benefits would need to
       rise about `<f>`-fold." with f to one decimal when f is 2 or more, and otherwise "Cash benefits would need to
       rise by about `<p>`%." with p = (f − 1) × 100 rounded to a whole number, and at least 1. For the examples
       f is 1.332 (Ranch A), 3.508 (B), 5.610 (C) and 1.048 (D): "by about 33%", "about 3.5-fold", "about
       5.6-fold" and "by about 5%".
     - "It turns most on `<driver 1>` and `<driver 2>`.", naming the entries with the two longest bars of the
       tornado (item 6), each label with its first letter in lowercase; with only one bar, "It turns most on
       `<driver 1>`."; with none, no sentence. This part joins with the sensitivity port (9.1 step 6); until then the
       verdict sentence ends before it.
   - With no cash flows for the operator, the verdict sentence is "No cash flows for you in this analysis." alone.
     Synthetic Ranch B as loaded (10.1 row 49): "Over 7 years at the example's 7% real rate (an assumption, not a
     recommendation), before tax, this costs about $230,000 more than it saves in cash. It does not pay. Cash
     benefits would need to rise about 3.5-fold. It turns most on herd size and subscription."
   - Order of the verdict area (judgment): "Indicative only: most of the benefit is estimated, not from your
     records." first, when it applies (7.2 item 1); then the verdict sentence; the payback-target line; the "It
     would pay" sentence, when the N-year test fails; the capacity-hours line; "Discount rate not yet reviewed." and
     "Includes synthetic cost placeholders.", each when it applies, in that order; and the published-prices sentence
     above.
   - Capacity-hours line, from the average of `hoursFreedₜ` over years 1..T in whole hours (the tile of item 2): "It
     also frees about `<h>` hours a year of your time (not cash)." when the average is above 0, and "It also takes
     about `<h>` more hours a year of your time (not cash)." when it is below 0, with h shown without its sign; no
     line when it rounds to 0. Synthetic Ranch A: "It also frees about 84 hours a year of your time (not cash)."
   - Payback target (B9; 9.3). Directly under the verdict sentence, above the capacity-hours line, a line reads
     "Pays for itself within N years (counting equipment value left at year N)" or "Does not pay for itself within N
     years", with N the payback target (5 by default), or "No cash flows for you within N years" when the N-year
     test has none (9.3). The headline stays the full-horizon cash NPV.
   - When the N-year test fails, the verdict adds "It would pay for itself within N years if: `<driver>`, or
     `<driver>`.", naming the first two drivers of the 9.3 ranking. Each driver reads "`<label>` at least `<value>`
     (you entered `<entered>`)" or "`<label>` at most `<value>` (you entered `<entered>`)", with the label's first
     letter in lowercase and the values formatted and rounded as in item 9. A driver left blank, which ranks after
     the others (9.3), reads "(left blank)" in place of "(you entered `<entered>`)", except a blank net program
     premium, which counts as 0 and reads "(you entered $0/yr)" (judgment); a blank price is never named (9.3).
     Synthetic Ranch D: "It would pay for itself within 5 years if: herd size at most 381 cows (you entered 400
     cows), or subscription at most $6.67/head/month (you entered $7/head/month)." With only one such driver, the
     sentence names one ("It would pay for itself within N years if: `<driver>`."); with none, it reads "No single
     input in the panel makes it pay for itself within N years."
   - The "What would make it pay" panel (item 9) sits next to the verdict.
2. **Tiles.** Each headline figure is labeled "before tax" and is the operator's (each line at its operator share,
   F6):
   - Cash NPV
   - Cash NPV including expected losses avoided (shown only when a risk line is entered)
   - Economic NPV
   - Cash payback (state text from 9.3)
   - BCR
   - Cost per head-month ("n/a" when there are no head-months)
   - Hours freed per year
   - IRR (state text from 9.3)

   Each tile's label is its name above followed by " (before tax)", for example "Cash NPV (before tax)" (judgment).
   Display (judgment): the three NPVs, like the verdict's `<X>`, are rounded as 7.3 says and shown as "about
   −$11,000", and one that rounds to $0 shows "about break-even" (7.2 item 2); payback and IRR as in 9.3; BCR to two
   decimals ("0.75"); cost per head-month in dollars and cents; hours freed in whole hours. The year table, the "Paid
   by others" and "Received by others" lists and the notices show money as item 9 does (whole dollars at $100 or
   more, cents below), without the 7.3 rounding. Tests pin `analyze()` values (10.1, ±$1) and the tiles' text as
   rounded here.
3. **Year table.**
   - Year 0 is its own row, then years 1..T. The merged 12-month view is gone.
   - Every cost and cash benefit line is itemized with its provenance badge. Replacements appear in their purchase
     years.
   - Years run down the rows. Columns: each cost line, each cash benefit line, residual value (its own column,
     nonzero only in year T, or in year T' for a lease-end residual, 9.3), total cost, total cash benefit, net cash,
     cumulative and discounted.
   - Risk lines appear in separate columns after net cash, with their own subtotal, and are never added to net or
     cumulative.
   - Capacity hours appear in their own column, in hours.
   - A note above the table states the convention: subscriptions billed at the start of each year, other flows at
     year end, prices in today's US dollars, real discount rate, all figures before tax. It reads (judgment): "Year 0
     is the start. Fees billed in advance, such as a subscription, are paid at the start of the season they cover,
     so the first season's fee is in year 0. Purchases, and fence the technology avoids, fall in the year of
     purchase; other costs and every benefit fall at the end of their year. Money in today's US dollars, discounted
     at `<r>`% a year (real). Your share of each line, before tax."
   - Years without cattle carry the cattle-presence message.
   - Each line shows the operator's share. Costs, or shares of costs, paid by a landowner or others are listed below
     the table under "Paid by others", and benefits or shares received by others under "Received by others";
     neither enters net cash, cumulative or any result (F6). Each list shows, by line and land unit, the amount in
     each year and its PV (`paidByOthers` and `receivedByOthers`, 9.3).
4. **Assumptions list.**
   - Every value with its class and source.
   - What was left out (7.3), in the order in which 9.4 lists the inputs. A benefit, risk or production line that
     counts as 0 because an input it needs is blank is listed once, however many of its inputs are blank, as
     "`<line>`: not entered, not counted", with the line's label (9.4): Synthetic Ranch A with its outage events per
     year cleared lists "Losses avoided (water): not entered, not counted". Any other blank input that counts as 0
     (item 7) is listed in the same form under its own label (9.4 intro), such as "Other hours saved: not entered,
     not counted", when one of the lines `buildLines` builds (9.2) uses it: the value of gain in a water analysis,
     which no line uses, is not listed. A blank price is listed as "Quote required: not counted" (item 7). When the
     list names a benefit, risk or production line or input, or an advanced input, other than "Losses from fewer
     physical checks" or "Verification fee" (each of which lowers the result when entered), it ends with "Benefits
     left blank are not counted, so they can only make this result look worse." (item 11; judgment); a price or
     other cost input left blank does not add that sentence.
   - Generic technology names everywhere on the page. Company or product names appear only in linked source
     citations (owner decision, 14 Oct 2026).
   - Price labels, built from `prov.src` and `prov.pub` (owner decision, 15 Oct 2026). The source part of each label
     (`prov.src`: the company or publication and its document) is a link to `prov.url`, so a company name appears
     only as a linked source citation (judgment). Every [C] record has a `url`: the examples' records (9.7), the
     fills of item 7, and the records that a version 1 link copies from them (item 8). The labels:
     - A [C] published list price: "Vendor information: published list price (source, date). Not an endorsement.
       Replace with your quote." When the source is undated, `pub` reads "undated; checked `<date checked>`", so
       the label reads "Vendor information: published list price (source, undated; checked `<date checked>`). Not an
       endorsement. Replace with your quote." (judgment: the date checked stands in for a publication date).
       Synthetic Ranch A's monitor price shows "(All-Tex dealer flyer, undated; checked 15 Oct 2026)".
     - A [C] value that an example loads rounded from a published price carries that price's label followed by
       " (rounded from `<published price>`)" (judgment). Synthetic Ranch C's indicator and load bars load $1,830
       with the published-list-price label of the Valley Vet listing followed by "(rounded from $1,829.95)"; the
       fill (item 7) sets $1,829.95. Synthetic Ranch C's tag price, $3.14, carries the published-list-price label
       of the Jeffers listing followed by "(rounded from $156.99 per 50)".
     - A fill computed per unit from a pack price is stored unrounded, and its label is followed by the pack price
       in parentheses (judgment): the tag fill (item 7) sets $156.99 ÷ 50 = $3.1398 a tag, shown as $3.14, with its
       label followed by "($156.99 per 50)".
     - A [C] price reported second-hand by the press or extension (`prov.reported`), which only a synthetic example
       uses: "Vendor information: reported price (source, date), not a published list price. Not an endorsement.
       Replace with your quote." Synthetic Ranches B and D show it on the subscription and the infrastructure, each
       "(DTN, 31 Mar 2025)".
     - A synthetic cost placeholder (`prov.placeholder`): "Synthetic placeholder, not a price. Replace with your
       quote."
     - A typed quote: "your quote" [D].
   - Synthetic demonstration assumptions [E] (runs avoided, hours, days cut, outage events, residual %, and the
     like) carry a badge visibly different from published vendor prices [C] and the ranch's own entries [D].
   - Money is in US dollars and quantities in US units. A value from research outside the US shows its country,
     currency and data year (`prov.region`, `prov.currency`, `prov.dataYear`) and where it may not apply; it is
     never a default and is never converted to US dollars (owner decision, 15 Oct 2026).
5. **Starting points.** The four starting points are the section 11 cases (Appendix A). The expected cases of Ranches
   A, B and C are named "Synthetic Ranch A", "Synthetic Ranch B" and "Synthetic Ranch C", each with the banner
   "Synthetic example ranch. Made-up numbers for demonstration, not any real operation's data." "Synthetic Ranch D",
   the good-fit cow-calf virtual-fence example with one set of inputs, carries the banner "Good-fit synthetic example:
   conditions where this technology is most likely to pay. Made-up numbers for demonstration, not any real
   operation's data. Check whether your operation matches." (owner decision, 15 Oct 2026). The page lists the four,
   and choosing one loads its module (water: A; virtual fence: B and D; EID: C) and its inputs. Their herd sizes
   differ (900 cows, 1,200 yearlings, 300 cows, 400 cows), and every value is editable. No example's inputs were
   tuned to reach a result. No example is named after a real ranch or shown as the site owner's operation:
   the site's brand name (`index.html:6` and `index.html:83`) may stay, but the sentences saying the starting values
   describe a 1,000-cow operation (`index.html:90`, `README.md:58` and the comment at `roi.js:26`) are replaced with
   the banner wording (owner decision, 15 Oct 2026). The page opens on Synthetic Ranch A, a cow-calf example, so the
   preselected operation type matches the primary user (judgment).
   - Loading an example fills every input, including its 7% real discount rate [E], shown and editable with the
     label "Example assumption (real rate), not a recommendation. Review it for your operation." Results appear at
     once. Every example loads the payback target at 5 years, the owner's default (B9).
   - The analysis becomes the user's own (`ownAnalysis`) when the user chooses "Analyze my operation" or changes any
     input other than the rate or the payback target away from the example (judgment: every other input counts as an
     operation input here; the payback target is the user's goal, not a fact about the operation, so changing it keeps
     the example and its banner). The rate keeps its value but shows a "Review this rate" prompt with the help text
     "real rate ≈ your loan rate + a risk premium − expected inflation", and the verdict carries "Discount rate not
     yet reviewed" until the user presses "Keep this rate", a button beside the prompt, or edits the rate
     (`rateReviewed`). An edit of the rate made on the example, before the analysis becomes the user's own, counts as
     a review. Results are never blocked.
   - The rate's label (judgment): the example label shows while the rate is the example's unedited value. "Keep this
     rate" keeps it and adds "Reviewed" after it. An edited rate is the user's [D] value and shows no example
     label. A rate from a version 1 link (item 8) is not the example's value either: it shows its class badge ([D]
     when the link set it, [E] when it came from `V1_PRESETS`) with the source "version 1 link" and no example
     label, and, because the migrated state is the user's own analysis, the "Review this rate" prompt and the
     verdict note "Discount rate not yet reviewed" until the user keeps or edits it; "Keep this rate" then adds
     "Reviewed" after its source.
   - "Analyze my operation" keeps every current value and sets `ownAnalysis`. Loading an example or Reset restores
     the example's values and `prov` and sets `ownAnalysis` and `rateReviewed` to false (judgment).
   - The synthetic banner (for Synthetic Ranch D, its good-fit banner) shows while `ownAnalysis` is false. In the
     user's own analysis it gives way to the class badges, the placeholder flags and the rate prompt, which mark what
     is still the example's (judgment).
   - Synthetic cost placeholders (section 11; an open item in §12): each loads with the placeholder label of item 4.
     While `ownAnalysis` is true, each one not yet confirmed is flagged: its label is followed by "Not yet replaced
     or confirmed." and a "Keep this value" button that sets `prov.confirmed`, and the verdict carries "Includes
     synthetic cost placeholders" (9.3). After "Keep this value", the placeholder label stays, followed by
     "Confirmed", and the button is gone (judgment, as for "Keep this rate"). Typing a value or clearing the field
     replaces a placeholder. Confirming changes no number.
   - No rate is presented as right for every operation: the owner has not selected a percentage, and 7% is only the
     synthetic examples' value (owner decision, 15 Oct 2026).
   - In the pull request that replaces today's presets (9.1 step 6), README.md is brought up to date with the new
     engine: "What it answers" (`README.md:16-27`: BCR in place of return on cost, the "What would make it pay" panel in
     place of the break-even table); "The model" (`README.md:31-54`), rewritten to the 9.3 line items, timing
     conventions and metrics, without the sentence at `README.md:53-54` that says the excluded items "can be folded into
     the inputs" (H5); "What the example shows" (`README.md:56-63`), with the section 11 outcomes (§3.4 L1); the test
     command and count (`README.md:85`); the Files list (`README.md:88-96`), which also drops "light and dark mode"
     from the `index.html` line (`README.md:91`), because `index.html:10` sets `color-scheme: dark` only and the page
     has no light theme; and the two screenshots and their captions
     (`README.md:10` and `README.md:29`, `docs/screenshot.png` and `docs/sensitivity.png`), retaken from the new page.
     `docs/two-way.png`, which no file references and which shows an older two-way grid of hardware per head against
     herd size (hardware per head is not an input of the new engine), is deleted, or retaken from the new page's
     two-way grid and referenced from the README, in the same pull request (judgment).
     The `index.html` Sources note and table (`index.html:136-146`) and the README's Sources section (`README.md:65-77`)
     are rebuilt from the examples' `prov`, so that published, reported and placeholder values are each described as
     such. The header note (`index.html:90`) and the README note (`README.md:12-14`), as corrected in 9.1 step 1,
     are rewritten the same way, so that neither says the examples' costs are published list prices.
6. **Sensitivity (kept features, ported).**
   - Inputs are addressed by path string (for example `"water.blocks.0.shareAvoided"`) through a pure
     `setPath(state, path, v)`. A scalar multiplier applied to an array path multiplies every element.
   - Each module exports `SENSITIVITY_INPUTS(a) => [{ path, label, unit, zeroRange, product, set }]`, a pure function
     of the analysis like `PAYBACK_DRIVERS(a)` (9.2), because its entries depend on the analysis: one per season
     block and per risk line, the virtual fence price by `vf.pricing`, and the cost lines present. It returns one
     entry per tornado bar, from the table below, in that order. `path` is the input the entry moves; `unit` is that
     input's unit (9.3, 9.4), or \$/yr for a product (next bullet); `zeroRange` is the range, in the stored unit, over
     which the entry is tested when its input is entered as 0, or null; `product` is the id of the line whose
     factors the entry stands for, or null; `set` is the linked move of the B9 driver named in the table (9.3), or
     null. Like `PAYBACK_DRIVERS(a)`, it leaves out an entry whose input has nothing to act on (9.3), and also the
     weight-gain entry while `production.classes` is empty and the avoided-hire entry while
     `labor.avoidedHire.salary` is blank. Structural inputs (T, the payback target, start years, lives, counts of
     devices, months, blocks and land units) and inputs that move only hours (such as hours per run and other hours
     saved) are left out (judgment).
   - Herd size is not a structural input: it is an entry in every module, moved through the `set` of the herd-size
     driver (9.3), so every head count, enrolled head, free-tag quantity and head-based `minQty` moves with it and
     enrolled head never exceeds the inventory (Synthetic Ranch B's bar is about $119,500 wide, 10.1 row 49).
   - Factors that only appear as a product (days × day rate, runs × miles × \$/mile, events × head × value per head,
     lb × value of gain, collar loss share × loss charge, applications × saving per application, and fence miles ×
     cost per mile) are one entry, whose `product` names the line, labeled in \$/yr (\$ for the fence). The entry moves
     one designated factor, its `path`, and holds the others (judgment): the units cut (`labor.cut.unitsCut`) in
     hired labor, with its hours per unit and pay rate (10.1 row 26); \$ per mile (`water.variableCostPerMile`) in the
     vehicle product, as in B9 (9.3); events per year (`riskLines.<i>.eventsPerYear`) in a risk line; lb per head
     per day (`production.lbPerHeadPerDay`) in production; the saving per application (`eid.dosing.perApplication`)
     in dosing; the cost per mile (`vf.fence.F`) in the fence; and the share lost (`vf.collarLoss.pctPerYear`) in
     collar loss, whose `zeroRange` is [0, 0.07] (10.1 row 25).

     | Module | Entry (label on the page) | `path` | `product`: factors held | `set` |
     |---|---|---|---|---|
     | Every module | Herd size | `herd` | none | herd size |
     | Every module | Discount rate | `settings.discountRate` | none | none |
     | Water | Share of runs avoided in `<block name>` (one per season block) | `water.blocks.<b>.shareAvoided` | none | none |
     | Water | Vehicle cost per mile | `water.variableCostPerMile` | `vehicle`: runs avoided, miles per run | none |
     | Water, EID | Hired labor cut | `labor.cut.unitsCut` | `laborCut`: hours per unit, pay rate or salary, load | none |
     | Virtual fence | Hired moving and gathering hours cut | `labor.cut.unitsCut` | `laborCut`: as above | hired moving and gathering hours cut (it also moves `vf.gatherHoursCut`) |
     | Every module | Avoided hire | `labor.avoidedHire.salary` | `avoidedHire`: load, years | none |
     | Every module | Added hours | handling and `labor.added` hours | none | added hours |
     | Water | Monitor price | `costs.monitors.unitCost` | none | none |
     | Water | Subscription per monitor | `costs.subscription.unitCost` | none | none |
     | Virtual fence | Interior fence that would otherwise be built | `vf.fence.F` | `fence`: miles | none |
     | Virtual fence | Subscription (leased collars), or Service fee (purchased collars), by `vf.pricing` | `costs.subscription.unitCost`, or `costs.serviceFee.unitCost` | none | none |
     | Virtual fence | Collar loss | `vf.collarLoss.pctPerYear` (`zeroRange` [0, 0.07]) | `collarLoss`: loss charge | none |
     | EID | Net program premium | `eid.premium` | none | net program premium |
     | EID | Tag price | `eid.tagPrice` | none | none |
     | EID | Retag rate | `eid.retagPct` | none | none |
     | EID | Reader and scale cost | `costs.reader`, `costs.indicatorBars` and `costs.platform` | none | reader and scale cost |
     | EID | Dosing savings | `eid.dosing.perApplication` | `dosing`: applications | none |
     | Virtual fence, EID | Weight gain | `production.lbPerHeadPerDay` | `production`: days, value of gain | none |
     | Water, virtual fence | Losses avoided (`<cause>`) (one per risk line) | `riskLines.<i>.eventsPerYear` | `risk:<i>`: head per event, share caught, value per head | none |
     | Every module | Each other cost line in `a.costs` that stores its own `unitCost` and that no entry above moves, by its label (such as Infrastructure, or a version 1 line); not the tag lines or collar loss, whose prices are `eid.tagPrice` and the loss charge (9.2) | `costs.<id>.unitCost` | none | none |

   - The tornado moves each entry 20% down and 20% up, to its value × 0.8 and × 1.2, until B1 adds scenario ranges;
     an entry with a `set` passes the moved value through it, as `solveDrivers()` does (9.3). A moved value that one
     of the two 9.2 rules that bound a driver would refuse (paid hours cut within the hours saved, a residual within
     the cost of its purchase) is set to the nearest value that passes, as the solver clips its range (9.3;
     judgment). Bars are drawn widest first; ties keep the order of `SENSITIVITY_INPUTS(a)`.
   - Entries without a bar are listed under the chart, never dropped (judgment), each list in the order of
     `SENSITIVITY_INPUTS(a)`, with the labels as on the page joined with "; ":
     - An entry whose value is blank, because its own price is blank ("Quote required") or its product holds a blank
       price (such as the collar-loss charge), has no value to move and is never tested: "Not counted, left blank:
       `<labels>`.", except an entry whose line's quantity is 0 in every year, which is not listed (item 7). An
       entry with a `set`, such as herd size, is tested as usual while its own value is not blank, even when a line
       it moves has a blank price.
     - An entry whose input is entered as 0 (a cleared benefit input counts as 0, item 7) is tested across its
       `zeroRange`. Only collar loss has one, because the examples enter its share as 0 on the assumption that the
       quote covers loss (Appendix A). Any other: "Entered as 0, not tested: `<labels>`." (a range for it would have
       no source until B1's scenario columns).
     - An entry whose bar is narrower than $0.005: "No effect on cash NPV: `<labels>`." A risk line's always is,
       because risk lines never enter cash NPV (9.3), and so is herd size where no cash line depends on head
       (Synthetic Ranch A).
   - The caption and legend (`index.html:116-117`) are rewritten (judgment). The caption reads "Cash NPV, your
     share, before tax, with each input moved 20% down and 20% up, one at a time. The longest bars are the numbers
     worth checking first.", followed, for each entry tested across its `zeroRange`, by "`<label>`, entered as 0, is
     tested from `<lo>` to `<hi>`." ("Collar loss, entered as 0, is tested from 0% to 7%."). The legend reads "Lower
     value" and "Higher value", and the hover text (`app.js:145`) reads "Lower value: cash NPV `<low>`" and "Higher
     value: cash NPV `<high>`" in place of "20% lower: NPV" and "20% higher: NPV".
   - The two-way grid uses the top two drivers and never pairs two factors of one product.
   - The metric is cash NPV for all three features.
   - Today's "Break-even values" table (`index.html:119-121`, `app.js:151-164`, `breakEven()` at `roi.js:142-151`)
     is not ported: the "What would make it pay" panel (item 9) replaces it, and its full-horizon column gives the
     break-even on cash NPV in ranch units (judgment).
7. **Inputs and validation.**
   - Discount rate: labeled "Discount rate (real, %/yr)" in step 2, always filled and editable, with the label or
     prompt of item 5 and the help text "real rate ≈ your loan rate + a risk premium − expected inflation". A
     cleared field keeps its last value, as typed blanks do today (`app.js:52`), so the rate never blocks results.
   - Money note (judgment): step 2 shows, beside the rate, "All amounts are in today's US dollars, with prices held
     flat, so the discount rate is a real rate. Every result is before tax." (7.1 step 2; 10.1 rows 20 and 34).
   - Payback target: labeled "Payback target (years)" in step 2, next to the horizon, with the help text "The page
     tests whether the analysis pays for itself within this many years." A whole number ≥ 1, 5 by default and
     editable (owner decision, 15 Oct 2026). A cleared field keeps its last value (`app.js:52`); 2.5 or 0 is a
     validation error (9.2).
   - Operation type: commercial cow-calf preselected and editable; stocker supported as a secondary type (owner
     decision, 15 Oct 2026).
   - Land units are required in step 1 for water and virtual fence (optional for EID): one or more, each owned or
     leased. Every cost line asks "Who pays for this?" and every benefit line "Who receives this saving?" (operator /
     landowner or other / split %), prefilled from the land units and always editable (F6).
   - Prices: a price input is a cost line's unit cost or the tag price (9.4 intro). "Use published vendor price" fills
     a price only from the table below: one fill per input, a first-hand published price (the vendor's or a dealer's
     own page, listing or flyer), with the label of item 4 [C]. A typed quote replaces it [D]. A price reported
     second-hand by the press or extension is section 4 context only and never a fill; the leased-collar virtual fence
     system publishes no US price, so its subscription, collars and infrastructure have no fill. Every price input not
     in the table stays blank and marked "Quote required"; a missing price is never filled (owner decision, 15 Oct
     2026). Two exceptions load with a synthetic example and keep their value and label after "Analyze my operation":
     its cost placeholders, [E] values labeled as placeholders (items 4 and 5; an open item in §12), and its
     second-hand reported vendor prices, [C] values with the reported-price label of item 4 (Synthetic Ranches B and
     D). A version 1 link's starting costs are kept as placeholders too, except two that are vendor prices as they
     stand (item 8). A blank price is not counted: the
     result names the line "Quote required: not counted" and shows the warning
     "Costs marked 'Quote required' are left out, so this result overstates the case." (judgment). A blank price on
     a line whose quantity is 0 in every year, such as a collar-loss charge with `pctPerYear` 0, still shows "Quote
     required" at its input, but the result does not list it as "Quote required: not counted" and shows no warning,
     because leaving it out changes nothing (judgment).

     | Input | Fill | Source (§13) | Date in the label |
     |---|---|---|---|
     | Water: monitor price `costs.monitors.unitCost` | $1,490 per monitor | All-Tex dealer flyer [S33] | undated; checked 15 Oct 2026 |
     | Water: subscription `costs.subscription.unitCost` | $365 per monitor per year | All-Tex dealer flyer [S33] | undated; checked 15 Oct 2026 |
     | EID: tag price `eid.tagPrice` | $3.1398 per tag ($156.99 ÷ 50, stored unrounded and shown as $3.14; Synthetic Ranch C loads it rounded to $3.14, labeled as in item 4) | Jeffers retail listing [S61] | undated; checked 15 Oct 2026 |
     | EID: reader `costs.reader.unitCost` | $1,919.00 | Jeffers retail listing [S62] | undated; checked 15 Oct 2026 |
     | EID: indicator and load bars `costs.indicatorBars.unitCost` | $1,829.95 (Synthetic Ranch C loads it rounded to $1,830, labeled as in item 4) | Valley Vet retail listing [S65] | undated; checked 15 Oct 2026 |

     Software has no fill: the one published plan found ([S68]) covers up to 250 active animals, so the price depends
     on herd size and needs a quote. Synthetic Ranch C's $360/yr, set at that plan's price, is therefore a synthetic
     cost placeholder (section 11, Appendix A).
   - Cleared fields (judgment): a cleared structural field keeps its last value, as the rate and the payback target
     do: `T`, `startYear`, head and months by class, `heifersRetained`, a block's weeks, runs, miles, hours and
     minimum visits, the monitor count, fence miles, `Lf`, `k`, `d`, `leaseYears` and land-unit shares. The
     exceptions are the fields to which 9.2 to 9.4 give a blank its own meaning: `lifeYears` (blank is null: one
     purchase, no replacement), `vf.gatherHoursToday` (blank skips the clamp) and `vf.fence.planMiles` (blank
     defaults to `miles`). A cleared price is "Quote required: not counted" (above). A cleared labor rate or load
     that a paid labor item needs is a validation error (9.2). Any other cleared input (a benefit, risk, production
     or advanced input, such as `unitsCut` or `labor.otherHoursSaved`) counts as 0 and, when a line uses it, is
     listed as "`<label>`: not entered, not counted" (item 4).
   - The validation errors in 9.2 block the result and name the field. Values loaded from a link pass the same
     validation as typed values; a negative number is set to 0 (9.2) and named in the banner.
8. **Shared links (B8).** The hash is `v=2&m=<moduleId>&x=<exampleId>&s=<base64url(JSON)>`, with module IDs
   `water`, `vf`, `eid` and example IDs `ranchA`, `ranchB`, `ranchC`, `ranchD`. `s` is the base64url encoding
   (the URL-safe alphabet, without `=` padding) of the UTF-8 bytes of the JSON text, written with `TextEncoder` and
   read with `TextDecoder` (judgment: `btoa()` alone throws on a character such as the en dash in Synthetic Ranch
   A's block name "fall–winter").
   - `s` is a JSON object keyed by the analysis's top-level keys (9.2) other than `module` and `example`. A key is
     present only when its value differs from the example's, and it then carries the whole value (for `settings`,
     without `paybackTarget` when that is 5, next bullet), so arrays, land units and cost lines are replaced whole
     and a removal can be expressed. A top-level key that the example has and the state lacks is written as `null`
     in `s`, and reading deletes that key (for example the `water` or `vf` key of a migrated version 1 state, which
     holds no module inputs). `prov` is the exception: it carries, by
     path, every record that differs from the example's, and `null` for each path the example has a record for but
     the state does not. Reading merges the link's records over the example's, then deletes each path whose value is
     `null`. A link therefore keeps
     `ownAnalysis`, `rateReviewed` and the rest of `settings`, each value's `prov.cls` (a typed quote equal to a
     published price stays [D]), placeholder confirmations, `ruleApplies` and `freeTags`.
   - `settings.paybackTarget` is written into `s.settings` only when it differs from 5, even when the rest of
     `settings` is carried, and a link without it reads as 5 (owner decision, 15 Oct 2026).
   - Reading a link: an empty hash is not a link, and the page opens on Synthetic Ranch A with no link banner (the
     synthetic-example banner shows as usual). A hash with `v=2` loads the example `x`, applies `s`, and passes the
     same validation as typed values; a negative number is set to 0 and named in the banner. A `v=2` hash without
     `s` loads the example unchanged. If `s` cannot be decoded, or `m` is not the module of `x`, the page opens on
     Synthetic Ranch A with a banner saying the link could not be read; so does a hash whose `v` is present but not
     2, and a `v=2` hash whose `x` is missing or not one of the four example IDs. A non-empty hash without `v` is
     v1.
   - `migrateV1(params)` rebuilds the full v1 input from the frozen `V1_PRESETS` plus the link's values, then maps it as
     below. A negative link value is set to 0 before the mapping (9.2) and named in the banner by its v1 label, so a
     money field that it sets to 0 creates no line (10.1 row 29). If `preset` is missing or is not one of the three v1 names, it uses "Collar-based virtual fencing", as
     today's page does (`app.js:24` and `app.js:30`), and the banner says so. The migrated state sets `opType`
     "cowCalf", because the v1 head is cows and cow-calf is the primary user (judgment), and keeps only the example's
     land units; the banner asks the user to confirm both. Every class other than `cows` is set to 0 head,
     `heifersRetained` is set to 0, and `served` (water and EID) and `enrolled` (virtual fence) hold only `cows`, as
     mapped below. The example's cost lines, benefit lines, `labor` block (including handling), risk lines and
     production inputs are removed, and so are the module's own inputs (`water`, `vf` or `eid`, including the season
     blocks, the fence block, `water.variableCostPerMile` and `vf.pricing`) except `eid.ruleApplies`, so the state holds
     only the mapped values below. `ruleApplies` is "no" for every class. A v1 money field that is 0 creates no line.
     Values the link set get `prov` class [D], and values taken from `V1_PRESETS` class [E], both with `src` "version 1
     link". Each cost taken from `V1_PRESETS` (the `unitCost` of `v1Hardware`, `v1Fixed` and `v1Subscription`) also gets
     `prov.placeholder` true and the placeholder label of item 4 (judgment: version 1 kept no source with its values,
     and these costs are a per-head conversion to its 1,000-cow example, as the water subscription's $3.65 a head is
     of 10 monitors at $365; a sum that includes a base-station figure that is not a published US price, as the
     virtual fence's $13,500 does (9.1 step 1); or costs with no published source, as the EID costs are; §3.4 L2).
     Two of them are a vendor price as they stand, so they are not placeholders, because a placeholder is a cost with
     no published price (§12): the water `v1Fixed` ($14,900, 10 monitors at $1,490) gets a copy of the [C] record of
     Synthetic Ranch A's monitor price with `note` "10 monitors × $1,490 (version 1 link)", and its label of item 4
     is followed by "(10 monitors × $1,490)"; the virtual fence `v1Subscription` ($84 a head a year, so `unitCost`
     $7/head/month) gets a copy of the [C] reported record of Synthetic Ranch B's subscription with `note` "version 1
     link", and the reported-price label of item 4. Each preset still leaves at least one placeholder unless the link
     sets those costs itself (the water subscription, the virtual fence `v1Fixed`, the EID costs). Because the
     migrated state is the user's own analysis, the verdict carries "Includes synthetic cost placeholders" until each
     is replaced or confirmed (item 5). A cost the link set is [D] and not flagged; `repairPct` from `V1_PRESETS` is a plain [E]
     value. The banner names, by its v1 label, every v1 field not carried over whose value is not 0.

   | v1 field | v2 destination |
   |---|---|
   | `preset` | "Collar-based virtual fencing" → `vf`/`ranchB`; "Remote water monitoring" → `water`/`ranchA`; "EID tags and scale" → `eid`/`ranchC`; missing or unknown → as "Collar-based virtual fencing" |
   | `head` | `classes.cows.head`, with `served.cows` at 12 months for `water` and `eid`, and `enrolled.cows = {head, months: 12}` for `vf` |
   | `years` | `settings.T` (a non-integer is a validation error) |
   | `discountRate` | `settings.discountRate` (÷ 100); the banner says it is now a real rate. The migrated state is the user's own analysis with the rate not yet reviewed (`ownAnalysis` true, `rateReviewed` false), so the review prompt shows |
   | `hardwarePerHead` | capital perDevice line `v1Hardware`, qty = cows head, classes `["cows"]`; `lifeYears: null`, residual `{mode: "none"}` (v1 had no asset life) |
   | `maintenancePct` | `repairPct` (÷ 100) on `v1Hardware`; when that line is not created and the value is not 0, named in the banner |
   | `fixedCost` | capital fixed line `v1Fixed`, `lifeYears: null` (residual none) |
   | `subscriptionPerHead` | annual perHeadYear line `v1Subscription`, classes `["cows"]`, `unitCost = subscriptionPerHead ÷ 12`, billed in advance; the banner notes the change from year-end billing and asks whether the quote is per device |
   | `laborHoursPerWeek` | `labor.otherHoursSaved` = × 52 h/yr, with `freedTimeUse` "absorbed" (capacity only) |
   | `wage` | `settings.oppCostPerHour` (economic view only) |
   | `year1Realized` | `ramp[1]` (÷ 100) |
   | `deathLossPts`, `valuePerHead`, `gainLbsPerHead`, `pricePerLb`, `otherSavings`, `replacementPct` | dropped; each one that is not 0 is named in the banner |

   - The expected migrated state for `#preset=Remote+water+monitoring&head=500&years=5`, the independent check on that
     snapshot (10.1 row 30), is exactly the object below (judgment), where `ranchA` is Synthetic Ranch A as
     `examples.js` defines it. It has these keys and fields and no others; a field it does not show is absent and
     takes its 9.2 default. So every class other than `cows` is absent (0 head), and there is no `enrolled`, no
     `water` key (no monitors, blocks or vehicle cost per mile), no `production`, and no `labor.cut`, `labor.added`,
     `labor.handling` or `labor.avoidedHire`. `paybackTarget` is 5, the default, as for every v1 link.

     ```js
     {
       module: "water", example: "ranchA",
       settings: { T: 5, discountRate: 0.08, paybackTarget: 5, ownAnalysis: true, rateReviewed: false,
                   opType: "cowCalf", oppCostPerHour: 28, landUnits: ranchA.settings.landUnits },
       classes: { cows: { head: 500 } },                           // no valuePerHead or valueOfGain
       heifersRetained: 0,
       served: { cows: { months: 12 } },
       labor: { freedTimeUse: "absorbed", otherHoursSaved: 624 },  // 12 h/wk × 52
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
         "costs.v1Fixed.unitCost": { ...ranchA.prov["costs.monitors.unitCost"],
                                     note: "10 monitors × $1,490 (version 1 link)" },
         "costs.v1Subscription.unitCost": { cls: "E", src: "version 1 link", placeholder: true },
         // and every record of ranchA.prov whose path starts "settings.landUnits", unchanged
       },
     }
     ```

     No other path has a `prov` record (judgment: a value the migration sets itself, such as `opType` or
     `served.cows`, has no source to record). The subscription bills 500 × 12 × 3.65 ÷ 12 = $1,825 a year, in
     advance; `v1Fixed` is the published monitor price for 10 monitors [C] and `v1Subscription` a placeholder.
     The banner names "Death loss avoided", "Value per
     head", "Price" and "Fuel, vehicle and fence savings", says the rate is now a real rate, notes the change to billing
     in advance, and asks the user to confirm the operation type and land units (its full text is in item 11). The
     verdict carries "Discount rate not yet reviewed" and "Includes synthetic cost placeholders".
9. **What would make it pay (B9).** A panel next to the verdict, titled "What would make it pay", in place of
   today's "Break-even values" table (item 6). It shows `targetTest()` and `solveDrivers()` (9.3) for the analysis
   on the page, and appears whenever a result is computed. The owner and lender business case (B6) prints it.
   - Caption: "Each row changes one input and keeps every other input as entered. Cash only, before tax, at your
     share of each cost and saving. Values are rounded up where a row says 'at least' and down where it says 'at
     most'."
   - Columns: "Input", "You entered", "To pay for itself within N years" and "To break even over T years", with N
     and T shown as numbers. One row per driver that the module's `PAYBACK_DRIVERS(a)` returns, in that order (9.3).
   - Cells, by state (9.3), where `<label>` is the driver's label with its first letter in lowercase and `<lo>` and
     `<hi>` are the ends of the clipped range:
     - "value": "at least `<value>`" or "at most `<value>`".
     - "none": "No `<label>` between `<lo>` and `<hi>` makes it pay for itself within N years" in the N-year column,
       and "No `<label>` between `<lo>` and `<hi>` makes it break even over T years" in the other.
     - "all": "Pays for itself within N years at any `<label>` between `<lo>` and `<hi>`", and "Breaks even or better
       over T years at any `<label>` between `<lo>` and `<hi>`".
     - "n/a", in both columns: "n/a: no head entered" (herd size), "n/a: no reader or scale cost entered", "n/a: no
       added hours entered", "n/a: no calves sold" (net program premium), or, on a hired-labor row (9.3), "n/a: freed
       time is absorbed" or "n/a: pay rate, hours per unit or load not entered". In a column whose test has no cash
       flows for the operator (9.3), every row reads "n/a: no cash flows within N years" (N-year column) or "n/a: no
       cash flows within T years" (full-horizon column), with N and T shown as numbers.
   - "You entered" shows the entered value, "Quote required" for a blank price, "$0/yr" for a blank premium, and
     "Left blank" for any other driver left blank (judgment).
   - A row whose range the 9.2 validation clipped carries a note: "Values below `<clippedLo>` are not valid with your
     other inputs: `<reason>`." or "Values above `<clippedHi>` are not valid with your other inputs: `<reason>`.",
     where `<reason>` is "paid hours cut cannot be more than the hours saved" (9.3 Labor) or "a residual cannot be
     more than the cost of the purchase", for a `clipReasonLo` or `clipReasonHi` of "paidHours" or "residual"
     (9.3). Synthetic Ranch A's hired labor cut: "Values above 33 days are not valid
     with your other inputs: paid hours cut cannot be more than the hours saved."
   - Notes under the panel, each shown only when it applies: "This test assumes the same prices continue to year
     N." (N > T); "Equipment value left at year N uses the residual you entered as a percentage of cost or an
     amount; it is not recalculated for year N." (a capital line with a `pctOfCost` or `amount` residual, as in
     Synthetic Ranch C); and each warning the N-year test raises itself (`targetTest(a).warnings`, 9.3, such as a
     contract that runs past year N), prefixed "`<N>`-year test: " with N as a number ("5-year test: ", item 11).
   - Format: each value is followed by its unit from the 9.3 table, with money written as "\$" and the amount
     followed by the rest of the unit ("381 cows", "28 days", "268 h/yr", "14.86 mi", "24.24%", "$6.67/head/month",
     "$15,866/mi", "$1,490 per monitor"). Herd size uses the class's name: cows, bulls, replacement heifers, calves
     or yearlings. A unit takes its singular form for a value of 1 ("1 day"), and so does "years" in the panel's
     headers, cells and notes ("To pay for itself within 1 year", item 1). In the "none" and "all" cells, `<lo>`
     keeps only its "\$" or "%" sign and `<hi>` carries the whole unit ("between 1 and 10,000 cows", "between 24.24%
     and 50%", "between $0 and $5/mi"). Precision: whole numbers for head, days, weeks, positions and hours; two
     decimals for miles and percentages; money in whole dollars at $100 or more and in cents below $100; thousands
     separators throughout; a value whose decimals would read ".00" is shown without them ("$7/head/month", "50%").
   - Rounding (judgment): a value marked "at least" is rounded up and one marked "at most" is rounded down, to that
     precision, so that the value shown, entered as is, passes its test (the solver's value already pays, 9.3). If
     rounding would take a value outside the clipped range, it is shown unrounded, to two decimals. Entered values
     and range ends are rounded to the nearest. Tests pin both the unrounded values (±0.01 of the unit) and the
     strings.
   - Synthetic Ranch D (N = 5, T = 7), in `PAYBACK_DRIVERS(a)` order, with the 5-year and 7-year cells: interior fence
     that would otherwise be built, "at least 14.86 mi" and "at least 14.94 mi" (entered 14.14 mi); fence cost per
     mile, "at least $15,866/mi" and "at least $15,943/mi" ($15,100/mi); hired moving and gathering hours cut, "at
     least 268 h/yr" and "at least 273 h/yr" (200 h/yr); subscription, "at most $6.67/head/month" and "at most
     $6.64/head/month" ($7/head/month); herd size, "at most 381 cows" and "at most 380 cows" (400 cows) (10.1 row 40).
10. **Kept sections (ported).** Two of today's sections that §3.7 keeps are rebuilt on the new engine in the page
    switch (9.1 step 6).
    - The cumulative cash chart (`app.js:96-123`) plots the operator's cumulative net cash from year 0 to T. It marks
      the payback point only when the 9.3 payback state gives a number of years, shows the state text otherwise, and
      carries the "before tax" label. Its caption (`index.html:111`, today "Purchase in year 0, then each year's
      benefit minus running costs. Payback is where the line crosses zero.") is rewritten to match the 9.3 timing
      (judgment): "Year 0 holds purchases, fees billed in advance and any avoided capital; each later point adds that
      year's cash benefits and residual value, less its costs. Your share, before tax. Payback is the point after
      which the line stays at or above zero."
    - The written-out formulas (`app.js:255-281`) are rebuilt from the 9.3 line items: each cost and cash benefit
      line with its formula and its values filled in, then the three NPVs, the BCR, the IRR and the payback, each
      with its state text. The "Not included" note (`app.js:280`) says that taxes (results are before tax),
      financing (the lender's view, B5) and price changes (today's dollars and a real rate) are not included, and
      drops "Add them by adjusting the inputs", which would count financing twice (H5).
11. **Notices and banners (judgment).** `text.js` builds these texts as written, with each part in angle brackets
    filled in: quantities to two decimals and money as in item 9, a value whose decimals would read ".00" shown
    without them, an input's value followed by its unit as item 9 writes it ("−8 mi", "50%"), years as numbers
    ("year" for a count of 1, item 1), a line or input by its label on the page without its unit (9.4 intro), a
    class by its name (item 9), a module by its generic name ("Remote water monitoring", "Collar-based virtual fencing", "EID tags and scale", as
    in 7.2 item 9 and the version 1 banner; a fixture module by its own), and a land unit as "land unit `<n>`", its
    number in step 1. A pool is named "water runs", "moving and gathering hours", "death loss (`<cause>`)" or
    "interior fence miles". 10.1 rows 6, 9, 12, 13, 15, 29, 32, 35, 47, 49 and 50, and row 30 for the
    `&head=500&years=5` link, assert these texts in full. Other validation errors show "Enter a whole number of
    years, 1 or more." (9.2) or name the field and the rule it breaks, and tests assert the field's label (9.4
    intro; row 23).
    - Per-head-per-year billing with months below 12 (9.3), one per line and class, for the first year it happens:
      "`<line>` is billed for 12 months per head, but the `<class>` are `<enrolled or served>` for `<months>`
      months in year `<t>`. Check how your quote bills."
    - A claim above its own baseline (9.6), one per pool, for the first year it happens: "The claim on `<pool>` is
      above the baseline in year `<t>` (`<claim>` against `<baseline>`), so it is counted only up to the baseline."
      A blank baseline: "Enter `<baseline input>` to check the claim on `<pool>`.", where `<baseline input>` is
      "moving and gathering hours today" (`vf.gatherHoursToday`), the one baseline input that can be blank while a
      claim is made (9.6); Synthetic Ranches B and D show "Enter moving and gathering hours today to check the claim
      on moving and gathering hours." (10.1 row 49).
    - `combine()` (9.6), one per pool, for the first year it happens: "`<modules>` claim the same `<pool>`:
      together `<sum of claims>` against a baseline of `<baseline>` in year `<t>`, so each claim is scaled down in
      proportion." and "`<modules>` report different baselines for `<pool>` in year `<t>` (`<values>`); the
      largest, `<largest>`, is used." Module names and values are joined with "and" (commas before it when there
      are more than two).
    - Value of gain outside $0.10 to $5/lb (F4): "Value of gain `<value>`/lb is outside the usual range of $0.10
      to $5/lb. Check that it is entered in \$/lb, not \$/cwt (100 lb)."
    - A value of gain from the two-quote calculation (F4) above the heavier weight's price per pound: "Value of gain
      is normally below the sale price per pound."
    - A version 1 link (item 8), its parts in this order, each only when it applies: "This link was made with an
      earlier version of the calculator and has been converted."; "It named no known technology, so it opened as
      Collar-based virtual fencing."; "Not carried over: `<v1 labels>`." (in the order of `V1_FIELDS`, joined
      with "; "); the corrected values below; "The discount rate is now a real rate (net of expected inflation).
      Review it for your operation."; "The subscription is now billed at the start of each year instead of at
      year end. Check whether your quote is per device rather than per head." (when `v1Subscription` is created);
      and "Confirm the operation type (set to cow-calf) and the land units (taken from `<example>`)."
    - Values a link sets that are not allowed (9.2; the whole banner for a version 2 link): "Changed from the link
      to a valid value: `<entries>`.", each entry reading "`<input>` (`<from>` to `<to>`)", joined with "; ". A
      version 1 field uses its v1 label: "Changed from the link to a valid value: Base station, setup and install
      (−$5,000 to $0)."
    - A link that cannot be read (item 8): "This link could not be read, so the page opened on Synthetic Ranch A."
    - A horizon that ends inside a contract (9.3): "The horizon (`<T>` years) ends inside the `<commitYears>`-year
      contract on `<line>`, so its early-termination fee (`<fee>`) is charged in year `<T>`." In the N-year test,
      N takes the place of T.
    - A lease that ends inside the horizon (9.3): "The lease on land unit `<n>` ends in year `<T'>`, inside the
      `<T>`-year horizon. Its share of each benefit stops then; its costs run as entered, except improvements that
      stay with the land, which stop at the lease end and are credited any reimbursement." (9.3, "Who pays and who
      receives": a `staysWithLand` line's part on that unit has no purchase in year T' or later and no repair after
      it, and takes the reimbursement as its residual.)
    - Water care by the landlord (9.3, Water runs and vehicle): "On land unit `<n>`, `<reason>`, so the vehicle,
      labor and hours-freed savings there go to the landowner by default and are listed under 'Received by
      others'." `<reason>` is "the landlord provides and checks the water" (`waterBy` "landlord") or "water care is
      included in the lease rate" (`careInLeaseRate`); with both, the first.
    - A share of runs avoided above 0% on a block flagged for freezing (9.3): "The `<block>` block is marked
      'tanks freeze / water checked on the feeding route', so its share of runs avoided is normally 0%. Check the
      `<share>` you entered."
    - A share of runs avoided typed above its block's cap, on a block with runs (9.3, Water runs and vehicle): "The
      `<block>` block's share of runs avoided is limited to `<cap>` by the minimum visits; you entered `<share>`."
    - A warning from the N-year test (item 9): the warning, prefixed "`<N>`-year test: " ("5-year test: ").
    - Inputs left blank (item 4): at the end of the list of what was left out, when it names a benefit, risk or
      production line or input, or an advanced input, other than "Losses from fewer physical checks" or
      "Verification fee": "Benefits left blank are not counted, so they can only make this result look worse."
    - The expected banner of the `#preset=Remote+water+monitoring&head=500&years=5` link (item 8): "This link was
      made with an earlier version of the calculator and has been converted. Not carried over: Death loss avoided;
      Value per head; Price; Fuel, vehicle and fence savings. The discount rate is now a real rate (net of expected
      inflation). Review it for your operation. The subscription is now billed at the start of each year instead of
      at year end. Check whether your quote is per device rather than per head. Confirm the operation type (set to
      cow-calf) and the land units (taken from Synthetic Ranch A)."

### 9.6 Overlap rule (F9)

- **Pool registry:**
  ```js
  POOLS = {
    waterRuns:           { unit: "runs/yr", baseline: (t, ctx) => /* Σ_b runs_b */ },
    gatherHours:         { unit: "h/yr",    baseline: (t, ctx) => /* vf.gatherHoursToday */ },
    "deathLoss:<cause>": { unit: "head/yr", baseline: (t, ctx) => /* Σ eventsPerYear × headPerEvent over the
                           analysis's riskLines entries with this cause */ },
    fenceMiles:          { unit: "mi",      baseline: (t, ctx) => /* vf.fence.planMiles (default: miles) */ },
  }
  ```
  Each analysis computes a pool's baseline from its own inputs (9.4) and splits it by land unit like its claims (9.3,
  order of operations, step 2): in year t the baseline counts only the units whose part of the claims still counts,
  the owned units, the leased units with t ≤ T' and those expected to renew, so it is the full baseline × the Σ
  `share` of those units (judgment). The `fenceMiles` baseline follows the fence block's own land unit. The
  single-module clamp and `combine()` use this split baseline. `combine()` uses one baseline per pool and year.
  If the analyses claiming a pool report different baselines, it uses the largest and warns, naming the modules and
  both values (judgment). A missing baseline for a claimed pool is an error in `combine()`.
- **Claims:** `waterRuns` from the water module's runs avoided; `gatherHours` from `vf.gatherHoursCut` only
  (health-check hours are outside the pool, 9.3); `deathLoss:<cause>` from each `riskLines` entry with that cause;
  `fenceMiles` from the fence block's `miles`. Claims are taken after the land-unit split, the ramp and the
  cattle-presence rule (9.3, order of operations).
- **Benefit lines** return a claim in the pool's unit. `perYearₜ = claimₜ × scaleₜ × valuePerUnitₜ`. A line with no
  pool has scale 1.
- **One analysis:** a claim above its own baseline is clamped to the baseline with a warning (for example, runs
  avoided above runs today). When several lines of one analysis claim one pool (risk lines with the same cause,
  9.3), their claims are added, and a sum above the baseline is clamped by scaling each claim by the same factor,
  baseline ÷ sum, with one warning. If a baseline is blank, the clamp is skipped and the page asks for it.
- **`combine([a, b, …])`**, pure: for each pool and year, `scaleₜ = min(1, baselineₜ ÷ Σ claimsₜ)`, or 1 when Σ
  claimsₜ = 0, applied pro rata to every claiming line, with a warning that names the modules. `Σ claimsₜ` sums each
  analysis's claims after steps 2–4 of the order of operations (9.3), before its own single-module clamp: in
  `combine()` the scale replaces the clamp. Hours saved derived from a scaled claim use the same scale, and paid
  hours cut and cash labor saved follow them through `fₜ` (9.3 Labor), so `paidHoursCut ≤ hoursSaved` still holds.
  `combine()` needs every baseline it caps. The analyses passed to `combine()` must have the same T; otherwise
  `combine()` returns an error. Their start years may differ, and each analysis keeps its own discount rate for its
  own results and for its lines in `riskSubtotalPV` (judgment).
- **Return value:** `combine(analyses)` returns `{ results, pools, riskSubtotalPV, warnings }`. `results` holds the
  `analyze()` output of each input analysis, in order, with the scales applied; each analysis keeps its own cash NPV.
  `pools[pool]` is `{ baseline, claims, scale }`: series over years 0..T, with `claims` one series per input
  analysis. `riskSubtotalPV` is the PV of every risk line after scaling, so a loss two modules claim is counted
  once. `warnings` lists the clamp, scale and baseline warnings.
- **Phase 1** has no multi-module page. `combine()` is tested with two fixture modules defined in `tests/`; once B7
  is built, row 9 also runs with the water module as one of the two analyses. User allocation of a pool among
  modules is L6.

### 9.7 Tests to add (in `tests/roi.test.mjs`, or split across `tests/*.test.mjs`)

- **Where tests run:** CI runs `node --test tests/roi.test.mjs` (`.github/workflows/test.yml` line 13), and
  `README.md:85` documents the same command. If the tests are split into several files, the same pull request changes
  both to `node --test tests/*.test.mjs`, so CI runs every file. Every pull request keeps the suite green (9.1 build
  order).
- **Cattle in engine tests:** a test built from raw lines either sets `requiresCattle: false` on its benefit lines or
  gives a served class with head > 0 in years 1..T, so that the cattle-presence rule (F3) does not zero its benefits.
  Cost-only cases (rows 10, 18, 19 and 21) need neither.
- **Engine:**
  - capital scheduler: the four cases in 10.1 row 21 and row 7, plus `lifeYears: null` and a cohort added in year 2;
    and a dip and recovery (9.3): a perDevice line with qty 1,200, 0, 1,200 (the last value carried forward), L = 5
    and T = 7 buys 1,200 in year 0 and again in year 5 only, because the devices left idle in year 1 serve again in
    year 2, while a `perAnimal` line with the same counts and `lifeYears` null buys 1,200 in years 0 and 2
  - residual modes, and residual as its own series in BCR and payback
  - billing: advance vs arrears (row 19: its billing amounts join with F5 at step 2, its payback and IRR texts with
    F8 at step 4); purchase vs subscription (row 10); commitments (rows 2 and 16) and the
    early-termination fee (row 32)
  - per-device scaling (F5 acceptance 1); per-head-month vs per-head-year billing (row 6); head-months; the
    cattle-presence rule (row 2)
  - the module start year: with `startYear` 2, no benefit other than an avoided fence falls before year 3, and the
    ramp applies to years 3–5. Synthetic Ranch D with `startYear` 2, fence `k` 2 and `trainingDays` [0, 0, 0, 7, 0]
    has its avoided fence in year 2 (the year it would have been built, 9.3 Timing), its training in year 3 and its
    handling hours in years 3–7; with that start year, `trainingDays` [0, 7, 0] is a validation error, and so is
    fence `k` 0 (9.2). Synthetic Ranch A with `startYear` 2 and its install hours in entry 2 of their `hours` array
    puts them in year 2 (in `K_2`)
  - the order of operations (9.3): a claim of 160 runs on a 148-run baseline with `ramp[1]` 0.5 counts 80 runs in
    year 1 (no clamp) and 148 from year 2; a leased unit's part that is 0 after T' takes no share of a pool
  - the lease-end residual: a `staysWithLand` capital line on a unit leased for 3 years, with T = 7, has no purchase
    or repair after year 3 and its `leaseReimbursement` in year 3. On an owned unit (`share` 0.6) and two leased
    units (`share` 0.3 and 0.1) whose leases end in years 3 and 5, a `leaseReimbursement` of $1,000 gives the leased
    parts $750 in year 3 and $250 in year 5. The N-year test keeps that allocation (9.3, "Who pays and who
    receives"): with T = 7, the line a $10,000 purchase in year 0 (`lifeYears` 10, straight-line residual) and the
    second lease ending in year 6, the full run gives $750 in year 3 and $250 in year 6, and the 5-year test gives
    $750 in year 3 (not $1,000) and the 0.1 part, whose lease runs past year 5, its straight-line residual of $500 at
    year 5 (0.1 × $10,000 × 5 ÷ 10). With the second lease ending in year 9 instead, the full run gives the 0.3 part
    $1,000 in year 3 and the 0.1 part its straight-line residual of $300 at year 7, and a 10-year test (payback
    target 10) gives the 0.3 part $1,000 in year 3 and the 0.1 part a residual of $0 in year 9
  - the repair and collar-loss lines on purchased collars (row 24); dosing ($398.25 a year on Synthetic Ranch C)
  - ramp (B3 acceptance); the EID lines and the recorded rule answer (B4a acceptance, row 36); free tags (the two
    Synthetic Ranch C cases in B4a acceptance, with free tags never above a year's tags and none carried over). The
    baseline netting test (B4b acceptance) joins the suite when B4b is built after R1
- **Metrics:** the IRR states, the payback state machine, BCR, discounted payback, and no NaN, Infinity or −99%
  (rows 1, 3, 4, 5, 14, 17, 27), and the first year with cash flows, s₀ (row 48); the $0.005 tolerance and the
  display formats of 9.3.
- **Cash vs capacity:** the F1 acceptance criteria and rows 8, 18 and 23; with `freedTimeUse` "absorbed", `unitsCut`
  counts as 0 and the notice of 9.2 shows.
- **Fence, land tenure and who pays:** rows 11, 22, 35 and 47, F6 acceptance criteria 5–8, and the `paidByOthers` and
  `receivedByOthers` lists (rows 22, 35 and 47). A lease that ends exactly at T follows the lease-end rule: Synthetic
  Ranch B on one land unit leased for 7 years, tenant builds, no renewal expected and no reimbursement, has a fence
  benefit of +1,720 in year 7 (no residual deducted) and a cash NPV of −$224,175.
- **Overlap:** `combine()` of two fixture modules (rows 9 and 12), its return value (9.6), and a pool whose baseline
  and claims are all 0 in a year (scale 1, no NaN); the single-module clamp (F9 acceptance); two risk lines with one
  cause in one fixture analysis (cause "water": cows, 0.2 events × 5 head, `shareCaught` 0.5; calves born, 1 event ×
  3 head, `shareCaught` 1), labeled "Losses avoided (water, cows)" and "Losses avoided (water, calves)" (9.4), which
  claim 3.5 head/yr against the pool's summed baseline of 4 (1 + 3), so neither claim is clamped and no warning shows
  (9.3, 9.6); the baseline split by land unit (9.6): two fixture analyses that each claim 100% of a 148-run baseline
  on land units with `share` 0.6 (owned) and 0.4 (leased, T' = 3, no renewal expected) have scale 0.5 in every year,
  and their combined claim is 148 runs in years 1–3 and 88.8 runs in years 4..T; once B7 is built, row 9 with the
  water module as one of the two analyses.
- **Provenance:** every example value has `cls` and `src`; every [B] and [C] value has `url`, `pub` and `region`, and
  `currency` if it is money; no example value or vendor fill has a `region` outside the US (a non-US study may appear
  only in `prov.note`). `pub` is a date or "undated; checked `<date>`", and an undated [C] value shows the undated label
  (9.5 item 4). Each fill in the table of 9.5 item 7 (`useVendorPrice`, 9.1) sets its value, `cls` "C" with its
  `url`, `pub`, `region` and `currency`, and its label; no other price input offers a fill, and no `reported` value is a fill. Synthetic Ranch C's indicator and load bars ($1,830) show the Valley
  Vet label followed by "(rounded from $1,829.95)", and its tag price ($3.14) the Jeffers label followed by "(rounded
  from $156.99 per 50)"; the tag fill sets $3.1398 and its label ends "($156.99 per 50)" (9.5 item 4). Synthetic
  Ranch A's summer `shareAvoided` has `cls` "E" and a `prov.note` that names the USU worked example (US, Utah) and,
  as non-US context only, PIRSA (South Australia) (Appendix A). Synthetic Ranches B and D load
  `vf.collarLoss.chargePerCollar` blank with `pctPerYear` 0, and their results carry no "Quote required" line or
  warning (9.5 item 7). Each example marks with
  `placeholder` exactly these paths, the synthetic cost placeholders of its expected case (section 11, Appendix A):
  Synthetic Ranch A `costs.mounting.unitCost` and `costs.batteries.unitCost`; Synthetic Ranches B and D the $25/h
  contract rate at both of its paths, `labor.handling.paidRate` and `labor.cut.paidRate`, each replaced or confirmed on
  its own (judgment: they are two inputs); Synthetic Ranch C `costs.platform.unitCost`, `costs.software.unitCost` and
  `eid.dosing.perApplication`. Each marks `reported` exactly on `costs.subscription.unitCost` and
  `costs.infrastructure.unitCost` of Synthetic Ranches B and D. Rows 37 and 38. This replaces the current "every preset
  fills every input" test.
- **Sensitivity, ported:** the current tornado and two-way grid tests are rewritten for path addressing through
  `setPath()`. Add rows 25 and 26, and the Synthetic Ranch B bars of row 49.
- **What would make it pay (B9):** rows 39–46: the N-year test of each example, a case that passes it, a test with no
  cash flows (row 41), and a payback target beyond the horizon with its note; the solver's states ("value", "none",
  "all", "n/a"), the validation clip and its note, the herd-size driver with a per-head subscription ("at most"), the
  scaled drivers (row 46), and each solved value giving a cash NPV within $1 of zero; the ranking and the verdict
  sentence; the display rounding (each value shown, entered as is, passes its test); the residual note; and the
  payback target as an input and in a link. Also a late start: Synthetic Ranch C with `startYear` 2 reads its herd
  size, net program premium and added hours in year 3, its first operating year, so no row reads "n/a"; added hours
  shows "You entered 30 h/yr" (29.75) and, being unpaid, "none" in both columns. The N-year test's warnings: row
  50(b) and (c).
- **Links:** rows 15, 29, 30 and 51 (snapshots for v1 links, with the `&head=500&years=5` state checked field by
  field against 9.5 item 8); the cases of reading a link in 9.5 item 8 (empty hash, missing or unknown preset, an `s`
  that cannot be decoded, a `v` other than 2, a missing or unknown `x`, and a `v=2` hash without `s`); and a round
  trip state → link → state that leaves unchanged a migrated v1 state (among them that of
  `#preset=Collar-based+virtual+fencing`, which comes back with no `vf` key and the same cash NPV), a state with two
  land units, a split operator share, a typed quote equal to its published price and a reviewed rate, a state with
  a cleared price and a cleared placeholder, Synthetic Ranch A with the fall–winter block's share changed to 50%
  (its `name` has an en dash, so the link must encode UTF-8), and Synthetic Ranch A with its summer block removed
  (`removeItem`, 9.1) and `labor.cut.unitsCut` set to 0, since the remaining block saves no hours (the fall–winter
  block's `prov` records move from index 1 to index 0, 9.2).
- **Validation:** rows 13, 23 and 28, the whole-number rules of 9.2 (`lifeYears` 2.5 typed is an error; 12.8 days
  cut in a tornado run is not), and the fence rules of 9.2: while `vf.fence.miles` is above 0, a fence `k` below the
  module's `startYear` and a `vf.fence.landUnitId` that names no land unit are each an error. A position cut
  (`laborUnit` "position", `unitsCut` 1, `freedTimeUse` "replacesPaidWork") with `hoursPerUnit` 0 is an error naming
  "Hours per unit" (9.4 intro), so a salary is never counted as cash with no hours saved behind it. Synthetic Ranch A
  with its install item switched to `doneBy` "paid", its pay rate and payroll load not yet entered, gives errors
  naming "Pay rate" and "Payroll load" (9.4 Shared).
- **Page text** (the verdict and labels come from a pure, DOM-free function in `text.js`, and the user actions from
  `state.js`, 9.1, so these run in node): the
  example rate and review prompt (row 33); the before-tax label (row 34; the printed business case is tested with
  B6, after phase 1); the real-rate labels (row 20); "Indicative only" (row 31); the placeholder label, flag and
  verdict note (row 37); the vendor fill and the price labels (row 38); the EID rule notice (row 36) and the
  "absorbed" notice; the list of what was left out (9.5 item 4): Synthetic Ranch A with its outage events per year
  cleared lists "Losses avoided (water): not entered, not counted" once and ends with "Benefits left blank are not
  counted, so they can only make this result look worse.", while in `analyze()` its cash NPV stays −$11,079 and
  its Cash NPV including expected losses avoided falls from −$412 to −$11,079, and a water analysis whose list
  names only a blank price and "Losses from fewer physical checks" ends without that sentence; the notices and
  banners of 9.5 item 11 (rows 6, 9, 12, 13, 15, 29, 30, 32, 35, 47, 49 and 50);
  the verdict area of 9.5 item 1 in full and in order (row 49); the payback-target line, the verdict sentence that
  names two drivers, and the panel's cells, notes and formats (rows 39–46); on a fixture driver result, the
  "(left blank)" parenthesis and the "Left blank" cell of a driver left blank (9.5 items 1 and 9); the display
  rounding of 9.5 item 2: rows such as 35, 37, 38 and 47 pin `analyze()` values, and the tiles show them rounded as
  item 2 says (cash NPV −$11,229 shows "about −$11,000"); and the singular "year" of 9.5 item 1: in Synthetic Ranch
  A with T set to 1 and the payback target set to 1 (cash NPV −$2,330), the verdict sentence begins "Over 1 year at
  the example's 7% real rate (an assumption, not a recommendation), before tax, this costs about $2,000 more than it
  saves in cash.", the payback tile reads "none within 1 year", the line under the verdict reads "Does not pay for
  itself within 1 year", and the panel's headers read "To pay for itself within 1 year" and "To break even over 1
  year".
  Rows 33, 36, 37, 38 and 45 run as sequences of `state.js` calls (and, in row 45, `links.js`): load an example,
  change an input, "Analyze my operation", "Keep this rate", "Keep this value" or "Use published vendor price",
  checking the state and the `text.js` output after each step. The checks that need the rendered page are a by-hand
  checklist in the description of the 9.1 step-6 pull request, as step 1 does for its link check: a class badge on
  every value the user did not type (F10 criterion (3)), no input that offers price escalation (row 20), and no
  "NaN" or "Infinity" shown anywhere on the page (row 1). In node, no string that `text.js` builds for row 1
  contains either.
- **Regression (pinned to Appendix A, tolerance ±$1 for dollars and ±0.001 for ratios):** each synthetic example's
  expected case (Synthetic Ranch D: its one case), run through `analyze()`, reproduces:
  - Ranch A: Cash NPV −$11,079, BCR 0.751, payback "none within 10 years" (also Cash NPV including expected losses
    avoided −$412 and Economic NPV +$10,788)
  - Ranch B: Cash NPV −$229,531, BCR 0.285, payback "none within 7 years"
  - Ranch C: Cash NPV −$9,895, BCR 0.206, payback "none within 7 years" (also Economic NPV −$13,101), with "Rule
    applies: no" (B4a)
  - Ranch D: Cash NPV −$9,789, BCR 0.954, payback "none within 7 years (no net outlay in year 0; cumulative
    negative from year 7)", IRR "n/a: no net outlay in year 0". Its fence miles are stored unrounded (2 × √(2,000 ÷
    640) × 4 = 14.1421… mi), with `planMiles` equal to them so that the pool does not clamp the claim; typed as
    14.14 mi, the cash NPV is −$9,815
  - the 5-year test (N-year test at the default target): Ranch A −$7,648, Ranch B −$175,519, Ranch C −$8,678,
    Ranch D −$6,871 (row 39; joins with B9, 9.1 step 6)
  - Ranch A expected: the verdict reads "Indicative only" (row 31; joins with the page switch, 9.1 step 6)
- **Hand checks:**
  - the USU water example, with the setup stated in B7 acceptance
  - the polywire fence stream in row 11, computed by hand in the test comments
  - today's hand-checked case rebuilt as line items, with `requiresCattle: false` (build order step 2 in 9.1)
- **Replaced current tests** (at 9.1 step 6, when today's model leaves `v1.js`; until then they run against
  `v1.js`): the hand-calculated cash flows, NPV/IRR/payback and "year 1 counts only the realized share" tests are
  replaced by the engine, metric and ramp tests above. The tornado test's "skips inputs set to zero" assertion is
  removed (row 25 replaces it). "Payback and IRR are null when it never pays" is replaced by the state-text checks in
  rows 3 and 19, "each benefit line uses its own formula" by the engine line tests, and "break-even finds the value
  where NPV is zero" (`tests/roi.test.mjs:55`) by the solver tests of rows 40–43, as the panel replaces today's
  break-even table (9.5 item 6). Step 1's row-28 test of today's `validate()` moves to `v1.js` with it and is
  replaced by the engine's row-28 tests: typed T from step 2, the link case with B8 (9.1 steps 2 and 6).

---

## 10. Validation plan

### 10.1 Edge-case and behavior tests

These tests are recommendations. Dollar figures in the expected column use a 7% real rate, the synthetic examples'
assumption [E], not a recommended rate. They are `analyze()` values; the page shows them as 9.5 item 2 says (a cash
NPV of −$11,229 shows "about −$11,000"). A row that names Ranch A, B, C or D starts from that ranch's expected-case
inputs in Appendix A (Ranch D has one set), with the changes the row states. The payback target is 5 years unless a
row says otherwise. Rows 39–46 give each solved value unrounded (±0.01 of its unit) and as the panel shows it (9.5
item 9).

| # | Case | Setup | Expected |
|---|---|---|---|
| 1 | Zero costs, zero benefits | All costs and benefits 0 | NPV 0. Payback "n/a: no cash flows". IRR "n/a: no cash flows". BCR n/a. No NaN anywhere on the page. The verdict reads "No cash flows for you in this analysis", never "pays", and the line under it "No cash flows for you within 5 years" |
| 2 | Zero cattle | Ranch B expected inputs with every class at 0 head in every year, plus a 36-month commitment (`minQty` 6,600 head-months = 1,200 collars × 5.5 months; `commitYears` 3) | Every benefit line is 0 in every year, including the fence. "No cattle in year t: benefits not counted" for t = 1..7. Handling hours 0. The subscription is billed at 6,600 × $7 = $46,200 in years 0, 1 and 2 and $0 after. Cash NPV −$134,230 (−$4,500 without the commitment). Cost per head-month "n/a". The verdict says it does not pay |
| 3 | Negative returns | Nₜ = −1,000, 100, 100, 100 (T = 3): benefits below costs every year | NPV −$737.57. Payback "none within 3 years". IRR "below 0%", never −99% from a failed search |
| 4 | No payback, then payback | Nₜ = −100, 60, 60, −80, 60 (a replacement in year 3) | Payback "4.00 years (cumulative was positive in year 2, then negative again before year 4)". IRR "n/a: cash flows change sign more than once" |
| 5 | No upfront outlay | Nₜ = 0, 10, 10 | Payback "no net outlay: cumulative cash never negative", never "1 months" as today (`app.js:16`). IRR "n/a: no net outlay in year 0" |
| 6 | Seasonal use | Stocker: 1,200 yearlings enrolled for 5 months, and a fixture line labeled "Subscription", perHeadMonth at $7/head/month | Subscription = 6,000 head-months × $7 = $42,000. Switching to perHeadYear gives 1,200 × 12 × $7 = $100,800, with the warning "Subscription is billed for 12 months per head, but the yearlings are enrolled for 5 months in year 1. Check how your quote bills." |
| 7 | Changing annual costs | 4-year device life over 10 years | Purchases in years 0, 4 and 8. Residual at year 10 = 50% of the year-8 purchase (straight line) |
| 8 | Unchanged payroll despite time savings | Ranch B expected with `freedTimeUse` "absorbed" (no paid hours cut), and moving and gathering hours cut (`vf.gatherHoursCut`) of 500 h/yr, then of 0 h/yr | Cash NPV identical in both. Capacity shows 500 h a year in the first. Economic NPV adds 500 × the owner rate a year only if a rate is entered (Ranch B enters none). `labor.cut.unitsCut` stays 200 as entered and, while freed time is absorbed, is not checked against the hours saved, so 0 h/yr raises no validation error (9.3 Labor) |
| 9 | Overlapping benefits | `combine([a, b])` of two fixture modules defined in `tests/`, both claiming 100% of a 100-run `waterRuns` baseline | Each claim scaled by 0.5. Combined claim 100 runs. Derived hours saved and paid hours cut halved. The warning names both modules, in full (9.5 item 11, with `<a>` and `<b>` the fixture modules' names): "`<a>` and `<b>` claim the same water runs: together 200 against a baseline of 100 in year 1, so each claim is scaled down in proportion." With baselines of 100 and 120 runs reported by the two analyses: 120 is used, with the warning "`<a>` and `<b>` report different baselines for water runs in year 1 (100 and 120); the largest, 120, is used." |
| 10 | Purchase vs subscription | Two water analyses of the same 10 water points, T = 10, no benefits: (a) buy 10 monitors at $1,490 (life 10, straight-line residual) plus a $365/monitor/yr service fee billed in advance (Ranch A's prices); (b) no purchase, an all-in lease of \$X per monitor per year billed in advance (years 0–9; X is a test value) | (a) PV of costs $42,330.60 (= 14,900 + 3,650 × 7.515232, the 10-year annuity-due factor at 7%); the residual at year 10 is 0. (b) At X = $563.26 (= 365 + 1,490 ÷ 7.515232) the two PVs agree within $1; at X = $600, (b) costs $45,091.39 in PV and is the dearer option. Phase 1 runs them as two analyses; a side-by-side page is not in scope |
| 11 | Fence avoided vs deferred | 8 mi × $4,300, k = 1, Lf = 25, m = 2%, T = 7. Then Lf = 4, k = 0, m = 5% | Avoided PV $18,933. Deferred by 0: 0 in every year. Deferred by 3: $10,164 (positive). Deferred by 6 (k + d = T) and by 10: identical to avoided, year by year. Polywire case, years 0–7: 34,400; 1,720; 1,720; 1,720; 36,120 (rebuild in year 4); 1,720; 1,720; −6,880 |
| 12 | Death-loss pool | `combine([a, b])` of two fixture modules, both claiming 100% of `deathLoss:water` at 0.15 events × 5 head | Combined claim 0.75 head/yr. `riskSubtotalPV` counts it once. Each analysis's cash NPV is unchanged. The warning reads in full: "`<a>` and `<b>` claim the same death loss (water): together 1.50 against a baseline of 0.75 in year 1, so each claim is scaled down in proportion." |
| 13 | Price units | `valueOfGain` entered as \$/cwt (for example 79 for $0.79/lb); then the F4 two-quote calculator with the base-weight price per pound below the heavy-weight price | A `valueOfGain` above $5/lb or below $0.10/lb shows the plausibility warning of 9.5 item 11, which names \$/cwt and \$/lb (thresholds: judgment); for 79 it reads "Value of gain $79/lb is outside the usual range of $0.10 to $5/lb. Check that it is entered in \$/lb, not \$/cwt (100 lb)." A calculated value of gain above the heavy-weight price per pound shows "Value of gain is normally below the sale price per pound." |
| 14 | Discount rate 0 | r = 0 | NPV = sum of nets. Discounted payback = payback |
| 15 | URL v1 link | `#preset=Unknown+tool`, an old hash that names no known technology | Loads as Collar-based virtual fencing (`vf`, `ranchB`) with no exception, and the banner reads in full: "This link was made with an earlier version of the calculator and has been converted. It named no known technology, so it opened as Collar-based virtual fencing. Not carried over: Death loss avoided; Value per head; Extra weight sold; Price; Fuel, vehicle and fence savings. The discount rate is now a real rate (net of expected inflation). Review it for your operation. The subscription is now billed at the start of each year instead of at year end. Check whether your quote is per device rather than per head. Confirm the operation type (set to cow-calf) and the land units (taken from Synthetic Ranch B)." |
| 16 | Drought destock under a commitment | Ranch B expected; yearling head 0 in season 3; 36-month commitment, `minQty` 6,600 head-months | The season-3 bill (paid in advance in year 2) is $46,200, the committed amount ($0 without the commitment). Year-3 cash benefits and handling hours are 0, with "No cattle in year 3". Seasons 4–7 are billed on actual head |
| 17 | No net outlay in year 0, then negative years | Nₜ = 100, −50, −80. Then Nₜ = 100, −150, 100, −100. Also Ranch B expected with the 6-wire high-tensile fence (§11 sensitivity) | "none within 2 years (no net outlay in year 0; cumulative negative from year 2)". Then "none within 3 years (no net outlay in year 0; cumulative negative from year 1) (positive in year(s) 2, negative again by year 3)". Ranch B: "none within 7 years (no net outlay in year 0; cumulative negative from year 2)". IRR "n/a: no net outlay in year 0" in all three |
| 18 | Paid added hours | 100 added hours, `doneBy` paid, $18.72/h × 1.10, T = 10 | Cash NPV falls by exactly PV(100 × $18.72 × 1.10 = $2,059.20 a year) = $14,462.96. Capacity unchanged |
| 19 | Advance billing | A $1,000/yr subscription, T = 5, no other flows | Billed in advance: NPV −$4,387.21 (= −Σ_{t=0}^{4} 1,000/1.07^t); in arrears: −$4,100.20; ratio exactly 1.07. Payback "none within 5 years". IRR "below 0%". Both texts hold for either billing (in arrears the first cash flow is in year 1, s₀ in 9.3) |
| 20 | Real rate, flat prices | Any analysis | The rate is labeled "real" in the input, its help text and the year-table note, and in the verdict sentence of any analysis with cash flows for the operator (the verdict "No cash flows for you in this analysis." of 9.5 item 1 states no amount and carries no label). Step 2 shows the note of 9.5 item 7: "All amounts are in today's US dollars, with prices held flat, so the discount rate is a real rate. Every result is before tax." No input offers price escalation (a check on the rendered page, 9.7) |
| 21 | Capital scheduler edge cases | (a) L = 10, T = 7. (b) startYear 2, L = 4, T = 10. (c) L = 4, T = 8. (d) L = 5, T = 10 | (a) One purchase; residual 30% of cost. (b) Purchases in years 2 and 6; residual 0. (c) Purchases in years 0 and 4, none in year 8; residual 0. (d) Purchases in years 0 and 5 only |
| 22 | Land tenure | Ranch B expected, on one land unit: (a) leased for 7 years or more, landlord provides fence; (b) leased 3 years with no renewal expected, tenant builds, no reimbursement | (a) Operator fence benefit 0; cash NPV −$294,088 (§11); the avoided-fence stream (PV $64.6k, §11) is listed under "Received by others" and not added to the operator's results. (b) Fence flows only in years 0–3 (34,400; 1,720; 1,720; 1,720); no residual deducted; the contract-hours benefit also counts in years 1–3 only; costs unchanged; cash NPV −$268,999. With renewal expected, (b) gives the expected case (−$229,531) |
| 23 | Paid hours cut above hours saved | Ranch A expected with 34 day-labor days (272 h) against 264 h saved | Validation error naming the field by its label, "Hired labor cut" (9.4 intro). No result is computed |
| 24 | Repair and loss percentages act on a real base | Virtual fence with purchased collars: `repairPct` 5% on the collar line; collar loss 5%/yr with a loss charge | Each lowers cash NPV by exactly the PV of its own line. No repair % is offered on a line whose unit cost is 0 (today the VF and water presets ignore both inputs, H1) |
| 25 | Tornado keeps inputs entered as 0 | Ranch B expected with `vf.collarLoss.chargePerCollar` $150 (test value) and `pctPerYear` 0; the collar-loss driver moves its designated factor, `pctPerYear`, over its `zeroRange` [0%, 7%] (9.5 item 6) | Collar loss appears in the tornado with a nonzero bar (today `roi.js:129` drops it): from the base cash NPV, −$229,531, to $67,905 lower (0.07 × 1,200 collars × $150 = $12,600 a year, billed in arrears in years 1–7, × 5.389289). The caption ends "Collar loss, entered as 0, is tested from 0% to 7%." |
| 26 | Factors of one product | Ranch A expected sensitivity | Day-labor days, hours per day and pay rate appear as one entry, "Hired labor cut", in \$/yr, moved on its days (`labor.cut.unitsCut`, 9.5 item 6). The two-way grid never pairs two factors of one product |
| 27 | IRR above the old search bracket | Nₜ = −1,000, 20,000. Then Nₜ = −1, 1,000,000 | IRR 1,900.0% (19.000 as a number). Then "above 10,000%". Never "n/a" for a profitable case (today the search stops at 1,000%, `roi.js:88`) |
| 28 | Non-integer horizon | T = 2.5, typed or loaded from a link | Validation error "Enter a whole number of years, 1 or more." Nothing is computed, so no per-year figure uses the wrong divisor (today `roi.js:72` rounds while `roi.js:121` does not) |
| 29 | Negative value in a shared link | A v2 link with `x=ranchB` whose `s.vf` is Synthetic Ranch B's `vf` with fence miles −8; the v1 link `#preset=Collar-based+virtual+fencing&fixedCost=-5000` | Both load with the value set to 0 and named in the banner (today `app.js:31` skips the ≥ 0 clamp). The v2 banner reads in full "Changed from the link to a valid value: Interior fence that would otherwise be built (−8 mi to 0 mi)."; with no fence avoided, cash NPV is −$294,088, as in row 22(a). The v1 value is set to 0 before it is mapped, so it creates no `v1Fixed` line (9.5 item 8), and the banner reads in full: "This link was made with an earlier version of the calculator and has been converted. Not carried over: Death loss avoided; Value per head; Extra weight sold; Price; Fuel, vehicle and fence savings. Changed from the link to a valid value: Base station, setup and install (−$5,000 to $0). The discount rate is now a real rate (net of expected inflation). Review it for your operation. The subscription is now billed at the start of each year instead of at year end. Check whether your quote is per device rather than per head. Confirm the operation type (set to cow-calf) and the land units (taken from Synthetic Ranch B)." |
| 30 | v1 link snapshots | `#preset=Collar-based+virtual+fencing`, `#preset=Remote+water+monitoring`, `#preset=EID+tags+and+scale`, `#preset=Remote+water+monitoring&head=500&years=5`, `#preset=Remote+water+monitoring&years=5`, and `#head=500` (no preset, so the first v1 starting point) | `migrateV1()` output (v2 state and banner text, including the dropped fields) matches a stored snapshot for each. The `&head=500&years=5` state equals the expected state written out in 9.5 item 8. The `&years=5` link opens with T = 5, as every link made after 9.1 step 1 carries its horizon. Every migrated state has `opType` "cowCalf", and each cost taken from `V1_PRESETS` has `placeholder` true except the two vendor prices of 9.5 item 8: the water `v1Fixed` is [C], labeled "Vendor information: published list price (All-Tex dealer flyer, undated; checked 15 Oct 2026). Not an endorsement. Replace with your quote. (10 monitors × $1,490)", and the virtual fence `v1Subscription` is [C] with the reported-price label of Synthetic Ranch B's subscription. None of these links sets a cost, so each keeps at least one placeholder and its verdict carries "Includes synthetic cost placeholders". Every migrated state passes validation, and a result is computed. Each migrated panel has the herd-size row and, for the EID link, the net program premium ("n/a: no calves sold") and added hours ("n/a: no added hours entered"), and no other row (9.3). For the `&head=500&years=5` state, herd size reads "No herd size between 1 and 10,000 cows makes it pay for itself within 5 years" and "No herd size between 1 and 10,000 cows makes it break even over 5 years", the line under the verdict reads "Does not pay for itself within 5 years", and the verdict adds "No single input in the panel makes it pay for itself within 5 years." |
| 31 | Indicative only | Ranch A expected | Every cash and residual line uses a [B], [C] or [E] input, so the verdict reads "Indicative only: most of the benefit is estimated, not from your records." It still reads so with the monitor price replaced by a typed quote [D]: a cost price never supports a benefit line |
| 32 | Horizon shorter than the commitment | A fixture line labeled "Subscription": perHeadMonth, $7 on 6,600 head-months, billed in advance, `commitYears` 3, `earlyTerminationFee` $10,000 (test value), T = 2 | Bills of $46,200 in years 0 and 1 only. The $10,000 fee is charged in year 2, and the page warns: "The horizon (2 years) ends inside the 3-year contract on Subscription, so its early-termination fee ($10,000) is charged in year 2." |
| 33 | Example rate and review prompt | Load Synthetic Ranch A. Then change herd size. Then, from that state, press "Keep this rate"; separately, edit the rate. Also, from the example: choose "Analyze my operation" without changing an input; and edit the rate (7% to 6%), then change herd size, then load Synthetic Ranch B | On load: the rate shows 7%, editable, labeled "Example assumption (real rate), not a recommendation. Review it for your operation."; no review prompt; results shown. After the herd change, and after "Analyze my operation": the rate is still 7%, the "Review this rate" prompt and its help text appear, and the verdict carries "Discount rate not yet reviewed". "Keep this rate" or an edit clears both. A rate edited on the example counts as reviewed: after the later herd change there is no prompt and no note. After "Keep this rate" the example label stays, followed by "Reviewed"; after an edit the rate shows the [D] badge and no example label. Loading Synthetic Ranch B sets both flags back to false: its 7% shows with the example label and no prompt. Results are computed at every step |
| 34 | Before-tax label | Any analysis | Every headline tile and the year-table note say "before tax", and so does the verdict sentence of any analysis with cash flows for the operator (the verdict "No cash flows for you in this analysis." of 9.5 item 1 states no amount and carries no label). The step-2 note of 9.5 item 7 says "Every result is before tax." No input asks for a tax rate. (The printed business case is checked with B6 acceptance criterion 1, after phase 1.) |
| 35 | Who pays and who receives | (a) Ranch A expected with the subscription line's `operatorShare` 0.5 (a landowner pays half). (b) Ranch A expected with its 10 water points in two land units: 6 owned (`share` 0.6) and 4 leased for 3 years with no renewal expected (`share` 0.4); the leased unit keeps the defaults `waterBy` "tenant" and `careInLeaseRate` false | (a) Cash NPV rises by exactly $13,715.30 (= 0.5 × 3,650 × 7.515232, half the subscription's PV, with row 10's factor), and $1,825 a year is listed under "Paid by others". (b) Each line is shown by land unit. The owned unit's 60% of each benefit line runs through year 10; the leased unit's 40% (vehicle, labor cut with its paid hours cut, hours saved and the risk line) counts in years 1–3 only and is not listed for others after that. Costs are unchanged (operator share 1), and the page warns, as in row 50(c): "The lease on land unit 2 ends in year 3, inside the 10-year horizon. Its share of each benefit stops then; its costs run as entered, except improvements that stay with the land, which stop at the lease end and are credited any reimbursement." Cash NPV −$19,434 (= −11,079 − 0.4 × 4,747.78 × 4.399265: the yearly cash benefits of vehicle and day labor, and the PV factor of years 4–10 at 7%); cash NPV including expected losses avoided −$11,439 |
| 36 | EID rule answered "yes" before B4b | Ranch C expected, with "Does the EID rule apply to cattle you move?" answered yes for the cows | The question is asked for `cows` and `calvesBorn` only, the inventory classes with head above 0 (not for `calvesSold`, a sale flow). Every tag stays a project cost, and cash NPV is unchanged (−$9,895). The answer is kept in the state (and, once B8 is built, in the link). The page shows: "Compliance treatment is pending verification of the rule's current status. All tags are counted as project costs here, which may understate the case for EID if your tags are required anyway. Check with your state veterinarian." Answering no again for the cows removes the notice from beside the question and from the notes. Once B4b is built, the same case gives −$8,877 (§11) |
| 37 | Synthetic cost placeholders | Load Synthetic Ranch A. Choose "Analyze my operation". Type $900 for mounting. Then press "Keep this value" on batteries and repairs | On load: mounting ($750) and batteries and repairs ($1,000 in years 4 and 8) show "Synthetic placeholder, not a price. Replace with your quote."; the verdict has no placeholder note; cash NPV −$11,079. After "Analyze my operation": both are flagged, each label followed by "Not yet replaced or confirmed." and a "Keep this value" button, and the verdict carries "Includes synthetic cost placeholders"; cash NPV unchanged. After the $900 quote: mounting is [D], labeled "your quote"; cash NPV −$11,229 (exactly $150 lower); the note stays. After "Keep this value": batteries and repairs keeps its placeholder label, followed by "Confirmed", with no button; the note clears, and cash NPV stays −$11,229. Results are computed at every step |
| 38 | Vendor fill and quote | Synthetic Ranch A, then "Analyze my operation": (a) clear the monitor price; (b) press "Use published vendor price"; (c) type $1,600. (d) Synthetic Ranch B: the subscription price | (a) The monitor line shows "Quote required: not counted", the result shows the warning of 9.5 item 7, and cash NPV is +$3,821 (the $14,900 purchase left out). (b) $1,490, class [C], labeled "Vendor information: published list price (All-Tex dealer flyer, undated; checked 15 Oct 2026). Not an endorsement. Replace with your quote."; cash NPV −$11,079. (c) Class [D], labeled "your quote"; cash NPV −$12,179. (d) The $7/head/month example value is labeled "Vendor information: reported price (DTN, 31 Mar 2025), not a published list price. Not an endorsement. Replace with your quote."; the input offers no "Use published vendor price" fill. Cleared, it shows "Quote required", the result lists "Quote required: not counted" with the warning, and cash NPV is +$36,884 (the subscription's PV of $266,414 left out) |
| 39 | Payback target: the N-year test | Each example as loaded (payback target 5). Then Ranch A expected with the optimistic column's cash inputs: vehicle $0.50/mi and 33 day-labor days cut | 5-year test cash NPV: Ranch A −$7,648, Ranch B −$175,519, Ranch C −$8,678, Ranch D −$6,871. Each verdict carries "Does not pay for itself within 5 years" and the sentence of 9.5 item 1, and each headline is unchanged (−$11,079, −$229,531, −$9,895, −$9,789). Ranch C's sentence names one driver (2,116.53 unrounded), because its herd size, tag price, reader and scale cost and added hours (unpaid) all give "none": "It would pay for itself within 5 years if: net program premium at least $2,117/yr (you entered $0/yr)." Ranch A's names two: "It would pay for itself within 5 years if: subscription per monitor at most $190 per monitor per year (you entered $365 per monitor per year), or hired labor cut at least 28 days (you entered 16 days)." (190.68 and 27.32 unrounded; relative changes 47.76% and 70.76%, against 79.76% for the monitor price and 88.31% for vehicle cost per mile; herd size and both blocks' shares give "none"; at $190 the 5-year test gives +$30). Only Ranch C's panel carries the note "Equipment value left at year 5 uses the residual you entered as a percentage of cost or an amount; it is not recalculated for year 5." (its 15% residual on the reader, scale and platform). The Ranch A case: +$6,000 and "Pays for itself within 5 years (counting equipment value left at year 5)", with no "It would pay" sentence (cash NPV over 10 years +$12,299) |
| 40 | What would make it pay: values found | Synthetic Ranch D (N = 5, T = 7) | Unrounded values (5-year; 7-year) and cells: interior fence that would otherwise be built 14.859; 14.932 mi, "at least 14.86 mi" and "at least 14.94 mi"; fence cost per mile $15,865.63; $15,943.00, "at least $15,866/mi" and "at least $15,943/mi"; hired moving and gathering hours cut 267.04; 272.65 h/yr, "at least 268 h/yr" and "at least 273 h/yr"; subscription $6.674; $6.646, "at most $6.67/head/month" and "at most $6.64/head/month"; herd size 381.86; 380.34 cows, "at most 381 cows" and "at most 380 cows". At each unrounded value the matching cash NPV is within $1 of zero. No range is clipped. Each value shown, entered as is, passes its test (381 cows: 5-year test +$325; 382 cows: −$53). The verdict adds "It would pay for itself within 5 years if: herd size at most 381 cows (you entered 400 cows), or subscription at most $6.67/head/month (you entered $7/head/month)." (relative changes 4.54% and 4.66%, against 5.07% for each fence driver and 33.52% for hours cut) |
| 41 | Range states: none, all, n/a | (a) Ranch A expected: the summer block's share of runs avoided, and the fall–winter block's. (b) Ranch C expected: herd size. (c) The Ranch A case of row 39: herd size. (d) Ranch C expected with 0 calves sold: net program premium, and the verdict. (e) Ranch A expected with `startYear` 5 and its install hours in entry 5 of their `hours` array. (f) Ranch A expected with every operator share 0. (g) Ranch A expected with `freedTimeUse` "absorbed": hired labor cut. (h) Ranch A expected with `labor.cut.unitsCut` 0 and `labor.cut.paidRate` cleared: hired labor cut | (a) The summer range, 0% to the block's 50% cap, is clipped at the low end to 24.24% (128 paid hours cut ÷ 528 summer run hours; `clippedLo` 0.2424). Cells: "No share of runs avoided in summer between 24.24% and 50% makes it pay for itself within 5 years" and "No share of runs avoided in summer between 24.24% and 50% makes it break even over 10 years", with the note "Values below 24.24% are not valid with your other inputs: paid hours cut cannot be more than the hours saved." The fall–winter range, 0% to its 50% cap, is not clipped: "No share of runs avoided in fall–winter between 0% and 50% makes it pay for itself within 5 years" and "No share of runs avoided in fall–winter between 0% and 50% makes it break even over 10 years" (cash NPV −$1,743 and −$965 at 50%). (b) "No herd size between 1 and 10,000 cows makes it pay for itself within 5 years" (5-year test cash NPV −$5,652 at 1 cow and −$106,852 at 10,000 cows) and "No herd size between 1 and 10,000 cows makes it break even over 7 years". (c) No water cash line depends on head: "Pays for itself within 5 years at any herd size between 1 and 10,000 cows" and "Breaks even or better over 10 years at any herd size between 1 and 10,000 cows". (d) "n/a: no calves sold" in both columns. No other driver gives a 5-year value (herd size as in (b); tag price: −$4,009 at $0; reader and scale cost: −$4,616 at $0; added hours: unpaid, so no cash effect), so the verdict adds "No single input in the panel makes it pay for itself within 5 years." (e) The module starts in year 5, the payback target, so it has no flows in the 5-year test (9.3): the line under the verdict reads "No cash flows for you within 5 years", the verdict carries no "It would pay" sentence, and every 5-year cell reads "n/a: no cash flows within 5 years"; the 10-year column is solved as usual. (f) The verdict reads "No cash flows for you in this analysis", never "pays", and the line under it "No cash flows for you within 5 years"; every cell reads "n/a: no cash flows within 5 years" or "n/a: no cash flows within 10 years"; every cost is listed under "Paid by others" and every benefit under "Received by others". (g) "n/a: freed time is absorbed" in both columns, and the row is not ranked; the summer share's range is not clipped (0% to 50%), because no paid hours are cut. (h) The analysis is valid (no unit is cut), and hired labor cut reads "n/a: pay rate, hours per unit or load not entered" in both columns, with no clip note |
| 42 | Validation clip | Ranch A expected: hired labor cut (day labor) and vehicle cost per mile | Hired labor cut: the range, 0 to 365 days, is clipped at the top to 33 days (264 hours saved ÷ 8 h a day; `clippedHi` 33), with the note "Values above 33 days are not valid with your other inputs: paid hours cut cannot be more than the hours saved." Solved: 27.32 days (5-year) and 25.58 days (10-year), shown "at least 28 days" and "at least 26 days" (entered "16 days"). Vehicle cost per mile: $0.753 and $0.699, shown "at least $0.76/mi" and "at least $0.70/mi" (entered "$0.40/mi"); not clipped |
| 43 | Herd size with a per-head subscription | Ranch B expected | Herd size reads "at most", because the subscription and collar handling rise with head while the fence and riding savings stay fixed: 273.33 (5-year) and 278.04 (7-year), shown "at most 273 yearlings" and "at most 278 yearlings" (entered "1,200 yearlings"). Subscription $0.938 and $0.969, shown "at most $0.93/head/month" and "at most $0.96/head/month". Hired moving and gathering hours cut 1,912.30 and 1,903.61 h/yr, shown "at least 1,913 h/yr" and "at least 1,904 h/yr". Fence cost per mile $19,608.69 and $19,588.40, shown "at least $19,609/mi" and "at least $19,589/mi". The verdict adds "It would pay for itself within 5 years if: herd size at most 273 yearlings (you entered 1,200 yearlings), or subscription at most $0.93/head/month (you entered $7/head/month)." |
| 44 | Payback target beyond the horizon | (a) Synthetic Ranch D with the payback target set to 10 (T stays 7). (b) Ranch C with the optimistic column's inputs (section 11) and T = 2 (payback target 5) | (a) The N-year test runs to year 10 with every price and quantity unchanged (training days carry their last value, 0): cash NPV −$15,903 and "Does not pay for itself within 10 years". The panel notes "This test assumes the same prices continue to year 10." The headline (−$9,789) and the panel's 7-year column are unchanged. (b) One verdict, from the 2-year cash NPV of −$283, which rounds to $0 at the $1,000 unit (7.3): the verdict sentence begins "Over 2 years at the example's 7% real rate (an assumption, not a recommendation), before tax, this is within $500 of breaking even in cash. It does not pay. Cash benefits would need to rise by about 5%." (f = 1.050), and the payback tile reads "1.92 years", inside the horizon, because payback is undiscounted (9.5 item 1). The line under it reads "Pays for itself within 5 years (counting equipment value left at year 5)" (5-year test +$3,683), and the panel notes "This test assumes the same prices continue to year 5." and the residual note of 9.5 item 9 (the 25% residual). The two results differ in sign, and each names its horizon (F2) |
| 45 | Payback target input and links | Synthetic Ranch D: set the payback target to 7, make a link and open it; then type 2.5, and then 0. Then open `#preset=Remote+water+monitoring&head=500&years=5` | On load, step 2 shows "Payback target (years)" at 5 next to the horizon. At 7, the line reads "Does not pay for itself within 7 years" (the 7-year test is the full horizon: −$9,789), the panel's two columns agree, and the good-fit banner stays (`ownAnalysis` false). The link's `s.settings` carries `paybackTarget` 7, and opening it restores 7; a link made at 5 carries no `paybackTarget`. 2.5 gives the validation error "Enter a whole number of years, 1 or more.", and so does 0; nothing is computed. The v1 link opens with `paybackTarget` 5 (9.5 item 8) |
| 46 | Scaled drivers | (a) Ranch C expected with every head count × 1,000 ÷ 300 (1,000 cows, 950 calves born, 800 calves sold) and `eid.freeTags` = {qty: 1,000, years: [0, 1, 2, 3, 4, 5, 6, 7]}: herd size. (b) Ranch B expected with row 2's commitment (`minQty` 6,600 head-months, `commitYears` 3): herd size. (c) Ranch A expected with `labor.cut.unitsCut` [0, 16, 16, 24] (24 from year 3 on): hired labor cut | (a) The free tags scale with the head, so every tag is free at every herd size: cash NPV +$954 over 7 years and −$199 in the 5-year test. Herd size: 1,036.54 (5-year) and 866.62 (7-year), shown "at least 1,037 cows" and "at least 867 cows" (entered "1,000 cows"), not "none" (with the free tags held at 1,000, the 7-year cash NPV would be −$6,193 at 1 cow and −$109,296 at 10,000 cows). (b) The commitment scales with the head, so herd size gives row 43's values: 273.33 and 278.04, shown "at most 273 yearlings" and "at most 278 yearlings". (c) The label reads "Hired labor cut (year 1; other years in proportion)" and "You entered" shows "16 days". The range is clipped at the top to 22 days (24 × 22 ÷ 16 = 33 days, the 264 hours saved, in years 3–10; `clippedHi` 22), with the note "Values above 22 days are not valid with your other inputs: paid hours cut cannot be more than the hours saved." Solved: 21.35 (5-year) and 18.65 (10-year), shown "at least 22 days" and "at least 19 days". At the entered array the cash NPV is −$4,627 (5-year test) and −$4,206 (10 years); at 22 days the 5-year test gives +$559 |
| 47 | Tenure defaults | (a) Ranch A expected on one land unit leased for 15 years (the lease runs past T), with `waterBy` "landlord". (b) The same with `waterBy` "tenant" and `careInLeaseRate` true. (c) Ranch D on one land unit leased for 10 years, with `fenceBuiltBy` "tenant" and `fenceMaintainedBy` "landlord" | (a) The vehicle, labor cut and hours-freed lines default to operator share 0 (an avoided hire would too; Ranch A enters none), each shown and editable, with the water-care notice of 9.5 item 11 ("On land unit 1, the landlord provides and checks the water, so the vehicle, labor and hours-freed savings there go to the landowner by default and are listed under 'Received by others'."). Costs and the risk line stay at operator share 1. Cash NPV −$44,426 (= −11,079 − 14,834 − 18,513: the vehicle's $2,112 a year and the labor cut's $2,635.78 a year in years 1–10, × 7.023582). "Received by others" lists the vehicle (PV $14,834), the labor cut (PV $18,513) and the hours freed. Setting the vehicle's operator share back to 1 gives −$29,592. (b) The same shares and cash NPV, with the notice's second reason ("water care is included in the lease rate"). (c) The tenant's fence upkeep `m` is 0, so the avoided fence stream loses its upkeep: cash NPV −$67,332 (= −9,789 − 57,543, the PV of $10,677.31 a year in years 1–7, × 5.389289) |
| 48 | Module starting after year 0 | Fixture lines with B7's USU numbers: a $1,800 capital line (`lifeYears` 10, straight-line residual) and a $780-a-year cash benefit line with `requiresCattle` false, T = 10, with the module's `startYear` 2. Then the same with a benefit of $100 a year | Nₜ = 0, 0, −1,800, then 780 in years 3–9 and 1,140 in year 10 (with the $360 residual), so s₀ = 2. IRR 41.1% (0.411 as a number), as for the same flows starting in year 0 with T = 8, and never "n/a: no net outlay in year 0". Payback "4.31 years (counted from year 0; the first cash flow is in year 2)", with no "cumulative was positive" note; discounted payback "4.61 years (counted from year 0; the first cash flow is in year 2)". Cash NPV +$2,678.96 (= 3,067.14 × 1.07⁻², the cash NPV of the year-0 start with T = 8). With $100 a year: payback "none within 10 years" and IRR "below 0%", each with no note |
| 49 | Verdict area and tornado of an example as loaded | Synthetic Ranch B as loaded. Then Synthetic Ranch D as loaded | Ranch B: the tornado's bars, widest first, are herd size $119,500 (it moves the subscription and the collar handling hours together), subscription $106,566, interior fence that would otherwise be built $25,823, added hours $20,048, discount rate $18,646, hired moving and gathering hours cut $10,779 and infrastructure $1,800 (±$1 each; 9.5 item 6), with no list under the chart (the collar-loss charge is blank on a share of 0, so it is not listed). The verdict area reads, in order: "Indicative only: most of the benefit is estimated, not from your records."; "Over 7 years at the example's 7% real rate (an assumption, not a recommendation), before tax, this costs about $230,000 more than it saves in cash. It does not pay. Cash benefits would need to rise about 3.5-fold. It turns most on herd size and subscription."; "Does not pay for itself within 5 years"; the "It would pay" sentence of row 43; and the published-prices sentence of 9.5 item 1. It has no capacity-hours line (no hours are freed) and neither review note (`ownAnalysis` is false). The Cash NPV (before tax) tile reads "about −$230,000". The notices include "Enter moving and gathering hours today to check the claim on moving and gathering hours.", and Ranch D shows the same notice |
| 50 | Warnings in full | (a) Ranch A expected with the fall–winter block's share of runs avoided at 50%. (b) Ranch B expected with the subscription's `commitYears` 6 and `earlyTerminationFee` $10,000 (test values). (c) The Ranch A case of row 35(b), whose leased unit is land unit 2. (d) Ranch A expected with the summer block's share of runs avoided typed as 80%; then also with 34 day-labor days cut (272 h) | (a) "The fall–winter block is marked 'tanks freeze / water checked on the feeding route', so its share of runs avoided is normally 0%. Check the 50% you entered." Cash NPV −$965 (row 41(a)). (b) The panel notes "5-year test: The horizon (5 years) ends inside the 6-year contract on Subscription, so its early-termination fee ($10,000) is charged in year 5." The 5-year test cash NPV is −$182,649 (−$175,519 less the fee's PV); the 7-year run raises no contract warning, and its cash NPV is unchanged (−$229,531). (c) The 10-year run warns "The lease on land unit 2 ends in year 3, inside the 10-year horizon. Its share of each benefit stops then; its costs run as entered, except improvements that stay with the land, which stop at the lease end and are credited any reimbursement." The 5-year test raises the same notice for the same land unit, so the panel lists no 5-year warning (9.3). (d) "The summer block's share of runs avoided is limited to 50% by the minimum visits; you entered 80%." The input still shows 80%, and the analysis uses the 50% cap (9.3), so cash NPV stays −$11,079 and the panel's summer row shows "You entered 50%" with the range of row 41(a). With 34 days cut, the paid-hours check uses the 264 hours saved at the cap (not 422.4 h at 80%), so the validation error of row 23 shows |
| 51 | Horizon prefill | Hand-made version 2 links whose `s.settings` is the example's own settings with `T` removed (every other settings field as in the example): (a) `x=ranchA`; (b) `x=ranchA`, with `s.costs` the example's own cost lines with the subscription's `commitYears` set to 3; (c) `x=ranchC` | (a) T = 10, the monitors' life, with no note. (b) T = 3, the contract term. (c) T = 5, with the note "5 years assumed: no contract term or asset life entered." (no commitment, and no capital line with a life). Every example and every version 1 link sets T, so no other link reaches the prefill (9.2) |

### 10.2 Expert review (recommendation)

Before calling it finished, ask one extension economist and one working ranch manager to run the four synthetic
examples and their own numbers. Record their changes in the README.

---

## Appendix A. Exact inputs and pinned outputs for the synthetic examples

The section 11 figures come from a reference prototype of the section 9 formulas. It sits beside this document in
[`prototype/`](prototype/) (`proto.mjs` for the engine, `examples.mjs` for the four ranches; run `node examples.mjs`).
It is a reference for the pinned numbers only: it is not part of the calculator's code (`roi.js`, `app.js`) and is not
a proposed implementation. It exists so that the phase-1 regression test (9.7) has exact inputs and outputs to
match. The four ranches are synthetic: made-up numbers for demonstration, not any real operation's data and not the
site owner's operation (section 11). Ranch D is the good-fit cow-calf virtual-fence example (owner decision, 15 Oct
2026); its inputs were fixed before any result was computed and were not adjusted afterwards. No ranch's inputs were
tuned to reach a result.

**Conventions the prototype applies** (specified in 9.2 and 9.3): 7% real discount rate, the examples' assumption [E]
and not a recommendation (the owner has not selected a rate; owner decision, 15 Oct 2026); years indexed 0..T;
capital at purchase year; subscriptions and software billed in advance (years 0..T−1); other operating costs and all
benefits at year end (years 1..T), except avoided capital (the fence), which falls in the year it would have been
bought (Ranch B: years 0 and 4; Ranch D: year 0); per-animal items bought each season (calf tags, retags) as annual lines billed in
arrears (years 1..T); residual at year T either straight-line on the last purchase cohort (Ranch A monitors; the
Ranch B and Ranch D fences, where the lost residual is subtracted from the avoided benefit) or a stated percentage of cost (Ranch C
reader, scale and platform: 15% in the expected case); replacements at s + n·L < T; avoided fence as a negated
capital line; risk, capacity and production lines excluded from cash NPV, BCR, IRR and payback.

Two more conventions follow the owner decisions of 15 Oct 2026. Every result is before tax: the prototype has no tax
lines. The operator pays every cost and receives every benefit (operator share 1 on every line, as each ranch's
tenure row below states), so the prototype omits the operator-share multiplication of 9.3 (F6) and lists nothing
under "Paid by others" or "Received by others". The one exception is the Ranch B landlord-fenced lease run, which sets
the fence benefit to 0 (a landlord-built fence on a lease of 7 years or more, or one expected to renew); that equals
an operator share of 0 on the fence line, and the prototype does not compute the "Received by others" list.

The prototype also does not implement land units, the discount-rate review prompt (`ownAnalysis`, `rateReviewed`) or
the synthetic-placeholder flags: it takes each ranch's inputs as fixed values. These change page text and verdict
notes, not the pinned numbers.

The prototype implements the IRR and payback states of 9.3, including "above 10,000%", "n/a: no cash flows" and
the notes for a cumulative that turns positive and then negative again. The reference for those states is still 9.3 and
the tests in 10.1 rows 1, 4, 5, 17 and 27. Ranch D shows two of them: IRR "n/a: no net outlay in year 0" and a payback
note for a cumulative that is negative only from year 7.

The prototype reads year 0 as the first year with cash flows (s₀ = 0 in 9.3): its `irrState()` and `payback()` take no
s₀ argument. That holds for every run in this appendix, since each has a cost in year 0 (a purchase or an
advance-billed subscription), so no pinned value depends on the s₀ rule. 10.1 row 48 (a module that starts in year 2)
is checked against 9.3, not against the prototype.

**Expected-case inputs**

All four ranches: ramp 1 in every year (the default); no commitments (`minQty`, `commitYears` and
`earlyTerminationFee` all 0). Values marked "synthetic placeholder" are the examples' cost placeholders: costs or
prices for which no published price that applies to the example was found, kept as [E] values. On the page each is labeled "Synthetic placeholder,
not a price. Replace with your quote." and, once the user starts their own analysis, is flagged until replaced or
confirmed (section 11; 9.2, 9.3, 9.5). Ranch B's conservative infrastructure ($9,000) and collar-loss charges
($3,000/yr) are placeholders too, but sit in the conservative column (section 11), not in the expected case below.
Ranch D has one set of inputs and uses one placeholder, the $25/h contract rate of Ranch B. The expected-case
placeholders, by the path whose `prov.placeholder` is true (9.2, 9.7): Ranch A `costs.mounting.unitCost` and
`costs.batteries.unitCost`; Ranch B and Ranch D the contract rate, stored at two paths, `labor.handling.paidRate` (the
handling cost) and `labor.cut.paidRate` (the hours cut), both flagged; Ranch C `costs.platform.unitCost`,
`costs.software.unitCost` and `eid.dosing.perApplication`.

| Ranch A (T = 10) | Value |
|---|---|
| Head and tenure | 900 cows, served 12 months (default); `heifersRetained` 0; owned (one land unit with all 10 water points), so the ranch provides and checks water, and the 9.3 tenure rule leaves operator share 1 on the lines that value water runs (vehicle, labor and hours freed); operator share is 1 on every line [E] |
| Monitors | capital: unit $1,490, qty 10, start 0, life 10, repairPct 0, straight-line residual (0 at year 10) |
| Mounting | capital, basis fixed (qty 1): `unitCost` $750 at year 0 (10 monitors × $75, entered as one amount), lifeYears null (no residual); synthetic placeholder [E] |
| Subscription | annual, advance: perDevice $365 × 10 = $3,650/yr |
| Batteries and repairs | the 9.4 "$ per monitor in stated years" input: annual perDevice line, $100 × 10 monitors in seasons 4 and 8 only, billed in arrears, so $1,000 in years 4 and 8; not a capital line, so no residual; synthetic placeholder [E] |
| Summer block (`name` "summer") | 22 weeks × 4 runs; 120 mi and 6 h per run; minimum 2 visits/week; share avoided 0.50 [E], a synthetic demonstration assumption set at the 50% the Utah State University Extension worked example assumes [B]; its `prov` has `cls` "E", and its `note` names that source (the USU worked example [S26], `https://extension.usu.edu/rangelands/research/save-time-money`, undated; checked 15 Oct 2026; US (Utah)) and PIRSA (South Australia, Feb 2022 prices), which assumes the same 50%, as non-US context only |
| Fall–winter block (`name` "fall–winter") | 30 weeks × 2 runs; 120 mi and 6 h per run; minimum 1 visit/week; freeze/feeding-route flag on; share avoided 0 |
| Vehicle | $0.40/mi |
| Paid labor cut | `freedTimeUse` "replacesPaidWork"; laborUnit "day", unitsCut 16, hoursPerUnit 8, paidRate $18.72/h, loadPct 10% |
| Added time | 1 h/week × 52 = 52 h/yr (`hours` is per year), unpaid |
| Risk line | 0.15 events/yr × 5 head × $2,700 × 0.75 |
| Owner time rate (economic view) | $20/h; install 30 h, a `labor.added` item {label "install", hours [30, 0], doneBy "unpaid"}: 30 h in year 0 only (entry 0, the module's `startYear`, 9.3; a single number 30 would recur in years 1..10, and a one-entry array [30] would carry 30 h into every year) |

| Ranch B (T = 7) | Value |
|---|---|
| Head | 1,200 yearlings, enrolled 5.5 months; `heifersRetained` 0 |
| Subscription | `vf.pricing` "leased" (leased collars with a subscription); annual, advance: perHeadMonth $7 → 1,200 × $7 × 5.5 = $46,200/yr (years 0..6) |
| Infrastructure | $4,500 at year 0, lifeYears null (no residual) |
| Handling labor (doneBy paid, contract $25/h, a synthetic placeholder [E], loadPct 0) | 1,200 head × 2 events × 1.5 min × crew 4 = 240 h; refits 2 × 3 riders × 8 h = 48 h; training 7 days × 2 riders × 6 h = 84 h |
| Collar loss | `vf.collarLoss` = {pctPerYear 0, chargePerCollar null (blank)}: $0 a year (the expected case assumes the quote covers loss) [E]. The loss charge is a price with no published source, so it loads blank and is never filled (9.2); with a loss share of 0 the line is $0 in every year, so it is not listed as "Quote required: not counted" and raises no warning (9.5 item 7). Not a placeholder in the expected case (the conservative $3,000/yr charge is one, section 11) |
| Fence avoided | F $4,300/mi, 8 mi, k = 0, life 4, upkeep 5%/yr, straight-line residual; interior fence miles in the plan, `vf.fence.planMiles` (the `fenceMiles` baseline, 9.6), 8 mi, equal to the claim, so no clamp; tenure owned (one land unit; the operator would build the fence; operator share 1 on every line) |
| Moving and gathering hours cut | 200 h × $25 (the synthetic placeholder rate) a year, paid: `vf.gatherHoursCut` 200 (the module's claim on `gatherHours`) and `labor.cut.unitsCut` 200 (`laborUnit` "hour", `hoursPerUnit` 1, `paidRate` $25, `loadPct` 0), with `freedTimeUse` "replacesPaidWork"; moving and gathering hours today (`vf.gatherHoursToday`, the `gatherHours` baseline) left blank, so the single-module clamp is skipped (9.6) |

| Ranch C (T = 7) | Value |
|---|---|
| Head and tenure | 300 cows and 285 calves born a year, served 12 months (default); served classes cows and calvesBorn, so head-months (300 + 285) × 12 = 7,020 a year; 240 calves sold, a sale flow drawn from the calves born, never served and never in head-months (not used, as the premium is 0); `heifersRetained` 0, so validation allows up to 285 calves sold and the 240 pass (9.2); tenure has no effect on any EID line (operator share 1 on every line) |
| Rule applies (the B4a step-3 question "Does the EID rule apply to cattle you move?", recorded as an input) | no, so all tags are project costs and the pending-verification notice does not appear |
| Cow tags | capital perDevice: 300 × $3.14 at year 0, lifeYears null, residual none |
| Calf tags | annual perDevice line from `calvesBorn`: 285 × $3.14 a year, billed in arrears (years 1..7) |
| Retags | annual line: 300 × 1.5% × $3.14 a year, billed in arrears (years 1..7) |
| Reader, indicator and bars, platform | capital: $1,919 + $1,830 + $800 at year 0, lifeYears null, residual pctOfCost 15% at year 7; the $800 platform is a synthetic placeholder [E]. The $1,830 is the indicator-and-bars listing price of $1,829.95 (9.5 item 7) rounded, class [C]: it loads with the example, not through the fill, and carries that listing's published-list-price label followed by "(rounded from $1,829.95)" (9.5 item 4); pressing "Use published vendor price" sets $1,829.95 |
| Software | annual, advance: $360/yr, set at a published plan price for up to 250 animals, below this herd's size, so a quote is needed; synthetic placeholder [E] |
| Dosing savings (a cash benefit line, not a cost) | 885 applications × $0.45 = $398.25 a year, years 1..7; the $0.45 dewormer price is a synthetic placeholder [E] |
| Premium | 0 |
| Recording time today | 0 h (no weights were recorded before; see section 11) |
| Added time (unpaid) | 885 weighings (cows twice a year, calves once) × 20 s × crew 3 + 15 h data upkeep = 29.75 h/yr at $20/h |

| Ranch D (T = 7; good fit, one set of inputs) | Value |
|---|---|
| Head and tenure | 400 cows, enrolled 12 months (`enrolled.cows` = {head 400, months 12}); calves and bulls not enrolled (section 11 gives the sources); `heifersRetained` 0; owned (one land unit of 8,000 acres in four 2,000-acre pastures; the operator would build the cross-fences; operator share 1 on every line) [E] |
| Subscription | `vf.pricing` "leased" (leased collars with a subscription); annual, advance: perHeadMonth $7 → 400 × $7 × 12 = $33,600/yr (years 0..6) |
| Infrastructure | $4,500 at year 0, lifeYears null (no residual) |
| Handling labor (doneBy paid, contract $25/h, a synthetic placeholder [E], loadPct 0) | one event a year (collar fit check at the fall working, classes cows, timesPerYear 1): 400 head × 1.5 min × crew 4 = 40 h; refits 2 gathers × 3 riders × 8 h = 48 h; training 7 days × 2 riders × 6 h = 84 h in year 1 only (`trainingDays` entered by year as [0, 7, 0], the last value carried forward), so 172 h ($4,300) in year 1 and 88 h ($2,200) in years 2..7 |
| Collar loss | $0 a year (as Ranch B expected: `vf.collarLoss` = {pctPerYear 0, chargePerCollar null (blank)}, so no "Quote required" warning; not a placeholder) |
| Fence avoided | `vf.fence`: F $15,100/mi (6-wire high-tensile) [B], miles 2 × √(2,000 ÷ 640) × 4 = 14.1421… mi, stored unrounded (typed as 14.14 mi, the cash NPV is −$9,815), k = 0, Lf 25, m 5%/yr, mode "avoided", straight-line residual: $213,546 avoided in year 0, upkeep $10,677 a year in years 1..7, lost residual (18 ÷ 25) × $213,546 = $153,753 at year 7; interior fence miles in the plan, `vf.fence.planMiles` (the `fenceMiles` baseline, 9.6), left to default to `miles` (14.1421… mi), so the claim equals the baseline and is not clamped (9.7) |
| Moving and gathering hours cut | as Ranch B expected: `vf.gatherHoursCut` 200 and `labor.cut.unitsCut` 200 (`laborUnit` "hour", `hoursPerUnit` 1, `paidRate` $25, `loadPct` 0) a year, with `freedTimeUse` "replacesPaidWork"; `vf.gatherHoursToday` blank |
| Not counted | no production, risk or owner-time lines, so the economic NPV equals the cash NPV; no cost share (B5, after phase 1; see the two Ranch D sensitivity rows below) |

**Pinned outputs, before tax (tolerance ±$1 for dollars, ±0.001 for ratios)**

| | Cash NPV | Cash NPV incl. expected losses avoided | Economic NPV | BCR | Payback |
|---|---|---|---|---|---|
| Ranch A expected | −$11,079 | −$412 | +$10,788 | 0.751 | none within 10 years |
| Ranch B expected | −$229,531 | −$229,531 | −$229,531 | 0.285 | none within 7 years |
| Ranch C expected | −$9,895 | −$9,895 | −$13,101 | 0.206 | none within 7 years |
| Ranch D | −$9,789 | −$9,789 | −$9,789 | 0.954 | none within 7 years (no net outlay in year 0; cumulative negative from year 7) |

Ranch D: IRR "n/a: no net outlay in year 0"; PV(C) $212,075 (subscription $193,756; contract labor $13,819;
infrastructure $4,500); PV(B) $202,286 (fence avoided, net of its lost residual, $175,340; hours cut $26,946).

Yearly net cash, expected cases and Ranch D (years 0..T):
- Ranch A: −19,300; 1,098; 1,098; 1,098; 98; 1,098; 1,098; 1,098; 98; 1,098; 4,748
- Ranch B: −16,300; −48,780; −48,780; −48,780; −14,380; −48,780; −48,780; −11,180
- Ranch C: −5,851; −871; −871; −871; −871; −871; −871; 172
- Ranch D: 175,446; −22,223; −20,123; −20,123; −20,123; −20,123; −20,123; −140,276

**Sensitivity runs.** `node examples.mjs` prints the nine headline runs of Ranches A, B and C, the Ranch D run and the
5-year test for every ranch, nothing more. Each section 11 sensitivity figure is
one call to a function exported by `examples.mjs`, starting from the case named and changing only what the call
states. Read `cashNPV` on the result unless the row says otherwise; `breakEven` returns the input value itself. For
example, from the `prototype/` folder:
`node --input-type=module -e 'import {ranchB} from "./examples.mjs"; console.log(ranchB("exp", {leasedLandlordFence: true}).cashNPV)'`.

| Run | Call | Result |
|---|---|---|
| A: fall–winter runs also 50% avoided | `ranchA("exp", {shareOther: 0.5})` | −$965 |
| A: no runs avoided, no day labor cut | `ranchA("exp", {shareSummer: 0, daysCut: 0})` | −$44,426 |
| A: added monitoring time 4 h/wk | `ranchA("exp", {addHrsWk: 4})` | cash −$11,079; `econNPV` −$11,126; `freed` −72 h/yr |
| A: 3% real | `ranchA("exp", {rate: 0.03})` | −$8,898 |
| A: 10% real | `ranchA("exp", {rate: 0.10})` | −$12,297 |
| A: day-labor days for cash NPV = 0 | `breakEven((d) => ranchA("exp", {daysCut: d}), 0, 33)` | 25.58 days |
| B: landlord-fenced lease (operator's fence benefit 0) | `ranchB("exp", {leasedLandlordFence: true})` | −$294,088 |
| B: 6-wire high-tensile fence | `ranchB("exp", {fence: {F: 15100, life: 25, m: 0.05}})` | −$194,901; `payback.text` "none within 7 years (no net outlay in year 0; cumulative negative from year 2)" |
| B: optimistic, same high-tensile fence | `ranchB("opt", {fence: {F: 15100, life: 25, m: 0.05}})` | −$65,159 |
| B: optimistic, billed for 5.5 months | `ranchB("opt", {months: 5.5})` | −$118,818 |
| B: subscription for cash NPV = 0 | `breakEven((x) => ranchB("exp", {subRate: x}), 0, 7)` | $0.969/head/month |
| C: dosing on calves only | `ranchC("exp", {dose: 285 * 0.45})` | −$11,350 |
| C: retags 4.3%/yr | `ranchC("exp", {tagLoss: 0.043})` | −$10,037 |
| C: rule applies to the cows, with the B4b compliance baseline (a preview: B4b waits for research task R1, 8.4; under B4a the result stays −$9,895) | `ranchC("exp", {cowTag: 0, tagLoss: 0})` | −$8,877 |
| C: optimistic, free calf tags all 7 years | `ranchC("opt", {calfTag: 0})` | +$10,737 |
| C: optimistic, verification fee $0.90/head (the flyer's 151–250-head tier, which covers 240 head) | `ranchC("opt", {prem: 240 * 5.5 * 2.25 - 240 * 0.90})` | +$6,173 |
| D: Arizona NRCS cost-share rates (context only; cost share is B5, after phase 1) | `ranchD({costShare: {year1: 400 * 91.92, laterYears: 400 * 60.48, lastYear: 5}})` | +$101,156 |
| D: the same, 5-year test | `ranchD({T: 5, costShare: {year1: 400 * 91.92, laterYears: 400 * 60.48, lastYear: 5}})` | +$104,074 |

**Five-year test and what would make it pay (B9).** `targetTest(f, target = 5)` returns `f({T: target}).cashNPV`: the
same ranch re-run with a horizon of 5 years and every other input unchanged, which is the N-year test of 9.3 with
`settings.paybackTarget` at its default of 5. Straight-line residuals are valued at year 5 (Ranch A's monitors, and the
Ranch B and Ranch D fences, whose lost residual is recomputed at year 5); Ranch C's residual, a percentage of cost, is
used as entered (15% in the expected case, at year 5). The case "pays for itself within 5 years" when the result is $0
or more.

| Run | Call | Result |
|---|---|---|
| A: 5-year test, conservative / expected / optimistic | `targetTest((o) => ranchA("cons", o))`, then `"exp"`, `"opt"` | −$23,867 / −$7,648 / +$6,000 |
| B: 5-year test, conservative / expected / optimistic | `targetTest((o) => ranchB("cons", o))`, then `"exp"`, `"opt"` | −$470,813 / −$175,519 / −$76,811 |
| C: 5-year test, conservative / expected / optimistic | `targetTest((o) => ranchC("cons", o))`, then `"exp"`, `"opt"` | −$10,906 / −$8,678 / +$3,683 |
| D: 5-year test | `targetTest(ranchD)` | −$6,871; `ranchD({T: 5}).payback.text` "none within 5 years (no net outlay in year 0; cumulative negative from year 5)" |

The prototype does not implement `PAYBACK_DRIVERS(a)`, `setPath()`, the validation clip or the verdict sentence that names two drivers (B9).
It solves one driver at a time by passing one override to a ranch function through `breakEven(f, lo, hi)`, a
bisection on cash NPV that returns `null` when cash NPV has the same sign at both ends (the "none in range" case).
The herd-size overrides are `head` on Ranch B (the subscription and the collar on and off hours scale with head; the
fence, refits, training and hours cut stay fixed), `cows` on Ranch C (cows, calves, weighings, doses and premium head
scale together; reader, scale, platform and software stay fixed) and `cows` on Ranch D (the subscription and the fit
check hours scale with cows; the fence plan, refits, training and hours cut stay fixed). Ranch A has no herd-size
override. For Ranch A's summer share, the validation clip is passed as the low end of the search: 16 days × 8 h = 128
paid hours cut must come out of 88 summer runs × 6 h = 528 h, so the share cannot fall below 128 ÷ 528 = 0.2424
(below it, `ranchA` throws "paid hours cut exceed hours saved").

Each call below is the 5-year test. Removing `T: 5` gives the full-horizon value (T = 10 for Ranch A, 7 for the
others). Results are the solved values to two decimals (tolerance ±0.01 of the unit); "at least" or "at most" is the
direction in which the case pays. For whole units the value in parentheses is the nearest whole number that pays.

| Driver (expected case unless stated) | Call (5-year test) | 5-year | Full horizon |
|---|---|---|---|
| A: day-labor days not hired (entered 16; at most 33 possible), at least | `breakEven((d) => ranchA("exp", {daysCut: d, T: 5}), 0, 33)` | 27.32 (28 days) | 25.58 (26 days) |
| A: variable vehicle cost (entered $0.40/mi), at least | `breakEven((x) => ranchA("exp", {mile: x, T: 5}), 0, 2)` | $0.75/mi | $0.70/mi |
| A: share of summer runs avoided (entered 0.50, the cap) | `breakEven((x) => ranchA("exp", {shareSummer: x, T: 5}), 128 / 528, 0.5)` | `null`: none between 0.2424 and 0.50 | `null` |
| A: share of fall–winter runs avoided (entered 0, freeze/feeding-route flag on; cap 0.50) | `breakEven((x) => ranchA("exp", {shareOther: x, T: 5}), 0, 0.5)` | `null`: none between 0 and 0.50 (−$1,743 at 0.50) | `null` (−$965 at 0.50) |
| B: subscription (entered $7/head/month), at most | `breakEven((x) => ranchB("exp", {subRate: x, T: 5}), 0, 7)` | $0.94/head/month | $0.97/head/month |
| B: herd size (entered 1,200 yearlings), at most | `breakEven((h) => ranchB("exp", {head: h, T: 5}), 1, 1200)` | 273.33 (273 head) | 278.04 (278 head) |
| B: moving and gathering hours cut (entered 200 h/yr), at least | `breakEven((h) => ranchB("exp", {riderCut: h, T: 5}), 0, 5000)` | 1,912.30 (1,913 h/yr) | 1,903.61 (1,904 h/yr) |
| B: fence $/mile, same 4-year polywire life (entered $4,300), at least | `breakEven((f) => ranchB("exp", {fence: {F: f, life: 4, m: 0.05}, T: 5}), 0, 50000)` | $19,608.69 | $19,588.40 |
| C: herd size (entered 300 cows) | `breakEven((c) => ranchC("exp", {cows: c, T: 5}), 1, 10000)` | `null`: none between 1 and 10,000 cows | `null` |
| C: verified-program premium, net of fees (entered $0/yr), at least | `breakEven((p) => ranchC("exp", {prem: p, T: 5}), 0, 10000)` | $2,116.53/yr | $1,836.00/yr |
| C optimistic: herd size (entered 300 cows), at least | `breakEven((c) => ranchC("opt", {cows: c, T: 5}), 1, 300)` | 177.24 (178 cows) | 150.04 (151 cows) |
| D: interior fence that would otherwise be built (entered 14.14 mi), at least | `breakEven((x) => ranchD({miles: x, T: 5}), 0, 30)` | 14.86 mi | 14.93 mi |
| D: subscription (entered $7/head/month), at most | `breakEven((x) => ranchD({subRate: x, T: 5}), 0, 7)` | $6.67/head/month | $6.65/head/month |
| D: herd size, collared cows on the same fence plan (entered 400), at most | `breakEven((c) => ranchD({cows: c, T: 5}), 1, 400)` | 381.86 (381 cows) | 380.34 (380 cows) |
| D: fence $/mile, same high-tensile fence (entered $15,100), at least | `breakEven((f) => ranchD({F: f, T: 5}), 0, 30000)` | $15,865.63 | $15,943.00 |
| D: moving and gathering hours cut (entered 200 h/yr), at least | `breakEven((h) => ranchD({riderCut: h, T: 5}), 0, 1000)` | 267.04 (268 h/yr) | 272.65 (273 h/yr) |

Relative to the entered values, Ranch D's 5-year drivers need changes of 4.54% (herd size), 4.66% (subscription),
5.07% (fence miles), 5.07% (fence $/mile) and 33.52% (hours cut). The two smallest, herd size and subscription, are the
two that sentence names when the 5-year test fails.

Ranch A expected: the prototype has no override for the subscription or the monitor price, but cash NPV is linear in
each, so each solved value is one expression on the 5-year test, `v = targetTest((o) => ranchA("exp", o))`
(−$7,647.65 unrounded). Subscription per monitor, billed in advance in years 0..4: at most
`365 + v / (10 * [0, 1, 2, 3, 4].reduce((s, t) => s + 1.07 ** -t, 0))` = $190.68 a year. Monitor price, half of
whose cost is left as residual at year 5 (10-year life): at most `1490 + v / (10 * (1 - 0.5 / 1.07 ** 5))` = $301.57.
Relative to the entered values, Ranch A's 5-year drivers need changes of 47.76% (subscription, $365 entered), 70.76%
(hired labor cut, 27.32 days against 16), 79.76% (monitor price, $1,490 entered) and 88.31% (vehicle cost per mile,
$0.753 against $0.40, and miles per run by the same share, as the other factor of the same product); herd size (no
water cash line depends on head) and both blocks' shares give "none". Ranch A's sentence therefore names the
subscription and the hired labor cut (10.1 row 39). Ranch B's sentence (herd size and subscription) and Ranch C's
(the premium alone) are pinned in 10.1 rows 43 and 39.
