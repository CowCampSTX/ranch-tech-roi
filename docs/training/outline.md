# Ranch Tech ROI: training path (draft outline)

Source for the click-through slide deck. Screenshots get taken after the visual polish merges; every
`[shot: …]` marks one. Numbers below were read off the live page on 20 Oct 2026 (they come from the
engine, so the polish should not change them).

## Part 1: Use it yourself (about 10 minutes)

1. **What it answers.** One question: will this technology pay for itself on this ranch, before tax?
   Covers remote water monitoring, collar-based virtual fencing, and EID tags with a reader and scale.
   Runs in the browser; nothing is uploaded or saved. [shot: full page, Ranch A]
2. **Pick a starting point.** Four synthetic example ranches (made up, labeled as such):
   A water monitoring, B virtual fencing on 1,200 yearlings, C EID tags and scale, D virtual fencing on
   400 cows. [shot: Starting point menu]
3. **Read the verdict first.** Ranch A: over 10 years at the example 7% real rate, it costs about $11,000
   more than it saves in cash. "Indicative only" means most of the benefit is estimated, not from records.
   [shot: verdict + tiles]
4. **Read the tiles.** Cash NPV, cash NPV with expected losses avoided, economic NPV, cash payback, BCR,
   cost per head-month, hours freed, IRR. Cash is what hits the bank; hours freed are time, never cash
   unless they replace paid work.
5. **"What would make it pay."** The most useful table for a buying decision. Ranch A pays within 5 years if
   the subscription is at most $190 per monitor per year (entered $365), or the hired labor cut is at
   least 28 days (entered 16). That is your negotiating number for the vendor. [shot: table]
6. **"What the answer turns on."** Each input moved 20% down and up; the longest bars are the numbers to
   check first. "Two inputs at once" crosses the top two. [shot: tornado + grid]
7. **Make it yours.** Press **Analyze my operation**: the example banner goes, and the page asks you to
   review the discount rate and replace each synthetic placeholder. Work Step 1 (operation, land, herd),
   Step 2 (horizon, payback target, rate), Step 3 (the technology). Blank vendor prices say
   "Quote required": get a quote, never guess. [shot: inputs after Analyze]
8. **Check where each number came from.** Every value has a class badge: A official statistics,
   B research or extension, C vendor information, D your entry, E made-up example. Year-by-year table,
   written-out formulas and sources sit at the bottom. [shot: badges + year table]
9. **Share it.** **Copy link** puts the scenario in the URL (only what differs from the example), so a
   banker, partner or extension agent opens the exact same numbers. **Reset** returns to the example.

## Part 2: Pitch it

- **One line:** "Before you sign for collars, water monitors or EID gear, put your own numbers in and see
  whether it pays for itself, before tax, and what price would make it pay."
- **To ranchers:** vendor-neutral (generic names, no sales agenda); shows the break-even price to take to
  the dealer; uses your herd, your land (owned or leased) and your labor; free, nothing uploaded.
- **To lenders, extension agents, consultants:** every number is traceable to a formula and a source class;
  a shared link makes the conversation about the same scenario; results split the operator's share from a
  landlord's.
- **The honest proof point:** none of the four examples pays at the example numbers. The tool is not built to
  sell technology; it tells you what would have to be true.
- **What not to claim:** not tax or financial advice; examples are not anyone's real ranch; vendor prices
  are dated and replaceable; no rate is right for everyone.
- **Portfolio angle (LinkedIn, interviews):** spec-first build, open formulas, tests in CI, owner rules
  enforced in code (before tax, generic names, sourced prices). 30-second version for a recruiter.

## Part 3: Help others use it

- **Sit-down script (20 minutes):** pick the closest example, press Analyze, replace herd and land first,
  then the technology price from their quote, then their labor. Read the verdict out loud, then
  "What would make it pay."
- **The five questions to bring:** head by class, months on the served pastures, a written quote, hours
  spent today on the job the tech replaces (checks, moves, gathers), and who would actually stop working
  (paid labor cut vs. time absorbed).
- **Common mistakes:** counting freed hours as cash; leaving the example 7% rate unreviewed; typing a
  vendor's "typical savings" as their own; forgetting the subscription is per head per month.
- **FAQ:** Why before tax? Why is my "economic NPV" different from cash? What does "Indicative only"
  mean? Can I save it? (Copy link.) Does it work on a phone?
- **Hand-off:** send them the link with their scenario and a one-paragraph summary of the verdict.
