# Ranch Tech ROI: audit and improvement plan

Prepared 15 October 2026 for Jeremiah Fleming (CowCampSTX). Covers the `main` branch of
`CowCampSTX/ranch-tech-roi` at commit `d0fd9b8`, plus the project's handoff notes (`HANDOFF.md`, which is not in
the repository). The audit itself changed no code. It is split into four Markdown files so that each stays readable
on GitHub, and they sit in one folder with the evidence table ([`evidence-table.csv`](evidence-table.csv)) and the
reference prototype ([`prototype/`](prototype/)). Section numbers run across the files:

| File | Sections |
|---|---|
| [`ranch-tech-roi-audit.md`](ranch-tech-roi-audit.md) (this file) | header, §1–§8 (except the §5.3 table), §11, §12 |
| [`phase1-spec.md`](phase1-spec.md) | §9 phase-1 specification, §10 validation plan, Appendix A pinned inputs and outputs |
| [`evidence-table.md`](evidence-table.md) | §5.3 the evidence table (the same rows, with full URLs, are in [`evidence-table.csv`](evidence-table.csv)) |
| [`sources.md`](sources.md) | §13 sources, including the sources not accessed |

Revised the same day to apply the project owner's answers to the seven open questions of the first version of this
plan (primary user, examples, pricing, discount rate, geography, taxes and land tenure; owner decision, 15 Oct 2026).
A further owner decision the same day added a payback target (5 years by default, editable) and a "What would make
it pay" panel that shows what would have to be true for each technology to pay for itself within the target
(phase-1 item B9, 8.2), and one good-fit cow-calf virtual-fence example, Synthetic Ranch D (§11). The examples are
never tuned to reach a result. Section 12 now lists each decision and where the plan implements it. Two items remain
open (§12): research task R1 (8.4), which verifies the EID rule's status and the litigation before any compliance
baseline is built, and one item for the owner to confirm, with a recommended default: the synthetic cost
placeholders in the examples.

**For a first read:** start with §1 (the five changes), then §2.3 (overall judgment) and the "Outcomes at a glance"
table in §11. §12 lists the owner's decisions and what remains open.

**For builders:** phase 1 starts at 9.1 (scope and build order) in [`phase1-spec.md`](phase1-spec.md). The tests are
in 9.7 and 10.1, the pinned numbers the regression tests must match are in Appendix A (same file), and the reference
prototype in [`prototype/`](prototype/) reproduces them.

**How to read this document**

- **Sourced finding** means a source says it. Each one names the source, its publication date and, where known,
  the year of the underlying data. The source list is §13, in [`sources.md`](sources.md).
- **Recommendation** means it is my judgment. Recommendations are labeled "Recommendation", and other judgment
  calls are marked "(judgment)".
- **Owner decision** means the project owner chose it (cited as "owner decision, 15 Oct 2026", or "owner decision,
  14 Oct 2026" for the earlier decision on generic technology names; see §12). It sets
  the plan's direction; it is neither a sourced finding nor my judgment.
- **Calculated** means I ran the repository's own `roi.js` (or, for the synthetic examples, the reference prototype of the
  proposed model in [`prototype/`](prototype/), described in Appendix A) and report the output.
- **Evidence classes.** Values in §5 and §11 carry one of these tags, and §9 stores each one in the input's
  `prov.cls` field:
  - **[A]** fact or specification (a rule, a government statistic, a quoted contract term)
  - **[B]** research-based estimate
  - **[C]** vendor-reported price or claim
  - **[D]** user-entered value
  - **[E]** synthetic or author-chosen value. Values I chose for the synthetic examples are [E], never [D].
- **Source labels in §4.** Section 4 labels each finding by the type of source. The labels map to the evidence
  classes as follows:
  - [gov] rule, program term or official statistic → **A**; [gov] estimate, assumption or worked example → **B**
  - [peer], [ext] or [trial] estimate → **B**, except vendor-authored or vendor-funded work → **C** (§5.2 item 7)
  - [vendor], and [news] reporting a vendor claim or one producer's own experience → **C**
  - [news, secondhand]: a press report of what a researcher said, where the original was not seen → **C** until the
    original is checked
  - The full list is at the start of §4.
- **Sections 1 to 3** carry no A–E tag. Their "Calculated" figures come from `roi.js` at `d0fd9b8` (the
  advance-billing figures in change 3 and M6 apply plain arithmetic to that output); their sourced figures name the
  source and date.
- Research limits: some peer-reviewed papers could not be opened (paywalls or bot blocks). They are listed in
  "Sources not accessed" (§13.3, in [`sources.md`](sources.md)). I do not claim the research is complete.

**Where each requested deliverable is**

| Deliverable | Section |
|---|---|
| 1. Concise assessment of the current tool | §2 |
| 2. Prioritized model audit | §3 |
| 3. Research and data requirements table with citations | §4 (research findings), §5 (table: [`evidence-table.md`](evidence-table.md) and [`evidence-table.csv`](evidence-table.csv)), §13 ([`sources.md`](sources.md)) |
| 4. Comparison of candidate additional modules | §6 |
| 5. Practical implementation roadmap | §8, with the user experience in §7 |
| 6. Developer-ready specification for the first phase | §9, with validation in §10 and the examples' exact inputs and pinned outputs in Appendix A, all in [`phase1-spec.md`](phase1-spec.md); synthetic examples in §11 (the prototype that produced them is in [`prototype/`](prototype/)) |
| 7. Remaining questions that need your input | §12 (now the decisions confirmed on 15 Oct 2026 and the remaining work) |

---

## 1. The five changes most likely to improve reliability and usefulness

1. **Separate cash savings from freed-up time, and make cash the headline.**
   - *What is wrong now:* the model values every hour saved at the loaded wage and counts it as cash
     (`roi.js:65`).
   - *Calculated:* with labor alone removed, the 5-year results for the shipped starting values change like this:
     - Virtual fencing: from **+$129,913 to −$28,311 NPV**
     - Water monitoring: from **+$79,621 to +$11,478**
     - EID and scale: from **+$109,736 to +$94,318**. Labor is only 10.6% of EID's full-year benefit; weight gain
       drives that result (see change 2).
   - *Sourced:* extension partial-budgeting guidance counts only income and costs that actually change. It reports
     unpaid labor as an economic cost, separately from cash. The sources are Oklahoma State AGEC-139 (Dec 2024),
     UW–Madison's partial-budgeting guide and USDA ERS (Dec 2024).
   - *Recommendation:* count payroll, overtime, day-labor and contract dollars as cash only in whole units (hours,
     days, weeks or a position) that the user says will actually stop being paid. Ask, as a required question:
     "Would the freed time go to other work you now pay for or would otherwise hire? If it is absorbed, cash = 0."
     Count new work done by paid hands (collar fitting, chute time, monitoring) as a cash cost. Report the remaining
     hours as capacity, in hours, outside the cash NPV, and value them only in the economic view at a rate the user
     gives.

2. **Tie every benefit to the animals that actually produce it, and default unproven production benefits to zero.**
   - *What is wrong now:* weight gain is multiplied by the whole herd (1,000 cows) at a calf price per pound
     (`roi.js:67`). Cows are not sold by the pound each year, calves are not counted in "head", and every extra
     pound is valued at the full sale price per pound.
   - *Calculated:*
     - Weight gain removed alone: virtual fencing goes from +$129,913 to **−$60,260** and EID from +$109,736 to
       **−$13,806**. Water monitoring has no weight benefit.
     - Changes 1 and 2 together (labor and weight gain both removed): virtual fencing **−$218,483**, EID
       **−$29,223**, water monitoring +$11,478.
   - *Sourced:* this audit found no independent evidence that any of the three technologies, by itself, adds sale
     weight (some papers could not be read; see §13.3).
     - Arizona Extension's virtual fence economics study (az2117, March 2025) found the calf gain needed to break
       even "implausibly large".
     - Controlled rotational-grazing experiments do not support assuming a gain (Augustine et al. 2020, Colorado;
       Briske et al. 2008, a review; §4.4).
   - *Recommendation:* enter the herd by class: cows, bulls, replacement heifers, calves born (at side: tags, dosing,
     death loss), calves sold, cull cows sold and yearlings. Each benefit and each per-head cost names the classes it
     applies to. Production benefits become optional advanced inputs that default to blank, need a source note, and
     count as cash only when the user marks them "from my records". Added pounds are valued at the value of gain
     (the extra dollars a heavier animal brings, divided by the extra pounds, from two dated USDA AMS weight-class
     auction quotes, or the user's own figure), not at the sale price per pound. In any year when a module has no
     cattle, the benefit lines that need cattle (labor, vehicle, fence, gather, death loss and production) and the
     freed hours count zero, and the page says "No cattle in year t: benefits not counted". An avoided fence
     purchase or rebuild still counts if the module has cattle in at least one year of the horizon (judgment; see
     9.3). Committed minimum subscription charges still apply.

3. **Model costs with the drivers vendors actually charge for, over the real asset life, at the time they are paid.**
   - *What is wrong now:*
     - Water monitors are priced per monitor but entered per head ($3.65/head), so changing herd size changes the
       monitor bill.
     - Base stations and scales are entered as a one-time "fixed cost" that never needs repair or replacement.
     - Virtual fence subscriptions are charged on every head for all 12 months.
     - The default horizon is 12 months, which is shorter than any of these assets last.
     - Every running cost is booked at the end of the year, although virtual fence subscriptions are priced by the
       month and can carry a multi-year commitment. The discount rate is not labeled real or nominal, while all prices are held
       flat (see M6).
   - *Calculated:* charging the virtual fencing subscription at the start of each year instead of the end lowers the
     5-year NPV from +$129,913 to +$103,082 (see M6).
   - *Recommendation:* each cost line says whether it is a capital purchase or an annual charge, and what sets its
     quantity (fixed, per device, per head-month or per head-year). Capital lines get a life, replacement years and a
     residual value. Annual subscriptions and service fees are charged at the start of each year (in advance).
     Contract minimums are billed through the commitment term even if head counts fall, for example in a drought.
     All prices are in today's dollars, discounted at a real rate. The synthetic examples load with a visible,
     editable example rate labeled as an assumption, not a recommendation, so results appear at once; when users
     analyze their own operation, the page prompts them to review the rate (owner decision, 15 Oct 2026; see M6).
     The default horizon is the contract term or asset life. A separate payback target, 5 years by default and
     editable, is shown next to it (owner decision, 15 Oct 2026; B9).

4. **Make fence savings honest: interior fence only, avoided versus deferred, at the year it would really be built,
   and only where the ranch would pay for it.**
   - *What is wrong now:* the virtual fencing starting point includes $30,000 a year of "fuel, vehicle and fence
     savings" with no source. It has no fence-miles input, although the page cites a $15,000/mile fence cost.
   - *Sourced:* NRCS (fact sheet, Oct 2024) says physical fences "will still be needed in some areas", and NMSU
     (B-132, Oct 2024) says virtual fencing "does not work well as replacement for exterior perimeter fencing."
   - *Recommendation:* the user enters the interior fence miles they would otherwise build, the cost per mile, the
     year it would be built, its life, and whether virtual fencing avoids or only postpones it. The user also
     describes the land the technology serves as owned, leased or both, and says who actually pays each cost and who
     receives each saving (owner decision, 15 Oct 2026: mixed tenure). Only the operator's share counts in the
     operator's results; amounts paid or received by others are listed separately (F6). On leased grass where the
     landlord provides the fence, the operator's fence benefit is zero. If the tenant would build it, the benefit
     ends with the lease unless the user expects the lease to renew, and the fence's remaining value counts only as
     far as the lease reimburses it. The fence runs through the same schedule as purchased equipment: the tool
     credits avoided capital in the year it would be built and any rebuilds within the horizon, credits avoided
     maintenance, and subtracts the value the fence would still have had at the end of the horizon.

5. **Replace the single "pays for itself" verdict with a cash verdict, an economic verdict, break-even thresholds and
   labeled scenarios.**
   - *What is wrong now:* the same inputs give two opposite verdicts on one page (12 months: "does not pay"; 5-year
     outlook: +$175k).
   - *What is also wrong:*
     - "Return on cost" divides undiscounted benefit minus cost by all costs, a definition that changes with the
       horizon.
     - The ±20% tornado treats every input as equally uncertain.
     - A rare loss (death loss) is counted as the same cash every year.
   - *Recommendation:*
     - Show one analysis horizon for the headline results, and lead with the cash NPV and the cash payback.
     - Test the result against the payback target (5 years by default; owner decision, 15 Oct 2026). The same inputs
       are rerun over the target years, counting the equipment value left at the end of the target, and one line
       under the verdict reads "Pays for itself within 5 years (counting equipment value left at year 5)" or "Does
       not pay for itself within 5 years". The headline stays the full-horizon cash NPV. The line is not called
       payback, because it counts residual value (judgment; B9).
     - Show three results separately: "Cash NPV"; "Cash NPV including expected losses avoided", which adds rare
       losses such as death loss in a water outage at their expected value; and "Economic NPV", which also values
       freed hours and production effects that are not from the ranch's records.
     - The verdict says "pays" only if the cash NPV is zero or more without the expected-loss lines. If the cash NPV
       is negative but reaches zero or more once the expected-loss lines are added, it says "pays only if the loss
       estimate holds". Otherwise it says "does not pay".
     - Replace "return on cost" with a discounted benefit-cost ratio.
     - Show what would make it pay. For each main driver, in units a rancher can check (fence miles, subscription
       $/head/month, payroll days you would have to cut, herd size), the panel gives the value at which the
       investment breaks even within the target and over the full horizon, holding every other input fixed, or says
       that no value in the driver's search range makes it pay. When the target test fails, the verdict adds "It would pay for itself within
       5 years if:" followed by the two drivers that need the smallest change (B9). Break-even values for rare-loss
       drivers ("head of death loss avoided per year") follow after phase 1 (B2).
     - Show conservative, expected and optimistic columns that the user edits input by input.
     - Label every result "before tax" (owner decision, 15 Oct 2026: no after-tax view in the initial version).

---

## 2. Assessment of the current tool

### 2.1 What is implemented today (verified in the code)

| Area | Implemented | Where |
|---|---|---|
| Model | One generic cash-flow model shared by all three starting points. It has 16 inputs. | `roi.js` `FIELDS`, `cashFlows()` |
| Costs | Per-head hardware, one fixed upfront cost, a per-head subscription, repairs % and replacement %. The repair and replacement percentages apply to per-head hardware only. | `roi.js:59-63` |
| Benefits | Labor hours × wage, death loss % × herd × value, extra pounds × herd × price, a lump "other savings", and a year-1 realization %. | `roi.js:64-74` |
| Timing | The purchase falls in year 0. Every running cost and every benefit falls at the end of years 1..N. | `roi.js:57-76` |
| Metrics | NPV, IRR (by bisection), undiscounted payback interpolated within the year, "return on cost", all-in cost per head per year. | `roi.js:82-123` |
| Sensitivity | Each input moved ±20% (tornado), break-even by bisection over 0–10× the input, and a 5×5 two-way grid. | `roi.js:125-156`; the 5×5 grid's ±40% steps are set in `app.js:168-172` |
| Page | A verdict sentence, tiles, a "5-year outlook" table and chart that runs the same inputs for 5 years whatever horizon is chosen and folds the year-0 purchase into its first 12-month row, a cumulative cash chart, written-out formulas, a sources table, and scenario state stored in the URL. | `app.js`; the sources table is static in `index.html:136-146` |
| Tests | 9 `node:test` tests. They include one hand-checked case and cover NPV, IRR and payback, a no-payback case, year-1 realization, the benefit formulas, break-even, tornado sort (and the skipping of inputs set to zero), grid, and preset completeness. All pass on `d0fd9b8`. | `tests/roi.test.mjs` |
| Starting values | 1,000 head and a 12-month horizon. Virtual fencing and water costs come from the sources cited on the page (see §3.4 L2, §4.1, §4.2). The EID costs ($4 tag, $12,000 fixed cost, $1/head/yr) have no source anywhere in the repo, although `index.html:90`, `index.html:138`, `README.md:12`, `README.md:67` and the comment at `roi.js:26` say the starting values' equipment and subscription costs are published list prices. Benefits are assumptions. | `roi.js:29-53` |

### 2.2 What is *not* implemented (proposed requirements, not current features)

The tool has none of the following:

- **Cash vs non-cash:** any separation of cash from non-cash benefits, or of expected rare losses from cash.
- **Herd structure:** operation type, animal classes, enrolled head, seasonal use, or year-by-year head counts.
- **Cost timing:** a device or asset life, replacement cycles, residual value, or any choice of when a cost is paid.
- **Fence:** fence miles, the avoided-versus-deferred treatment, land tenure, or who pays each cost and receives
  each benefit.
- **Financing and policy:** financing, cost-share programs, or the EID regulatory baseline.
- **Uncertainty and provenance:** scenario columns, or a provenance label on any input.
- **Combined use:** any way to combine modules without double counting.
- **Output:** a printable business case.

The README says taxes, depreciation, financing and resale are left out on purpose. The plan keeps taxes out of the
initial version and labels every result "before tax" (owner decision, 15 Oct 2026).

### 2.3 Overall judgment (recommendation)

- **Keep:** the architecture is right for the purpose. A pure, dependency-free financial module with tests, a page
  that shows its formulas, and shareable scenarios are worth keeping. Nothing here justifies a framework migration.
- **Fix:** the economic content is where credibility is lost.
  - The starting values reach large positive answers through benefits that are mostly non-cash or unsupported.
  - Several cost structures don't match how the products are sold.
  - The page shows two contradictory verdicts.

  A ranch manager or an ag lender who checks the numbers would find these problems quickly. For a tool meant to
  support investment decisions, that is the main risk.

---

## 3. Prioritized model audit

Severity reflects the likely effect on an investment decision:

- **Critical:** can flip the decision.
- **High:** can move NPV by a large share.
- **Medium:** misleading, but smaller in dollars.
- **Low:** presentation.

"Calculated" figures come from running `roi.js` on `d0fd9b8`.

### 3.1 Critical

**C1. Time saved is counted as cash.** (`roi.js:65`)
- **Calculation:** hours per week × 52 × loaded wage is added straight into cash benefit.
- **Starting values:** labor is worth $43,680 a year for virtual fencing (30 h/week), $17,472 for water and $4,368 for
  EID.
- **The problem:** a salaried hand or the owner saving 30 hours a week does not reduce payroll. The cash saving is
  real only if:
  - wages, overtime, day labor or contract riding are actually cut, or
  - a planned hire is avoided, or
  - the freed hours go to work that earns or saves cash (and that work's value must not already be counted
    somewhere else).
- **Sourced:** ERS's cow-calf costs and returns (data updated 1 Oct 2026) show the US average cow-calf operation in
  2025 with:
  - about $41 per cow of hired labor, against about $570 per cow of unpaid (operator and family) labor valued at
    opportunity cost.
- **Inference (judgment):** on an average operation, most ranch labor is not a payroll line that technology can cut.
- **Effect:** removing labor alone turns virtual fencing's 5-year NPV negative (+$129,913 → −$28,311). Weight gain is
  an even larger share of that result: $190k PV against $158k for labor. Labor is 62.5% of water monitoring's
  full-year benefit but only 10.6% of EID's (see change 1).

**C2. Weight gain is applied to the wrong animals at the wrong price.** (`roi.js:67`)
- **Calculation:** 1,000 head × 15 lb × $3.50/lb = $52,500 a year for virtual fencing, and $35,000 a year for EID.
- **The problem:**
  - In a cow-calf herd, the "head" are cows, which are not sold by the pound each year.
  - Sold weight comes from calves (calf crop × survival × share sold) and from cull cows at a cull-cow price. The
    model has neither.
  - The weight benefit for EID tags has no mechanism at all. A tag does not add weight; only a management change
    could.
- **Sourced:** see section 4. This audit found no independent study that isolates a weight-gain effect of virtual
  fencing, water monitoring or EID by themselves (some papers could not be read; see §13.3). The one positive calf-gain result found (NDSU, 2025 season) is confounded with patch
  grazing.

**C3. Fixed benefits don't depend on cattle, so zero cattle still shows a profit.**
- **Calculated:** virtual fencing with `head = 0` over 5 years gives an NPV of **+$253,394** and payback in 0.3
  years. Labor and "other savings" stay in, while the subscription disappears.
- **Calculated:** the default 12-month page already shows the defect. Its break-even table lists Herd size at 605.89
  head ("needs to move 39% down"), which tells the user to shrink the herd to make it pay. With `head = 0`, the
  12-month NPV is +$27,433.
- **Calculated:** the per-head economics of the starting value are negative. Each enrolled head costs $84 a year and
  brings in $58.50 in benefits ($6 death loss plus $52.50 weight). Every extra head lowers NPV, and a 5-year
  break-even search on herd size finds a *maximum* of 2,052 head.
- **Takeaway:** the positive answer rests entirely on $73,680 a year of labor and unsourced "other savings" that
  don't depend on cattle at all.

**C4. Two contradictory verdicts from the same inputs.**
- The starting values use a 12-month horizon (`years: 1`). The 5-year outlook (`app.js:207-209`) reruns the same
  inputs for 5 years.
- **Calculated:** virtual fencing reads "does not pay for itself" (12-month NPV −$17,844) directly above a 5-year
  "gain" of about +$175k.
- A 12-month horizon is also too short for any of these assets:
  - Halter's collars carry a five-year warranty (vendor statement, DTN, March 2025).
  - NRCS's water-telemetry enhancement assumes a 10-year life.
- The 12-month verdict penalizes purchase models and favors subscriptions.

### 3.2 High

**H1. Cost drivers don't match how the products are sold.** (`roi.js:61-63`, starting values)
- **Water monitoring:**
  - The starting value turns 10 monitors × $365 a year into $3.65 per head.
  - Herd size silently rescales a per-monitor fee. Doubling to 2,000 head adds $3,650 a year of subscription with no
    extra monitors. If Herd size appears in the sensitivity results, its row is meaningless.
- **Virtual fencing:**
  - The subscription is applied to all 1,000 head for 12 months.
  - Calves are not normally collared. NDSU (2025) collared only cows, noting collars are "not recommended for calves
    because of growth and weight restrictions." Federal emergency cost-share (FSA ECP-105, Aug 2026) covers only
    cattle over 440 lb.
  - Seasonal grazing may enroll animals for only part of the year. Whether the vendor bills per enrolled month is a
    contract question that needs a quote.
- **Repairs and replacements:** these apply only to per-head hardware. Base stations, the monitors themselves and the
  scale ($12,000 to $14,900 of fixed cost in the starting values) are never repaired or replaced.
  - For the virtual fencing and water starting points, typing a device-loss or repair % changes nothing (virtual
    fencing stays at +$129,913 over 5 years with 10% replaced and 5% repairs). Both percentages multiply per-head
    hardware (`roi.js:62-63`), which is $0 in those presets (`roi.js:33`, `roi.js:41`).

**H2. Possible double count in the virtual fencing infrastructure cost.** (`roi.js:31-33`)
- **The starting value:** $13,500 = $4,500 infrastructure + 3 base stations × $3,000.
- **Sourced:**
  - The $3,000-per-base-station figure for Halter is from Audoin's University of Arizona comparison slides
    (16 Apr 2024). The slides said Halter's collars were "not yet available" in the US at the time, so this was not
    an observed US price, and they are the only source giving $3,000.
  - The $4,500 is Halter's "one-time infrastructure investment starting at $4,500" in DTN (March 2025).
  - Oklahoma State's Reuter (Jan 2025) also gives Halter base stations as "$4500".
- **Inference (judgment):** the two numbers probably describe the same item at two different dates, so the cost may
  be counted twice.
- **Also:** The vendor's US site now advertises satellite collars (launched April 2026) that need "no tower
  infrastructure," with no published US price. The right number depends on which configuration is quoted.

**H3. "Fuel, vehicle and fence savings" is an unsourced lump.**
- **The values:** $30,000 a year for virtual fencing, $4,500 for water, $2,000 for EID.
- **The problems:**
  - Fence is a capital item, and only interior fence can be replaced.
  - A fence that would be built in year 3 is not a saving in year 1.
  - Postponing a fence by a few years is worth only the time value of money plus the maintenance avoided.
  - *Recommendation:* value vehicle savings at variable cost per mile (fuel, maintenance, tires), not the IRS rate.
    The IRS rate includes ownership costs that don't fall unless the ranch sells a vehicle.

**H4. Death loss avoided is a flat percentage of the whole herd, claimed twice.**
- **The values:** virtual fencing and water both claim 0.2% of 1,000 head × $3,000 ($6,000 a year each).
- **The problems:**
  - Water-related death is a rare, severe event. *Recommendation:* model it as expected outage events × head at risk ×
    the share caught early, using the ranch's own history.
  - If both technologies are adopted, the same avoided losses would be counted twice.
  - $3,000 is a bred-cow value. Calves lost before weaning are worth their expected weaning value instead.

**H5. No asset life, replacement schedule, residual value or safe treatment of financing.**
- **The problem:** costs are flat every year.
- **The workaround is wrong:** the README suggests reflecting resale by "a lower hardware cost". That moves money
  that arrives at the end of the horizon to year 0, and it also lowers the base for the repair and replacement
  percentages.
- **Financing can be double counted:** the page says financing and the other excluded items can be added "by
  adjusting the inputs" (`app.js:280`), and the README says they "can be folded into the inputs"
  (`README.md:53-54`). The model already charges the full purchase price in year 0 and discounts every flow. Adding
  interest or loan payments to the costs on top of that counts the investment, or the cost of the money, twice
  (judgment). *Recommendation:* keep the project NPVs unlevered at the real discount rate and show financing only in
  a separate lender's cash-flow view (B5).

### 3.3 Medium

**M1. "Return on cost" is not a standard ROI and changes with the horizon.** (`roi.js:119`)
- **The formula:** (total benefit − total cost) ÷ total cost, undiscounted, with operating costs in the denominator.
- **Calculated:** water monitoring shows 36% over 12 months but 313% over 5 years, from the same inputs.
- **Recommendation:** replace it with a discounted benefit-cost ratio ((PV of cash benefits + PV of residual
  value) ÷ PV of costs, as in F8 and 9.3). If an ROI is kept, define its denominator on the page.

**M2. Edge cases produce nonsense.** (`roi.js:86-107`)
- **Calculated:**
  - With no upfront cost and a zero first-year net, payback returns `NaN`, which the page shows as "NaN yrs".
  - With no upfront cost and a positive first-year net, payback is 0, which `pbText` (`app.js:16`) shows as
    "1 months".
  - With all cash flows zero, IRR returns −99%.
  - The IRR search stops at 1,000% (`roi.js:88`), so a very profitable case returns no IRR and the page shows "n/a",
    the same as a project that never pays. Example: water monitoring over 5 years with a $1,000 fixed cost has an NPV
    of +$93,521 and an IRR of "n/a".
  - `years = 0` gives a return on cost of −100%.
  - Fractional horizons: `cashFlows()` rounds the number of years (`roi.js:72`), but cost per head per year
    (`roi.js:121`) and the labels use the value as typed. With water monitoring at `years = 2.5`, the model runs 3
    operating years but shows $10.34 per head per year instead of $8.62.
- **Untested:** no test pins the starting-value results or checks the formatting in `app.js`, which is how "NaN yrs"
  can reach the page.
- **Latent:** payback takes the first crossing of zero. Once costs vary by year (replacements), the cumulative line
  can turn negative again and payback must report that.
- **Latent:** IRR is meaningless when there is no upfront investment, which is the case for pure subscriptions.

**M3. Benefit ramp-up applies to year 1 only, and there are no implementation costs.**
- **The problem:** the model has no line for:
  - install labor
  - training days
  - the extra software and monitoring time the systems need
  - collar fitting and refitting
  - battery swaps
  - connectivity surveys
- **Sourced:**
  - A Queensland (Australia) water-monitoring demonstration estimated that management time would rise from 0 to
    4 h/week on both demonstration properties (MLA B.NBP.0505, 2011; data about 2009–11). It shows that the cost
    exists; the hours are not an estimate for a US ranch.
  - A Colorado yearling trial found 23% of steers needed collar adjustments (CSU and USDA-ARS, 2024 season).

**M4. The EID starting value retags the whole herd every year and lumps the scale in with ID.**
- **The problem:** `replacementPct: 100` on a $4 tag × 1,000 head buys 1,000 new tags each year.
- **Sourced:**
  - The APHIS rule (89 FR, May 9 2024) requires official EID only for certain classes that move interstate, chiefly
    sexually intact cattle 18 months and older. It does not require readers.
- **Inference (judgment):** in cow-calf, recurring tag use is per calf (or per replacement heifer), plus tag loss
  (3.0% cumulative over 2 years across four Montana ranches, about 1.5% a year, in Roberts et al. 2012; §4.3).
- **Recommendation:** in phase 1, enter tags, reader, scale and software as separate lines, add the
  verified-program premium as its own line, and record the answer to "Does the EID rule apply to cattle you move?"
  (B4a). Treat required tags as compliance (a baseline that is not the technology's cost, and may be free) only
  after research task R1 has verified the rule's current status and the litigation (B4b, 8.4; owner decision,
  15 Oct 2026). Until then, a "yes" answer counts all tags as project costs, and the page says that compliance
  treatment is pending verification.

**M5. The sensitivity method implies equal uncertainty.**
- **The problem:** ±20% on discount rate, herd size and hours saved are not equally plausible, and some inputs move
  NPV in the "wrong" direction.
- **Inputs entered as zero are dropped:** `tornado()` skips any input entered as 0 (`roi.js:129`), so a cost left
  out of the model (collar loss, for example) can never be flagged as worth checking in "What the answer depends
  on" or in the break-even table.
- **Factors of one product are counted twice:** hours × wage, pounds × $/lb and death-loss % × value per head enter
  only as products (`roi.js:65-67`), so each pair gets identical bars and fills two rows.
  - **Calculated:** on the default 12-month water page, the six break-even rows include two such pairs (wage and
    hours; death loss % and value per head).
  - **Calculated:** the two-way grid uses the top two tornado inputs (`app.js:168`). At 5 years that pairs wage with
    hours for water, and pounds with $/lb for EID: a grid of one product.
- **Recommendation:** tornado bars should run between each input's conservative and optimistic values, entered by the
  user. Group factors that only appear as a product into one driver ($/yr of labor, weight or death loss) for the
  tornado, break-even values and two-way grid, and never pair two factors of the same product in the grid. Test an
  input entered as 0 over a range instead of dropping it.

**M6. Cash-flow timing: every running cost is booked at year end, and the discount rate is not labeled real or
nominal.** (`roi.js:57-84`, `app.js:205-213`)
- **In the code:** `cashFlows()` puts the purchase in year 0 and every subscription, repair, replacement and benefit
  at the end of years 1..N (`roi.js:71-76`). `npv()` discounts each year's net by (1 + r)^t (`roi.js:82-84`).
- **How the products are billed:** virtual fence subscriptions are priced per head or per collar per month, and
  contracts can run for years.
  - **Sourced:** Halter quotes an "annual subscription of less than $7 per head per month". Nofence charges a
    per-collar fee for the first 12 months, then a fee per collar in use per month (vendor statements, DTN, 31 March
    2025).
  - **Sourced:** Halter asks for a "36 month commitment" (Oklahoma State, Reuter, cost slides, 23 Jan 2025).
  - A fee paid at the start of the year, or month by month through it, leaves the bank account before year end. The
    model books it at year end, which makes subscription-heavy options look cheaper than they are.
- **The page uses two timing conventions at once:**
  - The "Year by year" table and the cumulative cash chart keep the purchase in year 0 (`app.js:96-123`,
    `app.js:197-202`).
  - The "5-year outlook" table and chart add the year-0 purchase into the "Year 1 (months 1–12)" row
    (`app.js:210-213`). The code comment says "The purchase is counted in months 1-12" (`app.js:206`).
  - The 5-year NPV and payback tiles on that same card (`app.js:220-224`) still treat the purchase as year 0 and the
    first year's flows as one full year later.
- **Discount rate:** the input is labeled only "Discount rate" in "%" (`roi.js:9`), and every starting point uses 8%
  (`roi.js:32`, `40`, `47`).
  - Neither the page nor the README says whether the rate is real or nominal.
  - All prices are held flat: "price changes over time" is listed as not included (`app.js:280`, `README.md:53-54`).
    Flat prices are today's dollars, which call for a real rate.
  - A user who enters a loan rate, which is nominal, discounts today's-dollar flows for inflation they do not
    contain. That understates the present value of every future cost and benefit.
- **Calculated:**
  - Moving the virtual fencing subscription ($84,000 a year) from the end to the start of each year multiplies its
    PV by 1.08 at 8% (`roi.js` output, with the subscription moved one year earlier by arithmetic): from $335,388 to
    $362,219 over 5 years. The 5-year NPV falls from +$129,913 to +$103,082, and
    the 12-month NPV from −$17,844 to −$24,067.
  - Water monitoring's subscription is small ($3,650 a year), so its 5-year NPV moves only from +$79,621 to
    +$78,455.
  - Virtual fencing's 5-year NPV is +$129,913 at 8% and +$144,740 at 5%. A 3-point gap is used here only to
    illustrate how far apart a nominal and a real rate can be. It is not an inflation forecast.
- **Recommendation:** adopt the billing convention in F5 and 9.3. Annual lines carry `billing: "advance"|"arrears"`.
  Subscriptions and service fees are paid in advance (years 0..T−1), and other running costs and all benefits arrive
  at year end. Show year 0 as its own row everywhere and drop the merged 12-month view (F2). State on the page that
  all prices are in today's dollars and the rate is real, with the help text "real rate ≈ your loan rate + a risk
  premium − expected inflation". Show the rate in step 2 of the five-minute workflow (§7.1). Each synthetic example
  loads with a visible, editable example rate (the examples use 7% real) labeled "Example assumption (real rate),
  not a recommendation. Review it for your operation.", so results appear at once. When the user starts their own
  analysis, the rate keeps its value but shows a "Review this rate" prompt, and the verdict carries "Discount rate
  not yet reviewed" until the user confirms or edits it. Results are never blocked. The owner has not selected a
  percentage, and the plan does not present 7% or any other value as right for every ranch (owner decision,
  15 Oct 2026).

### 3.4 Low

- **L1. The verdict wording claims more than the model supports.** "Pays for itself" appears whenever NPV ≥ 0,
  however much of the benefit is non-cash.
  - The README's "What the example shows" (`README.md:56-63`) tells readers that over 5 years all three
    technologies pay: virtual fencing "about $175,000 ahead", EID tags "about $145,000 ahead" and water monitoring
    "about $104,000 ahead". Those figures rest on hours counted as cash (C1), weight gain on the whole herd at the
    sale price (C2, for virtual fencing and EID), benefits that don't depend on cattle (C3), and the unsourced lump
    and flat death-loss benefits (H3, H4).
  - *Recommendation:* replace that README section with the section 11 outcomes once phase 1 is built. Until then,
    say there that the example counts saved hours and assumed weight gain as cash, so its results are not cash
    results.
- **L2. Provenance conflicts.**
  - `HANDOFF.md` says "The starting values are illustrative assumptions, not vendor prices… Keep it that way."
  - The page now says the costs are published list prices. Its sources table cites one undated reseller flyer and two
    sources from different dates for one vendor.
  - The EID costs ($4 tag, $12,000 fixed cost, $1/head/yr) have no source anywhere in the repo. There is no source
    comment at `roi.js:46-52`, no row in the `index.html` Sources table (lines 139-145) and none in the README
    Sources (lines 65-77). Yet `index.html:90` and `index.html:138`, `README.md:12` and `README.md:67`, and the
    comment at `roi.js:26` say the starting values' equipment and subscription costs are published list prices.
  - The repo dates the DTN article April 2025 (`index.html:141`, `README.md:71`). Its dateline is 31 March 2025; the
    URL path is dated 2025/04/01.
  - The benefit values are not labeled as synthetic in the input panel itself.
  - The starting values sit under the site's brand name (`index.html:6`, `index.html:83`) and are
    described as "a 1,000-cow operation" (`index.html:90`, `README.md:58`, `roi.js:26`), so they can read as one
    real operation's numbers.
  - **Recommendation:** correct the DTN date in both sources lists. For each EID cost, either offer a dated, sourced
    published price labeled as vendor information that the user can replace with a quote, or leave the field blank
    with "Quote required"; never fill a missing price (owner decision, 15 Oct 2026). Correct each of the five
    sentences above that call the starting values' costs published list prices, and rebuild the Sources note and
    table on the page and the README Sources section so that published, reported and placeholder values are each
    described as such (9.1 step 1, 9.5 item 5). Move the starting values into
    named synthetic example ranches with different, editable herd sizes, each under the banner "Synthetic example
    ranch. Made-up numbers for demonstration, not any real operation's data.", and replace the three "1,000-cow
    operation" sentences with that wording (owner decision, 15 Oct 2026; F10, 9.5). A fourth example added by the
    plan, the good-fit cow-calf virtual-fence example Synthetic Ranch D, carries its own banner saying it shows
    conditions where the technology is most likely to pay (owner decision, 15 Oct 2026; §11).
- **L3. Input validation.** Typed inputs are clamped at ≥ 0 (`app.js:53`), but values loaded from a shared link are
  not (`app.js:31`): `#otherSavings=-50000` loads as entered. Percentages above 100 are accepted, and there are no
  warnings for implausible values.

### 3.5 Where a result can look profitable without generating cash

| Mechanism | In the current model | Why it isn't cash |
|---|---|---|
| Hours saved × wage | Counted as cash | Payroll doesn't change unless someone is paid less or not hired |
| Weight on cows | Counted as sales | Cows aren't sold by the pound each year |
| Fence "savings" every year | A flat yearly benefit | Capital is avoided once, in a specific year, and only if the ranch (not a landlord) would really build the fence |
| IRS-style vehicle cost | Not explicit, but implied by "vehicle savings" | Ownership costs don't fall unless a vehicle is sold |
| Death loss avoided | A flat % of the herd, booked as the same certain cash every year | A rare event. In most years nothing is saved, and its expected value is small and uncertain. The plan shows it as a separate "expected losses avoided" (risk) subtotal, outside cash NPV, BCR, IRR and payback (see 9.3) |
| Better decisions from data | Implied by the EID weight benefit | Value comes only if specific culling, sorting or marketing changes are made |

### 3.6 Differences between operation types (recommendation, grounded in section 4)

| | Cow-calf | Stocker or yearling | Seedstock | Backgrounder on wheat or residue | Drylot backgrounder or feedyard |
|---|---|---|---|---|---|
| Revenue animal | Weaned calves, cull cows | Gain on purchased cattle | Registered bulls and females | Gain on light calves | Gain |
| Herd count over the year | Cows plus calves at side, and bulls in the breeding season. Calves are often too small to collar | Arrive and leave each season. Enrolled head-months matter | High value per head; herd size varies | Seasonal grazing of light calves. Enrolled head-months matter | Pens, high turnover |
| Virtual fencing fit | Rotations and riparian or burn exclusion on large pastures. Calves cross boundaries more than dams (NDSU 2025). Bulls frequently lose collars (NMSU B-132; one Saskatchewan, Canada ranch kept collars on 2 of 15 bulls, Canadian Cattlemen, June 2025), so breeding-season rotations need a plan for bulls | Seasonal enrollment. Collars fitted, refitted and removed every year. Training repeats with each new group | Low | Low: light calves near or below collar weight limits (collars not recommended for calves, NDSU 2025; cost share only over 440 lb, FSA ECP-105) | Not applicable |
| Water monitoring fit | Remote summer range. Value depends on route length and how often water is checked | Summer grass, heat. Same route logic | Depends on pasture layout | Relevant: water points on the grazed fields still need checking. Same route logic | Usually not relevant |
| EID and scale fit | Compliance for breeding stock moved interstate. Value depends on records being used | A scale for shrink, gain and dosing. Most feeders are exempt from the EID rule | Usually already own a scale and software for breed records; evaluate only the increment (reader, software link, replacement timing) | A scale for shrink, gain and dosing. Most feeders are exempt from the EID rule | High throughput |
| Weight benefit, if any | Calf weaning weight × calves sold | Daily gain × days × head | Not a pound-price business | Daily gain × days × head | Daily gain |

Where a weight benefit is counted, the extra pounds are valued at the value of gain, not the sale price per pound
(see change 2).

Commercial cow-calf operators are the primary users: cow-calf is the preselected, editable operation type in step 1,
and stocker operations are supported as a secondary use (owner decision, 15 Oct 2026). A ranch manager presenting
the decision to an owner or lender is served by the printable "Owner and lender business case" (B6), which also
prints the "What would make it pay" panel (B9). For virtual fencing, the cow-calf case is shown by the good-fit
example Synthetic Ranch D (400 cows, collars on cows only, fence it would otherwise build), and Ranch B remains the
stocker example (owner decision, 15 Oct 2026; §11).

### 3.7 Features to keep (recommendation)

- `roi.js` stays a pure, dependency-free module with node tests.
- Keep the formulas written out with the numbers filled in.
- Keep the year-by-year table and the cumulative chart, with year 0 as its own row (see M6).
- Keep break-even values. They become more useful once they are expressed in ranch units, as the "What would make
  it pay" panel does (B9).
- Keep the two-way grid. Drive it from scenario ranges.
- The break-even values, the tornado and the two-way grid survive phase 1's new input structure: they are ported to
  path-addressed inputs (`setPath()` and each module's `SENSITIVITY_INPUTS(a)`, see 9.5 item 6; the break-even
  values in B9 use each module's `PAYBACK_DRIVERS(a)`, see 9.3).
- Keep URL-shareable scenarios. They need versioning once the inputs change.
- Keep the sources table, the "not included" honesty, and the willingness to say "does not pay."
- Keep the no-build static site on GitHub Pages.
- Keep the vendor-neutral names: generic technology names on the page, with company or product names only in linked
  source citations (owner decision, 14 Oct 2026).

---

## 4. Research findings by technology (sourced)

This section reports what sources say. Each finding names its source and publication date; the full entries, with
URLs, are in §13.2. My own interpretation is kept out of the sourced lists. It appears only in items labeled
"Recommendation", "Implication … (recommendation)" or "Calculated", or marked "(judgment)".

**Evidence labels, and how they map to the A–E classes used in §5, §9 and §11**
- **[gov]** government. A rule, program term or official statistic is class [A]. A government estimate, assumption
  or worked example (for example a regulatory cost estimate or an assumed equipment life) is class [B].
- **[peer]** peer-reviewed: class [B], except vendor-authored or vendor-funded work, which is class [C] (§5.2
  item 7).
- **[ext]** university extension or university research report: class [B].
- **[trial]** independent or government-run producer demonstration: class [B].
- **[vendor]** vendor statement or price: class [C], whoever reports it.
- **[news]** trade press or radio. A vendor claim carried by the press, or one producer's own experience, is class
  [C]: an unverified claim, not a research estimate.
- **[news, secondhand]** a press report of what a researcher said, where the original was not seen: class [C] until
  the original is checked.

**Non-US evidence (owner decision, 15 Oct 2026).** The tool is US-first: its defaults use US dollars, US units and
US sources. Australian and Canadian studies stay in this section because for some questions they are the best
evidence found (§4.5). Each non-US figure names its country and, for money, its currency (A\$ is Australian dollars).
It keeps its original currency and units and is never converted to US dollars. Its data year is given where the
source states it; otherwise its publication date is the only date shown. Applicability limit for every non-US
figure: it describes the operations studied, whose route lengths, herd sizes, labor costs, prices and rules can
differ from a US ranch's, so it is context or a range check, never a default (§5.2). Narrower limits are stated with
the figure where they apply.

**Company and product names (owner decisions, 14 and 15 Oct 2026).** Names in this section identify whose price or
claim is reported and where it came from. On the page, technologies carry generic names (collar-based virtual
fencing, remote water monitoring, EID tags and scale), and company or product names appear only in linked source
citations. A published price offered on the page is labeled "Vendor information: published list price (source,
date). Not an endorsement. Replace with your quote." If the source is undated, the label reads "Vendor information:
published list price (source, undated; checked `<date checked>`). Not an endorsement. Replace with your quote." (§9.5;
the undated form is a judgment, since the owner asked for dated prices).
It describes what the equipment costs and is never evidence for a saving. Only a first-hand published price (the
vendor's or a dealer's own page, listing or flyer, dated or undated) is offered as a fill. A price reported
second-hand by the press or extension, as many in this section are, is context only and never a fill; where a
synthetic example uses one, the page labels it "Vendor information: reported price (source, date), not a published
list price. Not an endorsement. Replace with your quote." (§9.5). Where no published price was found, the
field is left blank with "Quote required" (§7.2, §9.5).

