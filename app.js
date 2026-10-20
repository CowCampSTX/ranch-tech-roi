// Page wiring for Ranch Tech ROI (docs/audit/phase1-spec.md 9.1 step 6, 9.5): the state lives in `a`, an analysis (9.2).
// Each user action goes through state.js; the form comes from form.js; every text from text.js; every number from
// roi.js. This file only draws them and connects the events.
import { HORIZON_NOTE, analyze, buildLines, landUnitsOf, lastShownYear, operatorShare, solveDrivers, targetTest, tornado, twoWayGrid, validate } from "./roi.js";
import { EXAMPLE_IDS, EXAMPLE_NAMES, example } from "./examples.js";
import { addItem, addPart, analyzeMine, byYearReady, getAt, keepRate, keepValue, loadExample, removeItem, removeKey, reset,
  setInput, setInstall, setPricing, setShare, toByYear, toFlat, useVendorPrice } from "./state.js";
import { readLink, writeLink } from "./links.js";
import { formGroups, newItem, readYears, shownLabel, shownValue, yearsUnread } from "./form.js";
import * as T from "./text.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** A source link's address, only when it is a web address: a link can carry any text (B8). */
/** text with its part cite linked to url, or text alone when either is missing (9.5 item 4). */
function linked(text, cite, url, id) {
  const href = T.safeUrl(url);
  if (!href) return esc(text);
  const anchor = (x) => `<a href="${esc(href)}"${id ? ` id="${esc(id)}"` : ""} target="_blank" rel="noopener">${esc(x)}</a>`;
  // A function, so that a "$" in the address is not read as a replacement pattern.
  return cite && text.includes(cite) ? esc(text).replace(esc(cite), () => anchor(cite)) : anchor(text);
}

// ---------------------------------------------------------------- state

const link = readLink(location.hash);
let a = link.state;
let linkNote = T.linkBanner(link);
let horizonNote = !!link.horizonAssumed;
// An unreadable link opens Synthetic Ranch A, so the address and "Copy link" carry Ranch A, not the link that failed.
if (link.kind === "unreadable") {
  try {
    history.replaceState(null, "", "#" + writeLink(a));
  } catch {
    // A page opened from a file can refuse replaceState.
  }
}
// Which groups and details are open, kept across redraws of the form.
const open = new Set(["operation", "settings", "module", "labor", "costs"]);

/** Takes the next state from a state.js action, writes the link, and redraws. */
function commit(next, { form = true } = {}) {
  if (next === a) {
    if (form) drawForm();
    return;
  }
  if (next.settings.T !== a.settings.T) horizonNote = false;
  a = next;
  try {
    history.replaceState(null, "", "#" + writeLink(a));
  } catch {
    // A page opened from a file can refuse replaceState; the page still works.
  }
  if (form) drawForm();
  scheduleResults();
}

let pending = null;
function scheduleResults() {
  clearTimeout(pending);
  pending = setTimeout(drawResults, 60);
}

// ---------------------------------------------------------------- the inputs

/** A class badge; its hover text says what the class means, never the source (9.5 items 3 and 4). */
function badge(cls) {
  if (!cls) return "";
  return `<span class="badge ${esc(cls)}" title="${esc(T.badgeTitle(cls))}">${esc(cls)}</span>`;
}

/** The badge and source of a value (9.5 items 3 and 4): every value the user did not type carries its class. */
function provMeta(path) {
  const p = a.prov?.[path];
  if (!p) return "";
  const href = p.cls === "C" || p.placeholder ? null : T.safeUrl(p.url);
  const src = href ? ` <a href="${esc(href)}" id="${esc(`prov:${path}`)}" target="_blank" rel="noopener">source</a>` : "";
  return `${badge(p.cls)}${src}`;
}

/** How a number field is shown: install time, a list by year, or one number. */
function numberMode(f) {
  if (f.install !== undefined) return "install";
  return Array.isArray(getAt(a, f.path)) && f.byYear ? "years" : "one";
}

const shown = (x) => (x === null || x === undefined || x === "" ? "" : String(x));

/**
 * The errors a field shows: those on its path or a part of it, and those on a path it is part of (the land units'
 * share total, a residual), so every error marks a field and opens its section.
 */
function errorsFor(path, errors) {
  const under = (e) => path.startsWith(`${e.path}.`) && (PART_FIELDS[e.path]?.test(path) ?? true);
  return errors.filter((e) => e.path === path || e.path.startsWith(`${path}.`) || under(e));
}

// The fields an error on a whole list marks: the land units' total marks each unit's share, not its other inputs.
const PART_FIELDS = { "settings.landUnits": /^settings\.landUnits\.\d+\.share$/ };

// The errors already written in this drawing of the form: an error that marks several fields is written once, under
// the first.
let said = new Set();
const errorHtml = (errs) => errs.filter((e) => !said.has(e) && said.add(e)).map((e) => `<div class="error" role="alert">${esc(e.message)}</div>`).join("");

/** A button the page redraws in place, with an id so it keeps the focus across a redraw. */
function actionButton(action, path, text, { cls = "small", label, i } = {}) {
  const id = `act:${action}:${path ?? ""}${i !== undefined ? `:${i}` : ""}`;
  return `<button type="button" class="${cls}" id="${esc(id)}" data-action="${action}"${path !== undefined ? ` data-path="${esc(path)}"` : ""}`
    + `${i !== undefined ? ` data-i="${esc(i)}"` : ""}${label ? ` aria-label="${esc(label)}"` : ""}>${esc(text)}</button>`;
}

/** The label a field's input is announced with: its shown label and, inside an item, the item it belongs to. */
const nameIn = (label, ctx) => (ctx && !label.includes(ctx) ? `${label}, ${ctx}` : label);

/**
 * A number input with its label and unit (9.4 intro), its badge and source, and the labels of 9.5 items 4, 5 and 7: a
 * price's label or "Quote required", a placeholder's flag and "Keep this value" (on any synthetic placeholder, a price
 * or not), the rate's example label and prompt.
 */
