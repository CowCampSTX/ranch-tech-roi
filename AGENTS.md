# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Ranch Tech ROI is a plain HTML and JavaScript calculator for ranch technology decisions:

- `index.html`: the page
- `app.js`: page and DOM code
- `roi.js`: the model (pure functions, no DOM, no dependencies)
- `tests/roi.test.mjs`: tests, run in CI on Node 22 (`.github/workflows/test.yml`)

There is no framework, build step or package manager. Keep it that way unless a change solves a demonstrated problem.

Run the tests from the repository root, as CI does:

    node --test tests/roi.test.mjs

If tests are split into more files, run them all with `node --test` and update the CI workflow to match.

## The plan is the spec

The audit and improvement plan is in [`docs/audit/`](docs/audit/), split into four files with section numbers that
run across them:

- [`docs/audit/phase1-spec.md`](docs/audit/phase1-spec.md) is what you build and review against:
  - **Section 9** is the phase-1 specification: 9.1 scope and build order, 9.2 data model, 9.3 formulas, 9.4 inputs,
    9.5 page changes (including the exact on-page wording), 9.6 overlap rule, 9.7 tests.
  - **Section 10** is the validation plan; 10.1 lists the edge-case and behavior tests.
  - **Appendix A** gives the exact inputs and pinned outputs of the four synthetic example ranches (A to D), including
    the 5-year test results and the "what would make it pay" driver values (B9).
- [`docs/audit/ranch-tech-roi-audit.md`](docs/audit/ranch-tech-roi-audit.md) holds the audit (sections 1 to 7), the
  roadmap (**section 8**, where each F, B, L and R item has acceptance criteria), the synthetic examples (section 11)
  and the owner's confirmed decisions and open items (**section 12**).
- [`docs/audit/evidence-table.md`](docs/audit/evidence-table.md) and
  [`docs/audit/evidence-table.csv`](docs/audit/evidence-table.csv) are the evidence table (section 5.3); the CSV has
  full source URLs. [`docs/audit/sources.md`](docs/audit/sources.md) is the source list (section 13).
- [`docs/audit/prototype/`](docs/audit/prototype/) reproduces Appendix A (`node docs/audit/prototype/examples.mjs`).
  It is a reference for the numbers, not code to copy into the app.

When the code and the spec disagree, follow the spec. If the spec itself is wrong, contradicts itself or cannot be
built as written, raise it as a spec issue rather than quietly building something else.

## Roles

- **Claude builds phase 1**, one pull request per build step in 9.1, each with its tests passing.
- **Codex reviews** those pull requests (quality control). Codex comments; it does not push to Claude's branches.

## Owner's standing rules

These come from the owner's decisions in section 12 and apply to every change. Exact wording is in 9.5.

- Results are before tax and say so. There is no after-tax view in this version.
- The page uses generic technology names. Company or product names appear only in linked source citations.
- Vendor prices are optional, dated, sourced and labeled as vendor information that the user can replace with a
  quote. A missing price stays blank and says a quote is required. Never invent a price. A published price never
  counts as support for a projected saving.
- Synthetic examples are labeled as made up and never read as the site owner's own operation.
- The examples load with a visible, editable example discount rate labeled as an assumption. When users analyze
  their own operation, the page prompts them to review it. No rate is presented as right for everyone.
- Land can be owned, leased or both. Results are the operator's share; amounts paid or received by others are listed
  separately.
- US-first: US dollars and units by default. Non-US research is labeled with country, currency and data year, and is
  never a default.
- The EID compliance baseline (B4b) is not built until research task R1 (8.4) is done.

## Conventions

- `roi.js` stays pure and importable in Node. DOM code stays in `app.js`. Code that tests must import, such as
  `migrateV1()` (B8), goes in a DOM-free module.
- One build step per pull request. Each pull request lists the roadmap items and spec sections it implements.
- `README.md` documents every formula; update it when a formula changes.

## Review guidelines

For reviewing pull requests in this repository:

1. Read the description to see which build step and roadmap items the pull request claims.
2. Check the code against those spec sections, and cite the section in each comment.
3. Run the tests. Confirm that every test 9.7 and 10.1 require for that step exists, asserts what the spec says, and
   passes.
4. Example results must match Appendix A to within $1 (ratios to within 0.001; driver values to within 0.01 of their
   unit).
5. Treat these as blocking: a wrong cash flow or formula; a required test missing, weakened or skipped; a pinned
   number not matched; a broken owner rule above; an old shared link that throws or silently maps to the wrong
   inputs; DOM code in `roi.js`; a new dependency or build step.
6. Treat naming, style and small clarity improvements as optional, and say so.
7. If the spec is the problem, start the comment with "Spec issue".