### 4.1 Collar-based virtual fencing

**Problem it solves**
- It controls where cattle graze without building or moving interior fence. Uses include rotations, resting or
  excluding riparian areas, burns or poisonous-plant areas, and strip or patch grazing (burn exclusion: Boyd et al.
  2022 [peer]; patch grazing: NDSU, 2025 season [ext]).
- Gathering is easier because animals can be located.

**Fit**
- **Where a lot of interior fence would otherwise be built.** az2117 (U. Arizona, Mar 2025) found virtual fencing
  cost-effective mainly where substantial physical fence would be built; its baseline assumed $20,000 of avoided
  fence a year [ext]. NMSU B-133's favorable comparison rests on 75 miles of fence (Mar 2025) [ext]. Webinar slides
  by a co-author of Hoag et al. 2025 list "High fence construction cost", "Low stocking rate", "Need to exclude
  irregular/temporary areas" and "Can tolerate some fence failure" as conditions for adopting now (Reuter, Oklahoma
  State, 23 Jan 2025) [ext]. The paper itself could not be read (§4.5).
- **A herd that can be collared.** FSA notice ECP-105 (27 Aug 2026) requires cattle over 440 lb [gov]. NDSU says
  collars are "not recommended for calves because of growth and weight restrictions" (2026 report) [ext]. Audoin's
  vendor comparison (16 Apr 2024) lists one vendor's collars for calves over 10 months [vendor]. An independent
  welfare review prepared for the Australian Government (Fisher & Cornish, for DAFF, Dec 2022, updated Nov 2023)
  recommends that virtual fencing not be used on juvenile animals [ext].
- **Weak fit (sourced):**
  - Perimeter replacement: virtual fencing "does not work well as replacement for exterior perimeter fencing" (NMSU
    B-132, Oct 2024) [ext]; physical fences "will still be needed in some areas" (NRCS fact sheet, Oct 2024) [gov].
  - Herds with calves at foot: uncollared calves spent more time outside the boundary than their dams (NDSU, 2025
    season) [ext]. In the second year of a two-year Alberta, Canada trial, calves were not collared and had "the
    freedom to roam", while their collared dams stayed inside the boundaries (U. Alberta *Folio*, 6 Nov 2025) [ext].
  - Bulls in the breeding season: only 2 of 15 bulls kept their collars on one Saskatchewan ranch in Canada
    (Canadian Cattlemen, 2 Jun 2025) [news], and bulls "are known to frequently lose their collars" (NMSU B-132)
    [ext].
  - Places without cellular access, for cellular collars: in an Alberta, Canada trial, cellular access was
    essential (*Smart Agricultural Technology*, Mar 2025, abstract) [peer]. Tower coverage depends on terrain: 10,000–100,000 acres
    per LoRaWAN tower depending on topography (NMSU B-132) [ext]. One vendor now sells satellite collars that it says
    need "no tower infrastructure or cell coverage" (US website, checked 15 Oct 2026) [vendor].
  - Herds below cost-share minimums: 51 head for the Arizona NRCS rates (az2105, Jan 2025) [ext]; 125 head for FSA
    ECP (ECP-105) [gov]. ECP also excludes pastures that already have permanent interior fence.
- **Recommendation (synthesis):**
  - Small herds are a weak fit even above the program minimums, because base-station and setup costs are spread
    over fewer head (judgment).
  - A larger herd helps only where the fence avoided grows with it. With a per-head subscription, more collared
    cows on the same fence plan add cost without adding fence saved (judgment). *Calculated (synthetic example, not
    a sourced finding):* Synthetic Ranch D (§11), with 400 cows entered, would pay for itself within 5 years, with its
    other inputs unchanged, only at 381 collared cows or fewer on the same fence plan (break-even 381.86).
  - The flexibility of a virtual line matters most where grazing goals need frequent moves (judgment).
  - Breeding-season rotations need a plan for bulls, given the collar-loss evidence above (judgment).
  - Light calves near or below the 440-lb threshold (for example, backgrounders placed light on wheat or crop
    residue) are a low fit because of their size (judgment).

**Costs and pricing structures**

