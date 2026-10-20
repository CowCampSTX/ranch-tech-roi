# AGENTS.md

The one instruction file for every AI coding agent in this repository: Claude Code reads it through `CLAUDE.md`
(which only imports it), and Codex reads it directly. Change the rules here, never in a copy.

## Project

Ranch Tech ROI is a plain HTML and JavaScript calculator for ranch technology decisions: will remote water
monitoring, virtual fencing, or EID tags with a reader and scale pay for themselves on this ranch, before tax. It is
live at https://cowcampstx.github.io/ranch-tech-roi/, served by GitHub Pages from the root of `main`, so the page and
its scripts stay at the repository root.

The repository is public and is a portfolio piece for its owner (GitHub: CowCampSTX). Don't add anything about the
owner's background to the repository unless the owner asks. Never commit `.env` files, tokens or passwords.

**Status (20 Oct 2026):** phase 1 (section 9.1, build steps 1 to 6) is built and the page runs on the new engine.
The visual polish (PR #14) is merged. The one phase-1 item still held is the EID compliance baseline (B4b), which waits for
research task R1 (8.4).

There is no framework, build step or package manager. Keep it that way unless a change solves a demonstrated problem.

## Where things live

GitHub is the source of truth: both agents read and write the repository, and nothing an agent needs lives only
somewhere else.

```
AGENTS.md            this file (shared by Claude Code and Codex)
CLAUDE.md            imports this file with @AGENTS.md, nothing else
README.md            what the calculator does, every formula (update it when a formula changes)
index.html           the page
app.js               page and DOM code
form.js              the page's inputs, in the order of 9.4, as data
roi.js               the engine (pure functions, no DOM, no dependencies)
text.js              the page text built from the engine's output (DOM-free)
examples.js          the four synthetic example ranches with their `prov`, and the vendor fills (DOM-free)
state.js             what each user action does to the state (pure, DOM-free)
links.js             shared links: writing and reading the link, and migrateV1() (DOM-free)
v1.js                the version 1 inputs and presets (B8), kept only so old links can be read
tests/               node:test tests, run in CI (.github/workflows/test.yml)
  snapshots/         pinned version 1 links
docs/
  README.md          index of the docs, and the matching Google Drive folders
  audit/             the plan and the spec (see "The plan is the spec")
  training/          the training path: outline.md, the slide deck's source (deck/) and its screenshots (shots/)
  archive/           dated material kept for the record, not for building against
```

The tests: `roi.test.mjs` for the engine, `modules.test.mjs` for the three modules on the example ranches,
`examples.test.mjs` for the examples' provenance, `state.test.mjs` for the user actions, `links.test.mjs` for the
links, `pay.test.mjs` for the payback target and "What would make it pay", `sens.test.mjs` for the sensitivity
chart and two-way grid, `text.test.mjs` for the page text, `page.test.mjs` for the page switch.

New material goes in the folder it belongs to; add a new folder under `docs/` (and the same folder in Drive) only
for a new kind of material, and list it in `docs/README.md`. Name dated material `YYYY-MM-DD-what`.

**Google Drive** ([My Drive > `Ranch Tech ROI`](https://drive.google.com/drive/folders/15Knr__hN8oMxNsTSbdlj3WmF9wSN4xtK)) holds readable copies for the owner and anyone they share with. Drive
is a copy: change the repository first, then refresh the copy. Code stays in GitHub; put code in Drive only when the
owner needs it there. The project's Drive is the owner's Google account that Google Drive for desktop syncs on their
PC (`My Drive`). Check that a Drive connector is signed in to that same account before writing through it. For a
bulk refresh, copy on the owner's PC instead: download the branch from GitHub and copy `docs/` into the folders
below. The filing rules for
Drive:

- Everything for this project lives inside `Ranch Tech ROI`: never at the top of My Drive, in another project's
  folder, or loose anywhere else. Only material shared between projects lives outside a project folder.
- Every folder and subfolder, in Drive and under `docs/`, has a `README.md` saying what belongs in it.
- Every file goes in the folder for its kind, and the folders mirror `docs/` with the same names: `audit` (the plan,
  spec, evidence table, sources and prototype), `images` (README and page screenshots), `training` (outline, `deck`,
  `shots`) and `archive` (dated material kept for the record). Only `AGENTS.md`, `README.md` and `Docs index.md`
  (a copy of `docs/README.md`) sit at the top.
- A new kind of material gets a new folder in both places, and a row in `docs/README.md`.
- Dated material is named `YYYY-MM-DD-what`. Superseded files move to `archive`; nothing in Drive is deleted
  without the owner's OK.

**Claude artifacts:** the training slide deck is published at https://claude.ai/artifact/ANXUwkPPZ95YDk4F9W7JTn;
its source is `docs/training/deck/`.

## Run and test

Run the tests from the repository root, as CI does (Node 22):

    node --test tests/*.test.mjs

To see the page, open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and open
http://localhost:8000/. `node docs/audit/prototype/examples.mjs` reproduces Appendix A.

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
- [`docs/audit/prototype/`](docs/audit/prototype/) reproduces Appendix A. It is a reference for the numbers, not code
  to copy into the app.

When the code and the spec disagree, follow the spec. If the spec itself is wrong, contradicts itself or cannot be
built as written, raise it as a spec issue rather than quietly building something else.

## Roles

- Claude Code and Codex both work from this file. Either can build a change or review one.
- The agent that opens a pull request owns it. The other agent reviews by commenting and does not push to the
  owner's branch.
- Phase 1 was built by Claude and reviewed by Codex, one pull request per build step in 9.1.

## Owner's working rules

- Nothing lives only in a chat or a session. Decisions, plans, research, files and anything another agent would need
  go into the repository (or the Drive copy, for the owner's readable files) before the session ends.
- At most two review rounds per change before its pull request opens. Tests and CI still run on every pull request.
- Each new piece of work starts fresh (a new branch, and a new chat or thread with a short brief) rather than
  continuing one long session.
- When work pauses for a usage limit, post a progress update first (in the Claude project, to the project chat),
  just before the limit hits when possible.

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

A pull request must not make the page break a rule it already follows. The by-hand checklist of build step 6 covers
every rule on the page.

## Conventions

- `roi.js` stays pure and importable in Node. DOM code stays in `app.js`. Code that tests must import, such as
  `migrateV1()` (B8), goes in a DOM-free module.
- One change per pull request. Each pull request lists the roadmap items and spec sections it implements.
- `README.md` documents every formula; update it when a formula changes.
- Old shared links keep working: a change to the link format adds a version and a test, never breaks an old link.

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
