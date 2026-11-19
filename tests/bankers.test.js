import { test } from "node:test";
import assert from "node:assert/strict";
import { safety, requestResources, need } from "../src/algorithms/bankers.js";

// Silberschatz: 5 processes, resources A=10, B=5, C=7
const state = {
  available: [3, 3, 2],
  max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
  allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
};

test("Need = Max - Allocation", () => {
  assert.deepEqual(need(state.max, state.allocation), [[7, 4, 3], [1, 2, 2], [6, 0, 0], [0, 1, 1], [4, 3, 1]]);
});

test("Textbook state is safe and the sequence really works", () => {
  const r = safety(state);
  assert.equal(r.safe, true);
  assert.deepEqual(r.sequence, [1, 3, 4, 0, 2]);
  assert.deepEqual(r.steps.at(-1).workAfter, [10, 5, 7]); // everything returned
  for (const s of r.steps) assert.ok(s.need.every((x, j) => x <= s.work[j]));
});

test("P1 requests (1,0,2): granted", () => {
  const r = requestResources(state, 1, [1, 0, 2]);
  assert.equal(r.granted, true);
  assert.deepEqual(r.state.available, [2, 3, 0]);
});

test("After that, P4 requests (3,3,0): must wait (not enough available)", () => {
  const s2 = requestResources(state, 1, [1, 0, 2]).state;
  const r = requestResources(s2, 4, [3, 3, 0]);
  assert.equal(r.granted, false);
  assert.match(r.reason, /wait/);
});

test("After that, P0 requests (0,2,0): denied because the state would be unsafe", () => {
  const s2 = requestResources(state, 1, [1, 0, 2]).state;
  const r = requestResources(s2, 0, [0, 2, 0]);
  assert.equal(r.granted, false);
  assert.equal(r.result.safe, false);
});

test("Asking for more than the declared need is an error", () => {
  const r = requestResources(state, 3, [1, 0, 0]);
  assert.equal(r.granted, false);
  assert.match(r.reason, /more than its remaining need/);
});

test("Unsafe state reports the stuck processes", () => {
  const r = safety({ available: [0], max: [[2], [2]], allocation: [[1], [1]] });
  assert.equal(r.safe, false);
  assert.deepEqual(r.stuck, [0, 1]);
});

test("Invalid input throws", () => {
  assert.throws(() => safety({ available: [1], max: [[1]], allocation: [[2]] }));
  assert.throws(() => safety({ available: [1, 1], max: [[1]], allocation: [[0]] }));
});
