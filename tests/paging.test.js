import { test } from "node:test";
import assert from "node:assert/strict";
import { replacePages, parseReferenceString } from "../src/algorithms/paging.js";

const textbook = parseReferenceString("7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1");

test("Silberschatz reference string with 3 frames: FIFO 15, LRU 12, OPT 9", () => {
  assert.equal(replacePages(textbook, 3, "fifo").faults, 15);
  assert.equal(replacePages(textbook, 3, "lru").faults, 12);
  assert.equal(replacePages(textbook, 3, "opt").faults, 9);
});

test("Belady's anomaly: FIFO gets MORE faults with 4 frames than with 3", () => {
  const refs = parseReferenceString("1,2,3,4,1,2,5,1,2,3,4,5");
  assert.equal(replacePages(refs, 3, "fifo").faults, 9);
  assert.equal(replacePages(refs, 4, "fifo").faults, 10);
  assert.ok(replacePages(refs, 4, "lru").faults <= replacePages(refs, 3, "lru").faults); // LRU is a stack algorithm
});

test("OPT is never worse than FIFO or LRU", () => {
  for (let seed = 1; seed < 30; seed++) {
    const refs = Array.from({ length: 40 }, (_, i) => ((i * 7 + seed * 13) ^ (seed * i)) % 6);
    for (const frames of [2, 3, 4]) {
      const opt = replacePages(refs, frames, "opt").faults;
      assert.ok(opt <= replacePages(refs, frames, "fifo").faults);
      assert.ok(opt <= replacePages(refs, frames, "lru").faults);
    }
  }
});

test("Steps record hits, slots and evictions", () => {
  const r = replacePages([1, 2, 1, 3], 2, "fifo");
  assert.deepEqual(r.steps.map((s) => s.hit), [false, false, true, false]);
  assert.deepEqual(r.steps[3], { page: 3, frames: [3, 2], hit: false, slot: 0, evicted: 1 });
  assert.equal(r.hitRatio, 25);
});

test("Bad input is rejected", () => {
  assert.throws(() => parseReferenceString("1 two 3"));
  assert.throws(() => parseReferenceString(""));
  assert.throws(() => replacePages([1], 0, "fifo"));
  assert.throws(() => replacePages([1], 2, "clock"));
});