function numField(f, errors, ctx) {
  const v = shownValue(a, f);
  const mode = numberMode(f);
  const id = `f:${f.path}`;
  const errs = errorsFor(f.path, errors);
  const label = shownLabel(f);
  let control;
  if (mode === "years") {
    // Each year 0..T, the years past the end of a shorter list showing the value it carries (9.2).
    const years = Array.from({ length: lastShownYear(a) + 1 }, (_, t) => t);
    control = `<div class="years">${years.map((t) => `<div><label for="${esc(`${id}.${t}`)}">Year ${t}</label>`
      + `<input type="number" id="${esc(`${id}.${t}`)}" data-num="${esc(f.path)}" data-entry="${t}" data-scale="${f.scale}" step="any" min="0"`
      + ` aria-label="${esc(`${nameIn(label, ctx)}, year ${t}`)}" value="${esc(shown(v[t]))}"></div>`).join("")}</div>`
      + actionButton("flat", f.path, "Same value every year", { cls: "link", label: `${nameIn(label, ctx)}: same value every year` });
  } else {
    const install = mode === "install" ? ` data-install="${esc(f.install)}"` : "";
    const placeholder = f.placeholder !== undefined ? ` placeholder="${esc(f.placeholder)}"` : "";
    const aria = ctx && !label.includes(ctx) ? ` aria-label="${esc(nameIn(label, ctx))}"` : "";
    control = `<input type="number" id="${esc(id)}" data-num="${esc(f.path)}"${install} data-scale="${f.scale}" step="any" min="0"${placeholder}${aria} value="${esc(shown(v))}">`;
  }
  const meta = [];
  const p = a.prov?.[f.path];
  if (f.price) {
    const note = T.priceNote(a, f.path, getAt(a, f.path));
    if (note?.quote) meta.push(`<span class="quote">${esc(note.text)}</span>`);
    else if (note) meta.push(`<span>${linked(note.text, note.cite, note.url, `src:${f.path}`)}</span>`);
  } else if (p?.placeholder) {
    meta.push(`<span>${esc(T.priceLabel(p))}</span>`);
  }
  const flag = T.placeholderFlag(a, f.path);
  if (flag) meta.push(`<span class="flag">${esc(flag.text)}</span>${flag.keep ? ` ${actionButton("keepValue", f.path, "Keep this value", { label: `Keep this value: ${nameIn(label, ctx)}` })}` : ""}`);
  if (f.price && f.fill) meta.push(actionButton("fill", f.path, "Use published vendor price", { label: `Use published vendor price: ${nameIn(label, ctx)}` }));
  if (f.rate) {
    const r = T.rateField(a);
    if (r.label) meta.push(`<span>${esc(r.label)}</span>`);
    if (r.prompt) meta.push(`<span class="flag">${esc(T.RATE_PROMPT)}</span> ${actionButton("keepRate", undefined, "Keep this rate")}`);
  }
  if (f.byYear && mode === "one" && v !== null && v !== undefined && v !== "" && byYearReady(a, f.path)) {
    meta.push(actionButton("byYear", f.path, "By year", { cls: "link", label: `Enter ${nameIn(label, ctx)} by year` }));
  }
  const help = [f.help ? esc(f.help) : "", f.sources ? f.sources.map(([name, url]) => linked(name, null, url)).join(" · ") : ""]
    .filter(Boolean).join(" ");
  const cap = f.cap !== undefined && f.cap < 1 ? `Most the analysis uses here: ${esc(T.percent(f.cap))}.` : "";
  return `<div class="field${f.advanced ? " adv" : ""}${errs.length ? " error-field" : ""}${mode === "years" ? " wide" : ""}">`
    + `<div class="row"><label for="${esc(mode === "years" ? `${id}.0` : id)}">${esc(label)} ${provMeta(f.path)}</label>${mode === "years" ? "" : control}</div>`
    + (mode === "years" ? control : "")
    + (meta.length ? `<div class="meta">${meta.join(" ")}</div>` : "")
    + (help || cap ? `<div class="help">${[help, cap].filter(Boolean).join(" ")}</div>` : "")
    + errorHtml(errs)
    + "</div>";
}