| Item | What sources report | Label |
|---|---|---|
| Leased collars, tower-based (Halter) | DTN (31 Mar 2025): "annual subscription of less than $7 per head per month" (a ceiling; the phrase mixes annual and monthly units); infrastructure "starting at $4,500"; 5-year collar warranty. Reuter, Oklahoma State (23 Jan 2025): "$66 service per year", base stations "$4500", "They ask for a 36 month commitment". Audoin, U. Arizona (16 Apr 2024; the comparison said this vendor's collars were "not yet available" in the US at the time): "$3,000 per base station", "$60/collar/year", "Collars are not purchased (2 years contract)". The US website advertises satellite collars (launched 28 Apr 2026) needing "no tower infrastructure or cell coverage" and publishes no US price (checked 15 Oct 2026). One Wyoming rancher reported $62 per head for the original collars, rising to $92 for satellite in two years; the time unit was not stated (KHOL radio, 6 Sep 2026) | [vendor], reported by [news] (DTN) and [ext] (Reuter, Audoin). The KHOL item is one producer's report [news] |
| Purchased collars plus service (Nofence; Gallagher eShepherd) | Collars about $250–$350 (Reuter, Jan 2025; DTN, Mar 2025: $289 and $250). Service: eShepherd $18 (base-station network) or $24 (cellular) per collar per year (Audoin, Apr 2024; Reuter gives $18–$24). Nofence $56 (up to 49 collars) or $42 (50 or more) per collar for the first 12 months, then $6.50 or $4.50 per collar in use per month, which is $78 or $54 a year (DTN, Mar 2025); Reuter (Jan 2025) gave $30–$50 a year. eShepherd base stations about $5,000 (Audoin; Reuter), 4-mile radius (DTN) | [vendor], reported by [news]/[ext] |
| Leased collars with replaceable batteries (Vence) | $40 per collar per year for collar, software and support, plus $10 per battery (DTN, Mar 2025); about $55 lease and about $15 per battery (Reuter, Jan 2025); two batteries a year at $10 (Audoin, Apr 2024); $35 per collar plus batteries, about $45–$55 per animal per year in all (WLJ, 22 Aug 2022); US$50 per collar per year on one Saskatchewan ranch (Canada; Canadian Cattlemen, 2 Jun 2025). Battery life 3 months to 1 year (DTN); 4–6 months under intensive use, about 1 year under light use (NMSU B-132). Base stations about $10,000 (DTN), $10,000 self-installed or $12,500 professionally installed (Audoin), about $12,000 (Reuter), $13,000 (Canadian Cattlemen; currency not recorded); 7,000–10,000 acres each (DTN) | [vendor], reported by [news]/[ext] |
| Modeled all-in cost | Year 1 "$175–$400 per cow"; later years "$80–$130 per cow"; 200–500 cow Arizona ranch; four vendors; vendor pricing as of Sept 2024 (az2117, Mar 2025) | [ext] |
| Cost share | Arizona NRCS virtual fence payments as of 1 Oct 2024 (az2105, Jan 2025, Table 1): minimum 51 head. Year 1 is $91.92–$147.00/head across county groups ($139.73 for 51–199 head and $91.92 for 200 or more in the lowest-rate group). Years 2–5 are $60.48–$63.63/head/yr. Historically underserved producers receive about 20% more. The paper does not name the program; the payments follow the NRCS "Fence" (year 1) and "Prescribed Grazing" (years 2–5) practices. FSA Emergency Conservation Program notice ECP-105 (27 Aug 2026): virtual fence for resource concerns caused by natural disasters; at least 125 head; cattle over 440 lb; replacement equipment, collar lease fees and data subscriptions are the producer's responsibility; pastures with permanent interior fence are not eligible | [ext] reporting NRCS rates; [gov]. Program terms are class [A] |

**Savings mechanisms and the evidence**
- **Interior fence not built.** This is the clearest cash mechanism.
  - NMSU B-133 (Mar 2025) estimated a virtual fence at about half the annual cost of 75 miles of physical fence on a
    representative 360-head New Mexico ranch: $33,376 vs $67,500 a year. The text says "24%", but its own tables
    imply about 49% (see §4.5).
  - The result depends on a very large fence-mile assumption.
  - The study models purchased collars with no subscription.
  - [ext]
- **Labor.** az2117 found that the time savings needed to offset year-1 costs are "often in excess of a year of
  full-time work (2,080 hours)", and roughly 500 to well over 1,000 hours a year after that. It valued time at
  $31.97/h, an Arizona agricultural supervisor wage used as the opportunity cost of the rancher's time, not a cash
  wage saved. [ext]
- **Weight gain.**
  - NDSU's 2025 season (2026 North Dakota Livestock Research Report), 110 virtual fence pairs on patch grazing vs 46
    continuously grazed control pairs: calves gained about 0.57 lb/day more. The result is confounded with patch
    grazing and comes from one site and one season. [ext]
  - az2117: the gain needed to break even is "implausibly large, particularly in year 1." [ext]
- **Overall:** az2117's baseline conclusion was that "none of the virtual fence systems examined… would pay for
  themselves." Payback was 9 years or more, and the benefit-cost ratio stayed below 1. With a 50% cost share on all
  year-1 costs, two of the four systems exceeded a benefit-cost ratio of 1 for some herd sizes; most combinations
  stayed below 1. [ext]
- **Calculated (synthetic example, not a sourced finding).** Synthetic Ranch D (§11, owner decision of 15 Oct 2026)
  is a good-fit cow-calf example built from the sources in this section: 400 cows, inside az2117's 200–500-cow
  range; collars on cows only, not on calves or bulls (Fit, above); 14.14 miles of new interior cross-fence that the
  ranch would otherwise build, priced as 6-wire high-tensile at $15,100/mi (Missouri G1193, §4.4) with a 25-year life
  and 5% a year upkeep (Iowa State FM-1855, §4.4); and the $7/head/month subscription and $4,500 infrastructure used
  for Synthetic Ranch B. Its inputs were fixed before any result was computed. At a 7% real example rate it is close
  to break-even and slightly negative: cash NPV −$9,789 over 7 years, and −$6,871 when the same analysis is run over
  5 years counting the value left at year 5 (before tax). It would pay for itself within 5 years with at least
  14.86 miles of fence avoided (14.14 planned) or a subscription of at most $6.67/head/month, each with the other
  inputs unchanged. As a sensitivity only
  (cost share is B5, after phase 1), at the low end of the Arizona NRCS rates above for 200 or more head ($91.92/head
  in year 1 and $60.48/head/yr in years 2–5), its cash NPV is +$101,156, subject to eligibility and program rules.
  This agrees with az2117: the case turns on how much fence is really avoided and on cost share (judgment).

**Labor and infrastructure still required**
- **Perimeter fence:**
  - NRCS (fact sheet, Oct 2024, reissued May 2025 with the same wording): physical fences "will still be needed in
    some areas." [gov]
  - NMSU B-132 (Oct 2024): virtual fencing "does not work well as replacement for exterior perimeter fencing,"
    especially in fence-out states. [ext]
- **Training:** about 3–7 days to adapt (Gadzama et al. 2025, *Ruminants* 5(2):21, narrative review) [peer]; heifers
  new to collars learned in 5–7 days and remembered the cues the next year (U. Alberta *Folio*, Canada, 6 Nov 2025)
  [ext]; Boyd et al. 2022 trained cows for 6 days [peer]. Vendors state 5–10 days (DTN, Mar 2025) or 7–10 days (US
  website, Oct 2026) [vendor]. Each new group of cattle has to be trained.
- **Collar fitting and refitting:** 27 of 118 yearling steers (23%) needed an adjustment during a 114-day season;
  check fit "at least every 45-60 days" (CSU AgNext and USDA-ARS fact sheet, undated; 2024 season data). [ext]/[gov]
- **Battery swaps** on replaceable-battery systems (battery life above). On one Saskatchewan ranch (Canada), besides
  the collars lost, another 7% "had critical battery health by the end of the fall" (Canadian Cattlemen, 2 Jun
  2025). [news]
- **Software time:** checking the app, moving lines and answering alerts. No source measured it (judgment).
- **Connectivity survey and base-station siting:** coverage depends on terrain (NMSU B-132) [ext]; cellular access
  was essential for cellular collars in Alberta, Canada (*Smart Agricultural Technology*, Mar 2025) [peer]. On
  leased land, siting a base station needs the landowner's permission (judgment).

**Adoption challenges and failure modes**
- **Containment is high but not total:**
  - About 90–99% when the whole herd is collared (UC ANR researchers, reported by Farm Progress, 20 Nov 2024)
    [news, secondhand].
  - "more than 99 per cent of the time" in a two-year Alberta trial (U. Alberta *Folio*, Canada, 6 Nov 2025) [ext].
  - 90–99% across studies (Gadzama et al. 2025 review) [peer].
  - NRCS: "will not contain 100% of the herd 100% of the time" (Oct 2024) [gov].
  - Boyd et al. 2022 (*Rangeland Ecology & Management* 81:55–62): virtual fencing "should not be thought of as an
    'iron gate'" [peer].
- **Collar loss:**
  - On one Saskatchewan ranch (Canada), 7% of the cow herd lost collars during the year and only 2 of 15 bulls kept
    theirs through the breeding season (Canadian Cattlemen, 2 Jun 2025). [news]
  - NMSU B-132 (Oct 2024): bulls "are known to frequently lose their collars." [ext]
- **Calves:** uncollared calves spent more time outside the boundary than their dams (NDSU, 2025 season). [ext]
- **Juveniles:** an independent welfare review prepared for the Australian Government (Fisher & Cornish, for DAFF,
  Dec 2022, updated Nov 2023) recommends that virtual fencing not be used on juvenile animals. [ext]
- **Network and equipment failures:** in an Alberta trial in Canada, 14 collars had a network connection failure that
  cleared after a manual reset (poor connections occurred less than 1% of the time), and 4 collars that cattle lost
  were recovered (*Smart Agricultural Technology*, Mar 2025, abstract) [peer]. The Saskatchewan ranch reported signal
  errors on 32 collars (Canadian Cattlemen, 2 Jun 2025) [news].

**Unlikely to pay when**
- Sourced:
  - little or no interior fence would really be built (az2117, Mar 2025; B-133's result rests on 75 miles) [ext]
  - there is no cost share: no system paid at baseline, and even a 50% year-1 cost share lifted only two of four
    systems above a benefit-cost ratio of 1, for some herd sizes (az2117) [ext]
  - the case depends on weight-gain benefits (az2117: "implausibly large"; Augustine et al. 2020 and Briske et al.
    2008, §4.4) [ext]/[peer]
- **Recommendation (synthesis):**
  - the herd is small (fixed costs spread over fewer head; see Fit) (judgment)
  - no paid labor would actually be cut: az2117 counts time at its opportunity cost, and on the average US cow-calf
    farm hired labor is a small share of labor cost (ERS, §4.4) (judgment)
  - the cattle run on leased grass where the landlord builds and owns the fence (judgment)

**Implication for the model (recommendation)**
- Fence miles avoided must be explicit, interior only and dated, with "avoided" vs "deferred" and the tenure of the
  land unit the fence would be on (owned or leased, with the lease term), including who would build and own the
  fence. The operator is credited only with the share of the saving it would actually receive: where the landlord
  would build the fence, the operator's share defaults to 0 (shown and editable) and the saving is listed as received
  by others; on leased land the operator's benefit ends at the lease term unless the lease is expected to renew
  (owner decision, 15 Oct 2026; §8.1 F6).
- Subscriptions need a billing basis (per head per month or per collar per year), billing in advance, and the
  commitment terms (minimum quantity, years, early-termination fee): one vendor's terms have been quoted as a 2-year
  contract and as a 36-month commitment.
- Calves are excluded from enrolled head by default. Bulls need their own collar-loss assumption.
- Labor is cash only in whole units the user says will stop being paid. Rider hours split into moving and gathering
  (cash-eligible) and health-check riding (not eligible).
- Handling (collars on and off, refits, training checks) is built from head, minutes per head, crew size and gathers.
- Weight gain defaults to blank. It counts only in the economic view unless the user marks it "from my records", and
  it is valued at the value of gain, not the sale price (§4.4).
- Because the case turns on a few inputs, the page shows the value of each at which the analysis would pay for
  itself within the payback target (5 years by default): interior fence miles that would otherwise be built, fence
  \$/mile, hired moving and gathering hours cut, subscription \$/head/month and herd size (B9 "What would make it pay",
  §8.2; owner decision, 15 Oct 2026).

### 4.2 Remote water monitoring (not water infrastructure)

**Problem it solves**
- It replaces some physical trips to check tank and trough levels.
- It gives earlier warning of pump, float or pipeline failures (on one Queensland property in Australia, detected
  bore pump faults "which would have potentially cost in excess of $14,000" (Australian dollars implied: the report
  writes "\$"; two incidents; data about 2009–11): MLA B.NBP.0505, May 2011) [trial].
- It does **not** supply water. Automatic watering, solar pumps, pipelines and tanks are separate investments
  (section 6). NRCS says financial assistance "may be available" for monitoring through EQIP under Energy Efficient
  Agriculture (Code 374) and through CSP under the enhancement E614A, "Adding Telemetry to a Livestock Watering
  Facility to Monitor Water Levels Remotely" (NRCS fact sheet, May 2025; the E614A enhancement sheet, Sept 2024, names
  Conservation Practice 614, "Watering Facility"). [gov]

**Fit**
- Sourced:
  - **Long routes driven as separate trips.** Five desert-Australia stations made 2–4 inspections a week of
    200–700 km each and aimed to cut them to about once a week; four paid back in 6–24 months (Ashley et al. 2008;
    data years not stated) [trial]. Applicability limit (judgment): those routes were 200–700 km per inspection, so a
    ranch with shorter routes will not see this payback (§5.2 item 2).
  - **Frequent checks.** Where producers rely on wells in pastures, "water checks are typically conducted daily or
    every other day to ensure a consistent water supply" (Nebraska Extension, Berger, 23 Apr 2025) [ext].
  - **Hot weather and lactating cows.** A 900-lb lactating cow needs about 11.4 gal/day at 40°F and 18.2 gal/day at
    90°F (UNL G2060, rev. Feb 2025, from NRC 2016) [ext].
  - **Selective monitoring.** On one New South Wales (Australia) sheep and goat station, monitoring every trough was
    not economic (AWI/Rural Directions, *Options for Water Telemetry*, Dec 2013) [trial].
  - Nebraska Extension adds that these technologies "won't be a perfect fit for everyone" (Berger, 23 Apr 2025)
    [ext].
- **Recommendation (synthesis):** the best fit is many water points on a long route, checked often in hot weather,
  where each check is its own trip and not on the way to other work (judgment, from the sources above).

**Costs** ([vendor] unless noted)
- Satellite water-level monitor: $1,490 plus $365/yr (Ranchbot, All-Tex Irrigation dealer flyer, undated; checked
  15 Oct 2026). The same
  vendor in farm press: $1,400 and about $1/day (FARM SHOW, 2025) [news].
- Tank-level monitor: RRP $399.99 plus $99 per device per year, covering cellular and satellite service (Gallagher
  Tank Level Monitor, US shop page, checked 15 Oct 2026).
- Stand-alone satellite water monitor: MSRP $549 plus $0.75/day (Ranchbot Trough Direct, reported by Feedlot
  magazine, Feb 2025) [news].
- Two further water-monitor listings (LoneStar; Tank Toad) were recorded during the research without a URL or a
  date, so their prices are not reported here and they are not used anywhere in this plan.
- Extension figures: "$500 and up" (SDSU Extension, updated 25 Sep 2023) [vendor], reported by [ext]; an $1,800
  monitor in a worked example (Utah State University Extension, undated) [ext]; cameras $400–$700 each (UNL
  BeefWatch, 27 Mar 2024) [vendor], reported by [ext].
- Life: NRCS assumes 10 years for the E614A enhancement (Sept 2024) [gov] (an assumption: class [B]). The lifespan of
  stand-alone monitors is "subject to battery life (can range from 2 years to 10 years)" (UNL BeefWatch, Aquino &
  Xiong, 27 Mar 2024) [ext]; an Australian telemetry review gave batteries 3–5 years (AWI/Rural Directions, Dec
  2013) [trial].
- Installation: the Utah worked example allowed $100 [ext]; the dealer flyer says 15 minutes [vendor].

**Savings mechanisms and evidence**

| Study | Setting | Result | Label |
|---|---|---|---|
| MLA B.NBP.0505 (Zeller, May 2011; data about 2009–11; Australian dollars implied: the report writes "\$") | 2 Queensland properties, Australia | Estimated labor 10 → 2 h/wk and travel 57 → 20 km/wk on one property, but **management time was estimated to rise from 0 to 4 h/wk on both demonstration properties**. Break-even 1.7 and 1.04 years. Labor valued at A$30/h. A third producer withdrew: remote technology "could not remove the need for visual inspections". The letter also cites cost (about A$40,000 for a third of its water system) | [trial] |
| Ashley et al. (2008; project established 2005, data years not stated) | 5 desert stations, Australia | Payback 6–24 months at four stations. **De Rose Hill: $25,000 system (currency not recorded), $0 saving**: its monitored points lay on the route to points that still needed checking | [trial] |
| PIRSA Farmbot case (page updated 22 Jul 2025; prices Feb 2022; Australian dollars implied) | South Australia | Assumes "water runs are reduced by 50%" (an assumption, not a measured result). Labor A$50/h, vehicle A$0.72/km. Year-1 saving A$2,107. "Monitoring devices do not eliminate the need to inspect tanks and troughs, but they can be checked less frequently" | [gov] worked example (class [B]); product price [vendor] |
| Utah State University Extension (project participant K. Heaton; undated) | Utah (26-week season; season not stated) | 3 trips/wk × 26 wk × 40 mi round trip × $0.50/mi = $1,560/yr. Halving trips pays for an $1,800 monitor in "just over 2 years" ($1,800 ÷ $780 ≈ 2.3 years). Labor, the $100 install and the $3–10/month fee are excluded, as are savings from labor, repairs and prevented deaths | [ext] |
| Producer report (Beef Central, 19 Apr 2021) | Isis Downs, Queensland, Australia | Monitors about $1,500 each plus $300–$500/yr (Australian article; currency not recorded); the producer expected full cost recovery within 12–18 months; the station still drove about 1,200 km a week | [news] |
| Ranchbot website (undated; seen during the research, Oct 2026) | — | A claim of more than 50% savings. A re-check of the home page on 15 Oct 2026 did not show the figure, so it is not verified | [vendor] |

- **Applicability limit for the Australian rows (judgment):** they come from Australian stations, some with routes of
  200–700 km per inspection and labor valued at A$30–50/h. They show what monitoring did and did not remove there;
  they are not US savings, payback or price defaults (§5.2 items 1–2).
- **Avoided death loss:** this audit found no study that quantifies it. Sources describe only single equipment
  events, such as the bore pump faults above (MLA 2011), not avoided deaths. An extension source says "cattle can
  survive for a few days without water" (LSU AgCenter, Navarre, May 2020) [ext]. The Utah worked example leaves prevented deaths out of its payback.
- **Water needs:** UNL G2060 (rev. Feb 2025, from NRC 2016) gives 11.4 gal/day for a 900-lb lactating cow at 40°F,
  rising to 18.2 gal/day at 90°F. [ext]

**Labor and infrastructure still required**
- **Physical checks continue.** "Monitoring devices do not eliminate the need to inspect tanks and troughs, but they
  can be checked less frequently" (PIRSA, South Australia, prices Feb 2022) [gov]. One MLA producer withdrew because
  remote technology "could not remove the need for visual inspections" (MLA B.NBP.0505, Queensland, Australia, 2011)
  [trial]. An MLA producer story reported that monitoring had not completely removed the need to inspect physically
  (MLA news, Australia, 4 Jan 2016) [news].
- **Added management time:** estimated at +4 h/wk of management time on both demonstration properties (MLA
  B.NBP.0505, Queensland, Australia, 2011; data about 2009–11) [trial].
- **Installation:** $100 in the Utah worked example [ext]; 15 minutes per the dealer flyer [vendor].
- **The water system itself:** tanks, floats, pumps and pipelines still have to be built and maintained. E614A adds
  telemetry to a livestock watering facility (NRCS, Sept 2024; fact sheet May 2025) [gov].
- **A data plan for each monitor:** "each monitor requires an active subscription" (Gallagher US shop page, checked
  15 Oct 2026) [vendor]. Units run on cellular or satellite service (dealer flyer; Gallagher) [vendor].
- **Batteries and solar panels** (life above).
- **Driving that remains:** one Queensland station in Australia still drove about 1,200 km a week with monitors
  installed (Beef Central, 19 Apr 2021) [news].

**Adoption challenges and failure modes**
- **Equipment problems** in the MLA demonstration: ultrasonic flow meters, ant damage, solar power that fell short in
  overcast weather, and the wrong data plan (MLA B.NBP.0505, Queensland, Australia, 2011) [trial].
- **Breakdowns:** a producer in an Australian wool-industry case study reported fewer water runs but three
  breakdowns (AWI, Dunblane case study, Nov 2013) [trial].
- **Only water problems are seen:** telemetry "won't pick up on any problems that aren't directly related to water"
  (Kimberley/Pilbara, Western Australia, producer demonstration, reported by Beef Central, May 2014) [news]. Fence,
  animal-health and predator problems still need a visit (judgment).
- **Cost:** one producer in the MLA demonstration (Queensland, Australia) withdrew partly over a quote of about
  A$40,000 for a third of its water system (MLA B.NBP.0505, 2011; data about 2009–11) [trial].

**Unlikely to pay when**
- Sourced:
  - the monitored points are on routes driven anyway (Ashley et al. 2008, De Rose Hill, Australia) [trial]
  - physical inspections continue anyway, so few runs are actually avoided (PIRSA, South Australia, Feb 2022 prices
    [gov]; MLA B.NBP.0505, Queensland, Australia, 2011 [trial])
- **Recommendation (synthesis):**
  - the water run is also the cattle, bull and mineral check (judgment)
  - water is near headquarters (judgment)
  - natural surface water is common (judgment)
  - nobody's paid hours change and mileage is short (judgment, from the Utah and PIRSA worked examples, where the
    savings are mileage and paid labor)
  - tanks freeze, or water is checked on the daily feeding round: a level monitor cannot chop ice, and a tank frozen
    over can still read full (judgment)

**Implication for the model (recommendation)**
- Inputs are runs, miles and hours by season block, each block with runs per week, weeks, miles and hours per run.
- Each block has a minimum number of pasture visits a week that are needed regardless of water (cattle, bull and
  mineral checks). Share of runs avoided is capped at (runs − minimum visits) ÷ runs, because the sources above say
  monitoring does not remove inspections (PIRSA, South Australia; MLA B.NBP.0505, Queensland, Australia).
- A block flagged "tanks freeze / water checked on the feeding route" defaults its share avoided to 0%.
- Vehicle cost is the variable cost per mile.
- Added monitoring time is a cost: cash when paid labor does it, capacity when it is done unpaid (for example, by the
  operator).
- Death loss avoided is an advanced, records-based expected value, shown as a separate risk line and never in cash
  NPV. An optional offset covers losses from fewer physical checks.
- Monitor count is independent of herd size.
- The page shows the value at which the analysis would pay for itself within the payback target (5 years by
  default) for the share of runs avoided in each season block, the vehicle cost per mile (miles per run and \$ per mile
  are factors of one product, so they are one driver, solved on \$ per mile), hired labor units cut,
  monitor price, subscription per monitor and herd size (B9, §8.2; owner decision, 15 Oct 2026).

### 4.3 EID tags, readers, scales and software (kept separate)

**Problem it solves**
- **Official identification:** covered cattle moved interstate need official ID under APHIS's traceability rules,
  and official eartags applied since 5 Nov 2024 must be visually and electronically readable (APHIS final rule,
  89 FR, May 2024) [gov]. The tag alone meets the rule: "Readers and software are not required" (same rule) [gov].
- **Faster, more accurate recording at the chute:** "The key benefit afforded by eID technology is labour
  efficiency" (MLA B.GFB.1719, Australia, 17 May 2017) [trial]. That benefit depends on spending on readers and data
  management, not only on tags (same report).
- **Weights for decisions:** a scale supports sale-weight and shrink management (Oklahoma State ANSI-3257) [ext] and
  the other uses in "Where the value comes from" below. The value comes from decisions made with the weights, not
  from the tag (judgment).

**Regulatory baseline**
- APHIS final rule, 89 FR, Doc. 2024-09717 (9 May 2024), effective 5 Nov 2024. Official eartags applied from that
  date must be visually and electronically readable. [gov]
- **Covered**, for interstate movement: sexually intact cattle and bison 18 months and older; dairy cattle (all
  females, and males born after 11 Mar 2013); rodeo, recreation, show and exhibition cattle. "Beef feeder cattle
  under 18 months of age are not subject to the identification requirements", and cattle moving direct to
  slaughter are exempt. [gov]
- **Readers are not required:** "Readers and software are not required because each EID tag also has a visual
  component." [gov]
- **APHIS cost estimates:** about $26.1 million a year nationally, or about $30.45 per operation per year, assuming
  no federal funding. APHIS has provided tags free since 2020, but says it "cannot commit to long-term funding for
  EID tags." [gov]
- **Litigation:** *R-CALF USA et al. v. USDA*, U.S. District Court for the District of South Dakota, case
  5:24-CV-05085-ECS. The court granted the government's motion to dismiss in part and denied it in part (order dated
  30 Sep 2025), and the plaintiffs moved for summary judgment on 5 Mar 2026 (NCLA case page; BEEF, 10 Mar 2026).
  A Tri-State Livestock News headline, "Update on EID lawsuit: Settlements are being discussed", reports settlement
  talks; its date is unknown and the article could not be opened. No ruling, stay or rescission was found through
  15 Oct 2026, but its absence could not be proven: the NCLA case page still listed the case as active with no
  entry after 5 Mar 2026. [news]/[gov] Verifying the rule's current status, including this docket, is a separate
  research task, R1 (§8.4), which must be completed before the compliance baseline (B4b) is built (owner decision,
  15 Oct 2026).
- **Free tags in 2026:** APHIS still says it provides EID tags at no cost through state veterinarians (page updated
  26 Jun 2026). State supplies are limited: New York allows up to 500 tags per premises, or one year's supply if smaller, within a 12-month period from 6 Jan 2026, "while
  supplies last" (form AI-489, Jan 2026), and Indiana says "Free USDA cattle tags are often backordered with
  deliveries taking weeks or months to arrive" (BOAH page, Apr 2026). [gov]

**Fit**
- Sourced:
  - **Compliance:** covered cattle moving interstate need official ID; official eartags applied since 5 Nov 2024 must
    be EID (visually and electronically readable), while visual official tags applied earlier remain official. Most
    beef feeders under 18 months and cattle going direct to slaughter are exempt (APHIS rule, May 2024) [gov].
  - **Readers:** an Australian benefit-cost study found that spending more than A$3,500 (Australian dollars implied:
    the report writes "\$") on readers and data management needs "over 800 cows with over 5 readings per calf prior to
    sale" for about a 25% return, and that "smaller cow herds are unlikely to generate economic returns from
    investment in eID technology" (MLA B.GFB.1719, Francis/Holmes Sackett, 17 May 2017; data year not stated in the
    report) [trial]. It studied commercial herds only: "Seed stock operators were avoided as the business case for
    investment in eID differs between seed stock operators and commercial operators." Applicability limit (judgment):
    the 800-cow figure is that study's result for Australian herds at A\$ costs, not a US threshold.
  - **Verified-program premiums:** measured on large lots sold through summer video auctions (McCabe et al. 2018)
    [ext].
  - **Scales:** shrink management when selling. "If cattle are fairly close to the scales where they will be
    weighed, one can probably assume 2-3% shrink from actual pasture weight" (Oklahoma State ANSI-3257) [ext].
- **Recommendation (synthesis):**
  - Cow-calf: the rule mostly reaches breeding stock moved interstate. The voluntary case rests on reads per head,
    records actually used, and a premium only where a buyer pays one (judgment).
  - Stocker and backgrounder: most cattle are exempt, so a scale for shrink, gain and dosing is usually the more
    relevant tool (judgment).
  - Seedstock: breed performance records already require weights, so most herds own a scale and records software.
    Evaluate only the increment: a reader, the software link, replacement timing (judgment).

**Costs (October 2026 retail unless noted)** ([vendor])
- 840 HDX tags: about $3.14 each ($156.99 per 50; Jeffers, checked 15 Oct 2026).
- Stick reader: about $1,900 ($1,919, Jeffers, checked 15 Oct 2026). Other published figures: $1,400–$2,200
  (AgrAbility, undated) [vendor], reported by [ext]; about $2,200 for one model (UC ANR; date not recorded) [vendor],
  reported by [ext]. A 2009 APHIS-commissioned estimate put a wand at $1,091 [gov].
- Scale: indicator plus two load bars about $1,780–$1,830 (Tru-Test S3 with MP600 bars: NRS $1,779.99; Valley Vet
  $1,829.95, which includes mounting brackets and a USB cable; checked 15 Oct 2026). A higher-end indicator (ID5000)
  lists at $2,299.99; whether that price includes load bars was not confirmed. A platform is not part of these
  listings.
- Software:
  - $149–$600 one-time, or $40–$950 a year (Oklahoma State CR-3279, Aug 2022). [vendor], reported by [ext]
  - One commercial package: $30/month billed yearly, for up to 250 head (CattleMax pricing page, checked 15 Oct
    2026; page metadata modified 1 Sep 2026).
- Age-and-source verification: $0.50–$1.10 per head, falling with lot size (FSNS verifier flyer; no date printed,
  file name dated 16 Dec 2025).

**Where the value comes from**

| Component | Mechanism | Evidence |
|---|---|---|
| Tag alone | Compliance where required. Otherwise ID for individual records | No standalone return. Tag loss or failure in Montana cows: 3.0% cumulative at 2 yr across four ranches; 19.8% at 5 yr on the one ranch followed that long (Roberts et al. 2012) [peer] |
| Reader | Faster, more accurate capture at the chute | "The key benefit afforded by eID technology is labour efficiency." Spending above about A$3,000–3,500 (the report gives both figures) on readers and data management needs more than 800 cows with more than 5 reads per calf for about a 25% return; smaller herds "unlikely" (MLA B.GFB.1719, 17 May 2017, Australia; data year not stated in the report) [trial] |
| Scale | Sale-weight knowledge and shrink, dosing by weight, heifer development targets, culling | Shrink of about 1% of body weight per hour in the first 3–4 hours of a haul; near the scales, "one can probably assume 2-3% shrink from actual pasture weight", though shrink varies with handling, sorting, crowding and loading time (Oklahoma State ANSI-3257, c. 2007; web version AFS-3257, Feb 2017) [ext]. Visual weight estimates can miss by more than 10% (OSU's Yost, as reported by Progressive Cattle, 10 Aug 2026) [news, secondhand] |
| Software and records | Enables decisions | No causal evidence of value found. In the MLA study, "When asked the critical question: 'what have you changed as a result of collecting the individual animal data?'" some producers stated that nothing had changed (MLA B.GFB.1719, Australia, 2017, Key messages) [trial] |
| Program premium | Age-and-source or other verified programs | Summer video-auction sales 2010–2017: average "$2.25/cwt", yearly range $1.02–$4.07, and "This premium may not have been enough for the average producer selling calves via video auction to be profitable" (McCabe et al. 2018) [ext]. 2001–2010: $1–$2/cwt premiums exceeding about $0.67/cwt of added costs in 2010 (Zimmerman et al. 2012; peer-reviewed but Pfizer-funded, so treated as [C] under §5.2 item 7) [peer]. Recent Superior, K-State and Merck summaries of video-sale results give no age-and-source premium (dates not recorded, except a Merck summary reported by *Drovers*, 14 Aug 2026 [vendor]); check before use (recommendation) |

**Labor and infrastructure still required**
- **Chute time and crew:** about 30 seconds per tag applied and 20 seconds per read (APHIS-commissioned NAIS
  benefit-cost analysis, K-State team, 14 Jan 2009, 2007 data, labor valued at $9.80/h) [gov] (estimate: class [B]).
  These are per animal; the whole crew is tied up while cattle go through (judgment).
- **Re-tagging** for lost or failed tags (Roberts et al. 2012, below) [peer].
- **Scale hardware:** an indicator and load bars, plus a platform or chute mounting (listings above) [vendor].
- **Records:** software, data entry and someone who uses the data. In 2007–08, 17.0% of US beef cow-calf operations
  kept records on a computer on the operation and 2.9% on a computer off the operation; for operations with 200 or
  more cows the figures were 37.4% and 10.8%. An operation could use more than one system, so the two figures are
  not simply added (USDA APHIS NAHMS, Mar 2011, Table 1) [gov].

**Adoption challenges and failure modes**
- **Tag loss and read failure:** annual failure of 1.4, 1.6, 3.7, 5.1 and 5.0% in years 1–5; cumulative 3.0% at
  2 years (all four ranches) and 19.8% at 5 years (one ranch), counting losses plus failures across tag types
  (Roberts et al. 2012, *The Professional Animal Scientist* 28:221–226) [peer].
- **Records not used:** some producers in the MLA study said nothing had changed as a result of collecting the data
  (MLA B.GFB.1719, Australia, 2017) [trial].
- **Free-tag supply:** limited, capped per premises in some states, and often backordered (New York AI-489, Jan
  2026; Indiana BOAH, Apr 2026) [gov].
- **Rule status:** the lawsuit is unresolved (see Regulatory baseline) [news]/[gov]. Research task R1 (§8.4) verifies
  the status before the compliance baseline (B4b) is built.
- **Weighing conditions:** shrink varies with handling, sorting, crowding and loading time, so weights taken under
  different conditions are not comparable (ANSI-3257) [ext].

**Unlikely to pay when**
- Sourced:
  - the herd is small (MLA B.GFB.1719, Australia, 2017: over 800 cows for about a 25% return at A\$
    costs; not a US threshold) [trial]
  - free tags already cover compliance (APHIS traceability page, 26 Jun 2026) [gov]
  - the reader and software are bought "because the rule requires EID": the rule requires the tag, not the reader
    (89 FR, 2024) [gov]
  - the data won't change culling, sorting or marketing (MLA B.GFB.1719, Australia, 2017: some producers said
    nothing had changed) [trial]
- **Recommendation (synthesis):**
  - calves are sold at a local auction with no verified program, so there is no premium to capture: the published
    premiums come from large video-auction lots (judgment, from McCabe et al. 2018)

**Implication for the model (recommendation)**
- Ask whether the rule applies to the cattle the ranch moves, and whether free tags are available. Phase 1 (B4a)
  records the rule answer and counts all tags as project costs; where the answer is yes, the page says this may
  understate the case for EID if the tags are required anyway. Separating compliance (a baseline) from voluntary
  investment, so that only the increment is charged, is B4b, built only after research task R1 (§8.4) has verified
  the rule's status (owner decision, 15 Oct 2026).
- Separate reader, scale, software and premium lines. A premium needs a buyer quote, net of verification fees.
- No generic "weight gain" from EID.
- Chute time = reads per year × head × seconds per read × crew size. Re-tags come from a tag-loss rate.
- Ask whether weights were recorded before, so the scale is credited only with what is new.
- The page shows the value at which the analysis would pay for itself within the payback target (5 years by
  default) for herd size, the program premium (net \$/yr), tag price, reader and scale cost, and added hours (B9,
  §8.2; owner decision, 15 Oct 2026).

