# Ranch Tech ROI

A calculator for the question every ranch asks before buying new technology: **will it pay for itself here?**
Pick a starting point (collar-based virtual fencing, remote water monitoring, or EID tags and a scale), replace the numbers with
your own quotes and records, and it shows the payback, the net present value, and which assumptions the answer really
depends on. Every number on the page is calculated in the open, with the formula and the values that went into it.

**Try it:** https://cowcampstx.github.io/ranch-tech-roi/ (runs in the browser; nothing is uploaded or saved).

![Ranch Tech ROI: inputs, verdict, key numbers and the cumulative cash chart](docs/screenshot.png)

> Synthetic example ranch. Made-up numbers for demonstration, not any real operation's data. Of the starting costs,
> only the water monitor's is a published price (a dealer's undated flyer). The virtual fence costs are vendor
> statements reported by the press and a figure from university comparison slides, not published list prices, and the
> EID costs have no published source (see Sources below). The benefits are assumptions. Use your own quotes and
> records for a real decision.

## What it answers

| Question | Where on the page |
|---|---|
| Does it pay, and how soon? | Verdict line, net present value, payback, internal rate of return, return on cost |
| What does it cost per head, all in? | All-in cost per head per year |
| Which of my assumptions matter most? | Sensitivity chart: each input moved 20% down and up, longest bars first |
| How wrong can I be before it stops paying? | Break-even table: the value of each key input where NPV hits zero |
| What if two things change at once? | Two-way table for the two biggest drivers, from 40% below to 40% above |
| Where does each number come from? | Year-by-year table and the written-out formulas |

A scenario can be shared: **Copy link to this scenario** puts every input in the link.

![Sensitivity chart and break-even table](docs/sensitivity.png)

## The model

All results are before income tax. Year 0 is the purchase. Years 1 to N are operating years. N, "Years analyzed", is
a whole number of years, 1 or more; any other value shows an error and nothing is calculated. Each starting point
uses 5 years, the fallback when no contract term or asset life is known, and says so beside the input. Its discount
rate is an example, labeled on the page as an assumption to review, not a recommendation.

| Line | Formula |
|---|---|
| Hardware | herd size × hardware per head |
| Upfront cost (year 0) | hardware + base station, setup and install |
| Running cost (each year) | herd × subscription per head + hardware × repairs % + hardware × devices replaced % |
| Labor benefit | hours saved per week × 52 × loaded labor cost per hour |
| Death loss benefit | herd × death loss avoided (% of herd) × value per head |
| Weight benefit | herd × extra pounds sold per head × price per pound |
| Full-year benefit | labor + death loss + weight + fuel, vehicle and fence savings |
| Year 1 benefit | full-year benefit × share realized in year 1 (the crew is still learning the system) |
| Net cash | benefit − cost for each year |
| NPV | Σ net<sub>t</sub> ÷ (1 + discount rate)<sup>t</sup>, t = 0…N |
| IRR | the discount rate where NPV = 0 (found by bisection) |
| Payback | years until cumulative net cash ≥ 0, interpolated within the year |
| Return on cost | (total benefit − total cost) ÷ total cost |
| Sensitivity | NPV with one input at −20% and +20%, everything else held as entered |
| Break-even | the value of one input where NPV = 0, searched from 0 to 10× its current value |

Not included, on purpose, to keep it readable: taxes and depreciation, financing, resale value at the end, and price
changes over time. They can be folded into the inputs (for example, a lower hardware cost to reflect resale).

## The new engine (being built)

`roi.js` holds the engine that phase 1 builds one step at a time from the specification in
[`docs/audit/phase1-spec.md`](docs/audit/phase1-spec.md) (sections 9.2 and 9.3). The page moves to it in the last
step and runs on today's model, `v1.js`, until then. Money is in today's dollars, before tax, at a real discount rate,
over years 0 to T. `examples.js` holds the four synthetic example ranches (A to D) with the source of each value, and
`state.js` what each user action does to the state, and `links.js` the shared links. Built so far:

| Part | Rule |
|---|---|
| Cost lines | Each cost is its own line: capital (bought) or annual (billed each season), with a quantity that is fixed (1), per device, or taken from head counts (below). A blank price is not counted and is listed as "Quote required", unless the line has no quantity in any year. A blank start year or billing takes the default. |
| Capital purchases | Bought in the line's start year s. Each later rise in quantity is a new group of devices, counted against the largest quantity so far (for items that leave with the animal, against the year before). Each group is bought again every L years, its life, while that year is before T; with no life entered, it is bought once. |
| Repairs | repair % × the purchase's cost, in each year the purchase is in service |
| Residual at T | from each group's last purchase: straight line, cost × (life left at T ÷ L), between 0 and 100%; none; a % of cost; or a dollar amount for the whole line. It is its own series, R. |
| Annual lines | Season t (t = s + 1 … T) costs that season's price × quantity, billed in year t − 1 in advance (the default for subscriptions and service fees) or in year t in arrears. Inside a commitment the billed quantity is at least the minimum; a commitment that runs past T charges its early-termination fee in year T. |
| Labor cut (cash) | Only when the freed time replaces paid work: units cut × hours per unit × pay rate × (1 + payroll load), or units cut × salary × (1 + load) for a position. Until that question is answered the time is "absorbed" and counts as no cash. The paid hours cut cannot be more than the hours saved, and they shrink with them in a year without cattle, when a claim is counted only up to its baseline, or when a shared claim is scaled down. |
| Avoided hire (cash) | salary × (1 + load) in each year of a planned hire that is not made |
| Added hours | Paid: hours × pay rate × (1 + load), a cost in the year they are worked. Unpaid: they lower the hours freed. A single number recurs in each operating year; hours given by year put setup time, such as install, in the start year. |
| Hours freed (capacity) | hours saved − paid hours cut − unpaid hours added, in hours, valued at the owner's time rate in the economic view only, never as cash |
| Head-months | Virtual fence: enrolled head × months enrolled, by class. Water and EID: head × months on the served pastures (12 by default), over the served classes. Calves sold and cull cows sold are sale flows drawn from other classes and never count. |
| Head-based quantities | Per head-month: the head-months of the line's classes. Per head-year: their head × 12, with a warning when they are enrolled or served for fewer months; a committed minimum is then 12 × the minimum head. Per device from a class (such as calf tags): that class's head, and a purchase in year t buys for the season that ends at t + 1. |
| No cattle | In any year after year 0 with no head-months, every benefit that needs cattle and the hours freed are 0, and the page says "No cattle in year t: benefits not counted." Costs are not zeroed: head-based ones fall to 0 on their own, and committed minimums are still billed. |
| Shared savings | Each saving claims a physical quantity: water runs, moving and gathering hours, death loss by cause, or interior fence miles. A claim above the ranch's own baseline (runs today, hours today, losses on record, fence in the plan) is counted only up to it, with a warning; when the baseline is blank, the page asks for it. The baseline is split by land unit like the claims: in each year it counts only the units whose part still counts (owned units, leases not yet ended and leases expected to renew), and the fence's baseline follows the fence's own land unit. When two technologies claim the same quantity, each claim is scaled by baseline ÷ total claimed (at most 1), with a warning naming both, and the hours those claims save, with the paid hours cut they support, scale with them. |
| Weight gain | lb a day × days × head sold × value of gain, over the sold classes (calves sold, cull cows sold, and yearlings × the share sold). Value of gain is dollars per pound added, not the sale price per pound; from two weight-class quotes it is (W<sub>heavy</sub> × P<sub>heavy</sub> − W<sub>base</sub> × P<sub>base</sub>) ÷ (W<sub>heavy</sub> − W<sub>base</sub>), with the heavier weight above the base weight. It counts in the economic view only, unless it comes from the ranch's own records, when it is cash. |
| Losses avoided | events a year × head per event × share caught × value per head, claimed against that cause's death loss (the lines of one cause share one baseline). An expected loss, never cash: it enters "cash NPV including expected losses avoided" and economic NPV, never cash NPV, BCR, IRR or payback. Water's optional losses from fewer physical checks subtract the same way. |
| Land units and who pays | Each water and virtual fence line is split across the land units by their share of head-months or water points (EID lines are not split). For each unit's part, the operator's flow is the operator share (1 unless changed) × the flow; the rest is listed as paid or received by others and never enters a result. On a lease that ends within the horizon with no renewal expected, that unit's part of each benefit stops at the lease end; an improvement that stays with the land stops there too, with its share of the lease reimbursement as its residual. Where the landlord provides and checks the water, or water care is in the lease rate, the vehicle, labor and hours-freed savings there go to the landowner by default. |
| Interior fence | Avoided: the cost of the fence the ranch would build, F × miles in build year k, rebuilt every Lf years, with upkeep m × cost a year, less its straight-line residual at T. Deferred by d: that stream less the same stream starting in year k + d. It lies whole on its own land unit: a landlord-built fence is the landlord's saving, its whole stream listed under "Received by others". A lease ending at T' with no renewal expected stops the stream at T': when the tenant builds, the lease's fence reimbursement is its residual there, and a landlord-built fence keeps its straight-line residual at T'; and a landlord who maintains it makes the upkeep 0. Its purchases count if the module has cattle in some year; its upkeep only in years with cattle. |
| Results | The operator's share only. Net cash N = cash benefits + residual − costs; cash NPV = Σ N<sub>t</sub> ÷ (1 + r)<sup>t</sup>; cash NPV including expected losses avoided adds their PV; economic NPV adds the PV of losses avoided, capacity value and production. Benefit-cost ratio = (PV of cash benefits + PV of residual) ÷ PV of costs (n/a with no costs); cost per head-month = PV of costs ÷ PV of head-months in years 1 to T. Amounts under half a cent count as 0. |
| IRR | The rate at which the NPV of N is 0, found by bisection from the first year with cash flows. It is n/a with no cash flows, with no outlay in that first year, or with more than one sign change; "below 0%" when the nets sum to less than 0; and stated as above the search range past 10,000%. |
| Payback | Counted from year 0: k − 1 + (−cumulative N<sub>k−1</sub> ÷ N<sub>k</sub>), where k is the first year from which cumulative N stays ≥ 0 through T. When the first cash flow comes after year 0, the text says so ("counted from year 0; the first cash flow is in year s₀"); when cumulative cash was positive and then negative again before k, a note says so. "None within T years" when cumulative cash is still negative at T; "no net outlay" when it is never negative. Discounted payback is the same on discounted N. |
| Ramp | A benefit line's claim in the module's first three operating years (years s + 1 to s + 3) is multiplied by ramp[1], ramp[2] and ramp[3] (1 by default; a value above 1 is set to 1, and a cleared entry counts as 0), and is full from year s + 4 on. Every part of the hours saved is ramped, and the paid hours cut and hours freed follow them; costs and the avoided fence are not ramped. |
| Water monitoring | For each season block, runs avoided = runs a week × weeks × share avoided, where the share used is at most (runs a week − minimum visits a week) ÷ runs a week. A block flagged for freezing or the feeding route counts 0 unless a share is typed, with a warning, and a share typed above the cap is counted at the cap, with a warning. The runs avoided are the claim on water runs. Vehicle (cash) = runs avoided × miles per run × variable cost per mile; hours saved = runs avoided × hours per run, the miles and hours per run averaged over the blocks by runs avoided. The monitors, subscription and batteries lines count the monitors. |
| Virtual fence | The pricing model picks the lines: leased collars carry a subscription on the enrolled classes; purchased collars are bought for the enrolled head, with a service fee per collar in use billed in advance. Other lines, such as infrastructure or base stations, are entered as quoted. Collar batteries = batteries per collar × collars, and collar loss = loss % × enrolled head × charge per collar, each billed in arrears. The moving and gathering hours cut are the claim on gathering hours; health-check riding hours cut add to the hours saved, but support paid hours cut only with a validated alert function. The fence the virtual fence replaces is the interior fence line above. |
| EID tags and scale | Cow tags are bought per cow (they leave with the animal), calf tags per calf born each season, and retags = retag % × the cows' head each season, all at the tag price; the calf tags and retags are billed in arrears. Free tags: in each listed billing year, up to the free quantity costs $0, going to cow tags, then calf tags, then retags, with no carry-over. Net program premium (cash) = calves sold × (sale weight in cwt × premium per cwt − verification fee). Dosing savings (cash) = Σ over classes of head × applications a year × saving per application. Recording time today is hours saved. Whether the EID rule applies is recorded for the cows and other inventory classes; until the rule's status is verified, every tag stays a project cost and the page says so. |
| Handling hours | Virtual fence and EID: Σ over the handling events of times a year × head of its classes × minutes per head × crew ÷ 60, plus gathers × riders × hours per gather, plus training days × riders × hours per day, in each operating year with cattle. Done by a paid hand they are a cost at pay rate × (1 + load); otherwise they lower the hours freed. |
| Horizon from a link | A version 2 link whose settings give no T takes the longest contract term among its cost lines; else the life of the capital line with the largest year-0 cost; else 5 years, with the note "5 years assumed: no contract term or asset life entered." Every example and every version 1 link sets T. The horizon and the payback target are whole numbers of years from 1 to 50. |
| Shared links | `links.js`. A link is `#v=2&m=<module>&x=<example>&s=<data>`, where the data is the URL-safe base64 of the UTF-8 JSON of what differs from the example: each changed part whole, a removed part as null, and each changed source record by its path. The payback target rides along only when it is not 5. Reading a link loads the example, applies the data, checks that every value has the shape the data model gives it (a number or blank, a list by year, one of a field's listed values, a list or set with only the data model's fields, a source record with its class, a discount rate, a timing and basis on each cost line, ids of letters, digits, `-` and `_`, and at most 51 entries in a list or set, a value for each year of the longest horizon), sets a negative number to 0 (and a ramp value above 1 to 1), names each such change in a banner, and checks the values as if typed; a link that cannot be read, or whose values give no finite result, opens Synthetic Ranch A and says so. A link from the version 1 page (no `v`) is converted: its values are mapped to the matching example's module (an unknown or missing technology opens the virtual fence and says so; the two brand names of the page just before 14 October 2026's last version, whose starting values were the same, are read as the technology they named), with the head as cows, the year-1 share as the ramp, labor hours as hours saved (capacity only), and its three costs as lines; the fields with no place in the new engine are named in the banner. |
| Payback target (N-year test) | N is the payback target (5 years unless changed). The analysis is run again with the horizon set to N: the residual at year N is recalculated for straight-line residuals, while a residual entered as a % of cost or an amount is used as entered (an amount only on a line bought within the N years); a lease-end reimbursement keeps the share the full horizon gives it (a lease that ends after T and within N gets none); a contract that runs past year N charges its early-termination fee in year N; past year T every price and quantity carries its value in year T (a value entered by year for a year after T is not used). It pays when its cash NPV is ≥ 0. With no cash flows for the operator within N years (or a module that starts in year N or later), it neither pays nor fails. Notices the N-year run raises that the full run does not are listed under the panel. |
| What would make it pay | For each driver of the module (water: each block's share of runs avoided, vehicle cost per mile, hired labor cut, monitor price, subscription, herd size; virtual fence: interior fence miles, fence cost per mile, hired moving and gathering hours cut, subscription or service fee, herd size; EID: herd size, net program premium, tag price, reader and scale cost, added hours), the value at which the N-year test's cash NPV and the full horizon's cash NPV reach 0, one input changed at a time. Each driver has a range (its table range, widened to include the entered value), narrowed where other inputs make a value invalid (paid hours cut above the hours saved; a residual above the purchase's cost). The search is bisection, 100 halvings, between the range's ends; it gives "none" when no value in the range pays, "all" when every value does, the value with "at least" or "at most" otherwise, and n/a when the driver has nothing to act on (no head, no calves sold, no reader or scale cost, no added hours, freed time absorbed or pay not entered, or no cash flows within the test). A driver entered by year moves in proportion to its first operating year's value. Herd size scales every head count, the free tags and head-based minimums together. The verdict names up to two drivers with a value, the smallest relative change first, taken to 10 significant figures so that drivers which tie keep the table order (an entered 0 or blank last; a price left blank never). |
| Sensitivity (tornado) | One entry per input that matters, by module: herd size and discount rate in every module; water: each block's share of runs avoided (from the share typed, up to its cap), vehicle cost per mile, hired labor cut, monitor price and subscription; virtual fence: hired moving and gathering hours cut, the interior fence's cost per mile, the subscription or service fee (by how the collars are paid for), and collar loss; EID: hired labor cut, net program premium (left out with no calves sold), tag price, retag rate, reader and scale cost and dosing savings; where entered, avoided hire and added hours (every module), weight gain (virtual fence and EID) and each risk line (water and virtual fence); and every other cost line with its own price that no entry above moves, in the unit the page gives it. Factors that only appear as a product (such as days × hours per day × pay rate) are one entry, moved on one factor and shown in $/yr ($ for the interior fence). Each entry is moved to 0.8 and 1.2 × its value (the lower value first, also for a negative value), one at a time, through the same linked moves as "What would make it pay" (herd size moves every head count with it); a value given by year moves every year in proportion. A moved value that would make the paid hours cut exceed the hours saved, or a residual exceed its purchase's cost, is set to the nearest value that does not. Each bar runs between the two cash NPVs; bars are sorted widest first (widths to 10 significant figures, ties in entry order). Collar loss entered as 0 is tested from 0% to 7%. Entries not drawn are listed under the chart: left blank, entered as 0 (any other), or with no effect on cash NPV (a bar under half a cent); a blank price on a line with no quantity in any year is not listed. The verdict names the top two bars. |
| Two-way grid | Cash NPV over the top two bars, each at 0.6, 0.8, 1, 1.2 and 1.4 × its value (or five steps across collar loss's 0% to 7% when it is entered as 0), with the same linked moves, the same cap on a share and the same nearest-valid rule; a cell whose two values are not valid together is n/a, and the note says when a value was capped or moved. The cell at the entered values is the cash NPV. |
| Display of a driver's value | Money is whole dollars at $100 or more and cents below; percentages and miles two decimals; head, days and hours whole. "At least" values round up and "at most" values round down, so each value shown, entered as is, passes its test; when that rounding would leave the narrowed range, the value is shown unrounded to two decimals. |

## What the example shows

Synthetic example ranch. Made-up numbers for demonstration, not any real operation's data. The example counts saved
hours and assumed weight gain as cash, so its results are not cash results: payroll changes only if someone is paid
less or not hired, and the weight gain is applied to the whole herd at the sale price per pound. The sensitivity chart
and break-even table show which assumptions the answers lean on, which is the conversation a ranch manager and a
vendor would actually have. A plan to make the results cash results is in [`docs/audit/`](docs/audit/).

## Sources

Each cost in the starting values is listed below as what it is: a published dealer price, a vendor statement reported
by the press, a figure from university comparison slides, or a placeholder with no published source. They are listed
for transparency and are not endorsements of any product, and the benefit values are assumptions, not vendor claims.

- Collar-based virtual fencing: $4,500 one-time infrastructure and a subscription under $7 per head per month, collars
  included. Vendor statements reported by the press, not published list prices.
  [DTN/Progressive Farmer, 31 March 2025](https://www.dtnpf.com/agriculture/web/ag/news/article/2025/04/01/virtual-fencing-ranchers-new-best)
- Virtual fence base stations at $3,000 each. A figure from university comparison slides, given when the slides said
  those collars were "not yet available" in the US, so not a published US price.
  [Virtual fence manufacturer comparison, Rangelands Gateway, 16 April 2024](https://rangelandsgateway.org/sites/default/files/users/user14/VFCompanyComparison.pdf)
- Remote water monitoring: $1,490 per satellite water-level monitor and $365 per monitor per year. A published dealer
  price. [Water monitor dealer flyer (All-Tex Irrigation), undated; checked 15 October 2026](https://www.alltexirrigation.com/storage/UserFileFolder/Ranchbot_Flyer_-_All-Tex.pdf)
- EID tags and scale: $4 per tag, $12,000 for the reader, scale and setup, and $1 per head per year. No published
  source: placeholders to replace with your quotes.
- Physical fence at about $15,000 per mile to build and 2% a year to maintain.
  [New Mexico State University Extension, B-133](https://pubs.nmsu.edu/_b/B133/index.html)

## Run it locally

No build step and no dependencies. The page uses JavaScript modules, so serve the folder instead of opening the file:

```bash
python -m http.server 8000      # then open http://localhost:8000
node --test tests/*.test.mjs    # 305 tests. v1.test.mjs (16): today's model, its hand-checked case, the horizon
                                # rule, the wording of the sources, and the before-tax and example-rate labels.
                                # roi.test.mjs (94): the phase-1 engine's cost lines, billing, labor, head
                                # counts, shared savings, metrics, weight gain, losses avoided, land units,
                                # operator shares, the fence, the ramp and validation, and the same
                                # hand-checked case. modules.test.mjs (45): the water, virtual fence and EID
                                # modules on the four example ranches, with their pinned results.
                                # examples.test.mjs (12): the examples' sources, placeholders and vendor
                                # prices. state.test.mjs (24): the user actions. text.test.mjs (25): the
                                # notices, warnings, result texts, tiles and verdict the page will show.
                                # links.test.mjs (29): reading and writing links, and converting version 1 links.
                                # pay.test.mjs (41): the payback target, the N-year test of each example and
                                # column, and "What would make it pay": drivers, values, ranking and texts.
                                # sens.test.mjs (19): the sensitivity entries of each module, the tornado's bars,
                                # lists, caption and hover text, and the two-way grid
```

## Files

```
index.html        the page and its styles (light and dark mode, works on a phone)
app.js            page wiring: inputs, charts, tables, written-out formulas
v1.js             today's model, which the page runs on: pure functions, no dependencies, shared with the tests
roi.js            the phase-1 engine, being built step by step (see "The new engine" above); the page does not use it yet
text.js           the page text the new engine's results will show: formats, names, notices, warnings,
                  result texts, tiles, the verdict, the payback target line, the "What would make it pay" panel,
                  and the sensitivity chart's caption, legend, hover text and lists and the two-way grid's note
examples.js       the four synthetic example ranches (A to D) for the new engine, with the source of each value
                  and the published vendor prices a user can fill in
state.js          what each user action does to the state: load, reset, type or clear a value, keep the rate or
                  a placeholder, use a vendor price, remove an item
links.js          shared links for the new engine: writing the state into the link, reading it back, and
                  converting links made with the version 1 page
tests/            node:test unit tests, including a small case checked by hand
docs/             screenshots
docs/audit/       the audit and improvement plan, and the phase-1 specification
```

## License

MIT
