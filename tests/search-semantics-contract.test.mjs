// BNDR. Search semantics regression contract.
// Executes the REAL search engine (src/lib/search.ts, loaded via type
// stripping) to prove the weighted fuzzy/typo/acronym/priority behavior is
// intact, and that the streaming accumulator used by the database-paginated
// API routes is EXACTLY equivalent to searchResources over the same corpus -
// same ranking, same totals, same page slices. This is the guard against
// "API pagination" quietly replacing the public search semantics.

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  compareScored,
  createSearchAccumulator,
  searchResources,
} from "../src/lib/search.ts";

function fixture(id, name, extra = {}) {
  return {
    id,
    name,
    acronym: null,
    description: null,
    category: "help",
    subcategory: null,
    phoneRaw: null,
    phoneNormalized: null,
    email: null,
    address: null,
    website: null,
    tags: "",
    priority: 0,
    verified: true,
    published: true,
    sourceNote: null,
    ...extra,
  };
}

const corpus = [
  fixture("r1", "Housing Assistance Network", {
    description: "Emergency housing help",
    tags: "housing,shelter",
  }),
  fixture("r2", "Patient Advocate Foundation", {
    acronym: "PAF",
    tags: "medical,financial",
  }),
  fixture("r3", "Community Food Bank", { tags: "food,groceries" }),
  fixture("r4", "Sunrise Meals Coalition", { tags: "food,meals" }),
  fixture("r5", "Aid Alpha", { tags: "aid" }),
  fixture("r6", "Aid Alpha Priority", { tags: "aid", priority: 2 }),
  fixture("r7", "Legal Services Center", { tags: "legal" }),
  fixture("r8", "Zebra Wellness", { tags: "wellness" }),
];

const all = (query, limit = 100, offset = 0) =>
  searchResources(corpus, query, { limit, offset });

test("typo queries still match via fuzzy scoring", () => {
  const results = all("housng");
  assert.ok(results.length >= 1, "fuzzy match must tolerate a one-character typo");
  assert.equal(results[0].id, "r1");
});

test("exact acronym queries rank the acronym owner first", () => {
  const results = all("paf");
  assert.ok(results.length >= 1);
  assert.equal(results[0].id, "r2");
});

test("priority boosts ranking among equal-content matches", () => {
  const results = all("aid alpha");
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("r5") && ids.includes("r6"));
  assert.ok(ids.indexOf("r6") < ids.indexOf("r5"), "priority 2 row must outrank priority 0 twin");
});

test("empty and stopword-only queries return the neutral alphabetical view with honored pagination", () => {
  const everything = all("");
  const names = everything.map((r) => r.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(names, sorted, "empty query must be name-ordered");
  assert.equal(everything.length, corpus.length);

  const page = all("the of", 3, 2);
  assert.deepEqual(
    page.map((r) => r.id),
    everything.slice(2, 5).map((r) => r.id),
    "stopword-only query must behave like the empty query, honoring offset/limit",
  );
});

test("streaming accumulator is exactly equivalent to searchResources for every query and page", () => {
  const queries = ["housng", "paf", "food", "aid", "legal", "zzzqqq"];
  for (const q of queries) {
    const expected = all(q);
    const acc = createSearchAccumulator(q);
    assert.equal(acc.hasQuery, true, `"${q}" must be treated as a real query`);
    for (let i = 0; i < corpus.length; i += 3) {
      acc.add(corpus.slice(i, i + 3));
    }
    const full = acc.finalize(0, 100);
    assert.equal(full.total, expected.length, `total mismatch for query "${q}"`);
    assert.deepEqual(
      full.page.map((r) => r.id),
      expected.map((r) => r.id),
      `ranking mismatch for query "${q}"`,
    );

    // Page-slice equivalence with a different batch shape (one row at a time).
    const acc2 = createSearchAccumulator(q);
    for (const row of corpus) acc2.add([row]);
    const paged = acc2.finalize(1, 2);
    assert.deepEqual(
      paged.page.map((r) => r.id),
      expected.slice(1, 3).map((r) => r.id),
      `page slice mismatch for query "${q}"`,
    );
    assert.equal(paged.total, expected.length);
  }

  const stopwordAcc = createSearchAccumulator("the of");
  assert.equal(stopwordAcc.hasQuery, false, "stopword-only queries take the browse path");
  const emptyAcc = createSearchAccumulator("");
  assert.equal(emptyAcc.hasQuery, false);
});

test("scored comparator breaks full ties alphabetically for stable pagination", () => {
  const a = { ...fixture("x1", "Alpha"), _score: 5, _matched: [] };
  const b = { ...fixture("x2", "Beta"), _score: 5, _matched: [] };
  assert.ok(compareScored(a, b) < 0);
  assert.ok(compareScored(b, a) > 0);
  const boosted = { ...fixture("x3", "Zed", { priority: 3 }), _score: 5, _matched: [] };
  assert.ok(compareScored(boosted, a) < 0, "equal score: higher priority wins");
});