### 4.4 Shared economic inputs

- **Wages.**
  - USDA NASS (Farm Labor, 21 May 2025), April 2025 livestock workers' gross wage: Northern Plains $18.72/h,
    Southern Plains $16.33/h, US $18.15/h, excluding housing and meals. [gov]
  - **NASS discontinued the Agricultural Labor Survey (the Farm Labor Survey) in 2025** (Federal Register, 3 Sep
    2025), so this is the last observation. Future updates need BLS OEWS or an escalator (recommendation).
  - Legally required benefits were about 10% of wages, and all benefits about 42%, for private industry in June 2025
    (BLS ECEC, released 12 Sep 2025). [gov]
  - *Recommendation:* where the ranch has no payroll figure, the public fallback is the NASS wage for its US region,
    in US dollars. The Australian labor rates in §4.2 (A$30/h and A$50/h) are never used as defaults (owner decision,
    15 Oct 2026).
- **Who does ranch labor.** ERS cow-calf costs and returns (updated 1 Oct 2026), 2025 US averages per cow: hired
  labor about $41, unpaid labor about $570, total costs about $1,752. [gov] The opportunity cost of unpaid labor
  ranged from $1,065 per cow on farms with 20–49 cows to $77 per cow on farms with 500 or more (ERS *Amber Waves*,
  Gillespie, 11 Dec 2024, 2018 ARMS data). [gov]
- **Discount rate.** "The minimum discount rate that should be used is the interest rate on any loan used to make the
  investment", plus a risk premium; the worked example uses 10% (U. Wyoming B-1302, Jul 2017; also UF/IFAS FE1060,
  2019, page modified Sept 2025) [ext]. az2117 used 3.9%, "based on estimated returns to ranch
  production assets in Arizona" [ext].
  - *Recommendation:* the plan treats the discount rate as a real rate and states all prices in today's dollars,
    because the tool holds prices flat. Help text: "real rate ≈ your loan rate + a risk premium − expected
    inflation". Each synthetic example loads with a visible, editable example rate of 7% real [E], labeled "Example
    assumption (real rate), not a recommendation. Review it for your operation.", so results appear at once. When
    the user starts their own analysis (chooses "Analyze my operation" or changes an operation input), the rate keeps
    its value but shows a "Review this rate" prompt, and the verdict carries "Discount rate not yet reviewed" until
    the user confirms or edits the rate. Results are never blocked (owner decision, 15 Oct 2026; §7.1, §9.5). The
    owner has not selected a rate, and 7% is only the examples' value, not a rate suited to every operation: the
    sources above use 10% and 3.9%.
