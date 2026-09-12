const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "performance-explorer.js"), "utf8");

assert.match(source, /function setTextIfChanged\(element, value\)/, "selection labels must be updated idempotently");
assert.match(source, /element\.textContent !== value/, "unchanged labels must not be rewritten");
assert.match(source, /function setAttributeIfChanged\(element, name, value\)/, "selection attributes must be updated idempotently");
assert.match(source, /element\.getAttribute\(name\) !== value/, "unchanged attributes must not be rewritten");
assert.match(source, /observe\(document\.querySelector\('#predictionGrid'\),\{childList:true\}\)/, "observer must be limited to direct grid replacements");
assert.doesNotMatch(source, /observe\(document\.querySelector\('#predictionGrid'\),\{childList:true,subtree:true\}\)/, "observer must not watch its own descendant controls");
assert.match(source, /selected\.length<10/, "ten-security selection limit must remain enforced");
assert.match(source, /controls\.clear\.addEventListener\('click'/, "clear-selection behavior must remain available");
assert.match(source, /document\.addEventListener\('click'.*data-performance-select/, "comparison controls outside the explorer root must use a reachable delegated listener");

class Element {
  constructor(kind, ticker = null) {
    this.kind = kind;
    this.dataset = ticker ? { performanceSelect: ticker } : {};
    this.children = [];
    this.attributes = new Map();
    this._text = "";
    this.parent = null;
    this.writes = 0;
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = value; this.writes += 1; notify(this, "childList"); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, value); this.writes += 1; notify(this, "attributes"); }
  append(child) { child.parent = this; this.children.push(child); notify(this, "childList"); }
  remove() { const index = this.parent?.children.indexOf(this) ?? -1; if (index >= 0) { const parent = this.parent; parent.children.splice(index, 1); this.parent = null; notify(parent, "childList"); } }
}

const grid = new Element("grid");
let callbackCount = 0;
let scheduled = false;
let selected = [];
const observers = [];
const count = new Element("count");

function isDescendant(node, ancestor) { for (let current = node; current; current = current.parent) if (current === ancestor) return true; return false; }
function notify(target, type) {
  if (observers.some((observer) => observer.type === type && (target === observer.target || (observer.subtree && isDescendant(target, observer.target))))) scheduled = true;
}
function settle() { let turns = 0; while (scheduled) { assert.ok(++turns <= 10, "observer callbacks must settle within a conservative bound"); scheduled = false; callbackCount += 1; decorateCards(); } return turns; }
function buttons() { return grid.children.flatMap((card) => card.children.filter((child) => child.kind === "select")); }
function setTextIfChanged(element, value) { if (element.textContent !== value) element.textContent = value; }
function setAttributeIfChanged(element, name, value) { if (element.getAttribute(name) !== value) element.setAttribute(name, value); }
function updateSelectionUI() {
  setTextIfChanged(count, `${selected.length} of 10 selected`);
  buttons().forEach((button) => {
    const active = selected.includes(button.dataset.performanceSelect);
    setTextIfChanged(button, active ? "Remove from comparison" : "Select for comparison");
    setAttributeIfChanged(button, "aria-pressed", String(active));
  });
}
function decorateCards() {
  grid.children.forEach((card) => {
    if (card.children.some((child) => child.kind === "select")) return;
    card.append(new Element("select", card.ticker));
  });
  updateSelectionUI();
}
function addCard(ticker) { const card = new Element("card"); card.ticker = ticker; grid.append(card); return card; }

observers.push({ target: grid, type: "childList", subtree: false });
const first = addCard("AAA");
assert.equal(settle(), 1, "one external insertion should require one observer callback");
assert.equal(buttons().length, 1, "initial card decoration should complete once");
assert.equal(settle(), 0, "observer must be idle after decoration");
const stableWrites = buttons()[0].writes + count.writes;
updateSelectionUI();
assert.equal(buttons()[0].writes + count.writes, stableWrites, "selection-label updates must be idempotent");

const second = addCard("BBB");
assert.equal(settle(), 1, "a second card insertion should settle after one callback");
assert.equal(buttons().length, 2);
second.remove();
assert.equal(settle(), 1, "card removal should settle after one callback");
assert.equal(buttons().length, 1);

selected = ["AAA"];
updateSelectionUI();
assert.equal(settle(), 0, "selection changes must not trigger grid observation");
assert.equal(buttons()[0].textContent, "Remove from comparison");
assert.equal(buttons()[0].getAttribute("aria-pressed"), "true");
selected = [];
updateSelectionUI();
assert.equal(settle(), 0, "unselect and clear behavior must settle immediately");
assert.equal(count.textContent, "0 of 10 selected");
assert.equal(buttons()[0].textContent, "Select for comparison");
assert.ok(callbackCount <= 3, `callback count must remain bounded; received ${callbackCount}`);

assert.doesNotMatch(source, /fetch\([^\n]*predictions\/scan/, "observer bookkeeping must not start a prediction scan");
assert.doesNotMatch(source.match(/function decorateCards\(\)[\s\S]*?function saveSelection/)?.[0] || "", /market-history/, "observer bookkeeping must not request historical data");
assert.ok(first.children.length === 1, "the same comparison control must not be decorated repeatedly");

console.log(`Performance Explorer observer stabilization contract passed (${callbackCount} bounded callbacks).`);