function selectField(f, errors) {
  const stored = getAt(a, f.path);
  // A value that is none of the options (blank, or a land unit since removed from a link) shows "Choose…", so that
  // choosing any option, the first included, changes it.
  const known = f.options.some(([v]) => v === (stored ?? f.dflt ?? ""));
  const value = known ? stored ?? f.dflt : "";
  const options = (known ? [] : [["", "Choose…"]]).concat(f.options);
  const errs = errorsFor(f.path, errors);
  return `<div class="field sel${f.advanced ? " adv" : ""}${errs.length ? " error-field" : ""}"><div class="row"><label for="${esc(`f:${f.path}`)}">${esc(f.label)} ${provMeta(f.path)}</label>`
    + `<select id="${esc(`f:${f.path}`)}" data-select="${esc(f.path)}">${options.map(([v, text]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(text)}</option>`).join("")}</select></div>`
    + errorHtml(errs) + "</div>";
}

function yesField(f) {
  const id = `f:${f.path}`;
  return `<div class="field${f.advanced ? " adv" : ""}"><label class="checks"><input type="checkbox" id="${esc(id)}" data-yes="${esc(f.path)}"${getAt(a, f.path) ? " checked" : ""}> ${esc(f.label)} ${provMeta(f.path)}</label>`
    + (f.help ? `<div class="help">${esc(f.help)}</div>` : "") + "</div>";
}

function textField(f) {
  const id = `f:${f.path}`;
  return `<div class="field${f.advanced ? " adv" : ""}"><div class="row"><label for="${esc(id)}">${esc(f.label)} ${provMeta(f.path)}</label>`
    + `<input type="text" id="${esc(id)}" data-text="${esc(f.path)}" value="${esc(getAt(a, f.path) ?? "")}"></div></div>`;
}

function classesField(f, ctx) {
  const stored = getAt(a, f.path);
  const chosen = new Set(Array.isArray(stored) && stored.length ? stored : f.dflt ?? []);
  return `<div class="field wide${f.advanced ? " adv" : ""}"><div class="row"><span>${esc(f.label)} ${provMeta(f.path)}</span></div>`
    + `<div class="checks" role="group" aria-label="${esc(nameIn(f.label, ctx))}">`
    + f.options.map(([c, text]) => `<label><input type="checkbox" id="${esc(`f:${f.path}:${c}`)}" data-class="${esc(f.path)}" value="${esc(c)}"${chosen.has(c) ? " checked" : ""}> ${esc(text)}</label>`).join("")
    + "</div></div>";
}

// Lists of years typed that cannot be read, by path: shown as typed with their error until fixed, never stored.
const unread = new Map();

function yearsListField(f, errors) {
  const id = `f:${f.path}`;
  const v = getAt(a, f.path);
  const errs = errorsFor(f.path, errors);
  const typed = unread.get(f.path);
  return `<div class="field${errs.length || typed !== undefined ? " error-field" : ""}"><div class="row"><label for="${esc(id)}">${esc(f.label)} (years, comma-separated) ${provMeta(f.path)}</label>`
    + `<input type="text" id="${esc(id)}" data-yearlist="${esc(f.path)}" value="${esc(typed ?? (Array.isArray(v) ? v.join(", ") : ""))}"></div>`
    + (typed !== undefined ? `<div class="error" role="alert">${esc(yearsUnread(Array.isArray(v) ? v : null))}</div>` : "")
    + errorHtml(errs) + "</div>";
}

/** "Who pays for this?" or "Who receives this saving?" (9.4 Shared): your share, by land unit when there are several. */
function shareField(f, errors, lines) {
  const line = lines.find((l) => l.id === f.lineId);
  if (!line) return "";
  const units = landUnitsOf(a);
  const stored = getAt(a, f.path);
  const errs = errorsFor(f.path, errors);
  const pct = (x) => Number((x * 100).toPrecision(12));
  const input = (path, unit, value, label) => `<div><label for="${esc(`f:${path}`)}">${esc(label)}</label>`
    + `<input type="number" id="${esc(`f:${path}`)}" data-share="${esc(f.path)}" data-unit="${esc(unit ?? "")}" step="any" min="0" max="100"`
    + ` aria-label="${esc(`${label}: ${f.label} (${f.title})`)}"`
    + ` placeholder="${esc(pct(operatorShare(a, line, units.find((u) => u.id === unit) ?? units[0])))}" value="${esc(value === undefined || value === null ? "" : pct(value))}"></div>`;
  let control;
  if (units.length <= 1) {
    const v = stored !== null && typeof stored === "object" ? stored[units[0].id] : stored;
    control = `<div class="years">${input(f.path, null, v, "Your share, %")}</div>`;
  } else {
    control = `<div class="years">${units.map((u) => input(`${f.path}.${u.id}`, u.id,
      stored !== null && typeof stored === "object" ? stored[u.id] : stored, `Land unit ${u.n}, %`)).join("")}</div>`;
  }
  return `<div class="item"><div class="head"><span>${esc(f.title)}</span></div><div class="field wide"><div class="row"><span class="unit">${esc(f.label)} Blank: set from the land units.</span></div>${control}`
    + (provMeta(f.path) ? `<div class="meta">${provMeta(f.path)}</div>` : "")
    + errorHtml(errs) + "</div></div>";
}

function rowsHtml(rows, errors, lines, ctx) {
  return rows.map((r) => rowHtml(r, errors, lines, ctx)).join("");
}

function rowHtml(r, errors, lines, ctx) {
  switch (r.type) {
    case "num": return numField(r, errors, ctx);
    case "select": return selectField(r, errors);
    case "yes": return yesField(r);
    case "text": return textField(r);
    case "classes": return classesField(r, ctx);
    case "years": return yearsListField(r, errors);
    case "share": return shareField(r, errors, lines);
    case "heading": return `<h4>${esc(r.text)}</h4>`;
    case "note": return `<p class="${r.error ? "error" : `note${r.rule ? " rule" : ""}`}">${esc(r.text)}</p>`;
    case "details": {
      const key = `details:${r.key ?? r.label}`;
      return `<details data-open="${esc(key)}" data-key="${esc(key)}"${open.has(key) ? " open" : ""}><summary id="${esc(`sum:${key}`)}">${esc(r.label)}</summary>${rowsHtml(r.rows, errors, lines, ctx)}</details>`;
    }
    case "item": {
      const remove = r.removable ? actionButton(r.key ? "removeKey" : "removeItem", r.path, "Remove", { i: r.i, label: r.removeLabel ?? `Remove ${r.title}` }) : "";
      return `<div class="item" data-key="${esc(`${r.path}.${r.i}`)}"><div class="head"><span>${esc(r.title)}</span>${remove}</div>`
        + `${rowsHtml(r.rows.map((x) => (x.type === "details" ? { ...x, key: `${r.path}.${r.i}` } : x)), errors, lines, r.title)}</div>`;
    }
    case "add":
      return `<div class="toolbar">${actionButton("add", r.path, r.label)}</div>`;
    case "addKey":
      return `<div class="addkey"><select id="${esc(`add:${r.path}`)}" aria-label="${esc(r.label)}">${r.options.map(([v, text]) => `<option value="${esc(v)}">${esc(text)}</option>`).join("")}</select>`
        + `${actionButton("addKey", r.path, r.label)}</div>`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------- redrawing in place

/**
 * Updates el's children to match html in place: an element that keeps its place, tag and key (its id or data-key)
 * stays the same element, so the field being typed in or tabbed to keeps the focus, a click under way lands, and open
 * details stay open. Only what changed is replaced.
 */
function morph(el, html) {
  const next = document.createElement(el.tagName);
  next.innerHTML = html;
  patchChildren(el, next);
}
const keyOf = (n) => (n.nodeType === 1 ? `${n.tagName}#${n.id || n.getAttribute("data-key") || ""}` : `#${n.nodeType}`);
function patchChildren(from, to) {
  const want = [...to.childNodes];
  want.forEach((y, i) => {
    const x = from.childNodes[i];
    if (!x) from.appendChild(y);
    else if (keyOf(x) !== keyOf(y)) from.replaceChild(y, x);
    else patchNode(x, y);
  });
  while (from.childNodes.length > want.length) from.lastChild.remove();
}
function patchNode(x, y) {
  if (x.nodeType !== 1) {
    if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue;
    return;
  }
  for (const { name } of [...x.attributes]) if (!y.hasAttribute(name)) x.removeAttribute(name);
  for (const { name, value } of [...y.attributes]) if (x.getAttribute(name) !== value) x.setAttribute(name, value);
  patchChildren(x, y);
  // The live state that an attribute no longer sets once the user has touched the control.
  if (x.tagName === "INPUT") {
    if (x.type === "checkbox") x.checked = y.hasAttribute("checked");
    else if (x.value !== (y.getAttribute("value") ?? "")) x.value = y.getAttribute("value") ?? "";
  } else if (x.tagName === "SELECT") {
    x.value = y.value;
  } else if (x.tagName === "DETAILS") {
    x.open = y.hasAttribute("open");
  }
}