- **Prices.**
  - USDA NASS (Agricultural Prices, 29 Sep 2026): calves averaged $455/cwt nationally in August 2026. [gov] NASS
    "defines a calf as weighing less than 500 lbs" (NASS prices-received questionnaire, "Corn Silage and Cattle
    Prices Inquiry", October 2006 version, OMB information collection 200805-0535-002, opened 15 Oct 2026) [gov].
    The 2026 report itself does not restate the definition, so treat this series as covering calves under 500 lb
    unless NASS says otherwise (recommendation).
  - USDA ERS forecasts (LDP-M-387, 17 Sep 2026), Oklahoma City medium-frame No. 1 feeder steers (750–800 lb):
    - 2025 actual: $321.86/cwt
    - 2026 forecast: about $357/cwt
    - 2027 forecast: $342.50/cwt in the table ($342.25 in the report text)
  - Price slide: USDA AMS South Dakota weekly auction summary (AMS_2027, 12 Oct 2026, week of 4–10 Oct), medium and
    large No. 1 feeder steers: $480.52/cwt at 500–548 lb (average 526 lb) and $447.59/cwt at 550–598 lb (average
    573 lb). [gov]
  - *Calculated (illustration of the method only):* at those prices a 526-lb steer was worth about $2,528 and a
    573-lb steer about $2,565, so the 47 extra pounds added about $37, roughly $0.79/lb, against sale prices of about
    $4.48–$4.81/lb. One week's averages across different lots are noisy, so this is not a default value. Using the
    band midpoints (524 and 574 lb) instead of the lots' average weights gives about $1.03/lb, which shows how
    sensitive the figure is to the weights used. The §8.1 F4 test uses the average weights ($0.791/lb).
  - *Recommendation:* value added weight at the value of gain for the class sold: (value at the heavier weight −
    value at the base weight) ÷ added pounds, from two dated AMS weight-class quotes, or a value the user enters.
    Help text: "not the sale price per pound". Do not use the NASS calves price for calves over 500 lb.
- **Death loss benchmarks** (not effects of technology):
  - USDA APHIS NAHMS (May 2010, 2007 data): of all beef calves born, 3.5% were born alive but died or were lost
    (including theft) before weaning, and 2.9% were born dead. 1.5% of beef breeding cattle died or were lost.
  - USDA APHIS (Dec 2017, 2015 data): calf losses were 6.2% of the calf crop across all operations (Table A.1.b);
    about 5.5% on beef operations (Table A.2.c, not quoted directly; check before use, recommendation). On beef
    operations, calving-related problems caused 22.7% of nonpredator calf deaths, and theft 1.0% (Table C.2.a).
  - [gov]
- **Fence.**
  - NMSU B-133 (Mar 2025): "upwards of $15,000 per mile"; 2% a year repair and maintenance; 25-year life. [ext]
  - Missouri G1193 (January 2024 prices; adjusted totals, which add 5% to materials for terrain, for a quarter-mile
    fence):
    - 5-wire barbed: $3.55/ft (≈ $18,700/mi)
    - 6-wire high-tensile: $2.86/ft (≈ $15,100/mi)
    - 2-strand interior electric with polywire: $0.81/ft (≈ $4,300/mi)
  - Iowa State FM-1855 (rev. Dec 2024; Table 6 unchanged since 2012):
    - woven and barbed wire: 20-year life, 8% a year maintenance
    - high-tensile, electric or not: 25-year life, 5% a year
    - electrified polywire: 4-year life, 5% a year. The text says polywire and polytape "will likely last about
      4–5 years" and that "The non-wire or tape components have an estimated life of 25 years."
  - [ext]
- **Grazing management and animal performance.**
  - az2117 notes "limited research quantifying the benefits" of virtual fencing.
  - It calls the effect of rotational grazing on animal performance "an ongoing debate," citing Augustine et al.
    2020, a USDA-ARS collaborative adaptive rangeland management experiment. [ext]
  - **Augustine et al. 2020** (*Rangeland Ecology & Management* 73(6):796–810), Central Plains Experimental Range,
    Colorado: adaptive multi-paddock rotational grazing "resulted in a 12–16% reduction in total cattle weight
    gain" against season-long grazing at an identical stocking rate. Daily gains averaged 14.1% lower. [peer]
  - **Briske et al. 2008** (*Rangeland Ecology & Management* 61(1):3–17), a review of grazing experiments: plant
    production was "equal or greater in continuous compared to rotational grazing in 87% (20 of 23)" of
    experiments. Animal production per head was equal or greater in 92% (35 of 38), and per area in 84% (27 of 32).
    [peer]
  - *Implication (recommendation):* a grazing system enabled by virtual fencing should not be assumed to raise gain
    or stocking rate. The controlled evidence does not support a default gain.

### 4.5 Disagreements and gaps in the evidence

- **One vendor's virtual fence prices (Halter).** Sources disagree on:
  - base-station cost: $3,000 (Audoin, 16 Apr 2024, when that comparison said the collars were "not yet available" in
    the US; the only source giving $3,000); "Base stations - $4500" (Reuter, 23 Jan 2025); DTN (31 Mar
    2025) gives a "one-time infrastructure investment starting at $4,500" without saying it is per base station;
    none for the satellite collars launched in April 2026;
  - subscription: $60/collar/yr (Audoin); $66/yr (Reuter); "less than $7 per head per month" (DTN), which is up to
    about $84/yr;
  - contract term: "2 years contract" (Audoin, Rangelands Gateway comparison, 16 Apr 2024) vs "They ask for a 36
    month commitment" (Reuter, Oklahoma State slides, 23 Jan 2025).

  They are 2024–2026 snapshots; get a quote (recommendation).
- **NMSU B-133 contains internal inconsistencies.** Its text says 24% where its own tables give about 49%, and its
  text gives the e-collar total as "360 heads x $40/collar x 2 collars for 10 years" = $28,800, while Table 2 shows
  $144,000 ($14,400 a year). Table 2 itself is consistent with two $200 collars per head (5-year life) over its
  10-year horizon. Recompute before citing (recommendation).
- **Water monitoring.** Trip reductions in the evidence run from 0% measured (De Rose Hill) to the paper's general
  statement that monitoring "reduce[s] the need for physical inspections to once a week" from 2–4 a week (50–75% fewer
  inspections; no station-level counts are reported; Ashley et al. 2008, Australia). PIRSA and the Utah worked example
  assume 50%. One vendor claims more than 50% (Ranchbot website; not re-confirmed, see §4.2). The best economic
  evidence is Australian, with longer routes and different labor costs, and most of it is more than 10 years old. No
  US peer-reviewed economic trial was found; one US paper on remote stock-water monitoring (Walker 2021, *Rangelands*
  43(2)) could not be accessed.
- **Water-monitor battery life.** UNL BeefWatch gives 2–10 years by product (Mar 2024); an Australian review gave
  3–5 years (Dec 2013). Use the vendor's specification for the model quoted (recommendation).
- **EID premiums.** The latest published US age-and-source premium estimate covers 2010–2017 (McCabe et al. 2018),
  when yearly averages ranged from $1.02 to $4.07/cwt. No current US estimate was found.
- **Death loss avoided.** This audit found no study for any of the three technologies, so it should come from ranch
  records (recommendation).
- **Beef calf death rate.** The 2015 APHIS report's 6.2% (all operations) was quoted directly; the beef-only 5.5%
  was not, and needs checking before use (recommendation).
- **Calves and collars.** The youngest collaring age differs by source: 10 months (Audoin's comparison, Apr 2024)
  and 12 months (as reported by the Australian welfare review, Dec 2022, updated Nov 2023), both for the same vendor
  (Halter); over 440 lb (FSA ECP-105, Aug 2026); and "not recommended for calves" (NDSU, 2026 report).
- **Hoag et al. 2025** (*Rangelands* 47(1):92–101), the main peer-reviewed economics paper on virtual vs physical
  fence, could be read only as an abstract. Its conclusions are not used here.

---

## 5. Data requirements and evidence table

### 5.1 How to use this table

- **Inputs:** the table covers the inputs the phase-1 model needs (section 9).
- **Columns:**
  - **Input (units)** and **Definition.**
  - **Applies to · effect on calculation:** the technology the input belongs to, and what it changes in the
    calculation.
  - **Operation types:** cow-calf, stocker, seedstock, or all.
  - **Should come from:** ranch records, a vendor quote, public data or a research estimate.
  - **Evidence:** the source, its publication date and the year of the underlying data. For a vendor price, the
    data year is the date the price was observed.
  - **Source IDs:** short IDs such as [S12] that point to the full entry, with its URL, in §13.2. One exception:
    [S111], a headline whose article could not be opened, is listed in §13.3.
  - **Applicability and limits:** where the evidence comes from and what it does not cover. Evidence from outside
    the US names its country and the currency of any money value (§5.2 item 9).
  - **Region:** where the row's evidence comes from: "US", with the state or program where it matters, or the
    country (and state or province) for evidence from outside the US; "—" where the row has no source. A row with
    sources from more than one place lists each. A literature review that pools studies from several countries is
    listed as "review (countries not recorded)", because the countries it covers were not recorded for this table.
  - **Currency:** the currency of the row's money values: "USD" for US dollars; for a figure from outside the US,
    its own currency, or "currency not recorded" where the source does not state it; "—" where the row has no money
    value. A row with money values in more than one currency lists each.
  - **Suggested value or range [class]:** see below.
  - **Update:** how often the value should be refreshed.
  - **Tier:** see below.
- **Evidence classes:**
  - **[A]** fact or specification: a regulation, a government statistic or program term, a contract term once
    quoted.
  - **[B]** research-based estimate.
  - **[C]** vendor-reported price or claim. The page offers a price as an optional fill only when it is a first-hand
    published price (the vendor's or a dealer's own page, listing or flyer), and only the one price per input listed
    in the fill table in 9.5 ("Inputs and validation"). It labels it "Vendor information:
    published list price (source, date). Not an endorsement. Replace with your quote." When that source is undated,
    the label reads "Vendor information: published list price (source, undated; checked `<date checked>`). Not an
    endorsement. Replace with your quote." (9.5 item 4). A price reported second-hand by the press or extension is
    context in §4 only: it is never offered as a fill and never labeled a published list price. Where a synthetic
    example uses such a figure, the page gives it the reported-price label of 9.5 item 4 (§11).
  - **[D]** a value the user enters from their own records, quotes or judgment. A quote the user types replaces any
    published price and is labeled "your quote".
  - **[E]** synthetic or author-chosen value, used only in the worked examples (§11 and Appendix A). Values I chose
    for those examples are [E], never [D]. The examples are made-up ranches, not any real operation, and the page
    gives [E] values a badge visibly different from [C] and [D] (owner decision, 15 Oct 2026). No example value is
    tuned to reach a result: the inputs of the good-fit example, Synthetic Ranch D, were fixed before any result was
    computed (§11).
- **How the §4 source labels map to these classes:**
  - [gov] rule, program term or official statistic → [A]; [gov] estimate, assumption or worked example → [B].
  - [peer], [ext] and [trial] estimates → [B]; vendor-authored or vendor-funded work → [C] (§5.2 item 7).
  - [vendor] prices and claims → [C], whoever reports them.
  - [news] (a vendor claim in the press, or one producer's experience) and [news, secondhand] → [C].
- **Suggested values:** a value appears only where a source supports it. Every price is a dated snapshot.
  - "Quote required" means the result should rest on the ranch's own quote. A first-hand published vendor price
    listed in the row (the vendor's or a dealer's own page, listing or flyer) is vendor information. The page offers
    one such price per input, the one listed in the fill table in 9.5 ("Inputs and validation"), as an optional,
    labeled fill until the quote is entered; any other price in the row is context only. Where no published price
    was found, the field stays blank and marked "Quote required"; a missing price is never filled (owner decision,
    15 Oct 2026). A figure the row cites from a press or extension report is context only, never a fill, even
    where it is the only figure found. For example, no published US list price was found for collar-based virtual
    fencing, so its prices in §5.3, all from press or extension reports, are never offered as a fill (§4.1).
  - Published prices describe what the equipment costs. They never support a benefit line or the projected
    savings (§7.3).
- **Dollars, units, tax, discounting and the payback target** (owner decisions, 15 Oct 2026):
  - All values are in today's US dollars and US units (lb, cwt, miles, acres, head). Figures from outside the US
    keep their own currency, with their country and data year, and are never silently converted to US dollars
    (§5.2 item 9).
  - Results are before tax, and the page labels them so. The initial version has no after-tax module.
  - The discount rate is a real rate (§4.4). The synthetic examples load with a visible, editable example rate,
    7% real [E], labeled "Example assumption (real rate), not a recommendation. Review it for your operation."
    When the user starts their own analysis, the rate keeps that value but the page asks them to review it, and
    the verdict says "Discount rate not yet reviewed" until they confirm or edit it. Results are never blocked
    (§7.1). The owner has not selected a rate, so 7% is the examples' assumption, not a recommended value.
  - The payback target (`settings.paybackTarget`, whole years) is 5 by default and editable. It is a setting, not
    an estimate: the page tests whether the analysis pays for itself within that many years and shows what would
    have to change for it to do so (B9 "What would make it pay", 9.3). A value the panel reports (for example, at
    least 14.86 miles of interior fence for Synthetic Ranch D to pay for itself within 5 years, §11) is calculated
    from the other inputs. It says what would have to be true, not that a source shows it is likely; check it
    against the ranch's records or a quote.
- **Tiers:**
  - **Required:** the five-minute path.
  - **Optional:** improves accuracy.
  - **Advanced:** collapsed by default, and needs a source note when used.
- **Spreadsheet copy:** the same rows, with every column including full URLs, are in
  [`evidence-table.csv`](evidence-table.csv), in the same folder as this document.

### 5.2 When a published estimate should *not* be transferred to another ranch (recommendation)

Treat a published number as a starting question, not an answer, when any of these hold:

1. **Different labor structure.** Savings in Australian water trials were valued at A$30–$50 per hour (MLA
   B.NBP.0505, Queensland, 2011, data about 2009–11; PIRSA, South Australia, 2022 prices). These are Australian
   labor values in Australian dollars; a US analysis uses a US wage (§4.4) or the ranch's own pay rate, not a
   converted Australian figure. If the US ranch's water runs are done by the owner, the cash value of those hours
   is zero. The same holds when freed hours are absorbed by other work instead of cut in whole units (days, weeks
   or a position) that stop being paid.
2. **Different scale or geometry.**
   - Stations in desert Australia drove 200–700 km per inspection (Ashley et al. 2008; data years not stated). A
     Plains ranch with water near headquarters will not see those savings.
   - The NMSU fence comparison assumed 75 miles of fence on 6,000 acres (B-133). Results scale with the miles a
     particular ranch would actually build, and only the operator's share counts where a landowner would pay for
     the fence (F6; owner decision, 15 Oct 2026). Synthetic Ranch D shows how much this matters (calculated from a
     synthetic example, not a sourced finding): its plan needs 14.14 miles of interior fence, and, with its other
     inputs unchanged, it would pay for itself within 5 years only with at least 14.86 miles (§11).
3. **Different animal class or season.**
   - Trials on dry cows (Boyd et al. 2022), yearling steers (CSU AgNext and USDA-ARS, 2024 season) or heifers
     (U. Alberta, Canada, 2025) do not transfer to cow-calf pairs. Calves are uncollared and cross boundaries more
     often (NDSU, 2025 season). Synthetic Ranch D therefore collars cows only and does not value the risk that
     uncollared calves roam (§11).
   - Water-run savings measured in open-water months do not transfer to months when tanks freeze or water is
     checked on the daily feeding round (judgment).
4. **Different market channel.** Age-and-source premiums measured on large video-auction lots (McCabe et al. 2018)
   do not transfer to a local sale barn.
5. **Dated prices and programs.** Vendor prices from 2024 already conflict with 2025 figures (§4.5). Cost-share
   rates differ by state, county group and fiscal year (az2105).
6. **Confounded treatments.** A gain measured under patch grazing *with* virtual fencing cannot be attributed to the
   collar (NDSU, 2025 season).
7. **Vendor-authored or vendor-funded work.** Keep it as [C] even when it appears on a government or industry site.
8. **Internal errors in the source.** Recompute from the source's own inputs before citing (NMSU B-133).
9. **Different country or currency.** The tool is US-first, not US-only (owner decision, 15 Oct 2026): defaults
   use US dollars, US units and US wage, price and program sources. Research from Australia, Canada or elsewhere
   stays where it is the best evidence, but each use names the country, the currency and the data year and says
   where it does not apply; each input's provenance records this in `region` and `currency` (9.2). A non-US figure
   is never used as a default and never silently converted to US dollars.

### 5.3 The table

The table is in [`evidence-table.md`](evidence-table.md). The same rows, with full URLs, are in [`evidence-table.csv`](evidence-table.csv). The columns are described in 5.1.

---

## 6. Candidate additional modules

### 6.1 Should improving the existing calculator come first? Yes (recommendation)

All three current starting points share one model (§2.1), and so share the defects in section 3: cash vs capacity, cash-flow timing, animal classes, cost
drivers, asset life, and fence and death-loss treatment. A new module built on today's engine would inherit them. A
new module built after phase 1 would cost substantially less (judgment, not estimated), because the shared line-item
engine, provenance labels and scenarios would already exist.

### 6.2 Comparison (sourced evidence; ratings are my judgment)

Every rating in this table (High, Medium, Low, none) is my judgment. Only the cited facts in the "Evidence quality"
column, and the cited figures in other cells, come from sources. Column definitions:

- **Value to intended users** is rated separately for a cow-calf operator, a stocker operator and a lender. For a
  lender, value means how well the module's output would support a credit decision: a capital purchase with clear
  cash costs rates higher than a benefit that can only be framed as a break-even (judgment). The primary user is
  the commercial cow-calf operator, including a manager presenting a decision to an owner or lender; stocker
  operations are secondary (owner decision, 15 Oct 2026). The ratings below were made before that decision and are
  unchanged by it.
- **Ranch implementation and upkeep** is the work and disruption for the ranch to install the technology and keep
  it running.
- **Build effort** is the developer work to add the module to this calculator after phase 1.

Columns marked *(good when High)* are better when high. Overlap, ranch implementation and upkeep, build effort and
risk of overstating are *worse* when high.

| Candidate | Producer relevance *(good when High)* | Value to intended users: cow-calf / stocker / lender *(good when High)* | Evidence quality *(good when High)* | Can incremental cash be quantified? *(good when High)* | Ease of ranch inputs *(good when High)* | Overlap with existing modules | Ranch implementation and upkeep | Build effort | Risk of overstating |
|---|---|---|---|---|---|---|---|---|---|
| **Water infrastructure and solar pumping** | High (rangeland, all types) | High / High / High | Medium–High. Extension economics: U. Wyoming B-1289.2 (Aug 2016) compares the installed and annual costs of solar, generator and utility power. NMSU B-829 (Nov 2023) gives grazing-capacity reductions by distance to water | High: capital, fuel, site visits, EQIP share | High | Medium: shares water runs avoided with water monitoring | High: a construction project (pump, panels or power line, and any well or pipeline). In B-1289.2's example, solar then needs 2 site visits a week and a generator 7 | Medium | Medium (forage-gain claims) |
| **Calving monitoring** (tail sensors, cameras) | High for cow-calf and seedstock; none for stockers | High / none / Low | Medium on accuracy, Low on outcomes. Mostly dairy. In Miller et al. 2020 (UK, 2017 data; 144 beef and 110 dairy cows), a research tail accelerometer, not a commercial unit, predicted calving within a 5-h window for beef cows with MCC 0.31 | Medium: calves saved × value, minus devices; framed as a break-even | High: calvings, past calving losses, night-check hours | Low | Medium: devices fitted before calving and removed after. In one Canadian dairy study (Ontario, 2021 data; 49 cows) 42% dropped off (Umaña Sedó et al. 2024) | Low | High: the benefit rests on calves saved, and this audit found no US study that measured it |
| **Standalone GPS tracking** (ear tags, no fence) | High on large, leased or BLM pasture; low otherwise | Medium / Medium–High / Low | Low. MLA P.PSH.1315 (Australia, 11 Feb 2026) *modelled* rather than measured ROI. Large-loss stories are vendor anecdotes | Medium: head recovered, gathering hours. MLA's Australian model: full cost recovery if 1–2 head per 100 are kept from loss over 12–18 months | Medium | High with virtual fencing (collars already report location) | Low–Medium: tags fitted at a normal working, plus gateways or a satellite plan. MLA P.PSH.1315: about 90% of tags retained over 12 months; about 300,000 ha covered with as few as three gateways | Low–Medium | High |
| Walk-over / in-pasture weighing | Medium (stockers, heifer development) | Low–Medium / Medium / Low | Medium on accuracy (Simanungkalit et al. 2020, Australian authors, University of New England; the abstract does not name the trial site or year; 112 cattle: 5.1–5.5% prediction error); mixed on economics (MLA L.PDS.2302, 2024, two Australian demonstration farms: NPV −A$31,000 and +A$45,380, in Australian dollars, not converted and not transferable to a US ranch without its own inputs) | Medium | Medium | High with EID and scale | Medium: a platform at water that cattle must cross; readings need cleaning (Parsons et al. 2023, 10 steers: about 30% of readings discarded) | Medium | Medium |
| Precision supplementation | Medium | Medium / Medium / Low | Low. One SDSU thesis (Dagel 2023) reported $28/hd supplement savings. In Clemson trials (Jacobs et al. 2023), 27–55% of cattle, depending on class, were not successfully trained to the feeders; the authors call it "generally cost prohibitive" | Medium | Medium | Medium (needs EID) | High: training cattle to the feeders, then feeder upkeep | Medium | High |
| Ranch record software | Medium | Medium / Low–Medium / Low | Low. No causal evidence of value found | Low | High for cost, Low for benefit | Medium (EID) | Medium: ongoing data entry | Low (a cost line) | High |
| Satellite forage tools (Rangeland Analysis Platform) | Medium | Medium / Medium / Low | Medium as data; not an investment | Low (free tool) | High | Low | Low: a free web tool | Low (a link) | Medium |
| Drones for checking cattle | Medium | Low–Medium / Low–Medium / Low | Low (demonstrations: USU Extension, Apr 2025; one SARE farm, FNC20-1210) | Medium | Medium | Medium | Medium: someone must fly each check | Low | Medium |

Health and illness alerts (activity or rumination collars, boluses) are not in this table because this audit did not
research them. See 6.4.

### 6.3 Recommendation: at most three additions, in this order, after phase 1

1. **Water infrastructure and solar pumping** (an "improve water supply" module, separate from monitoring).
   - *Why it ranks first (judgment):*
     - It has the best evidence and the clearest cash flows.
     - It matters to cow-calf and stocker operations on rangeland (6.2 rates its producer relevance High for all
       operation types).
     - It is a true comparison of alternatives (solar vs generator vs line extension vs hauling), which is the kind
       of capital decision a lender reviews.
   - *Fit with the primary user (judgment):* water supply fits commercial cow-calf operations directly, and its
     capital comparison is the kind a manager can present to an owner or lender.
   - *Guardrails:*
     - Site visits avoided are shared with water monitoring through the overlap rule (spec 9.6).
     - Forage gained from new water (via NMSU B-829's distance factors) is an advanced input that defaults to zero.
     - The EQIP payment is entered by the user from their state schedule.
2. **Calving monitoring**, framed as a break-even: "it pays if it saves N calves a year."
   - *Why (judgment):* the inputs are familiar, the costs are simple, and the module tells a cow-calf manager
     something useful.
   - *Fit with the primary user (judgment):* it fits commercial cow-calf operations, the primary users; it has no
     value for stocker operations.
   - *Guardrails:*
     - Show the accuracy limits (mostly dairy evidence, frequent false alarms, detached devices).
     - Default the calves saved to blank. Offer the ranch's own calving-loss records as the anchor.
3. **Standalone GPS tracking**, only if the target users run on large or leased pasture. Also framed as a
   break-even (head recovered per year, gathering hours).
   - *Fit with the primary user (judgment):* it remains conditional on large or leased country; it fits a cow-calf
     operation only where the cows run on such pasture.
   - *Guardrail:* not available when virtual fence collars are already on the same animals. SDSU Extension (Brennan
     and Menendez, updated 13 Feb 2026) puts tags at roughly $70–$300 each plus software fees; the same page also
     gives $70–$200 elsewhere.

### 6.4 Defer or exclude (recommendation)

- **Defer:** walk-over weighing. Fold it into EID and scale later as an "in-pasture weighing" option rather than a
  separate module.
- **Defer:** precision supplementation. The evidence is immature and this audit found no published price.
- **Defer:** health and illness alerts (activity or rumination collars, boluses). The research for this audit did
  not cover them, so 6.2 gives them no rating. This is a gap against the requested candidate list ("health/calving
  alerts"; only calving monitoring was researched), not a finding that they lack value. Revisit after reviewing
  evidence for beef cattle on pasture.
- **Exclude as modules:**
  - **Record software:** treat it as a cost line inside the EID module.
  - **Rangeland Analysis Platform and similar free tools:** link to them as references.
  - **Drones:** at most an alternative inside GPS tracking.
- **Exclude:** broad "smart ranch" bundles. They make one-benefit-per-dollar accounting impossible.

---

## 7. A more credible user experience

### 7.1 Five-minute workflow (recommendation)

The times are my judgment for a user who has a quote and knows their own operation; together they come to about 3 to
6 minutes.

| Step | Screen | Required inputs | Time |
|---|---|---|---|
| 1 | **Your operation** | Operation type: commercial cow-calf is preselected and editable (the primary user; owner decision, 15 Oct 2026); stocker or yearling (supported, secondary), seedstock, other. Head by class (cows, bulls, replacement heifers, calves born, calves sold, cull cows sold, yearlings), by year if it will change, for example in a drought destock. Months on the pasture where the technology would be used. **The land the technology serves:** one or more land units, each owned or leased (lease term; whether renewal is expected; who builds and maintains fence and any fence reimbursement at lease end; who provides and checks water; whether care is included in the lease rate), so an operation with both owned and leased land is supported. Each land unit carries its share of the herd's head-months or water points. These answers set the starting "who pays" and "who receives" shares on each line (F6). **Who does the work today:** owner or family (unpaid), salaried, hourly, day labor or contract, and the unit each is paid in (hour, day, week or position) | 1–2 min |
| 2 | **The technology, the quote and your discount rate** | Purchase or subscription. Number of devices (monitors, collars, tags, readers), or enrolled head and months. Price per unit from the quote. Where 9.5 item 7 lists a first-hand published price (the vendor's or a dealer's own page, listing or flyer, dated or undated with the date it was checked), an optional "Use published vendor price" fill, labeled "Vendor information: published list price (source, date). Not an endorsement. Replace with your quote." [C], or, when the source is undated, "Vendor information: published list price (source, undated; checked `<date checked>`). Not an endorsement. Replace with your quote." (9.5 item 4); a typed quote replaces it and is labeled "your quote" [D]. A price reported second-hand by the press or extension is never a fill. Where no first-hand published price is listed, the field stays blank with "Quote required"; a missing price is never filled. Two exceptions load with a synthetic example: its cost placeholders (7.3; `prov.placeholder`, 9.5 item 5), each an [E] value labeled as a placeholder, not a price, and its second-hand reported vendor prices (`prov.reported`, [C], labeled as a reported price, not a published list price, as in 9.5 item 4; Synthetic Ranches B and D). Both keep their value after "Analyze my operation", with their label shown. Billing basis and timing (all year or enrolled months; billed in advance or in arrears). Contract term, any minimum quantity and any early-termination fee. For each cost line, "Who pays for this?" (operator / landowner or other / split %), prefilled from the step-1 land answers and editable. Years to evaluate. **Payback target:** whole years, 5 by default (owner decision, 15 Oct 2026) and editable, shown next to the years to evaluate (`settings.paybackTarget`, B9); the page tests whether the analysis pays for itself within that many years (7.2 items 1 and 6). **Discount rate (a real rate):** an example loads with its rate visible and editable (the synthetic examples use 7% real [E]), labeled "Example assumption (real rate), not a recommendation. Review it for your operation." When the user starts their own analysis (chooses "Analyze my operation" or changes any operation input away from the example), the rate keeps its value but shows a "Review this rate" prompt with the help text "real rate ≈ your loan rate + a risk premium − expected inflation", and the verdict carries "Discount rate not yet reviewed" until the user presses "Keep this rate" or edits the rate (an edit made on the example counts). Loading an example or Reset returns to the example and sets both the own-analysis and rate-reviewed flags back to false (9.5 item 5). Results are never blocked. No rate is presented as right for every operation; the owner has not selected a percentage (owner decision, 15 Oct 2026). The page states that all prices are in today's US dollars (the default currency) and that all results are before tax | 1–2 min |
| 3 | **What changes on your place** | Per technology, a short set of questions in ranch units (listed below the table) | 1–2 min |
| 4 | **Result** | No new inputs | — |
| Advanced (optional, collapsed) | Expected losses avoided (death-loss events and head per event, shown as a separate risk line), production effects, residual value, financing, cost share, ramp-up by year, an optional "losses from fewer physical checks" offset for water (blank by default), and owner-time value for the economic view | — | — |

**Step 3 questions by technology:**

- **Remote water monitoring.** One row per season block (for example summer, and fall–winter–calving). Each block asks
  for runs per week, weeks, and miles and hours per run; a box "tanks freeze / water checked on the feeding
  route", which defaults that block's share of runs avoided to 0% (an override shows a warning); the minimum
  pasture visits per week the user would make anyway (cattle, bulls, mineral), which caps the share of runs
  avoided at (runs per week − minimum visits) ÷ runs per week; runs expected after; and who drives (paid or
  unpaid). It also asks once for the vehicle's variable cost per mile: fuel, maintenance and tires, not the IRS
  mileage rate, which includes ownership costs.
- **Collar-based virtual fencing.** Interior fence the user would otherwise build (miles, type, year, and the land unit it is on),
  with who builds it, and so who receives the fence saving, taken from that land unit's step-1 answers (editable).
  If the landlord would build it, the operator's fence benefit is 0 and the saving is listed under "Received by
  others". Hours spent moving and gathering these cattle today (the baseline that caps hours cut), and the hours cut for **moving and gathering** cattle, by riders or a contractor.
  Health-check riding is asked separately and is not counted as cash unless the user cites a validated alert
  function (then it is [C]). Crew size, handling events (collar on, collar off, refits) and minutes per head.
  Training days and riders.
- **EID tags and scale.** "Does the EID rule apply to cattle you move?" (the APHIS rule, §4.3; asked for each class). In phase 1 (B4a) the answer is
  recorded as an input. Moving tags the rule already requires into the baseline, so that only the increment is
  charged, waits for B4b, which follows research task R1 (8.4) on the rule's status and the litigation. Until
  then, a "yes" counts all tags as project costs, and the page says: "Compliance treatment is pending verification
  of the rule's current status. All tags are counted as project costs here, which may understate the case for EID
  if your tags are required anyway. Check with your state veterinarian." Are free official EID tags available to
  you from the state veterinarian, how many, and for which years? Did you weigh or record individual animals before, and how long did it take?
  Head sold through a verified program. Scale uses per year. Chute crew size.
- **Labor (every technology).** Which whole units of paid work would stop: day-labor days not hired, weeks cut from
  a seasonal hire, or a position not filled. Required question: "Would the freed time go to other work you now pay
  for or would otherwise hire? If it is absorbed, cash = 0." For each new task the technology adds, who does it:
  paid (a cash cost) or unpaid (hours taken from capacity).
- **Who receives each saving (every technology).** For each benefit line, "Who receives this saving?" (operator /
  landowner or other / split %), prefilled from the step-1 land answers and always shown and editable. On a leased
  land unit, the operator's benefit ends at the lease term unless the user says the lease is expected to renew, and
  the residual of an improvement left on the land (the fence, or a cost line marked as staying with the land) goes
  to the operator only as far as the lease reimburses it (default 0); devices the operator removes keep their
  residual (9.3).

Overlap between modules is scaled back automatically, with a warning naming the modules (spec 9.6). Letting the
user allocate an overlap by hand comes later, with the combined view (L6).

### 7.2 Result page layout (recommendation)

1. **Cash verdict.** For example (Ranch B, expected case, §11; the exact sentence of 9.5 item 1 and 10.1 row 49):
   > Over 7 years at the example's 7% real rate (an assumption, not a recommendation), before tax, this costs about
   > $230,000 more than it saves in cash. It does not pay. Cash benefits would need to rise about 3.5-fold. It turns
   > most on herd size and subscription.

   Under the payback target (B9), the same verdict adds the line "Does not pay for itself within 5 years" (Ranch
   B's 5-year test cash NPV is −$175,519, before tax) and the sentence "It would pay for itself within 5 years if:"
   with two drivers from the panel in item 6: "It would pay for itself within 5 years if: herd size at most 273
   yearlings (you entered 1,200 yearlings), or subscription at most $0.93/head/month (you entered $7/head/month)."
   (9.5 item 1; 10.1 row 43).

   The sentence is generated from the numbers, and it names the two inputs that matter most: the two longest bars of
   the phase-1 tornado, which moves each driver ±20% (9.5 item 6). For Ranch B these are herd size (about $119.5k
   wide, because it moves the subscription and the collar handling hours together) and the subscription (about
   $106.6k); the interior fence that would otherwise be built (\$/mile × miles, about $25.8k), added hours (about
   $20.0k) and the discount rate (about $18.6k) come next, ahead of hired moving and gathering hours cut (about
   $10.8k) (10.1 row 49). The verdict names no payback year, which stays on its tile (9.5 item 1). With the scenario
   tornado of B1 (item 8), the avoided fence is the same in all three §11 columns, so it has no bar (§11 tests it as
   a separate what-if row, a landlord-fenced lease), and the subscription and the hired moving and gathering hours
   cut would be the longest bars.
   It says "pays" only when cash NPV is zero or more without risk
   lines. With no cash flows for the operator at all (for example, every operator share 0), it says "No cash flows
   for you in this analysis" instead (9.3). When the "Indicative only" rule in 7.3 applies, that line comes first. It would here, because every
   Ranch B cash benefit multiplies at least one [B] or [E] input.

   Around the verdict (owner decisions, 15 Oct 2026):
   - The verdict sentence and each headline figure (items 1–3) are labeled "before tax". The initial version has no
     after-tax view (L5).
   - Cash NPV, the benefit-cost ratio, payback and IRR are the operator's: each cost and benefit line counts only
     the share the operator pays or receives (F6). Amounts paid or received by others are listed separately (item
     5) and never added to the operator's results.
   - While the user is analyzing their own operation and has not confirmed or edited the discount rate, the verdict
     carries "Discount rate not yet reviewed" (7.1, step 2).
   - In the same way, while the user is analyzing their own operation and any synthetic cost placeholder (7.3) is
     neither replaced nor confirmed, the verdict carries "Includes synthetic cost placeholders" (9.3). Results are
     computed either way.
   - Near the verdict, the page says: "Published prices describe what the equipment costs. They do not support the
     projected savings, which come from your entries or the example's assumptions."
   - Payback target (B9; owner decision, 15 Oct 2026). A second line under the verdict reads "Pays for itself within
     5 years (counting equipment value left at year 5)" or "Does not pay for itself within 5 years", with 5 replaced
     by the user's target N, or "No cash flows for you within N years" when the N-year test has no cash flows for
     the operator (for example, a module that starts in year N or later; 9.3, 9.5 item 1). It comes from the N-year test: the whole analysis rerun with N years as the horizon,
     every other input unchanged, residual values taken at year N (rules in 9.3), at the operator's share and before
     tax. It passes when that cash NPV is zero or more. The headline stays the full-horizon cash NPV, and the line is
     not called payback, because it counts residual value (judgment). When N is longer than the horizon, the page
     says "assumes the same prices continue to year N". When the test fails, the verdict adds "It would pay for
     itself within 5 years if:" followed by the two drivers in item 6 whose required change is smallest relative to
     the entered value. The "What would make it pay" panel (item 6) sits next to the verdict.
2. **Cash NPV including expected losses avoided.** A second headline figure, below cash NPV, shown only when a risk
   line is entered. Risk lines (expected values of rare losses avoided, such as death loss in a water outage) are
   itemized here with their inputs (events per year × head per event × value per head × share caught) and never
   enter cash NPV, the benefit-cost ratio, IRR or payback. If cash NPV is negative and this figure is zero or more,
   the verdict reads "pays only if the loss estimate holds". Example (Ranch A, expected): cash NPV about −$11,000;
   including expected outage losses avoided, about break-even (−$412 before rounding). The verdict tests the
   unrounded figure, so Ranch A's verdict still reads "does not pay".
3. **What you're buying with the rest.** Hours freed per year, shown in hours (Ranch A, expected: 84 owner hours a
   year, net of added monitoring time). A dollar figure appears only if the user prices those hours, and it is
   labeled "economic value, not cash". Production effects not taken from the ranch's own records also appear here,
   not in cash. The page's third headline figure, "Economic NPV", adds these and the risk lines to cash NPV. Added
   work done by paid hands is a cash cost and appears in the cash-flow table, not here.
4. **Today vs with the technology (B2, after phase 1).** A table that sets the baseline beside the proposal, so the user can see that
   only the difference is counted. Rows are the physical quantities the module changes (water runs, miles driven,
   paid days, weeks or positions, the fence plan with its miles, type, year and builder, tags already required by
   rule (once B4b is built), devices and subscriptions), then annual cash. Columns are "Today", "With the technology" and "Change". The
   "Change" column is what feeds the cash-flow table, at the operator's share of each line. Example (Ranch A,
   expected, §11 and Appendix A; owned land, so the operator pays every cost and receives every benefit):

   | Per year | Today | With monitoring | Change (to the cash-flow table) |
   |---|---|---|---|
   | Summer water runs | 88 | 44 | −44 runs |
   | Fall–winter–calving water runs (tanks freeze; checked on the feeding round) | 60 | 60 | 0 |
   | Miles on water runs | 17,760 | 12,480 | −5,280 mi × $0.40 = +$2,112 |
   | Day-labor days hired | the ranch's own number | 16 fewer | 16 × $164.74 = +$2,636 |
   | Subscription | $0 | $3,650, billed in advance | −$3,650 |
   | **Net cash in a year with no repair charge (years 1–3, 5–7 and 9)** | | | **+$1,098** |

   Purchases (year 0), repairs and residual value appear in the cash-flow table in the years they occur.
5. **Annual cash-flow table.** One row per year from year 0 to the horizon T, with year 0 as its own row (purchases,
   and subscriptions billed in advance). Columns: each cost line and each cash benefit line, itemized, with
   replacements in the years they occur; residual value in its own column (nonzero only in year T, or in year T' for a
   lease-end residual on a leased land unit, 9.3, so it is never mixed into an operating line); then net cash, cumulative and discounted.
   Risk lines appear in separate columns after the net with their own subtotal, and never enter net or cumulative.
   A note above the table states the timing: subscriptions and service fees billed at the start of each year (years
   0 to T−1), other costs and all benefits at year end. In any year with no cattle on the module, the table says "No
   cattle in year t: benefits not counted". The same note states that all figures are before tax. Every line
   carries its provenance badge [A]–[E]. The merged "first 12 months" view is dropped.
   Each line shows the operator's share. Any cost, or share of a cost, paid by a landowner or other party is listed
   below the table under "Paid by others", and any benefit or share received by others under "Received by others";
   neither enters net cash, cumulative or the operator's results.
6. **What would make it pay: break-even values in ranch units (B9, phase 1).** The panel sits next to the verdict.
   For each of the module's main drivers (`PAYBACK_DRIVERS(a)`, 9.2; herd size is a driver in every module), it shows
   the value at which the analysis would pay for itself within the payback target (the N-year test's cash NPV is 0)
   and the value at which cash NPV over the full horizon is 0, each with its direction ("at least" or "at most"),
   holding every other input fixed. Exact page strings are in 9.5 item 9. Examples, as the panel shows them with a
   5-year target (9.5 item 9; 10.1 rows 40, 42 and 43), the 5-year cell first and the full-horizon cell second. A
   value marked "at least" is rounded up and one marked "at most" is rounded down, so each value shown, entered as
   is, pays; the unrounded solved values are in parentheses:
   - Synthetic Ranch A, expected, hired labor cut (day labor): "at least 28 days" within 5 years and "at least 26
     days" over 10 years (27.32 and 25.58; you entered 16 days).
   - Synthetic Ranch B, expected, subscription: "at most $0.93/head/month" within 5 years and "at most
     $0.96/head/month" over 7 years (0.938 and 0.969; you entered $7/head/month, a reported price, 9.5 item 4).
   - Synthetic Ranch D, 5-year and 7-year cells: interior fence that would otherwise be built, "at least 14.86 mi"
     and "at least 14.94 mi" (14.859 and 14.932; you entered 14.14 mi); subscription, "at most $6.67/head/month" and
     "at most $6.64/head/month" (6.674 and 6.646; you entered $7/head/month); herd size, "at most 381 cows" and "at
     most 380 cows" (381.86 and 380.34; you entered 400 cows).

   The panel solves on cash NPV. Break-evens for risk lines are solved on cash NPV including expected losses
   avoided, say so, and come with B2 after phase 1, over the analysis horizon rather than the payback target. A B2
   example (Ranch A, expected, 10 years): "Counting expected outage losses avoided, it breaks even if outages would
   otherwise kill about **0.8** head a year (enter your own history)." That value is $11,079 ÷ 7.0236 (the 10-year
   annuity factor at 7%) ÷ ($2,700 × 75% caught) = 0.78 head a year; Ranch A's synthetic input is 0.75 (0.15
   events × 5 head). Each driver's search range is limited to values that pass validation with the other inputs
   fixed, and the row says so when that limit binds: Ranch A's avoided runs free at most 33 days, so the
   day-labor search stops at 33. When no value in the range makes it pay, the row says "No `<label>` between
   `<lo>` and `<hi>` makes it pay for itself within N years" (Ranch A, 5-year test: no share of summer runs avoided
   between 24.24%, the least that still supplies the 16 paid days, and the 50% cap).
7. **Scenario columns.** Conservative, expected and optimistic, plus an optional drought or destock case (B1). Each
   input has three editable values, pre-filled from the evidence range where one exists and otherwise left blank.
   A value from non-US research is shown beside the input with its country, currency and data year, and is never
   the prefill.
   The page states: *"These are three sets of assumptions, not a statistical range. There is no stated probability
   that the result falls between them."*
8. **What to verify first.** The tornado, run between each input's conservative and optimistic values and sorted by
   their effect on cash NPV. Factors that only appear as a product (hours × wage, pounds × value of gain, death rate ×
   value per head) move together as one driver, and the two-way grid never pairs two factors of one product. Inputs
   entered as 0 stay in the tornado and are tested over a range. It is captioned with the action, for example: "Get
   a written quote on billing for enrolled months," or "Pull 3 years of fuel logs for the water route."
9. **Sources and assumptions.** Every non-user value lists its source, date and data year, with its class [A]–[E].
   Blank benefit, risk, production and advanced inputs are listed as "`<label>`: not entered, not counted", and a
   blank price as "Quote required: not counted" (9.5 items 4 and 7); a cleared structural field, such as the
   horizon or a head count, keeps its last value (9.5 item 7). Page text, starting points and labels use generic technology names
   (collar-based virtual fencing, remote water monitoring, EID tags and scale), as already decided for the site. A
   company or product name appears only inside a linked source citation, and every first-hand published [C] price is
   labeled "Vendor
   information: published list price (source, date). Not an endorsement. Replace with your quote.", or, when the
   source is undated, "Vendor information: published list price (source, undated; checked `<date checked>`). Not an
   endorsement. Replace with your quote." (9.5 item 4). A [C] price reported second-hand by the press or extension,
   which only a synthetic example uses, is labeled "Vendor information: reported price (source, date), not a
   published list price. Not an endorsement. Replace with your quote." (9.5 item 4). A typed quote is labeled "your
   quote" [D]. A synthetic
   example's cost placeholder is labeled "Synthetic placeholder, not a price. Replace with your quote." (7.3). Synthetic demonstration assumptions [E] (runs avoided, hours, days cut, outage
   events, residual %, and the like) carry a badge visibly different from sourced prices [C] and from the ranch's
   own entries [D]. Money is in US dollars and quantities in US units (lb, cwt, miles, acres, head) by default. A
   value from non-US research is labeled with its country, currency and data year and a note on where it may not
   apply; it is never used as a default and never silently converted to US dollars.
10. **Owner and lender business case (B6).** A print stylesheet produces the business case a ranch manager can
    take to an owner or lender. Its first page is a one-page summary: the decision and the verdict; cash NPV and
    payback; the payback-target line (B9: "Pays for itself within N years (counting equipment value left at year
    N)", "Does not pay for itself within N years" or "No cash flows for you within N years"); cash needed by year; which values are your quote, published
    vendor information, reported vendor prices (not published list prices), synthetic, or from the ranch's records; who pays and who receives (item 5, and item 4 once B2 is built); the main risks and what to verify first (item 8);
    the "before tax" label; and the date and tool version. The 2–3 pages after it carry the operation, the quote, the
    cash table, the today-vs-with table once B2 is built, the "What would make it pay" panel with its break-evens
    (item 6; B9), the scenarios once B1 is built, the assumptions with provenance, and a dated
    footer that names the tool version and states that synthetic values are present.

### 7.3 Handling incomplete information without false precision (recommendation)

- **Blank means "not counted", not zero by accident.** The result lists what was left out ("Losses avoided (water): not
  entered, not counted", 9.5 item 4). A blank benefit can only make the result look *worse*, and the page says so
  (9.5 items 4 and 11).
- **Ranges instead of points when the user doesn't know.** If the user chooses "I don't know" for runs avoided, the
  scenario columns use the evidence range:
  - conservative 0% (De Rose Hill, where the monitored points lay on the route to points that still needed
    checking; Ashley et al. 2008, desert stations in Australia);
  - expected 50% (PIRSA, a South Australian worked example, and USU, a Utah one; both are assumptions in worked
    examples, not measurements);
  - optimistic 50–75% (2–4 inspections a week down to 1; Ashley et al. 2008, Australia; the paper's general
    statement, not a measured result: it reports no station-level inspection counts). The page uses the larger
    of 50% and the cut from the user's own runs per week to 1, up to 75%: 50% for 2 runs a week or fewer, 67% for 3,
    75% for 4 or more.

  These are shares of runs, not money, so no currency arises. None is a non-US default (judgment): 0% is simply
  the floor, 50% has a US source (USU), and the optimistic value is computed from the user's own runs per week. The
  Australian studies are cited, with their country, as evidence for the range (a measured 0% at one end, a stated
  cut to one inspection a week at the other); their distances
  (200–700 km per inspection) do not transfer to a Plains ranch with water near headquarters (5.2).

  Every value is then capped by that season block's minimum-visit floor, (runs per week − minimum visits) ÷ runs
  per week, and defaults to 0% in a block flagged "tanks freeze / water checked on the feeding route".
- **Rounding that matches the evidence.** Show results to the nearest $1,000 when any material input is [B], [C] or
  [E], and to the nearest $100 when every material input is [A] or [D]. An input is **material** when the line it
  feeds has an absolute PV of at least 10% of PV(B) + PV(R), where PV(B) is the PV of cash benefits and PV(R) the
  PV of residual value.
- **The verdict changes tone with provenance.** A line is **estimated** if any input it multiplies is [B], [C] or
  [E]. When the PV of estimated cash-benefit and residual lines (including the avoided fence and its residual; cost
  lines are not counted) is more than 0.5 × (PV(B) + PV(R)), the verdict reads "Indicative only: most of the
  benefit is estimated, not from your records." Example: every Ranch A cash benefit multiplies at least one [B] or
  [E] input (mileage is runs [E] × share avoided [E], set at a [B] worked-example value, × \$/mi [E], chosen
  within the [B] AAA–TAMU range), so Ranch A's expected case reads "Indicative only" (a test in 9.7).
  Published prices describe cost only (owner decision, 15 Oct 2026). A [C] published price on a cost line never
  counts as support for a benefit line, and a benefit line built on an [E] assumption stays "estimated" whatever the
  source of the price.
- **Synthetic examples are labeled.** Every example shows the banner "Synthetic example ranch. Made-up numbers for
  demonstration, not any real operation's data." Examples have different herd sizes, every value is editable, and
  none is named after a real ranch or shown in a way that reads as the site owner's operation (owner decision, 15 Oct
  2026). The §11 ranches (900 cows, 1,200 yearlings, 300 cows, and 400 cows in Synthetic Ranch D) already meet
  this. Ranch D, the good-fit cow-calf virtual-fence example (Ranch B, a stocker operation, stays as the
  secondary-user case), carries in its place the banner "Good-fit synthetic example: conditions where this technology is most
  likely to pay. Made-up numbers for demonstration, not any real operation's data. Check whether your operation
  matches." Its inputs were fixed before any result was computed and were not adjusted afterwards; no example is
  tuned to reach a result (owner decision, 15 Oct 2026). The page's current sentence that the starting values
  describe a 1,000-cow operation is replaced (9.5).
  Some example costs have no published price: Ranch A's mounting ($750) and batteries and repairs ($1,000); Ranch B's
  conservative infrastructure ($9,000), collar-loss charges ($3,000 a year, conservative case) and $25/h contract
  rate, which Ranch D also uses; Ranch C's platform ($800), dewormer ($0.45 an application) and software ($360 a year, set at a published plan
  price for up to 250 active animals, below this herd's size, so a quote is needed). They are kept, because dropping a cost would understate
  costs and flatter the result. Each is [E] and is shown as "Synthetic placeholder, not a price. Replace with your
  quote." When the user starts their own analysis, each placeholder keeps its value but is flagged, and the verdict
  carries "Includes synthetic cost placeholders" until each is replaced or confirmed, the same mechanism as the
  discount-rate review (7.1 step 2; data fields, rule and test in 9.2, 9.3 and 10.1). This is an open item for the
  owner to confirm, with this behavior as the recommended default (§12). Operating assumptions (runs, hours, shares,
  events) stay [E] and are not placeholders.

---

## 8. Implementation roadmap

Everything in this section is recommendation. The "Evidence or rationale" column names the sourced finding or the
audit item (section 3) that each change rests on; where a change rests only on my judgment, it says so, and where it
follows an owner decision, it cites "owner decision, 15 Oct 2026".

Effort is relative: S = a day or less, M = a few days, L = a week or more, for one developer working in the existing
code style. Item IDs are referenced in the spec (section 9).

**Phase 1** (section 9) is F1–F10 plus B3, B4a, B7, B8 and B9. B3, B4a, B7 and B8 are in phase 1 because the
phase-1 engine and its tests need them. B9, "What would make it pay", is in phase 1 because the owner asked that the
tool show what would have to be true for each technology to pay for itself within 5 years, rather than adjust the
example herd sizes until it does (owner decision, 15 Oct 2026). B6, the owner and lender business case, is built
first after phase 1; B1, B2 and B5 follow it. B4b, the EID compliance baseline, waits for research task R1 (8.4).
The L items come after that.

Dependencies form no cycle. F1, F2, F5, F10 and R1 depend on nothing. F9 depends on F1 only; F7 depends on F3 and
F9; F8 depends on F3 and F5; B9 depends on F1–F10, B3, B4a and B7 (its link test, 10.1 row 45, also uses B8, which
9.1 step 6 builds just before B9); B4b depends on R1 and B4a. Where a phase-1
item (B8, B9) depends on F10, it needs F10's criteria (1) and (2); F10's page criterion (3) is completed in the
page switch of 9.1 step 6, after B8 and B9.

### 8.1 Fix now: analytical credibility and correctness

| ID | Problem | Proposed change | Evidence or rationale | Inputs and formulas affected | Effort | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| F1 | Time saved is counted as cash (C1) | Split labor into four parts. **Cash labor saved:** payroll, day-labor or contract dollars that stop, counted only in whole units the user says will stop being paid. **Avoided hire:** a planned hire that is not made. **Paid added hours:** new work done by paid hands, a cash cost. **Capacity hours:** unpaid hours freed or added, reported in hours and valued only in the economic view. A question, answered "absorbed" until the user changes it (9.2): "Would the freed time go to other work you now pay for or would otherwise hire? If it is absorbed, cash = 0." | Partial budgeting counts only items that change (OSU AGEC-139, Dec 2024). Unpaid labor is an economic, not cash, cost (UW–Madison partial-budgeting guide; ERS, Dec 2024). Seasonal hands are paid by the season, so scattered hours do not cut payroll (judgment) | Removes `laborHoursPerWeek × 52 × wage` from cash. New per-year terms (9.3): `cashLaborₜ`, `avoidedHireₜ`, `paidAddedₜ`, `hoursFreedₜ = (hoursSavedₜ − paidHoursCutₜ) − unpaidHoursAddedₜ`. New fields `laborUnit`, `unitsCut`, `hoursPerUnit`, `doneBy` | M | — | (1) With `unitsCut` = 0, changing hours saved leaves cash NPV unchanged to the cent. (2) With risk and production inputs blank, Economic NPV − Cash NPV = PV(Kₜ) exactly (joins the suite with F8, 9.1 step 4). (3) 100 added hours done by a paid hand lower cash NPV by exactly PV(100 × paidRate × (1 + loadPct)). (4) paidHoursCutₜ > hoursSavedₜ is a validation error. (5) Answering "absorbed" sets cash labor saved to 0 |
| F2 | One horizon gives two contradictory verdicts (C4); the merged 12-month view books the purchase inside year 1 (M6) | One horizon `T` in whole years, defaulting to the contract term (the largest `commitYears` above 0) or else the main asset's life (the `lifeYears` of the capital line with the largest year-0 cost among those with a life), and to 5 years with a note if neither is known (9.2). Remove the forced 12-month starting value. The year table shows year 0 as its own row. Drop the merged "12 months at a time" view | DTN, 31 Mar 2025 (5-year collar warranty, vendor statement); NRCS E614A (10-year life) | `years` becomes `settings.T`; `fiveYear()` and its table are removed; year table per 9.5 item 3 | S | — | The page gives one verdict, from the full-horizon cash NPV, and the 12-month and 5-year outlook views are gone. The only other horizon on the page is the payback target's (B9: the line under the verdict and the panel's N-year column), which names its own horizon ("within N years") and is not a verdict. Year 0 is its own row. A non-integer `T` is rejected with a message (10.1 row 28) |
| F3 | Benefits are applied to the whole herd and the wrong class, and zero cattle still shows a profit (C2, C3) | Animal classes: cows, bulls, replacementHeifers, calvesBorn (at side: tags, dosing, death loss), calvesSold, cullCowsSold, yearlings. Inventory and enrollment per class, both allowed to vary by year. Head-months count only the enrolled or served classes, never the sale flows (calvesSold, cullCowsSold). Every head-based line names its `classes`. **Cattle-presence rule:** benefit lines flagged `requiresCattle` are 0 in any year when the module has no head-months, and the page says so | NDSU, 2025 season (calves not collared); FSA ECP-105, Aug 2026 (cattle over 440 lb); cow-calf costs and risks attach to calves at side, and cull cows are a revenue class (judgment) | New `classes[c]`, `heifersRetained`, `enrolled[c]`, `served[c]`; `classes: string[]` on lines; head-months HMₜ and the cattle-presence rule (9.3); validation: enrolled ≤ inventory, calvesSold ≤ calvesBorn − heifersRetained | M | F1, F5 | With head = 0 in every class and year: every `requiresCattle` line and capacity hours are 0 in every year 1..T; the page says "No cattle in year t: benefits not counted"; per-head costs are 0 except committed minimums, which are billed through the commitment term; fixed and capital costs remain, so cash NPV ≤ 0 (for r ≥ 0); cost per head-month shows "n/a" (joins the suite with F8, 9.1 step 4, which builds the metric). These criteria run on fixture lines; the Ranch B case (10.1 row 2) joins the suite with Synthetic Ranch B (9.1 step 5) |
| F4 | Production benefits are unsupported and valued at the sale price | Weight-gain, stocking-rate and conception effects become advanced inputs that default to blank and need a source note. Added weight is valued at `classes[c].valueOfGain` (\$/lb of added weight), not the sale price per pound. Counted in the economic view; counted as cash only when the user marks it "from my records" | az2117 (March 2025): calf gain needed "implausibly large"; grazing evidence in 4.4. Heavier weight bands sell for fewer \$/cwt (South Dakota auction summary, USDA AMS, 12 Oct 2026: M&L1 steers $480.52/cwt at 500–548 lb (average 526 lb), $447.59 at 550–598 lb (average 573 lb)). NASS's "calves" price covers animals under 500 lb | `gainₜ = Σ_{c ∈ production.classes} lbsPerHead × headSold_c,t × valueOfGain_c`, with `lbsPerHead = lbPerHeadPerDay × days` (9.3); `valueOfGain_c = (W_heavy × P_heavy − W_base × P_base) ÷ (W_heavy − W_base)` from two dated AMS quotes, or user-entered | S | F3 | (1) A blank gain field contributes 0 and is listed as "Weight gain: not entered, not counted" (9.5 item 4). (2) With `fromRecords` false, gain changes Economic NPV only. (3) From the South Dakota weekly auction summary (USDA AMS, 12 Oct 2026), M&L1 feeder steers in the 500–548 lb band averaging 526 lb at $480.52/cwt and in the 550–598 lb band averaging 573 lb at $447.59/cwt, `valueOfGain` = (573 × 4.4759 − 526 × 4.8052) ÷ 47 = $0.791/lb (±$0.001). (4) The help text reads "not the sale price per pound". (5) The plausibility warnings of 10.1 row 13 show |
| F5 | Cost drivers are wrong (H1); no life, replacement or residual (H5); every running cost is booked at year end (M6) | Typed cost lines. `timing`: capital or annual. `basis` sets quantity only: fixed, perDevice, perHeadMonth, perHeadYear. Annual lines carry `billing` (advance by default for subscriptions and service fees) and optional commitments (`minQty`, `commitYears`, `earlyTerminationFee`). Capital lines go through one scheduler: cohorts, replacements at s + n·L < T, repairs and residual modes | Vendors price per head per month, per collar and per monitor per year (4.1–4.3). Halter "36 month commitment" (OSU, Reuter, 23 Jan 2025) | Replaces `hardwarePerHead`, `fixedCost`, `subscriptionPerHead`, `maintenancePct`, `replacementPct`. Fields in 9.2; formulas in 9.3 | L | — | (1) Changing herd size does not change a perDevice subscription (joins the suite with F3, 9.1 step 3). (2) L = 4, T = 10: purchases in years 0, 4 and 8; residual at year 10 = 50% of the year-8 purchase. (3) L = 4, T = 8: no purchase in year 8. (4) L = 5, T = 10: purchases in years 0 and 5 only. (5) startYear 2, L = 4, T = 10: purchases in years 2 and 6, residual 0. (6) L = 10, T = 7: residual 30%. (7) Advance billing multiplies a subscription's PV by exactly (1 + r) relative to arrears. (8) A committed minimum is billed when the quantity falls below it (a perDevice fixture line; the head-based case, 10.1 row 16, joins the suite with Synthetic Ranch B, 9.1 step 5) |
| F6 | Fence treatment (H3); land tenure is not asked, and every saving is assumed to belong to the operator | **Land tenure: who pays each cost and receives each benefit; avoided or deferred fence.** Step 1 asks for the land the technology serves as one or more land units, each owned or leased (lease term; whether renewal is expected), each with its share of the herd's head-months or water points, so an operation with both is supported. Every cost and benefit line carries `operatorShare` (0–1): the share of the cost the operator actually pays, or of the benefit the operator actually receives, asked as "Who pays for this?" and "Who receives this saving?" (operator / landowner or other / split %). Defaults come from the land-unit answers and are always shown and editable. Cash NPV, BCR, payback and IRR are the operator's; amounts paid or received by others are listed as "Paid by others" and "Received by others" and never added to them. On leased land, a line's operator benefit ends at the lease term unless the user expects the lease to renew, and the residual of an improvement left on the land, such as a fence, goes to the operator only if the lease reimburses it (default 0). Fence block: miles of interior fence the ranch would build, \$/mile `F`, build year `k`, life `Lf`, upkeep `m`, and *avoided* or *deferred by d years*. It runs as a negated capital line through the F5 scheduler (one function; 9.3). Perimeter fence cannot be entered as avoided. A landlord-built fence gives the operator a fence-benefit share of 0 (a default from the land-unit answers); a water-monitor subscription the landlord pays is answered "landowner or other" on its line, giving an operator cost share of 0 | NMSU B-132 (Oct 2024): virtual fencing "does not work well as replacement for exterior perimeter fencing"; NRCS fact sheet (Oct 2024): "Physical fences will still be needed in some areas"; Missouri G1193 (Jan 2024 prices); Iowa State FM-1855 (life and upkeep by fence type). On leased grass the landowner often builds and owns the fence (judgment). Mixed tenure (owned and leased land, including both), and asking who actually pays each cost and receives each benefit: owner decision, 15 Oct 2026 | `fenceBenefitₜ`, the operator-share and leased-land rules (9.3); `settings.landUnits` and `operatorShare` on every line (9.2) | L | F5 | (1) Deferred by 0 gives 0 in every year. (2) Deferred by 3 gives a positive PV. (3) Deferred so that k + d ≥ T gives exactly the avoided stream, which already nets the year-T residual. (4) Lf = 4, k = 0, T = 7: avoided rebuild in year 4. (5) Leased with the landlord providing fence: operator fence benefit 0, and the fence stream is listed under "Received by others". (6) Tenant-built fence on a 3-year lease with no reimbursement and no renewal expected: no fence flows after year 3 and no residual deducted. (7) A line with `operatorShare` 0.5 contributes exactly 0.5 × its PV to cash NPV; the other half is listed under "Paid by others" or "Received by others". (8) A mixed operation with one owned and one leased land unit splits each line that serves the land by unit, except the fence line, which lies whole on its own land unit (9.3). Criteria 1–8 run on fixture lines, with 10.1 row 11 as the hand-checked fence case; rows 22 (Ranch B) and 35 (Ranch A) join the suite with those examples (9.1 step 5) |
| F7 | Death loss is a flat share of the herd, claimed by both modules (H4), and an expected loss is booked as certain cash | Expected-value form, as a **risk** line: shown as its own subtotal and never in cash NPV, BCR, IRR or payback. Default blank, with a note asking for the ranch's own history. Claims go to one `deathLoss:<cause>` pool in head per year | NAHMS gives death-loss benchmarks only, not effects of these technologies (4.4) | `claimₜ = eventsPerYear × headPerEvent × shareCaught` [head/yr], `valuePerUnit = classes[c].valuePerHead`; one `deathLoss:<cause>` pool per cause, claimed by every `riskLines` entry with that cause (9.6); replaces `deathLossPts` | S | F3, F9 | (1) Blank gives 0. (2) No risk input changes Cash NPV; each changes "Cash NPV including expected losses avoided" by exactly its PV. (3) `combine()` of two fixture modules defined in `tests/`, both claiming 100% of `deathLoss:water` at 0.15 events × 5 head, gives a combined claim of 0.75 head/yr, counted once in the risk subtotal, with a warning naming both modules (10.1 row 12) |
| F8 | Metric definitions and edge cases (M1, M2) | Replace "return on cost" with BCR = (PV(B) + PV(R)) / PV(C). Payback follows the state machine in 9.3. IRR follows the validity rules in 9.3, searched up to 10,000%. Show three NPVs: Cash, Cash including expected losses avoided, and Economic. Guard every division. The verdict sentence, every headline figure and the year-table note say "before tax" | Standard capital budgeting (U. Wyoming B-1302, July 2017; UF/IFAS FE1060). Before-tax labels: owner decision, 15 Oct 2026 | `analyze()` outputs; 9.3 Metrics | M | F3, F5 | 10.1 rows 1, 3, 4, 5, 14, 27 and 48 and the raw cash-flow case of row 17 pass (the Ranch B case of row 17 joins the suite with Synthetic Ranch B, 9.1 step 5; row 1's line under the verdict, from the N-year test, joins with B9, and its page check with the page switch, both 9.1 step 6). No NaN, Infinity or −99% can reach the page. Row 34 (before tax) passes once the page uses the new engine (9.1 step 6) |
| F9 | Overlap between modules (H4) | Each benefit line claims a physical quantity in a pool: `waterRuns` (runs/yr), `gatherHours` (h/yr), `deathLoss:<cause>` (head/yr), `fenceMiles` (mi). A pure `combine([a, b])` caps each pool at its baseline, pro rata, with a warning. A single module's claim above its own baseline is clamped. Phase 1 has no multi-module page; that and user allocation are L6 | Without a cap, two modules can each claim the same runs or the same deaths (H4; judgment) | Benefit line `{claim, valuePerUnit, pool}`; `POOLS` registry with `baseline(t, ctx)`; scale rule (9.6) | M | F1 | `combine()` of two fixture modules defined in `tests/`, both claiming 100% of `waterRuns` (10.1 row 9): the scaled claims sum to the baseline; each module's derived hours saved and paid hours cut scale by the same factor; the warning names both modules. A single module claiming 160 runs against a 148-run baseline is clamped to 148 with a warning |
| F10 | Provenance (§3.4 L2) | Every value the user did not type carries `prov = {cls, src, url, pub, dataYear, region, currency, note}` (9.2), where `cls` is A–E. The page shows a class badge, and synthetic [E] values have a badge visibly different from published vendor prices [C] and the ranch's own entries [D]. A price input may offer an optional "Use published vendor price" fill [C], labeled as vendor information, only where a first-hand published price was found (the vendor's or a dealer's own page, listing or flyer, dated or undated; 9.5 item 7); a price reported second-hand by the press or extension is never a fill; a typed quote replaces a fill [D]; with no published price, the field stays blank with "Quote required". A value from outside the US is never a default and is never converted to US dollars. The starting values become the labeled synthetic examples of section 11, with different, editable herd sizes, the synthetic-example banner, the example rate's label and review prompt, and the synthetic cost placeholders' label and flag (9.5 items 4 and 5). Near the verdict, the page says that published prices describe what the equipment costs and do not support the projected savings (9.5 item 1) | User requirement; the project's handoff notes (`HANDOFF.md`, not in the repository: "illustrative assumptions, not vendor prices"); owner decisions, 15 Oct 2026 (synthetic examples; hybrid pricing; example discount rate; US-first) | `FIELDS` metadata is replaced by the `prov` map (9.2); the "every preset fills every input" test is replaced (9.7) | L | — | (1) At 9.1 step 1, on today's model: a test reads `index.html`, `README.md` and `roi.js` and finds no occurrence of "1,000-cow operation", "come from published" or "starting values are published", the wording of the sentences that 9.1 step 1 replaces or corrects, so that no sentence there calls every starting cost a published list price. (2) With the examples (step 5): a test fails if any example value lacks `cls` and `src`, or if a [B] or [C] value lacks `url`, `pub` or `region`, or `currency` when it is money. (3) With the page switch (step 6): every non-user value on the page shows a class badge, the synthetic banner shows on every example, the published-prices sentence shows near the verdict, and 10.1 rows 33, 37 and 38 pass |

### 8.2 Build next: the highest-value improvements

B3, B4a, B7, B8 and B9 are built in phase 1 (marked "phase 1" below). B6 is listed first because it is built first
after phase 1: a manager presenting an investment decision to an owner or lender is part of the primary use (owner
decision, 15 Oct 2026). B1, B2 and B5 follow it, and B4b waits for research task R1 (8.4). The items that follow
phase 1 may use any phase-1 item in their acceptance tests; their "Depends on" cells name only the items they build
on directly.

| ID | Problem | Proposed change | Evidence or rationale | Inputs and formulas affected | Effort | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| B6 (first after phase 1) | No printable output, and nothing a manager can take to an owner or lender | **Owner and lender business case.** A print stylesheet and a "business case" section (the printable business case in 7.2 item 10), led by a one-page summary. It is built from phase-1 outputs, including the payback-target line and the "What would make it pay" panel (B9); the scenario columns (B1) and the today-vs-with table and risk-driver break-evens (B2) join the printout when those items are built | Lenders and owners review decisions on paper or PDF; a dated printout with provenance keeps synthetic values from being read as quotes (judgment). Commercial cow-calf operators are the primary users, with a workflow that helps ranch managers present investment decisions to owners or lenders (owner decision, 15 Oct 2026) | No new inputs. Print layout of the one-page summary, then the verdict with its payback-target line, the "What would make it pay" panel, the year table and assumptions, and the today-vs-with table and scenarios once built | M | F6, F8, F10, B9 | (1) The summary fits on one letter page and shows: the decision and the verdict; cash NPV and payback; the payback-target line (B9); cash needed by year; which values are quoted, published vendor information, reported vendor prices (not published list prices), synthetic or from the ranch's records; who pays and who receives, with any "Paid by others" and "Received by others" amounts; the main risks and what to verify first; the "before tax" label; the date and the tool version. (2) The whole business case prints on letter paper in ≤ 4 pages with no clipped tables. (3) It includes the provenance list and says "synthetic values present" whenever any [E] value is used. (4) It prints the "What would make it pay" panel (B9) with its notes |
| B1 | Sensitivity implies equal uncertainty (M5); drought years are not modeled | Scenario columns (conservative, expected, optimistic) for each input. The tornado and two-way grid run between them. A "drought year(s)" option, available in any column, sets head by class to a chosen share in chosen years. Design choices, such as the fence type, stay fixed across the columns; alternatives are separate sensitivity rows | 7.2 scenario columns. Drought is the main operating risk on the Plains: herds are culled and stockers may not be bought for a season (judgment; no source in this audit quantifies it) | `scenario[cons\|exp\|opt][path]` set through `setPath()`; `drought = {years: number[], headShare: {[class]: 0..1}}` multiplies `classes[c].head` and `enrolled[c].head` in those years | M | F3, F5, F10 | Editing one scenario value changes only that column's results. The caption says the scenarios are not a probability range. A drought option with headShare 0 for yearlings in year 3, under the row-16 commitment, reproduces 10.1 row 16 in that column, including the committed minimum |
| B2 | Rare-loss (risk) drivers have no break-even, and no view sets today's operation beside the proposal (7.2 item 4) | Break-evens for the risk drivers (head of death loss avoided per year), solved with the B9 solver on "Cash NPV including expected losses avoided" and labeled so. Add the "Today vs with the technology" table (7.2 item 4), built from each pool's baseline and claim, the EID compliance baseline (once B4b is built) and the cost lines. The break-evens of the cash drivers, in ranch units, are B9 (phase 1) | 7.2 items 4 and 6 | The B9 solver (9.3), with one driver per `riskLines` entry: events × head per event × value per head × share caught is one product, solved on `eventsPerYear` and reported as head lost a year (events × head per event); the table reads `POOLS` baselines and claims (9.6) and, once B4b is built, `baselineCostₜ` (9.3) | M | F9, B9 | (1) Each risk break-even gives a "Cash NPV including expected losses avoided" within $1 of zero, or says "none" with its range. (2) Ranch A expected, over its 10-year horizon: water-outage losses break even at 0.78 head a year (±0.01; entered 0.15 events × 5 head = 0.75). (3) Ranch A expected: the table shows summer runs 88 → 44 and miles 17,760 → 12,480, and its annual cash change (+$1,098) equals year-1 net cash in Appendix A |
| B3 (phase 1) | Implementation costs are missing, and the benefit ramp covers year 1 only (M3) | Year-indexed implementation lines: install (hours with `doneBy`, and dollars), training days, connectivity survey, desk and monitoring time, collar fitting and refits (handling formula, 9.3), battery swaps. A benefit ramp `ramp[i]`, i = 1..3, for the module's first three operating years (years startYear+1 to startYear+3; years 1–3 when the module starts at year 0) | MLA B.NBP.0505 (Queensland, Australia, 2011; data about 2009–11): management time was estimated to rise from 0 to 4 h/week on both demonstration properties (hours only; context, not a US default). CSU AgNext and USDA-ARS (2024 season): 23% of yearling steers needed collar adjustment; check fit every 45–60 days. Training 5–10 days (Nofence, DTN Mar 2025) and 7–10 days (Halter US site) [C] | `ramp[i]` multiplies each benefit line's claim in the module's i-th operating year, year startYear + i, for i = 1..3 (9.2, 9.3), except avoided capital (fence); implementation hours become cost lines (paid) or capacity reductions (unpaid); `handling` hours (9.3) | M | F1, F5 | Ramp 50/80/100 gives exactly 50%, 80% and 100% of each benefit line in years 1, 2 and 3, and 100% after. A ramp of [1, 0.5, 0.7, 0.9] gives 50%, 70% and 90% in years 1–3 and 100% from year 4: `ramp[3]` is not carried forward (9.2). The ramp changes no cost line. Install hours done by a paid hand are a year-0 cost; done by the owner, they reduce year-0 capacity only |
| B4a (phase 1) | EID is treated as one blob (M4) | Split into tags (free tags: how many and for which years, at $0), reader, scale, software, and program premium (head in program × cwt × premium − verification fee). Step 3 asks "Does the EID rule apply to cattle you move?" for each class and records the answer. Until B4b is built, every tag is a project cost, and a "yes" shows: "Compliance treatment is pending verification of the rule's current status. All tags are counted as project costs here, which may understate the case for EID if your tags are required anyway. Check with your state veterinarian." | APHIS final rule, 89 FR, 9 May 2024 (Doc. 2024-09717): readers not required, free tags offered "as long as funding is available". McCabe et al. 2018 (2010–2017 premium). The compliance treatment waits for research task R1 (owner decision, 15 Oct 2026) | `eid.ruleApplies[c]` ("no" by default; recorded; changes no line until B4b), `eid.freeTags = {qty, years}` (up to `qty` free tags in each listed billing year, 9.3); separate tag, reader, scale and software lines; `premiumₜ` (9.3) | M | F3, F5 | Ranch C expected ("Rule applies: no") reproduces Appendix A (−$9,895). Answering "yes" for the cows leaves every line and the cash NPV unchanged and shows the notice (10.1 row 36). Free tags on Ranch C expected: 300 in year 0 raise cash NPV by exactly $942 (to −$8,953); 285 more in each of years 1–7 raise it by a further $4,822.88 (to −$4,130) |
| B4b (after R1) | Tags required by rule are charged to the technology (M4) | Compliance baseline: for each class the rule covers, the required tags (less free tags) sit in a baseline as well as in the project, so the analysis counts only the increment over the compliance baseline. Built only if R1's research note gives a "go" on this design; until then the B4a notice stands | APHIS final rule, 89 FR, 9 May 2024 (Doc. 2024-09717): official EID for certain classes moved interstate, most beef feeders under 18 months exempt. Rule status: research task R1 (8.4); owner decision, 15 Oct 2026 | `ruleApplies[c]` applied; `baselineCostₜ` and `incrementₜ = projectCostₜ − baselineCostₜ` (9.3) | S | R1, B4a | When the rule applies to a class, that class's required tags appear in both baseline and project and net to zero. With the rule applying to the cows, Ranch C expected is −$8,877 (§11) |
| B5 | No cost share or financing | Cost share: amount, year received and conditions, with a reminder that some programs exclude subscriptions or data fees or need minimum head. Financing in a separate *lender's cash-flow view*. The project NPVs stay unlevered at the real discount rate | AZ NRCS virtual fence cost share (az2105, Jan 2025): minimum 51 cattle. FSA ECP-105 (27 Aug 2026): 125 head or more, cattle over 440 lb, lease and data fees not covered | `costShare = {dollars, year, note}` as a cash benefit line in the year received; `loan = {amount, nominalRate, termYears}` and an inflation rate used only in the lender view, which restates today's-dollar flows in nominal dollars before subtracting `debtServiceₜ` (judgment) | M | F5 | Turning financing on changes none of the three NPVs. Debt service matches an amortization check ($10,000 at 6% over 5 years = $2,373.96 a year). Cost share appears in the year received |
| B7 (phase 1) | Water monitoring inputs are not in ranch units; winter runs and visits needed anyway are ignored | Water module inputs: monitors; season blocks (weeks, runs per week, miles and hours per run, share avoided, a "tanks freeze / water checked on the feeding route" flag, minimum pasture visits per week needed anyway); who drives (`labor.cut`: `laborUnit`, `unitsCut`, `hoursPerUnit`, `paidRate`, `salary`, `loadPct`, as in 9.4); variable \$/mile; added monitoring time; outage history (risk line); an optional offset "losses from fewer physical checks", blank by default | USU Extension example (undated). PIRSA (South Australia, 2022 prices): "Monitoring devices do not eliminate the need to inspect tanks and troughs, but they can be checked less frequently." MLA B.NBP.0505 (Queensland, Australia, 2011): one producer withdrew because "remote technology could not remove the need for visual inspections". The two Australian sources support the minimum-visit floor; no figure from them is used. Frozen tanks and feeding-route checks (judgment) | Per block: `runs_b = runsPerWeek_b × weeks_b`; `shareAvoided_b ≤ max(0, (runsPerWeek_b − minVisitsPerWeek_b) ÷ runsPerWeek_b)`; the freeze flag sets the default share to 0%; mileage and hours (9.3); pool `waterRuns` | M | F1, F5, F7, F8, F9, B3 | USU example (one served class with head > 0, minimum visits 0, T = 10): one block of 26 weeks × 3 runs × 40 mi at $0.50/mi gives baseline mileage of $1,560/yr; at 50% avoided the benefit is $780/yr; a single $1,800 monitor (capital, `lifeYears` 10, straight-line residual) with no subscription and no labor (install not counted, as in USU) gives cumulative cash −1,800, −1,020, −240, +540 in years 0–3, so payback is 2.31 years (±0.01). 4 runs a week with 2 minimum visits caps the share at 50%. A freeze-flagged block defaults to 0%. Ranch A expected reproduces Appendix A |
| B8 (phase 1) | Shared scenario links will break | Version the URL hash: `v=2&m=<moduleId>&x=<exampleId>&s=<base64url(JSON of the state keys that differ from the example)>` (9.5 item 8). An empty hash opens Synthetic Ranch A; a non-empty hash without `v` is v1. A pure `migrateV1(params)` in a DOM-free module, with a frozen `V1_PRESETS` copy, maps v1 links using the documented table in 9.5 item 8. A banner names the dropped fields | F5 renames fields, so v1 links would silently mis-map: `readHash()` copies any `FIELDS` key in the link onto the current preset (`app.js:28-32`). `app.js` runs DOM code when imported, so migration code placed there cannot be tested in node | Hash format; `migrateV1()`; `V1_PRESETS`; mapping table (9.5 item 8) | M | F3, F5, F10 | Snapshot tests for each of the three `#preset=<name>` links, one with `&head=500&years=5`, one with `&years=5` and `#head=500` match stored v2 states and banner text, and the `&head=500&years=5` state equals the one written out in 9.5 item 8. A state survives the round trip state → link → state unchanged (9.7). No v1 link throws. Values from any link pass the same validation as typed values (10.1 row 29) |
| B9 (phase 1) | The page says whether a technology pays over the horizon, but not whether it pays within the owner's payback target or what would have to be true for it to do so; today's break-evens are in model units (§3.7) | **What would make it pay.** A payback target, `settings.paybackTarget` (whole years, 5 by default, editable, shown in step 2 next to the horizon). The N-year test reruns the whole analysis with the target in place of the horizon (9.3) and gives a second line under the verdict: "Pays for itself within 5 years (counting equipment value left at year 5)" or "Does not pay for itself within 5 years". A panel beside the verdict shows, for each driver that the module's `PAYBACK_DRIVERS(a)` returns (herd size in every module), the value at which the N-year test's cash NPV and the full-horizon cash NPV reach zero, in ranch units, with its direction ("at least" or "at most") and every other input fixed. When the test fails, the verdict names the two drivers that need the smallest change. The panel replaces today's break-even table. The examples are never tuned to reach a result; Synthetic Ranch D, a good-fit cow-calf virtual-fence example (section 11), joins them with the virtual fence module (9.1 step 5) | The owner asked for a 5-year target and, rather than adjusting the example herd sizes until each technology showed a return, for the tool to show what would make each technology pay (owner decision, 15 Oct 2026). Today's break-even search (`roi.js:142-151`) already solves one input by bisection, but in model units, over 0 to 10 times the entered value. The N-year line is not called payback, because it counts residual value (judgment) | `settings.paybackTarget` and `PAYBACK_DRIVERS(a)` (9.2); `targetTest()` and `solveDrivers()` (9.3); the verdict lines and the panel (9.5 items 1 and 9); the target input (9.5 item 7); the link (9.5 item 8) | M | F1–F10, B3, B4a, B7 | (1) The 5-year test of every example reproduces section 11 and Appendix A, and a passing case shows "Pays for itself within 5 years (counting equipment value left at year 5)" (10.1 row 39). (2) Each solved value gives a cash NPV within $1 of zero for its horizon and matches 10.1 rows 40, 42 and 43 within 0.01 of its unit; each value the panel shows, entered as is, passes its test. (3) The "none", "all" and "n/a" states (row 41), the validation clip (row 42), the herd-size "at most" case (row 43), a target beyond the horizon (row 44) and the scaled drivers (row 46: herd size with free tags or a contract minimum, and a labor cut entered by year) pass. (4) Over the full horizon the solver gives the section 11 break-evens: Ranch A expected day-labor days 25.58 and Ranch B expected subscription $0.969/head/month, each ±0.01 (rows 42 and 43). (5) The verdict sentences of rows 39 (Ranch C, one driver; Ranch A, two), 40 and 43 (two drivers) and 41(d) (no driver) pass, and row 45 (the target input and links) passes once the page uses the new engine (9.1 step 6); row 45's link part relies on B8, which 9.1 step 6 builds before B9 |

### 8.3 Add later: new modules and advanced capabilities

| ID | Problem | Proposed change | Evidence or rationale | Inputs and formulas affected | Effort | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| L1 | Monitoring is conflated with water supply; a rancher choosing among solar, generator, utility line and hauling has no tool (6.3 #1) | Water infrastructure and solar pumping module: compares alternatives, with the EQIP share and an optional forage gain that defaults to 0. Site visits avoided share the `waterRuns` pool with monitoring | U. Wyoming B-1289.2 (Aug 2016): installed and equivalent annual costs of solar, generator and utility power; NMSU B-829 (Nov 2023): grazing-capacity reductions by distance to water | `pumpType`, capital and life per alternative, fuel and site visits per week, `EQIP` dollars and year (through B5 cost share), forage gain (advanced) | L | F1–F10, B5 | Reproduces B-1289.2's equivalent annual costs (solar $992, generator $2,028, utility $918) from its own inputs, within the document's rounding. With water monitoring claiming 50% of runs and this module 60% of visits on the same water points, `combine()` keeps the combined claim ≤ 100% of baseline runs and warns |
| L2 | A cow-calf manager cannot test whether calving monitoring would pay (6.3 #2) | Calving monitoring module framed as a break-even: "it pays if it saves N calves a year". Calves saved default to blank; accuracy limits are shown | Mostly dairy evidence. In Miller et al. 2020 (UK, 2017 data; beef cows), a research tail accelerometer, not a commercial unit, predicted calving within a 5-hour window with MCC 0.31 (6.2) | Devices, price, subscription, calvings, `classes.calvesBorn.valuePerHead`, night-check hours (`doneBy`), calves saved as a risk line in pool `deathLoss:calving` | M | F1–F10 | With calves saved blank, cash NPV = −PV(costs) and the page shows the break-even calves per year, solved on "Cash NPV including expected losses avoided" to within 0.01 head |
| L3 | Losses and gathering time on large or leased pasture (6.3 #3) | Standalone GPS tracking module, only if target users run on large or leased pasture. Break-even framing (head recovered per year, gathering hours). Not available on animals that already wear virtual fence collars | SDSU Extension (updated 13 Feb 2026): tags "approximately $70 to $300 per unit" plus software fees. MLA P.PSH.1315 (Australia, Feb 2026) *modelled* rather than measured ROI | Tags, price, software, head recovered (risk line, `deathLoss:theftOrStray`), gathering hours (pool `gatherHours`) | M | F1–F10 | The module is unavailable when virtual fence enrollment covers the same classes. Gathering hours share `gatherHours` with virtual fencing, so `combine()` keeps the combined claim ≤ baseline |
| L4 | Published defaults go stale, and some series stop | Price and wage update helper: a dated "last checked" stamp on each published default, a "stale" badge when a default is older than its update interval, and a README section listing the update cadence from 5.3 | NASS discontinued the Agricultural Labor Survey behind its Farm Labor wage report (FR Doc. 2025-16831, published 3 Sept 2025), so the wage default will need a new source | `prov.pub`, `prov.dataYear`, an update interval per input | S | F10 | With a fixed test clock, a default whose last-checked date is older than its interval shows a "stale" badge, and one inside its interval does not |
| L5 (not in the initial version) | Purchases and subscriptions are taxed on different timing, and the tool has no after-tax view | Not in the initial version: until it is built, every result is labeled "before tax" (9.5). Later, an optional tax view: Section 179 or depreciation timing in a separate after-tax view, marked "not tax advice" | Judgment; no tax source was researched for this audit. No after-tax module in the initial version: owner decision, 15 Oct 2026 | Marginal tax rate, depreciation method per capital line; after-tax flows kept apart from the cash flows | M | F5 | The after-tax view never changes the pre-tax cash NPV. The view carries the "not tax advice" label |
| L6 | Phase 1 caps shared pools pro rata inside `combine()`, but users cannot run several modules on one page or decide how a shared saving is split | Combined-portfolio view: several modules on one ranch, with user allocation of each pool's quantity among modules, replacing the pro-rata default | Judgment; follows from F9 | `allocation[pool][moduleId]` shares | M | F9, and at least one of L1–L3 | Allocations summing to 100% give combined claims equal to the baseline; allocations above 100% are rejected; with no allocation entered, the results equal phase-1 `combine()` |

### 8.4 Research task before the compliance baseline

The owner asked that the EID rule's status and the litigation be verified as a separate research task before any
compliance baseline is implemented (owner decision, 15 Oct 2026). R1 needs no code and depends on nothing, so it can
run at any time, including during phase 1; only B4b waits for it.

| ID | Problem | Proposed change | Evidence or rationale | Inputs and formulas affected | Effort | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| R1 | The compliance baseline (B4b) rests on the APHIS EID rule, whose current status is unconfirmed: a lawsuit is pending, settlement talks are reported, and no later ruling, stay or rescission was found through 15 Oct 2026, though that absence could not be proven (§4.3) | **Verify the EID rule's status and the litigation.** Check the D.S.D. docket (*R-CALF USA et al. v. USDA*, case 5:24-CV-05085-ECS) for entries after the 5 Mar 2026 summary-judgment motion; the Tri-State Livestock News settlement report; the APHIS pages and the Federal Register for any stay, amendment, rescission or settlement; and current state free-tag programs. Output: a dated research note with sources, an updated §4.3 and evidence-table rows, and a go or no-go on the baseline design | §4.3 (Litigation; Free tags in 2026); NCLA case page; BEEF, 10 Mar 2026; Tri-State Livestock News headline (date unknown; article not opened). Owner decision, 15 Oct 2026 | None in the model. Its go or no-go decides whether B4b is built as specified in 9.3 | S | — | Every claim in the note has a source and a date. The note states the rule's status as of its date. §4.3 and the EID rule row in §5.3 are updated. The note ends with a go or no-go on the B4b design |

---

## 9. Developer-ready specification: phase 1 (F1–F10, B3, B4a, B7, B8, B9)

In [`phase1-spec.md`](phase1-spec.md).

## 10. Validation plan

In [`phase1-spec.md`](phase1-spec.md).

---

## 11. Synthetic ranch examples

> **All four ranches are synthetic.** They are not based on any real operation, they are not the site owner's
> operation, and none is named after a real ranch. Their herd sizes differ (900 cows, 1,200 yearlings, 300 cows, 400
> cows), and every value can be edited on the page. They replace the current starting values, which describe a
> 1,000-cow operation (9.5). On the page Ranches A, B and C each carry the banner "Synthetic example ranch. Made-up
> numbers for demonstration, not any real operation's data." Ranch D, the good-fit example, carries its own banner:
> "Good-fit synthetic example: conditions where this technology is most likely to pay. Made-up numbers for
> demonstration, not any real operation's data. Check whether your operation matches." These four ranches therefore
> meet the decision on examples (owner decision, 15 Oct 2026). Ranches A, C and D are commercial cow-calf operations,
> the tool's primary user; Ranch B is a stocker operation, which the tool supports as a secondary user (owner
> decision, 15 Oct 2026). Ranch D is the cow-calf virtual-fence example, and Ranch B stays as the stocker case.
>
> No example's herd size or other input was tuned to reach a result. Adjusting herd sizes until each technology
> showed a 5-year return was considered and not chosen (owner decision, 15 Oct 2026). Instead, every ranch shows the
> five-year test and what would have to be true for the technology to pay for itself within 5 years (B9; see
> 11.5).
>
> **What the classes mean here.** Values marked [C] are vendor information: published list prices, or vendor claims
> as the vendor or the press reported them, dated where the source gives a date. They are not endorsements. On the
> page a [C] published list price is labeled "Vendor information: published list price (source, date). Not an
> endorsement. Replace with your quote." When the source is undated, as the dealer flyer behind Ranch A's monitor and
> subscription prices is, the label reads "Vendor information: published list price (source, undated; checked
> `<date checked>`). Not an endorsement. Replace with your quote." (for Ranch A: "All-Tex dealer flyer, undated;
> checked 15 Oct 2026"). A quote the user types replaces a [C] value as [D].
>
> Ranch B's and Ranch D's subscription and infrastructure values are a different kind of [C] value. The tower-based
> leased-collar virtual fence system has no published US price (the vendor's US site publishes none, checked 15 Oct 2026; [S21]).
> Its figures ("less than $7 per head per month" and "starting at $4,500", DTN, 31 Mar 2025; "$66 service per year",
> Reuter, 23 Jan 2025) are vendor statements reported second-hand by the press and by extension slides (§4.1). Here
> they are example values only. The page labels them "Vendor information: reported price (source, date), not a
> published list price. Not an endorsement. Replace with your quote." (9.5 item 4; for the $7 subscription the source
> and date read "DTN, 31 Mar 2025"), never as published list prices, and never offers them as a "Use published vendor
> price" fill. They keep their value and label after "Analyze my operation"; typed over, they become the user's
> quote [D]; cleared, they show "Quote required" (9.2, 9.4, 9.5 items 4 and 7).
>
> Values marked [E] were chosen by me to demonstrate the model; no user entered them. They include every operating
> assumption (runs avoided, hours, days cut, outage events, residual values). They also include eight synthetic cost
> placeholders, prices or costs for which no published price was found: Ranch A's mounting materials ($750) and
> batteries and repairs ($1,000 in years 4 and 8); Ranch B's conservative infrastructure ($9,000), collar-loss charges
> ($3,000/yr, conservative column only) and contract labor rate ($25/h, which Ranch D also uses; the one rate prices
> both the contract handling hours and the contract hours cut); and Ranch C's platform materials ($800), dewormer
> price ($0.45 per application) and software ($360/yr, set at a published plan price for up to 250 animals, below
> this herd's size). They are kept because dropping a cost would understate costs and flatter the
> result. Each is shown on the page as "Synthetic placeholder, not a price. Replace with your quote." and is marked
> "synthetic placeholder" in the tables below. While an example is loaded unchanged, the label shows and the verdict
> carries no placeholder note. When a user starts their own analysis, each placeholder keeps its value but is
> flagged, and the verdict carries "Includes synthetic cost placeholders" until each is replaced or confirmed, the
> same mechanism as the discount-rate review below (9.2, 9.3, 9.5). Results are computed either way, and confirming a
> placeholder changes no number. §12 lists this treatment as an open item for the owner to confirm, with this as the
> recommended default. The reference prototype does not implement these flags (Appendix A). The page gives [E] values
> a badge visibly different from [C] prices and the ranch's own entries [D]. The [C] prices describe only what the
> equipment costs. None of them supports a projected saving: every saving in these examples
> rests on at least one [E] assumption, so it stays "estimated" (§7.3; owner decision, 15 Oct 2026).
>
> **How the settings were chosen.** Before any numbers were run, each technology was placed where the independent
> evidence gives it its best chance, and the expected column uses the central published value where one exists:
> - Ranch A has long, frequent water routes and some hired help, the conditions in which the Australian
>   demonstrations (Ashley et al. 2008; MLA B.NBP.0505, 2011) reported savings and for which the USU worked example
>   (Utah, undated) computes them.
> - Ranch B would otherwise build interior fence, the situation in which Arizona Extension (az2117, March 2025)
>   found virtual fencing most likely to be cost-effective.
> - Ranch C is a mid-size cow-calf herd selling at a local auction, a common US setting.
> - Ranch D is a cow-calf herd on large pastures that would otherwise build permanent interior cross-fence for a
>   rotation, the same situation, with collars on cows only. It was added later as the good-fit example (owner
>   decision, 15 Oct 2026). Its inputs were fixed before any result was computed and were not adjusted afterwards.
>
> All four are set in the US, the tool's default context [E]. Every dollar figure below comes from a US source or is
> [E]. Studies from Australia and Canada supply only shares of runs, hours and days, and a few qualitative findings
> (that monitoring does not remove the need to inspect; that the key benefit of electronic ID is labor efficiency,
> which Ranch C does not get; that virtual fencing is not recommended for juvenile animals; that uncollared calves
> are free to roam while their collared dams stay inside), each named with its country and year. They describe the
> operations studied, whose route lengths, herd sizes, labor costs and rules can differ from a US ranch's, so here they serve as context, a range
> check or a sensitivity row, never as the only support for an expected value, and none of their money values is
> used or converted to US dollars (owner decision, 15 Oct 2026).
>
> Conservative and optimistic values use the ends of published ranges where they exist, and my judgment [E] where
> they do not. Four inputs do not follow these rules exactly, by my judgment [E]:
> - Ranch A's added monitoring time is 0.5–2 h/wk, below the 4 h/wk the MLA demonstration estimated for both of its
>   properties (MLA B.NBP.0505, Queensland, Australia; data about 2009–11). At 4 h/wk the expected economic NPV is
>   −$11,126 instead of +$10,788; cash NPV is unchanged.
> - Ranch A's conservative share of summer runs avoided is 25%. The published low of 0% (De Rose Hill, Australia;
>   Ashley et al. 2008) is shown as a sensitivity row instead.
> - Ranch B's subscription has no central reported value: the press-reported "less than $7 per head per month" is a
>   ceiling, so the expected column uses $7 and the optimistic column uses Reuter's $66 a year (about $5.50 a month).
> - Ranch C's expected retag rate is 1.5%/yr, the 2-year rate, although yearly failures reached 3.7–5.1% in years
>   3–5. At 4.3%/yr the expected cash NPV is −$10,037 instead of −$9,895.
>
> After the first results, several conventions and inputs were tightened for realism (advance billing, a real
> discount rate, seasonal water runs, labor cut in whole days, a fixed fence type, weight gain kept out of cash, and a built-up handling labor estimate). Taken together, they lowered
> every ranch's result in every scenario. The changes are listed under each ranch. None was chosen to reach a
> particular result. Ranch D was built after these changes, under the same conventions, so it has no earlier result.
>
> **Conventions (spec section 9.3):** 7% real discount rate [E], prices in today's US dollars, subscriptions billed at
> the start of each year, operating costs and benefits at the end of each year, except the avoided fence, which
> counts in the year it would have been built. "Cash NPV" excludes expected-value
> risk lines, owner time and production effects not taken from the ranch's own records; those appear on separate
> rows. The numbers come from the reference prototype of the section 9 formulas, in [`prototype/`](prototype/)
> beside this document (Appendix A). Results are given to the dollar only so the regression test (9.7) can match them; under the 7.3 rounding rule the
> page would show them to the nearest $1,000 (Ranch A expected: about −$11,000). Paybacks are rounded to one decimal
> here; the page shows two (9.3), for example 4.59 years for Ranch A optimistic and 2.67 years for Ranch C optimistic
> (Appendix A). The three columns are three sets of assumptions, not a statistical range, and carry no stated
> probability. Ranch D has one set of inputs.
>
> Four more conventions follow the owner's decisions of 15 Oct 2026:
> - **Discount rate.** The 7% real rate is the examples' assumption, not a recommendation. The owner has not selected
>   a rate, and 7% is not presented as right for every operation. On the page each example loads with the rate
>   visible and editable, labeled "Example assumption (real rate), not a recommendation. Review it for your
>   operation.", so results appear at once. When a user starts their own analysis, the rate keeps its value, a
>   "Review this rate" prompt appears, and the verdict carries "Discount rate not yet reviewed" until the user
>   confirms or edits it; results are never blocked (§7.1, 9.5). Ranch A's 3% and 10% rows show how far a result
>   moves with the rate.
> - **Before tax.** Every result in this section is before tax. The initial version has no after-tax module (L5).
> - **Land tenure and who pays.** Ranches A, B and D are on owned land, and Ranch C's EID lines do not depend on
>   tenure. So the operator pays every cost and receives every benefit (operator share 1 on every line) [E], and
>   nothing is listed under "Paid by others" or "Received by others" (F6, 9.3). The one exception is Ranch B's
>   landlord-fenced lease, a sensitivity row in which the fence saving goes to the landlord.
> - **Five-year test (B9).** Each ranch is also re-run with a horizon of 5 years (`settings.paybackTarget`, default
>   5) and every other input unchanged. Straight-line residuals, including the lost residual of avoided fence, are
>   valued at year 5; Ranch C's residual, entered as a percentage of cost, is used as entered (9.3), and the panel
>   notes this. "Pays for itself within 5 years" means that test's cash NPV is $0 or more (operator share, before
>   tax, cash lines only, at the same 7% example rate). It is not called payback, because it counts the equipment
>   value left at year 5 (judgment). The headline stays the full-horizon cash NPV; the 5-year result is a second
>   line under it.

**Outcomes at a glance (expected scenario, before tax; Ranch D has one scenario)**

| Ranch | Cash NPV | 5-year test: cash NPV | Plain-English reading |
|---|---|---|---|
| A: water monitoring | **−$11,079** | −$7,648 | Close to break-even only if a synthetic outage-loss value is counted; cash alone falls short |
| B: virtual fence | **−$229,531** | −$175,519 | Strongly negative in every scenario, including the optimistic one |
| C: EID tags, reader and scale | **−$9,895** | −$8,678 | Mildly negative; positive only with a verified-program premium the ranch does not have today |
| D: virtual fence, good fit | **−$9,789** | −$6,871 | Close to break-even and slightly negative even in a good fit; turns on how much fence it really replaces |

### 11.1 Ranch A: 900-cow northern cow-calf, 10 remote water points, remote water monitoring (10-year horizon)

**Inputs by scenario**

| Input | Conservative | Expected | Optimistic | Class |
|---|---|---|---|---|
| Land tenure | Owned: one owned land unit with all 10 water points; the ranch provides and checks water, and the operator pays every cost and receives every benefit (operator share 1 on every line) | same | same | [E] |
| Monitors | 10 × $1,490 = $14,900, plus $750 mounting | same | same | [E] 10 water points; $750 mounting (10 × $75), synthetic placeholder; [C] $1,490 each (All-Tex dealer flyer, undated; checked 15 Oct 2026) |
| Monitor life | 10 years (no residual at year 10) | same | same | [B] NRCS E614A enhancement life span, 10 years (Sept 2024) |
| Subscription | 10 × $365 = $3,650/yr, billed in advance (years 0–9) | same | same | [C] same All-Tex flyer, undated; checked 15 Oct 2026 |
| Batteries / repairs | $1,000 in years 4 and 8 | same | same | [E] synthetic placeholder |
| Water route today, summer block | 22 weeks × 4 runs = 88 runs/yr; 120 mi and 6 h per run | same | same | [E] |
| Water route today, fall–winter–calving block | 30 weeks × 2 runs = 60 runs/yr; 120 mi and 6 h per run | same | same | [E] |
| Share of fall–winter runs avoided | 0% (tanks freeze; water checked on the feeding round) | 0% | 0% | [E], per the spec's freeze/feeding-route flag |
| Minimum summer visits needed regardless of water (cattle, bulls, mineral) | 2 a week, which caps summer runs avoided at 50% | same | same | [E]; PIRSA (South Australia, Feb 2022 prices): monitoring does "not eliminate the need to inspect" |
| Share of summer runs avoided | 25% | 50% | 50% (the 2-visit floor blocks Ashley et al.'s stated cut to one inspection a week: 75% from 4 a week, a general statement, not a measured result; Australia, 2008) | [E]; the expected and optimistic 50% is set at the share the USU (Utah) worked example assumes [B]; PIRSA (South Australia, 2022) assumes the same 50% (non-US context only) |
| Variable vehicle cost | $0.30/mi | $0.40/mi | $0.50/mi | [E], chosen across the published range: [B] AAA Sept 2025 pickups, fuel ≈$0.17–0.18/mi + maintenance, repair and tires ≈$0.11/mi (≈$0.28–0.29/mi); TAMU 2012 ≈$0.47/mi variable (derived); USU's worked example uses $0.50/mi |
| Day-labor days not hired (8-h days) | 0 | 16 | 33 (all avoided summer run hours) | [E] |
| Day-labor rate | $18.72/h × 1.10 load × 8 h = $164.74/day | same | same | [A] NASS Northern Plains livestock wage, Apr 2025; [B] ≈10% legally required benefits (BLS ECEC, June 2025) |
| Added monitoring time (owner) | 2 h/wk | 1 h/wk | 0.5 h/wk | [E]; one Australian demonstration estimated +4 h/wk of management time on both of its properties (MLA B.NBP.0505, Queensland; data about 2009–11; see sensitivity rows) |
| Water-outage losses avoided (expected value, **risk line**) | not counted | 0.15 events/yr × 5 head × $2,700 × 75% caught | 0.25 × 5 × $2,700 × 90% | [E]; the evidence table says to leave this blank without the ranch's own history |
| Owner time | valued at $20/h in the economic view only; includes 30 h of unpaid install time in year 0 (−$600) | same | same | [E] |

**Calculated results**

| | Conservative | Expected | Optimistic |
|---|---|---|---|
| **Cash NPV** | **−$38,863** | **−$11,079** | **+$12,299** |
| Benefit-cost ratio (cash) | 0.13 | 0.75 | 1.28 |
| Cash payback | none within 10 years | none within 10 years | 4.6 years |
| IRR | below 0% | below 0% | 18.7% |
| Risk line: expected outage losses avoided (PV) | $0 | $10,667 | $21,334 |
| Cash NPV including expected losses avoided | −$38,863 | −$412 | +$33,633 |
| Owner hours freed per year (net of added monitoring time) | 28 h | 84 h | −26 h (all avoided hours were paid day labor) |
| Economic NPV (adds the risk line and owner time at $20/h) | −$35,530 | +$10,788 | +$29,381 |
| 5-year test: cash NPV (B9) | −$23,867 | −$7,648 | +$6,000 (pays for itself within 5 years) |

**Sensitivity rows (expected scenario, one change at a time)**

| Change | Cash NPV |
|---|---|
| None (expected) | −$11,079 |
| Fall–winter runs also 50% avoided (an open-water southern ranch: freeze flag off, 1 of the 2 weekly visits still needed; day-labor days and the Northern Plains wage unchanged) | −$965 |
| No runs avoided, as at De Rose Hill (Ashley et al. 2008, Australia), so no day labor is cut either | −$44,426 |
| Added monitoring time 4 h/wk, as estimated for both properties of one Australian demonstration (economic NPV −$11,126; owner hours freed −72 h/yr) | −$11,079 (cash unchanged) |
| Discount rate 3% real | −$8,898 |
| Discount rate 10% real | −$12,297 |
| Day-labor days needed for cash NPV = 0 | ≈25.6 days (entered: 16; maximum possible: 33) |

**What it shows**
- In cash, the expected case falls about $11k short. Its cash benefits are $14.8k PV of mileage and $18.5k PV of
  day labor not hired, against $44.4k PV of costs.
- The subscription ($27.4k PV) costs nearly twice as much as the monitors.
- The result turns on two questions the rancher can answer: how many summer runs would really stop, and how many
  whole days of hired help would go. The synthetic outage value nearly closes the gap (cash NPV including expected
  losses avoided: −$412). It is shown as a separate risk line, not as cash, because it is an expected value of rare
  losses with no ranch history behind it (spec 9.3), not because of its size.
- Changes from the first results: non-summer runs avoided set to 0%; a summer visit floor; labor in whole
  days; advance billing; 7% real rate; the outage value moved out of cash. Before these changes the expected result
  was positive, with the outage value counted as cash.

### 11.2 Ranch B: 1,200 yearling stockers, 150-day summer season, virtual fence instead of 8 miles of new interior fence (7-year horizon)

**Inputs by scenario**

| Input | Conservative | Expected | Optimistic | Class |
|---|---|---|---|---|
| Land tenure | Owned grass: one owned land unit. The operator would build the interior fence, pays every cost and receives every benefit (operator share 1 on every line) | same | same | [E]; see sensitivity rows for a landlord-fenced lease |
| Subscription | $7/head/month billed on all collars for 12 months = $100,800/yr | $7/head/month × 5.5 months (season plus training and removal) = $46,200/yr | $5.50/head/month (Reuter's $66/yr ÷ 12) × 5 months = $33,000/yr, assuming the quote bills grazing months only, not training and removal | [C] vendor statements reported second-hand, not published list prices (no US price is published): DTN, 31 Mar 2025, "less than $7 per head per month"; Reuter, 23 Jan 2025, "$66 service per year"; billing basis needs a quote |
| Billing timing | in advance, years 0–6 | same | same | spec 9.3 |
| Infrastructure | $9,000 | $4,500 | $4,500 | [C] "starting at $4,500", a vendor statement reported by DTN (31 Mar 2025), not a published list price; [E] conservative $9,000, twice the starting price, synthetic placeholder |
| Collar on at receiving and off at shipping | 1,200 head × 2 events × 2.0 min × crew of 4 = 320 h | × 1.5 min × 4 = 240 h | × 1.0 min × 3 = 120 h | [E] |
| Refit gathers (growing cattle) | 3 gathers × 3 riders × 8 h = 72 h | 2 × 3 × 8 = 48 h | 2 × 2 × 6 = 24 h | [E]; [B] CSU AgNext/USDA-ARS fact sheet: "check collar fit at least every 45-60 days"; 27 of 118 yearling steers (23%) needed a collar adjustment over a 114-day season |
| Training checks for the new group | 10 days × 2 riders × 8 h = 160 h | 7 × 2 × 6 = 84 h | 5 × 1 × 6 = 30 h | [E]; [B] 3–7 days in research (Boyd et al. 2022, Oregon: 6 days; U. Alberta, Canada, 2025: 5–7 days; Gadzama et al. 2025 review: 3–7 days); [C] 7–10 days (Halter US site, 2026) |
| Contract labor rate (all handling paid, cash) | $25/h | same | same | [E] synthetic placeholder |
| Collar loss charges | $3,000/yr | $0 (assumes the quote covers loss) | $0 | [E]; the conservative $3,000/yr is a synthetic placeholder (the $0 columns are not); needs the vendor's loss terms |
| Interior fence avoided in year 0 | 8 mi × $4,300 (2-strand polywire) | same | same | [E] 8 miles, built in year 0; [B] $4,300/mi (Missouri G1193, Jan 2024 prices) |
| Fence life and upkeep | 4 years (rebuilt in year 4), 5%/yr upkeep, 25% residual at year 7 subtracted | same | same | [B] Iowa State FM-1855 Table 6 (polywire 4 yr / 5%). Its text says the polywire "will likely last about 4–5 years" and the non-wire or tape components about 25 years, so rebuilding the whole fence in year 4 likely overstates the avoided rebuild in the technology's favor |
| Contract hours cut for moving and gathering (not health checks) | 0 | 200 h × $25 | 400 h × $25 | [E] |
| Extra weight gain | not counted | not counted | 0.1 lb/day × 150 days × 1,176 head sold (98% of 1,200; `production.soldShare` 0.98, 9.2) × $3.40/lb, **economic view only** | [E] unsupported; $3.40/lb is a sale price per pound I chose [E], used as an upper bound on the value of gain, which is normally far lower (§5.3 illustrates about $0.79 per added lb for 526–573 lb steers) |

**Calculated results**

| | Conservative | Expected | Optimistic |
|---|---|---|---|
| **Cash NPV** | **−$616,250** | **−$229,531** | **−$99,789** |
| Benefit-cost ratio (cash) | 0.09 | 0.29 | 0.54 |
| Cash payback | none within 7 years | none within 7 years | none within 7 years |
| Contract handling hours per year (cash cost) | 552 h | 372 h | 174 h |
| Economic NPV (adds the unsupported gain) | −$616,250 | −$229,531 | +$223,439 |
| 5-year test: cash NPV (B9) | −$470,813 | −$175,519 | −$76,811 |

**Sensitivity rows (one change at a time)**

| Change | Cash NPV |
|---|---|
| Expected, as above | −$229,531 |
| Expected, leased grass where the landlord provides fence, on a lease of 7+ years or one expected to renew (the operator's fence benefit is $0 and the fence saving is listed under "Received by others"; every other line stays the operator's) | −$294,088 |
| Expected, avoided fence is 6-wire high-tensile ($15,100/mi, 25-yr life, 5% upkeep) | −$194,901 |
| Optimistic, same high-tensile fence | −$65,159 |
| Expected, subscription that makes cash NPV = 0 | ≈$0.97/head/month (input: $7, the press-reported "less than $7" ceiling; no quote yet) |

**What it shows**
- Every scenario loses money in cash. In the expected case the subscription ($266.4k PV) is about 2.9× all cash
  benefits combined ($91.5k PV: $64.6k of fence avoided net of its residual, and $26.9k of contract hours cut).
  Cash benefits would need to rise about 3.5-fold (PV of costs ÷ PV of cash benefits) to break even.
- The only positive figure is the optimistic economic NPV, and it comes entirely from the unsupported weight gain
  ($323k PV).
- This matches Arizona Extension's finding (az2117, March 2025) that no system paid for itself at baseline and that
  the calf gain needed to break even was "implausibly large".
- What to verify first: the billing basis for seasonal cattle, whether the 8 miles of fence would really be built
  and by whom (tenure, which decides who receives the fence saving), and the handling labor build-up.
- Changes from the first results: fence type held fixed (the optimistic column had switched to high-tensile);
  polywire 4-year life; handling labor built up from crew and minutes; enrolled months include training and removal
  in the expected column (the optimistic column assumes billing for grazing months only; at 5.5 months its cash NPV
  would be −$118,818); rider hours limited to moving and gathering; weight gain moved out of cash; advance billing;
  7% real rate. The earlier optimistic column counted the unsupported weight gain as cash, which broke the spec's own
  rule; that result is not reported.

### 11.3 Ranch C: 300-cow cow-calf, 285 calves born, 240 feeder calves sold at a local auction, EID tags + reader + scale (7-year horizon)

**Inputs by scenario**

| Input | Conservative | Expected | Optimistic | Class |
|---|---|---|---|---|
| Does the EID rule apply to cattle you move? (the APHIS rule; the step-3 answer B4a records) | No: feeder calves are exempt, and no cattle 18 months or older (and no show or rodeo cattle) leave the state except directly to slaughter. All tags are voluntary project costs | same | same | [E] ranch fact; [A] APHIS final rule, 89 FR, 9 May 2024 (Doc. 2024-09717): most beef feeders under 18 months are exempt. The rule's current status and the litigation are checked by research task R1 (8.4) |
| Cow tags (300, year 0) | $3.14 each | same | free (state program, initial supply only) | [C] retail Oct 2026 (Jeffers, $156.99 per 50, which is $3.1398 a tag, rounded to $3.14; the page shows the listing's published-list-price label followed by "(rounded from $156.99 per 50)", 9.5 item 4); free tags [A] are time-limited and capped, e.g. New York: up to 500 tags or one year's supply, whichever is smaller, per 12 months from 6 Jan 2026, while supplies last (form AI-489); "initial supply only" is my assumption [E] |
| Calf tags (285 calves born per year) | $3.14 each | same | same | [C] same Jeffers listing and rounding |
| Retags for lost or unreadable cow tags | 4.3%/yr | 1.5%/yr | 1.5%/yr | [E], set at the rates in Roberts et al. 2012 [B]: ≈1.5%/yr (4 ranches, 2 yr); ≈4.3%/yr compounded (1 ranch, 5 yr) |
| Reader | $1,919 | same | same | [C] Jeffers XRS2 stick reader, Oct 2026 |
| Indicator and load bars | $1,830 | same | same | [C] Valley Vet's S3 + MP600 listing, $1,829.95 (undated; checked 15 Oct 2026), rounded to $1,830; the page shows that listing's published-list-price label followed by "(rounded from $1,829.95)" (9.5 item 4), and its "Use published vendor price" fill sets $1,829.95 (9.5 item 7). NRS lists the same system at $1,779.99 |
| Platform materials | $800 | same | same | [E] synthetic placeholder, not a price: the published scale listings do not include a platform (quote required) |
| Software | $360/yr, billed in advance | same | same | [E] synthetic placeholder, set at one commercial package's published $30/month billed yearly [C] (CattleMax, checked Oct 2026); that plan covers up to 250 active animals, fewer than this herd's 300 cows and 285 calves, so a quote is needed |
| Residual value at year 7 (reader, scale, platform) | 0% | 15% | 25% | [E]; no published life found (quote required) |
| Dewormer dosed by weight | not counted | 885 applications × $0.45 ($398/yr) | same | [E] illustrative synthetic placeholder, **no published source**; 885 = 300 cows × 2 chute workings + 285 calves at weaning |
| Age-and-source premium | not counted | not counted (local auction, no program) | 240 head × 5.5 cwt × $2.25/cwt − $1.10/head fee | [B] McCabe et al. 2018 (2010–17 video-auction average; does not transfer to a local barn); [C] FSNS age-and-source fee for lots of 1–75 head (file dated 16 Dec 2025); the flyer's fees fall with head count, to $0.50/head for 1,001+ head, so $1.10 overstates the fee for 240 head: the flyer's fee for 151–250 head is $0.90 (checked 15 Oct 2026), and at $0.90 the optimistic cash NPV would be +$6,173 |
| Added chute time (crew of 3, family) | 885 weighings × 30 s × 3 people = 22 h | × 20 s × 3 = 15 h | × 15 s × 3 = 11 h | [E]; [B] APHIS 2009 BCA ≈20 s per read |
| Added data upkeep (owner) | 20 h/yr | 15 h/yr | 10 h/yr | [E] |

**Calculated results**

| | Conservative | Expected | Optimistic |
|---|---|---|---|
| **Cash NPV** | **−$12,608** | **−$9,895** | **+$5,914** |
| Benefit-cost ratio (cash) | 0.00 | 0.21 | 1.51 |
| Cash payback | none within 7 years | none within 7 years | 2.7 years |
| IRR | below 0% | below 0% | 33.9% |
| Added owner and family hours per year | 42 h | 30 h | 21 h |
| Economic NPV (owner time at $20/h) | −$17,149 | −$13,101 | +$3,644 |
| 5-year test: cash NPV (B9) | −$10,906 | −$8,678 | +$3,683 (pays for itself within 5 years) |

**Sensitivity rows (one change at a time)**

| Change | Cash NPV |
|---|---|
| Expected, as above | −$9,895 |
| Expected, dosing counted on calves only (285 applications) | −$11,350 |
| Expected, retags at 4.3%/yr (the 5-year compounded rate) | −$10,037 |
| Expected, if the rule applied to the cows and the B4b compliance baseline were built (cow tags and retags move to the baseline). A preview of B4b, which waits for research task R1 (8.4); in phase 1 (B4a) a "yes" moves no tags, so the result stays −$9,895 and the page shows the pending-verification notice (§7.1) | −$8,877 |
| Optimistic, free calf tags for all 7 years [E] (free tags are available in 2026 while supplies last, but APHIS "cannot commit to long-term funding for EID tags") | +$10,737 |

**What it shows**
- Without a market that pays for verified cattle, the equipment does not pay on a 300-cow herd. The optimistic
  result depends almost entirely on a 2010–2017 video-auction premium ($14.6k PV), which needs a current buyer quote
  and a change of sale channel.
- This ranch did not weigh or record individual animals before, so the labor-efficiency benefit MLA identifies
  (B.GFB.1719, Australia, 2017: "The key benefit afforded by eID technology is labour efficiency") does not apply
  here. Chute time is added, not saved. A ranch that already records weights by hand would enter its recording time
  saved instead.
- Here the calf tags are voluntary: feeder calves are exempt from the APHIS rule. For a beef herd, the rule as
  published reaches sexually intact cattle 18 months and older (and show or rodeo cattle) moved interstate other than
  directly to slaughter. Those animals need official ID, and an official eartag applied since 5 Nov 2024 must be EID.
  Those tags move into the compliance baseline only once B4b is built, after research task R1 (8.4) has verified the
  rule's current status and the litigation; until then (B4a) they count as project costs. Ranch C's own result does
  not depend on R1: its answer is "no", so all its tags are project costs whether or not the rule stands.
- Changes from the first results: rule status stated; free tags limited to the initial cow supply; dosing
  relabeled [E] and limited to animals actually weighed; chute time built up from crew and seconds per read; retags
  added; advance billing; 7% real rate.

### 11.4 Ranch D: 400-cow cow-calf on 8,000 owned acres, virtual fence instead of 14.14 miles of new interior cross-fence (good-fit example, 7-year horizon)

This is the good-fit example (owner decision, 15 Oct 2026): a cow-calf herd on large pastures that would otherwise
build permanent interior fence for a rotation, the situation in which Arizona Extension (az2117, March 2025) found
virtual fencing most likely to be cost-effective. On the page it carries the banner "Good-fit synthetic example:
conditions where this technology is most likely to pay. Made-up numbers for demonstration, not any real operation's
data. Check whether your operation matches." Its inputs were fixed before any result was computed and were not
adjusted afterwards. It has one set of inputs: the virtual-fence prices and effects are Ranch B's expected values,
and the herd, the fence plan and the fence type are its own.

**Inputs**

| Input | Value | Class |
|---|---|---|
| Herd | 400 cows | [E]; inside the 200–500-cow range of az2117's representative Arizona ranch (March 2025) [B] |
| Land tenure | Owned: one owned land unit of 8,000 acres in four 2,000-acre pastures. The operator would build the cross-fences, pays every cost and receives every benefit (operator share 1 on every line) | [E] |
| Cattle collared | Cows only, 12 months a year. Calves and bulls are not collared. Uncollared calves are not held by the virtual fence: in the second year of a two-year Alberta, Canada trial they "had the freedom to roam" while their collared dams stayed inside (U. Alberta *Folio*, 6 Nov 2025), and in North Dakota they spent more time outside the boundary than their dams (NDSU, 2025 season); the example does not value that risk | [E]; [B] calves were not collared in the NDSU 2025 season (AS2304-18), and an independent welfare review prepared for the Australian Government recommends against virtual fencing for juvenile animals (Fisher & Cornish, for DAFF, Dec 2022, updated Nov 2023); bulls "are known to frequently lose their collars" (NMSU B-132, Oct 2024) |
| Grazing plan: interior fence the ranch would otherwise build in year 0 | Each pasture split into 3 paddocks by 2 cross-fences. A square 2,000-acre pasture is √(2,000 ÷ 640) = 1.768 mi on a side, so the plan needs 2 × 1.768 × 4 = 14.14 mi of new interior fence. Avoided, not deferred; the perimeter fence stays | [E] |
| Fence type, life and upkeep | 6-wire high-tensile, $15,100/mi ($213,546 in year 0); 25-year life, so no rebuild within 7 years; 5%/yr upkeep; the straight-line residual at year 7 (18 of 25 years, $153,753) is subtracted | [B] Missouri G1193 (Jan 2024 prices); Iowa State FM-1855 Table 6 (high-tensile 25 yr / 5%) |
| Subscription | 400 cows × $7/head/month × 12 months = $33,600/yr, billed in advance (years 0–6) | [C] vendor statement reported second-hand, not a published list price (no US price is published): DTN, 31 Mar 2025, "less than $7 per head per month", used at the ceiling as in Ranch B expected; billing basis needs a quote |
| Infrastructure | $4,500 | [C] "starting at $4,500", a vendor statement reported by DTN (31 Mar 2025), not a published list price |
| Contract labor rate (all handling paid, cash) | $25/h | [E] synthetic placeholder (as Ranch B) |
| Collar fit check at the fall working | 400 head × 1 event × 1.5 min × crew of 4 = 40 h/yr | [E] |
| Refit gathers | 2 gathers × 3 riders × 8 h = 48 h/yr | [E], as Ranch B expected |
| Training | 7 days × 2 riders × 6 h = 84 h in year 1 only (the cow herd is trained once) | [E]; [B] 3–7 days in research (as Ranch B) |
| Collar loss charges | $0 (assumes the quote covers loss) | [E], as Ranch B expected; needs the vendor's loss terms |
| Contract hours cut for moving and gathering (not health checks) | 200 h × $25 = $5,000/yr | [E], as Ranch B expected |
| Production effects | none counted | — |

**Calculated results**

| | Ranch D |
|---|---|
| **Cash NPV** | **−$9,789** |
| Benefit-cost ratio (cash) | 0.95 |
| Cash payback | none within 7 years (no net outlay in year 0; cumulative negative from year 7) |
| IRR | n/a: no net outlay in year 0 |
| PV of costs | $212,075 (subscription $193,756; contract labor $13,819; infrastructure $4,500) |
| PV of cash benefits | $202,286 (fence avoided, net of its lost residual, $175,340; contract hours cut $26,946) |
| Contract handling hours per year (cash cost) | 88 h (172 h in year 1, with training) |
| Yearly net cash, years 0 to 7 | +$175,446; −$22,223; −$20,123 in each of years 2 to 6; −$140,276 |
| Economic NPV | −$9,789 (no risk, owner-time or production lines) |
| 5-year test: cash NPV (B9) | −$6,871 (does not pay for itself within 5 years) |

**Sensitivity row (context only)**

| Change | Cash NPV |
|---|---|
| As above | −$9,789 |
| With Arizona NRCS cost-share rates as of 1 Oct 2024 (az2105, Jan 2025), at the low end for 200 head or more: $91.92/head in year 1 and $60.48/head/yr in years 2 to 5 ($36,768, then $24,192 a year for 400 cows), received at year end. Cost share is B5, after phase 1. Eligibility and program rules apply: a minimum of 51 cattle for the Arizona rates, and FSA ECP-105 is not available where permanent interior fence exists | +$101,156 (5-year test +$104,074) |

**What it shows**
- Even in a good fit, virtual fencing at a $7/head/month subscription is close to break-even and slightly negative
  (cash NPV −$9,789; benefit-cost ratio 0.95). It turns on how much fence it really replaces: it breaks even at 14.932
  mi of cross-fence over 7 years (the panel shows "at least 14.94 mi") and 14.859 mi in the 5-year test,
  against the 14.14 mi the plan needs.
- The difference from Ranch B is the fence: 14.14 mi of permanent high-tensile fence ($213,546 in year 0) instead of 8
  mi of polywire ($34,400), on a cow herd that is trained once.
- Year 0 is positive because the avoided fence counts in the year it would have been built, and its lost residual
  ($153,753) counts at year 7. Cumulative cash stays positive through year 6 and turns negative in year 7, so the
  payback reads "none" and the IRR "n/a" (9.3).
- Cost share would change the answer, but it is context only here: it depends on eligibility, program rules and the
  rates in force, and phase 1 does not model it (B5).
- What to verify first: whether the cross-fences would really be built and how many miles; a subscription quote for
  cows billed 12 months a year; and how uncollared calves and bulls will be managed.

### 11.5 Five-year test and what would make it pay (B9)

B9 (phase 1) re-runs each analysis with a 5-year horizon (the convention above) and, for each driver that the module's
`PAYBACK_DRIVERS(a)` returns, solves the value at which cash NPV is 0, holding every other input fixed: once for the 5-year
test and once for the full horizon (9.3). The panel sits next to the verdict, and the owner and lender business case
(B6) prints it. The values below come from the reference prototype (Appendix A). They cover the drivers the
prototype can solve; the page's panel lists every phase-1 driver of the module.

**5-year test: cash NPV by scenario (before tax)**

| Ranch | Conservative | Expected | Optimistic |
|---|---|---|---|
| A: water monitoring | −$23,867 | −$7,648 | +$6,000 |
| B: virtual fence | −$470,813 | −$175,519 | −$76,811 |
| C: EID tags, reader and scale | −$10,906 | −$8,678 | +$3,683 |
| D: virtual fence, good fit | — | −$6,871 (one set of inputs) | — |

Only Ranch A optimistic and Ranch C optimistic pay for themselves within 5 years. No ranch's inputs were changed to
reach that result.

**What would make it pay (expected scenario unless stated; every other input as entered)**

"At least" or "at most" gives the direction in which the value pays. Values are shown as the page's panel shows them
(9.5 item 9): rounded up where the row says "at least" and down where it says "at most", so each value shown, entered
as is, pays. For whole units (days of hired labor, head, hours) the unrounded solved value is given first and the
panel's whole number in parentheses. Appendix A gives every unrounded value.

| Ranch and driver | Entered | To pay within 5 years | To pay over the full horizon |
|---|---|---|---|
| A: day-labor days not hired | 16 (at most 33 possible) | at least 27.32 (28 days) | at least 25.58 (26 days; the ≈25.6 of the sensitivity rows) |
| A: variable vehicle cost | $0.40/mi | at least $0.76/mi | at least $0.70/mi |
| A: share of summer runs avoided | 50% (the cap) | none: no share between the feasible minimum 24.24% and the 50% cap makes it pay | none in the same range |
| B: subscription | $7/head/month (the press-reported ceiling; no quote) | at most $0.93/head/month | at most $0.96/head/month (0.969 unrounded, the ≈$0.97 of the sensitivity rows) |
| B: herd size (yearlings collared) | 1,200 | at most 273.33 (273 yearlings) | at most 278.04 (278 yearlings) |
| B: moving and gathering hours cut | 200 h/yr | at least 1,912.30 (1,913 h/yr) | at least 1,903.61 (1,904 h/yr) |
| B: fence $/mile (same 4-year polywire life) | $4,300 | at least $19,609/mi | at least $19,589/mi |
| C: herd size | 300 cows | none between 1 and 10,000 cows | none between 1 and 10,000 cows |
| C: verified-program premium, net of fees | $0/yr (not counted) | at least $2,117/yr | at least $1,837/yr |
| C optimistic: herd size | 300 cows | at least 177.24 (178 cows) | at least 150.04 (151 cows) |
| D: interior fence that would otherwise be built | 14.14 mi | at least 14.86 mi | at least 14.94 mi |
| D: subscription | $7/head/month | at most $6.67/head/month | at most $6.64/head/month |
| D: herd size (collared cows, same fence plan) | 400 | at most 381.86 (381 cows) | at most 380.34 (380 cows) |
| D: fence $/mile (same high-tensile fence) | $15,100 | at least $15,866/mi | at least $15,943/mi |
| D: moving and gathering hours cut | 200 h/yr | at least 267.04 (268 h/yr) | at least 272.65 (273 h/yr) |

How to read the panel:
- **Ranch A.** The summer share cannot fall below 24.24% while 16 days of paid labor are cut: those 128 hours must
  come out of the 528 summer run hours (88 runs × 6 h), so the search range is clipped there, and the panel says so.
  Between that minimum and the 50% cap, no share pays.
- **Ranch B.** The fence and riding savings are fixed while the subscription and handling costs rise with head, so the
  herd-size driver reads "at most". Every value needed is far from what was entered (a subscription about one-seventh
  of the press-reported ceiling, or almost ten times the hours cut).
- **Ranch C.** No herd size pays in the expected scenario, because every per-head benefit is smaller than the per-head
  tag cost. With the optimistic inputs, including the premium, it pays for itself within 5 years from 178 cows.
- **Ranch D.** The prototype solves every phase-1 driver of the virtual fence module here, so the sentence the verdict
  adds when the 5-year test fails can be read off: herd size (4.5% below the entered 400 cows) and subscription (4.7%
  below $7) need the smallest changes; fence miles and fence price each need about 5.1% more. Fewer cows pay only
  because the fence plan, and so the fence saving, is held fixed while the subscription falls with head.
- **The verdict sentence for Ranches B and C.** Ranch B's names herd size and subscription (10.1 row 43): "It would pay
  for itself within 5 years if: herd size at most 273 yearlings (you entered 1,200 yearlings), or subscription at most
  $0.93/head/month (you entered $7/head/month)." Ranch C's names only the premium (10.1 row 39), because its herd size,
  tag price, reader and scale cost and added hours all give "none": "It would pay for itself within 5 years if: net
  program premium at least $2,117/yr (you entered $0/yr)."
- **The verdict sentence for Ranch A.** The prototype does not solve Ranch A's monitor price, subscription per monitor
  or herd size, so these were worked from the 9.3 rules on the same expected cash flows, which are linear in each
  price. Subscription per monitor at most $190.68 a year (47.8% below the entered $365) and hired labor cut at least
  27.32 days (70.8% above the entered 16) need the smallest changes, against 79.8% for monitor price (at most $301.57)
  and 88.3% for vehicle cost; herd size and the season-block shares give "none". The sentence would read "It would pay
  for itself within 5 years if: subscription per monitor at most $190 per monitor per year (you entered $365 per
  monitor per year), or hired labor cut at least 28 days (you entered 16 days)."

---

## 12. Decisions confirmed (15 Oct 2026) and remaining work

The project owner answered the seven open questions of the first version of this plan (primary user, examples,
pricing, discount rate, geography, taxes and land tenure) on 15 Oct 2026 and asked that the plan and the
specification reflect the answers. The same day, the owner also decided how the tool shows what would make each
technology pay (item 8).
The plan cites each decision as "owner decision, 15 Oct 2026".

1. **Primary user.** Commercial cow-calf operators come first, with a workflow that helps ranch managers present
   investment decisions to owners or lenders; stocker operations are secondary.
   *Where:* cow-calf is the preselected operation type (§3.6, 7.1 step 1, 9.2, 9.4, 9.5 items 5 and 7); the owner
   and lender business case (B6, 7.2 item 10) is the first item built after phase 1 (8.2); 6.3 notes how each
   recommended module fits these users; Synthetic Ranch D gives cow-calf operators a virtual-fence example (item 8).
2. **Examples.** Clearly labeled synthetic ranches with different, editable herd sizes; there is no requirement to
   keep 1,000 head, and nothing may suggest the examples are the owner's own operation.
   *Where:* the four §11 ranches (900 cows, 1,200 yearlings, 300 cows, and 400 cows in Synthetic Ranch D) meet this.
   Ranches A, B and C carry the banner "Synthetic example ranch. Made-up numbers for demonstration, not any real
   operation's data."; Ranch D carries the good-fit banner of 9.5 item 5, which also says "Made-up numbers for
   demonstration, not any real operation's data." The repository's "1,000-cow operation" sentences are replaced (§3.4
   L2, 7.3, F10, 9.5 item 5). No example's inputs were tuned to reach a result (item 8).
3. **Pricing.** A hybrid: optional, dated, sourced public vendor prices, labeled as vendor information, that users
   replace with their quotes; synthetic operating assumptions kept visibly separate; no invented prices; and no
   suggestion that published prices support the projected savings. This builds on the 14 Oct 2026 decision to use
   generic technology names, with price sources linked and labeled as published list prices, not endorsements
   (cited as "owner decision, 14 Oct 2026").
   *Where:* §4, §5.1, 7.1 step 2, 7.2 items 1 and 9, 7.3, F10, 9.3 (verdict rules), 9.5 items 1, 4 and 7, 10.1 rows 37
   and 38. All five fills offered in phase 1 come from undated sources, a dealer flyer and retail listings, and show the
   date they were checked in place of a publication date (judgment; 9.5 items 4 and 7). The handoff notes (`HANDOFF.md`,
   kept by the owner outside the repository: "illustrative assumptions, not vendor prices") should be updated to match;
   this is not a phase-1 code task.
4. **Discount rate.** Examples give results at once with a visible, editable example rate labeled as an assumption,
   and users analyzing their own operation are prompted to review it. The owner has not selected a percentage, so
   the plan presents 7% real only as the synthetic examples' value, never as right for every operation.
   *Where:* M6, §4.4, §5.1, the Discount rate row in §5.3, 7.1 step 2, 9.2, 9.3, 9.5 items 1, 5 and 7, 10.1 row 33.
5. **Geography.** US-first, not US-only: US dollars, US units and US operating context by default, with
   international research labeled by country, currency, data year and limits, never used as a default and never
   converted to US dollars. It also settles which region's figure to use: where a public figure varies by US region,
   as the wage does, the fallback is the value for the ranch's own region (§4.4, §5.3).
   *Where:* §4, §5.1, 5.2 item 9, 7.2 item 9, 9.2 (`prov.region`, `prov.currency`), 9.4, 9.5 item 4.
6. **Taxes.** No after-tax module in the initial version, and every result is labeled "before tax".
   *Where:* §2, §5.1, 7.1 step 2, 7.2, 9.3, 9.5 items 1–3, B6, L5 (not in the initial version), 10.1 row 34.
7. **Land tenure.** Mixed: owned and leased land, including operations with both, and the tool asks who actually
   pays each cost and receives each benefit instead of assuming every saving is the operator's.
   *Where:* §1 change 4, 7.1 steps 1–3, 7.2 items 4 and 5, F6 (retitled), 9.2 (`landUnits`, `operatorShare`), 9.3 ("Who
   pays and who receives"), 9.4, 9.5 items 3 and 7, 10.1 rows 22, 35 and 47. The synthetic ranches stay on owned land
   with operator share 1 on every line, and Ranch B's landlord-fenced lease stays a sensitivity row.
8. **What would make it pay.** The tool should be usable for every technology it covers, but the example herd sizes
   are not adjusted until each technology shows a return; that was considered and not chosen. Instead, the page
   tests each analysis against a payback target, 5 years by default and editable, and shows what would have to be
   true for the technology to pay for itself within it. One good-fit example joins the three ranches: Synthetic
   Ranch D, a cow-calf operation using virtual fencing in place of cross-fence it would otherwise build. Ranch B, a
   stocker operation, stays as the secondary-user case. No example's inputs are tuned to reach a result.
   *Where:* B9 (8.2; phase 1, 9.1 build order step 6), with the risk-driver break-evens and the "Today vs with the
   technology" table left in B2; 7.1 step 2 and 7.2 items 1 and 6; 9.2 (`settings.paybackTarget`,
   `PAYBACK_DRIVERS(a)`); 9.3 (the N-year test and the driver solver); 9.4; 9.5 items 1, 5, 7, 8 and 9; 9.7; 10.1
   rows 39–46; §11 (Synthetic Ranch D and the five-year results); Appendix A. The owner and lender business case (B6)
   prints the panel.

**Remaining work**

Two items remain open: research task R1, and one item for the owner to confirm, with a recommended default.

- **Research task R1 (8.4).** The owner asked that the EID rule's status and the litigation be verified as a separate
  research task before any compliance baseline is implemented. Phase 1 therefore builds B4a (separate EID lines and
  the recorded rule answer) and leaves the compliance baseline to B4b, after R1. What is known now: a lawsuit against
  the rule (*R-CALF USA et al. v. USDA*, U.S. District Court for the District of South Dakota, case 5:24-CV-05085-ECS)
  had a motion to dismiss granted in part and denied in part on 30 Sept 2025, and the plaintiffs moved for summary
  judgment on 5 March 2026 (NCLA case page; BEEF, 10 March 2026). No later ruling was found through 15 Oct 2026, but
  that absence could not be proven. A Tri-State Livestock News headline, "Update on EID lawsuit: Settlements are being
  discussed", reports settlement talks; its date is unknown and the article could not be opened.
- **Synthetic cost placeholders (for the owner to confirm).** Eight costs in the synthetic examples have no published
  price that applies to them: Ranch A's mounting materials ($750) and batteries and repairs ($1,000 in years 4 and
  8); Ranch B's conservative infrastructure ($9,000), collar-loss charges ($3,000 a year, conservative column) and
  contract labor rate ($25/h, which Ranch D also uses); and Ranch C's platform materials ($800), dewormer price
  ($0.45 per application) and software ($360/yr, set at a published plan price for up to 250 animals, below this
  herd's size). *Recommended default:* keep them, because dropping a cost would understate costs and flatter the
  result. Each is tagged [E] and labeled "Synthetic placeholder, not a price. Replace with your quote." In the user's
  own analysis each keeps its value but is flagged, and the verdict carries "Includes synthetic cost placeholders"
  until each is replaced or confirmed (9.2, 9.3, 9.5 items 4 and 5, 10.1 row 37). A version 1 link's starting costs
  get the same flag, except two that are vendor prices as they stand (9.5 item 8).

---

## 13. Sources

In [`sources.md`](sources.md).

## Appendix A. Exact inputs and pinned outputs for the synthetic examples

In [`phase1-spec.md`](phase1-spec.md).
