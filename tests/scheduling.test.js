import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule, checkAnswers, validateProcesses } from "../src/algorithms/scheduling.js";

const P = (id, arrival, burst, priority) => ({ id, arrival, burst, priority });
const ids = (r) => r.timeline.map((s) => s.id);
const waits = (r) => Object.fromEntries(r.rows.map((x) => [x.id, x.waiting]));

// Silberschatz: P1=24, P2=3, P3=3, all at time 0
const classic = [P("P1", 0, 24), P("P2", 0, 3), P("P3", 0, 3)];

test("FCFS textbook example: average waiting 17", () => {
  const r = schedule(classic, "fcfs");
  assert.deepEqual(ids(r), ["P1", "P2", "P3"]);
  assert.equal(r.averages.waiting, 17);
  assert.equal(r.averages.turnaround, 27);
});

test("SJF textbook example: average waiting 7", () => {
  const r = schedule([P("P1", 0, 6), P("P2", 0, 8), P("P3", 0, 7), P("P4", 0, 3)], "sjf");
  assert.deepEqual(ids(r), ["P4", "P1", "P3", "P2"]);
  assert.equal(r.averages.waiting, 7);
});

test("SRTF textbook example: average waiting 6.5", () => {
  const r = schedule([P("P1", 0, 8), P("P2", 1, 4), P("P3", 2, 9), P("P4", 3, 5)], "srtf");
  assert.deepEqual(ids(r), ["P1", "P2", "P4", "P1", "P3"]);
  assert.deepEqual(waits(r), { P1: 9, P2: 0, P3: 15, P4: 2 });
  assert.equal(r.averages.waiting, 6.5);
});

test("Round Robin q=4 textbook example: average waiting 5.67", () => {
  const r = schedule(classic, "rr", { quantum: 4 });
  assert.deepEqual(ids(r), ["P1", "P2", "P3", "P1"]); // P1's later slices merge into one block
  assert.equal(r.timeline.at(-1).start, 10);
  assert.equal(r.averages.waiting, 5.67);
});

test("Round Robin puts new arrivals before the preempted process", () => {
  const r = schedule([P("A", 0, 3), P("B", 1, 2)], "rr", { quantum: 2 });
  assert.deepEqual(r.timeline, [
    { id: "A", start: 0, end: 2 }, { id: "B", start: 2, end: 4 }, { id: "A", start: 4, end: 5 },
  ]);
});

test("Priority non-preemptive textbook example: average waiting 8.2", () => {
  const r = schedule([P("P1", 0, 10, 3), P("P2", 0, 1, 1), P("P3", 0, 2, 4), P("P4", 0, 1, 5), P("P5", 0, 5, 2)], "priority");
  assert.deepEqual(ids(r), ["P2", "P5", "P1", "P3", "P4"]);
  assert.equal(r.averages.waiting, 8.2);
});

test("Priority preemptive: a higher-priority arrival preempts", () => {
  const r = schedule([P("A", 0, 5, 3), P("B", 2, 2, 1)], "priority-p");
  assert.deepEqual(r.timeline, [
    { id: "A", start: 0, end: 2 }, { id: "B", start: 2, end: 4 }, { id: "A", start: 4, end: 7 },
  ]);
});

test("Idle gaps appear in the timeline and lower utilisation", () => {
  for (const algo of ["fcfs", "sjf", "srtf", "priority", "priority-p", "rr"]) {
    const r = schedule([P("A", 2, 2), P("B", 6, 1)], algo, { quantum: 1 });
    assert.deepEqual(ids(r), [null, "A", null, "B"], algo);
    assert.equal(r.utilisation, 42.86, algo);
  }
});

test("Every algorithm keeps the invariants", () => {
  const procs = [P("P1", 0, 7, 2), P("P2", 2, 4, 1), P("P3", 4, 1, 3), P("P4", 5, 4, 2), P("P5", 15, 3, 1)];
  for (const algo of ["fcfs", "sjf", "srtf", "priority", "priority-p", "rr"]) {
    const r = schedule(procs, algo, { quantum: 3 });
    for (const row of r.rows) {
      const ran = r.timeline.filter((s) => s.id === row.id).reduce((s, x) => s + x.end - x.start, 0);
      assert.equal(ran, row.burst, `${algo} ${row.id} total run time`);
      assert.ok(row.waiting >= 0 && row.response >= 0 && row.response <= row.waiting, `${algo} ${row.id}`);
      assert.ok(r.timeline.filter((s) => s.id === row.id)[0].start >= row.arrival);
    }
    for (let i = 1; i < r.timeline.length; i++) assert.equal(r.timeline[i].start, r.timeline[i - 1].end);
  }
});

test("Validation catches bad input", () => {
  assert.ok(validateProcesses([]).length);
  assert.ok(validateProcesses([P("A", 0, 0)]).length);
  assert.ok(validateProcesses([P("A", -1, 2)]).length);
  assert.ok(validateProcesses([P("A", 0, 2), P("A", 1, 2)]).length);
  assert.throws(() => schedule(classic, "rr", { quantum: 0 }));
  assert.throws(() => schedule(classic, "lottery"));
});

test("checkAnswers marks each cell", () => {
  const r = schedule(classic, "fcfs");
  const fb = checkAnswers(r, { P1: { completion: 24, turnaround: 24, waiting: 0 }, P2: { waiting: 99 } });
  assert.equal(fb.correct, 3);
  assert.equal(fb.total, 9);
  assert.equal(fb.cells[1].waiting, "wrong");
  assert.equal(fb.cells[2].waiting, "blank");
});