function drawForm() {
  const focus = document.activeElement?.id;
  const near = neighbors(document.activeElement);
  // A section opened or closed by a click just before this redraw is kept (its toggle event comes after).
  for (const d of $("form").querySelectorAll("details[data-key]")) {
    const key = d.dataset.group ?? d.dataset.open;
    if (key) d.open ? open.add(key) : open.delete(key);
  }
  const errors = validate(a);
  said = new Set();
  let lines = [];
  try {
    lines = buildLines(a);
  } catch {
    lines = [];
  }
  morph($("form"), formGroups(a).map((g) => `<details class="group" data-group="${esc(g.id)}" data-key="${esc(g.id)}"${open.has(g.id) ? " open" : ""}>`
    + `<summary id="${esc(`sum:group:${g.id}`)}">${esc(g.title)}</summary>${g.note ? `<p class="note">${esc(g.note)}</p>` : ""}${rowsHtml(g.rows, errors, lines)}</details>`).join(""));
  // A field with an error is shown: its groups open, and advanced inputs shown when it is one (9.5 item 7).
  for (const field of $("form").querySelectorAll(".error-field")) {
    if (field.classList.contains("adv") && !document.body.classList.contains("show-advanced")) {
      $("showAdvanced").checked = true;
      document.body.classList.add("show-advanced");
    }
    for (let d = field.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
  }
  $("example").value = a.example;
  drawBanners();
  restoreFocus(focus, near);
}

// The button just pressed, so that a press that removes its own button can be told from an entry that removes the
// button Tab was going to; cleared by the next Tab. And whether the last Tab went back (Shift+Tab).
let press = null, back = false;
function notePress(el) {
  const { action, path } = el.dataset;
  const removes = /^remove/.test(action) ? [...$("form").querySelectorAll(`button[data-action="${action}"]`)].filter((b) => b.dataset.path === path) : [];
  press = { id: el.id, key: action === "addKey" ? $(`add:${path}`)?.value : undefined, row: el.closest("tr")?.rowIndex,
    list: path, last: removes.length > 0 && removes[removes.length - 1] === el };
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    press = null;
    back = e.shiftKey;
  }
}, true);
document.addEventListener("pointerdown", () => { back = false; }, true);

// Shown and enabled: not hidden, and not inside a closed details (whose content keeps its boxes in some browsers).
const usable = (x) => x && !x.disabled && (x.checkVisibility ? x.checkVisibility() : x.offsetParent !== null);

/** The form's controls in the order Tab follows them. */
const focusables = () => [...$("form").querySelectorAll("input, select, button, a[href], summary")].filter(usable);

/**
 * The ids of the controls after el in the form, in the order Tab follows, and of those before it, nearest first: where
 * the focus goes if el is redrawn away.
 */
function neighbors(el) {
  const all = el?.id ? focusables() : [];
  const i = all.indexOf(el);
  const ids = (list) => list.map((x) => x.id).filter(Boolean);
  return i < 0 ? { after: [], before: [] } : { after: ids(all.slice(i + 1)), before: ids(all.slice(0, i).reverse()) };
}

/** Focuses x as Tab would: a text or number field with its value selected, so typing replaces it. */
function focusOn(x) {
  x.focus();
  if (x.tagName === "INPUT" && /^(number|text)$/.test(x.type)) x.select();
}

/**
 * After a redraw, the focus goes back to the control that held it, by id. When that control is gone, a button that
 * was pressed passes it to the control that took its place (By year to the year 0 entry, Same value every year, Keep
 * this value and the vendor price to their field, Keep this rate to the rate, the last class added to its first
 * field, the last item of a list removed to the list's Add control). Any other control passes it to the field that
 * replaced it (a field shown by year, or no longer by year), else to the control that followed it (preceded it, after
 * Shift+Tab): after an entry removes the button Tab was going to, the focus moves on and never goes back into the field
 * just typed in. A field gets the focus with its value selected, as Tab gives it.
 */
function restoreFocus(id, near = { after: [], before: [] }) {
  const pressed = press?.id === id ? press : null;
  const held = document.activeElement;
  if (!id || (held && held !== document.body && !held.disabled)) return;
  const same = document.getElementById(id);
  if (usable(same)) return focusOn(same);
  if (pressed) press = null;
  const [, kind, action, path] = id.match(/^(act|table):(\w+):(.*)$/) ?? [];
  const byId = (x) => document.getElementById(x);
  const field = (p) => byId(`f:${p}`) ?? byId(`f:${p}.0`);
  let to = null;
  // Analyze my operation turns itself off: the next button.
  if (id === "mine") to = $("reset");
  else if (pressed && kind === "act") {
    if (action === "byYear") to = byId(`f:${path}.0`);
    else if (["flat", "keepValue", "fill"].includes(action)) to = field(path);
    else if (action === "keepRate") to = field("settings.discountRate");
    else if (action === "addKey") to = byId(`act:removeKey:${path}:${pressed.key}`)?.closest(".item")?.querySelector("input, select");
    else if (pressed.last) to = byId(`act:add:${pressed.list}`) ?? byId(`add:${pressed.list}`);
  } else if (kind === "table") {
    // The table's Keep this value: the next row's link or button, else the control after the table.
    const table = $("assumptions");
    const rows = [...table.rows].slice((pressed?.row ?? Infinity) + 1);
    to = rows.map((r) => r.querySelector("a[href], button")).find(Boolean)
      ?? [...document.querySelectorAll("a[href], button, input, select, summary")]
        .find((x) => !table.contains(x) && table.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING && usable(x));
  } else if (id.startsWith("f:")) {
    to = byId(`${id}.0`) ?? byId(id.replace(/\.\d+$/, ""));
  }
  if (!usable(to)) to = (back && !pressed ? near.before : near.after).map(byId).find(usable);
  if (to) focusOn(to);
}

function drawBanners() {
  const out = [];
  if (linkNote) out.push(`<div class="banner link">${esc(linkNote)}</div>`);
  if (horizonNote) out.push(`<div class="banner link">${esc(HORIZON_NOTE)}</div>`);
  if (!a.settings.ownAnalysis) out.push(`<div class="banner">${esc(T.EXAMPLE_BANNERS[a.example])}</div>`);
  $("banners").innerHTML = out.join("");
  $("mine").disabled = !!a.settings.ownAnalysis;
}

// ---------------------------------------------------------------- input events

const parse = (s) => (s === "" ? null : Number(s));

$("form").addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.num !== undefined) {
    const scale = Number(el.dataset.scale) || 1;
    const v = parse(el.value);
    if (v !== null && !Number.isFinite(v)) return;
    const value = v === null ? null : v / scale;
    if (el.dataset.install !== undefined) return commit(setInstall(a, Number(el.dataset.install), value), { form: false });
    const path = el.dataset.entry !== undefined ? `${el.dataset.num}.${el.dataset.entry}` : el.dataset.num;
    commit(setInput(a, path, value), { form: false });
  } else if (el.dataset.share !== undefined) {
    const v = parse(el.value);
    if (v !== null && !Number.isFinite(v)) return;
    commit(setShare(a, el.dataset.share, el.dataset.unit || null, v === null ? null : v / 100), { form: false });
  }
});

// A press on a button that a redraw moves would lose its click (the press and the release land on different places):
// while a pointer is down, the redraw that follows an entry waits until the release and its click have run.
let pressed = false, redrawAfterPress = false;
document.addEventListener("pointerdown", () => { pressed = true; }, true);
for (const type of ["pointerup", "pointercancel"]) {
  document.addEventListener(type, () => {
    pressed = false;
    if (redrawAfterPress) {
      redrawAfterPress = false;
      setTimeout(drawForm, 0);
    }
  }, true);
}

// The form is redrawn in place once a number, a name or a list of years is entered, for its badge, notes and errors
// (morph keeps the focus). After the focus has moved on, so that a Tab lands where it was going (setTimeout), and not
// under a press.
function drawFormLater() {
  if (pressed) redrawAfterPress = true;
  else setTimeout(drawForm, 0);
}

$("form").addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.num !== undefined || el.dataset.share !== undefined) return drawFormLater();
  if (el.dataset.select !== undefined) {
    const path = el.dataset.select, value = el.value === "" ? null : el.value;
    // Choosing how collars are paid for adds that model's lines, blank, so each reads "Quote required" (9.4).
    return commit(path === "vf.pricing" ? setPricing(a, value) : setInput(a, path, value));
  }
  if (el.dataset.yes !== undefined) return commit(setInput(a, el.dataset.yes, el.checked));
  if (el.dataset.text !== undefined) {
    commit(setInput(a, el.dataset.text, el.value.trim() === "" ? null : el.value.trim()), { form: false });
    return drawFormLater();
  }
  if (el.dataset.class !== undefined) {
    const path = el.dataset.class;
    const chosen = [...$("form").querySelectorAll(`input[data-class="${CSS.escape(path)}"]:checked`)].map((x) => x.value);
    return commit(setInput(a, path, chosen));
  }
  if (el.dataset.yearlist !== undefined) {
    const path = el.dataset.yearlist, years = readYears(el.value);
    if (years === null) unread.set(path, el.value);
    else {
      unread.delete(path);
      commit(setInput(a, path, years.length ? years : null), { form: false });
    }
    return drawFormLater();
  }
});

$("form").addEventListener("toggle", (e) => {
  const el = e.target;
  const key = el.dataset?.group ?? el.dataset?.open;
  if (!key) return;
  if (el.open) open.add(key); else open.delete(key);
}, true);

$("form").addEventListener("click", (e) => {
  const el = e.target.closest("button[data-action]");
  if (!el) return;
  notePress(el);
  const { action, path } = el.dataset;
  switch (action) {
    case "keepValue": return commit(keepValue(a, path));
    case "keepRate": return commit(keepRate(a));
    case "fill": return commit(useVendorPrice(a, path));
    case "add": return commit(addItem(a, path, newItem(a, path)));
    case "removeItem": return commit(removeItem(a, path, Number(el.dataset.i)));
    case "removeKey": return commit(removeKey(a, path, el.dataset.i));
    case "addKey": {
      const key = $(`add:${path}`)?.value;
      return key ? commit(addPart(a, path, key)) : undefined;
    }
    case "byYear": return commit(toByYear(a, path));
    case "flat": return commit(toFlat(a, path));
    default:
      return undefined;
  }
});

$("example").innerHTML = EXAMPLE_IDS.map((id) => `<option value="${id}">${esc(EXAMPLE_NAMES[id])}: ${esc(T.moduleName(example(id).module))}</option>`).join("");
$("example").addEventListener("change", (e) => {
  unread.clear();
  linkNote = null;
  horizonNote = false;
  commit(loadExample(e.target.value));
});
$("reset").addEventListener("click", () => {
  unread.clear();
  linkNote = null;
  horizonNote = false;
  commit(reset(a));
});
$("mine").addEventListener("click", () => commit(analyzeMine(a)));
$("copy").addEventListener("click", async () => {
  const button = $("copy");
  try {
    await navigator.clipboard.writeText(location.href);
    button.textContent = "Link copied";
  } catch {
    button.textContent = "Copy the address bar";
  }
  setTimeout(() => (button.textContent = "Copy link"), 1800);
});
$("showAdvanced").addEventListener("change", (e) => document.body.classList.toggle("show-advanced", e.target.checked));

// ---------------------------------------------------------------- tooltip

const tip = $("tip");
function showTip(e, lines) {
  tip.innerHTML = lines.map((l, i) => (i === 0 ? `<b>${esc(l)}</b>` : esc(l))).join("<br>");
  tip.style.display = "block";
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
  const y = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 8);
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}
const hideTip = () => (tip.style.display = "none");
function hover(el, lines) {
  el.addEventListener("pointermove", (e) => showTip(e, lines));
  el.addEventListener("pointerleave", hideTip);
}

// ---------------------------------------------------------------- charts

/**
 * Round axis ticks from min to max, about count of them, a step of at least $1 (money axes), each a whole number of
 * steps so no tick drifts with the float sum.
 */
function niceTicks(min, max, count = 5) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw));
  const ticks = [];
  for (let k = Math.floor(min / step); k * step <= max + step * 0.001; k++) ticks.push(Number((k * step).toPrecision(12)));
  if (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toPrecision(12)));
  return ticks;
}
/** An axis value: "$0", "$2.5", "−$12.5k", "$1.25M", with the decimals the tick needs (at most two). */
function compact(x) {
  const sign = x < 0 ? "−" : "", v = Math.abs(x);
  const short = (n) => String(Math.round(n * 100) / 100);
  if (v >= 1e12) return `${sign}$${short(v / 1e12)}T`;
  if (v >= 1e9) return `${sign}$${short(v / 1e9)}B`;
  if (v >= 1e6) return `${sign}$${short(v / 1e6)}M`;
  if (v >= 1e3) return `${sign}$${short(v / 1e3)}k`;
  return `${sign}$${short(v)}`;
}
const NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function cumulativeChart(r) {
  const c = T.cumulativeChart(r);
  const W = 760, H = 270, m = { l: 64, r: 88, t: 16, b: 32 };
  const pts = c.points;
  const ticks = niceTicks(Math.min(0, ...pts.map((p) => p.value)), Math.max(0, ...pts.map((p) => p.value)));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (t) => m.l + (t / Math.max(1, pts.length - 1)) * (W - m.l - m.r);
  const y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cumulative net cash by year, your share, before tax" });
  for (const t of ticks) {
    svgEl("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: t === 0 ? "var(--axis)" : "var(--grid)", "stroke-width": 1 }, svg);
    svgEl("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end" }, svg).textContent = compact(t);
  }
  const every = Math.ceil(pts.length / 12);
  pts.forEach((p, i) => {
    if (i % every === 0 || i === pts.length - 1) svgEl("text", { x: x(p.year), y: H - 10, "text-anchor": "middle" }, svg).textContent = `Year ${p.year}`;
  });
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(p.value)}`).join("");
  svgEl("path", { d: `${d}L${x(pts[pts.length - 1].year)},${y(0)}L${x(0)},${y(0)}Z`, fill: "var(--s1)", "fill-opacity": 0.1, stroke: "none" }, svg);
  svgEl("path", { d, fill: "none", stroke: "var(--s1)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
  if (c.mark) {
    const px = x(c.mark.at);
    svgEl("line", { x1: px, x2: px, y1: m.t, y2: H - m.b, stroke: "var(--ink-2)", "stroke-dasharray": "3 4" }, svg);
    const right = px < W - 220;
    svgEl("text", { x: right ? px + 6 : px - 6, y: m.t + 12, class: "lbl", "text-anchor": right ? "start" : "end" }, svg).textContent = c.mark.text;
  }
  // Each year's hover target spans the space between its neighbours, so it never covers another year's point.
  const slot = (W - m.l - m.r) / Math.max(1, pts.length - 1);
  pts.forEach((p) => {
    svgEl("circle", { cx: x(p.year), cy: y(p.value), r: 4.5, fill: "var(--s1)", stroke: "var(--surface)", "stroke-width": 2 }, svg);
    const hit = svgEl("rect", { x: x(p.year) - slot / 2, y: m.t, width: slot, height: H - m.t - m.b, fill: "transparent" }, svg);
    hover(hit, [`Year ${p.year}`, `Net cash ${T.money(r.N[p.year])}`, `Cumulative ${T.money(p.value)}`]);
  });
  const last = pts[pts.length - 1];
  svgEl("text", { x: x(last.year) + 8, y: y(last.value) + 4, class: "strong" }, svg).textContent = T.money(last.value);
  $("cumChart").replaceChildren(svg);
  $("cumCaption").textContent = T.CUMULATIVE_CAPTION + (c.state ? ` ${c.state}.` : "");
}

function tornadoChart(t) {
  $("tornadoCaption").textContent = T.tornadoCaption(t);
  $("tornadoLegend").innerHTML = `<span><span class="sw" style="background:var(--s1)"></span>${esc(T.TORNADO_LEGEND[0])}</span>`
    + `<span><span class="sw" style="background:var(--s2)"></span>${esc(T.TORNADO_LEGEND[1])}</span>`
    + `<span><span class="sw" style="background:var(--ink);width:2px"></span>Cash NPV as entered</span>`;
  $("tornadoLists").innerHTML = T.tornadoLists(t).map((l) => `<li>${esc(l)}</li>`).join("");
  const rows = t.bars;
  if (!rows.length) {
    $("tornado").replaceChildren();
    return;
  }
  const W = 760, rowH = 30, m = { l: 250, r: 20, t: 8, b: 30 }, H = m.t + m.b + rows.length * rowH;
  const vals = rows.flatMap((b) => [b.low, b.high]).concat(t.base);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const x0 = ticks[0], x1 = ticks[ticks.length - 1];
  const x = (v) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cash NPV with each input moved 20% down and up" });
  for (const tk of ticks) {
    svgEl("line", { x1: x(tk), x2: x(tk), y1: m.t, y2: H - m.b, stroke: tk === 0 ? "var(--axis)" : "var(--grid)" }, svg);
    svgEl("text", { x: x(tk), y: H - 10, "text-anchor": "middle" }, svg).textContent = compact(tk);
  }
  rows.forEach((b, i) => {
    const cy = m.t + i * rowH + rowH / 2;
    const label = b.label.length > 38 ? `${b.label.slice(0, 36)}…` : b.label;
    svgEl("text", { x: m.l - 10, y: cy + 4, "text-anchor": "end", class: "lbl" }, svg).textContent = label;
    for (const [v, color] of [[b.low, "var(--s1)"], [b.high, "var(--s2)"]]) {
      const left = Math.min(x(v), x(t.base)), w = Math.max(1, Math.abs(x(v) - x(t.base)));
      svgEl("rect", { x: left, y: cy - 9, width: w, height: 18, rx: 3, fill: color }, svg);
    }
    const hit = svgEl("rect", { x: 0, y: cy - rowH / 2, width: W, height: rowH, fill: "transparent" }, svg);
    hover(hit, T.tornadoHover(b));
  });
  const bx = x(t.base);
  svgEl("line", { x1: bx, x2: bx, y1: m.t - 4, y2: H - m.b, stroke: "var(--ink)", "stroke-width": 1.5 }, svg);
  $("tornado").replaceChildren(svg);
}

function grid(g) {
  $("gridCard").hidden = !g;
  if (!g) return;
  $("gridNote").textContent = T.gridNote(g);
  const cells = g.cells.flat().filter((v) => v !== null);
  const maxAbs = Math.max(1, ...cells.map(Math.abs));
  const bg = (v) => (v === null ? "var(--mid)" : v >= 0 ? (v / maxAbs > 0.5 ? "var(--pos-2)" : "var(--pos-1)") : (-v / maxAbs > 0.5 ? "var(--neg-2)" : "var(--neg-1)"));
  const head = `<tr><th>${esc(g.rows.label)} ↓ / ${esc(g.cols.label)} →</th>${g.cols.values.map((v) => `<th>${esc(T.gridValue(g.cols, v))}</th>`).join("")}</tr>`;
  const body = g.rows.values.map((rv, i) => `<tr><th>${esc(T.gridValue(g.rows, rv))}</th>${g.cells[i].map((v, j) => {
    const base = i === g.base[0] && j === g.base[1];
    return `<td class="${base ? "base" : ""}" style="background:${bg(v)}">${v === null ? "n/a" : esc(T.money(v))}</td>`;
  }).join("")}</tr>`).join("");
  $("grid").innerHTML = head + body;
}

// ---------------------------------------------------------------- results

function verdict(r, test, rows, bars) {
  const lines = T.verdictArea(a, r, test, rows, bars);
  const cls = (l, i) => {
    if (l === T.INDICATIVE) return "indicative";
    if (l === T.PUBLISHED_PRICES) return "prices";
    if (l.startsWith("Over ") || l.startsWith("No cash flows for you in")) return "main";
    if (i <= 2 && /^(Pays|Does not pay|No cash flows for you within)/.test(l)) return "target";
    if (l === "Discount rate not yet reviewed." || l === "Includes synthetic cost placeholders.") return "notes";
    return "";
  };
  $("verdict").innerHTML = lines.map((l, i) => `<p class="${cls(l, i)}">${esc(l)}</p>`).join("");
  $("tiles").innerHTML = T.tiles(a, r).map((tile, i) => {
    const neg = /^about −/.test(tile.value);
    const long = tile.value.length > 22;
    return `<div class="tile${i === 0 ? " headline" : ""}"><div class="k">${esc(tile.label)}</div><div class="v${neg ? " neg" : ""}${long ? " long" : ""}">${esc(tile.value)}</div></div>`;
  }).join("");
}

function panel(r, test, rows) {
  const p = T.paybackPanel(a, r, test, rows);
  $("panelTitle").textContent = p.title;
  $("panelCaption").textContent = p.caption;
  $("panel").innerHTML = `<thead><tr>${p.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>`
    + p.rows.map((row) => `<tr><td>${esc(row.input)}${row.notes.map((n) => `<small>${esc(n)}</small>`).join("")}</td><td>${esc(row.entered)}</td><td>${esc(row.target)}</td><td>${esc(row.horizon)}</td></tr>`).join("")
    + "</tbody>";
  $("panelNotes").innerHTML = p.notes.map((n) => `<li>${esc(n)}</li>`).join("");
}

function notices(r) {
  const skip = new Set(["notEntered", "quoteRequired", "noCattle"]);
  const texts = [...new Set(r.notices.filter((n) => !skip.has(n.type)).map(T.noticeText).filter(Boolean))];
  $("notices").innerHTML = texts.length ? texts.map((x) => `<li>${esc(x)}</li>`).join("") : `<li class="note">None.</li>`;
  const left = T.leftOut(a, r);
  $("leftOut").innerHTML = left.items.length ? left.items.map((x) => `<li>${esc(x)}</li>`).join("") : `<li class="note">Nothing.</li>`;
  $("leftOutEnd").textContent = left.ending ?? "";
  $("quoteWarning").textContent = left.warning ?? "";
}

function yearTable(r) {
  const y = T.yearTable(a, r);
  $("yearNote").textContent = y.note;
  $("badgeLegend").innerHTML = ["A", "B", "C", "D", "E"].map((c) => `<span>${badge(c)} ${esc(T.CLASS_TEXT[c])}</span>`).join("");
  const groupClass = (g) => (g === "total" ? "total" : g === "risk" ? "risk" : "");
  const head = `<thead><tr>${y.columns.map((c) => `<th class="${groupClass(c.group)}">${esc(c.label)}${c.classes?.length ? ` ${c.classes.map((x) => badge(x)).join("")}` : ""}${c.note ? `<small>${esc(c.note)}</small>` : ""}</th>`).join("")}</tr></thead>`;
  const net = y.columns.findIndex((c) => c.label === "Net cash");
  const body = y.rows.map((row) => `<tr>${row.cells.map((cell, i) => {
    const neg = (i === net && row.negative[0]) || (i === net + 1 && row.negative[1]);
    return `<td class="${[groupClass(y.columns[i].group), neg ? "neg" : ""].filter(Boolean).join(" ")}">${esc(cell)}</td>`;
  }).join("")}</tr>${row.note ? `<tr class="note"><td colspan="${y.columns.length}">${esc(row.note)}</td></tr>` : ""}`).join("");
  $("yearTable").innerHTML = head + `<tbody>${body}</tbody>`;
  $("others").innerHTML = T.othersLists(a, r).filter(Boolean).map((list) => `<h3>${esc(list.title)}</h3><div class="scroll"><table>`
    + `<thead><tr>${list.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>`
    + `<tbody>${list.rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`).join("");
}

function assumptionsTable() {
  const rows = T.assumptions(a);
  $("assumptions").innerHTML = `<thead><tr><th>Input</th><th>Value</th><th>Class</th><th>Source</th></tr></thead><tbody>`
    + rows.map((x) => {
      const flag = T.placeholderFlag(a, x.path);
      // Only the source part of a label links to its source (9.5 item 4).
      const source = linked(x.source, x.cite, x.url);
      const keep = flag?.keep ? ` <button type="button" class="small" id="${esc(`table:keepValue:${x.path}`)}" data-action="keepValue" data-path="${esc(x.path)}" aria-label="${esc(`Keep this value: ${x.label}`)}">Keep this value</button>` : "";
      return `<tr><td>${esc(x.label)}</td><td>${esc(x.value)}</td><td>${badge(x.cls)} ${esc(x.classText)}</td><td>${source}${x.note ? ` <span class="note">(${esc(x.note)})</span>` : ""}`
        + `${flag ? ` <span class="flag warning">${esc(flag.text)}</span>${keep}` : ""}</td></tr>`;
    }).join("") + "</tbody>";
}
$("assumptions").addEventListener("click", (e) => {
  const el = e.target.closest("button[data-action=keepValue]");
  if (!el) return;
  notePress(el);
  commit(keepValue(a, el.dataset.path));
});

function formulas(r) {
  const f = T.formulas(a, r);
  $("formulas").innerHTML = f.sections.map((s) => `<h3>${esc(s.title)}</h3>${s.rows.length ? s.rows.map((row) => `<p class="formula">${esc(row.name)} = ${esc(row.expr)}${row.result ? ` = <b>${esc(row.result)}</b>` : ""}</p>`).join("") : `<p class="note">None.</p>`}`).join("")
    + `<p class="note">${esc(f.note)}</p>`;
}

function sources() {
  const rows = T.exampleSources(EXAMPLE_IDS.map(example));
  $("sources").innerHTML = `<thead><tr><th>Example</th><th>Input</th><th>Value</th><th>What it is</th></tr></thead><tbody>`
    + rows.map((x) => {
      const source = linked(x.source, x.cite, x.url);
      return `<tr><td>${esc(x.example)}</td><td>${esc(x.label)}</td><td>${esc(x.value)}</td><td>${badge(x.cls)} ${source}</td></tr>`;
    }).join("") + "</tbody>";
}

/**
 * True when every amount the page would draw is a finite number of at most $1e15 (judgment: an amount beyond that comes
 * from a number entered far too large, and would print a wall of digits or overflow the charts), else the page shows
 * T.TOO_LARGE in place of the results.
 */
const LARGEST = 1e15;
function drawable(r, test, t, g) {
  let c = 0;
  const amounts = [r.cashNPV, r.cashNPVWithRisk, r.economicNPV, test.cashNPV, ...r.N, ...r.N.map((x) => (c += x)), t.base,
    ...t.bars.flatMap((b) => [b.low, b.high]), ...(g ? g.cells.flat().filter((v) => v !== null) : []),
    // Every line's amounts, and what others pay and receive, which the year table and its lists print.
    ...r.lines.flatMap((l) => [l.pv ?? 0, l.pvResidual ?? 0, ...(l.series ?? []), ...(l.residual ?? []), ...(l.hours ?? [])]),
    ...[...r.paidByOthers, ...r.receivedByOthers].flatMap((x) => [x.pv ?? 0, ...x.series])];
  return amounts.every((x) => Number.isFinite(x) && Math.abs(x) <= LARGEST);
}

/** An error as the list under the results names it: the message, which names its field, or the field and the message. */
const errorText = (e) => (e.message.startsWith(e.label) ? e.message : `${e.label}: ${e.message}`);

/** The one line read out when the results change (the results themselves are not a live region). */
function announce(text) {
  if ($("live").textContent !== text) $("live").textContent = text;
}

function drawResults() {
  const focus = document.activeElement?.id;
  const errors = validate(a);
  const results = $("results");
  results.classList.toggle("invalid", errors.length > 0);
  if (errors.length) {
    $("errors").innerHTML = `<p class="error">Fix the inputs marked in red to see results.</p><ul class="plain">${errors.map((e) => `<li class="error">${esc(errorText(e))}</li>`).join("")}</ul>`;
    $("verdict").innerHTML = "";
    $("tiles").innerHTML = "";
    announce(`No results: ${errors.length === 1 ? "an input needs" : `${errors.length} inputs need`} fixing.`);
    return;
  }
  $("errors").innerHTML = "";
  let r;
  try {
    r = analyze(a);
    const test = targetTest(a, r), rows = solveDrivers(a, r, test), t = tornado(a, r), g = twoWayGrid(a, t);
    if (!drawable(r, test, t, g)) throw new RangeError("too large to draw");
    verdict(r, test, rows, t.bars);
    panel(r, test, rows);
    notices(r);
    cumulativeChart(r);
    tornadoChart(t);
    grid(g);
    yearTable(r);
    assumptionsTable();
    formulas(r);
    announce(T.verdictSentence(a, r, t.bars));
  } catch (err) {
    results.classList.add("invalid");
    $("errors").innerHTML = `<p class="error">${esc(T.TOO_LARGE)}</p>`;
    $("verdict").innerHTML = "";
    $("tiles").innerHTML = "";
    announce(T.TOO_LARGE);
    if (!(err instanceof RangeError)) console.error(err);
  }
  // A button in the results that was redrawn (such as "Keep this value") keeps the focus, or passes it on.
  restoreFocus(focus);
}

sources();
drawForm();
drawResults();
