// CPU scheduling algorithms. Pure functions, no DOM: easy to test and reuse.
//
// A process is { id: "P1", arrival: 0, burst: 5, priority: 2 }.
// Times are whole numbers. For priority scheduling, a LOWER number = HIGHER priority.
// Ties are broken by arrival time, then by the order the processes were given.

export const ALGORITHMS = {
  fcfs: { name: "First Come First Serve (FCFS)", preemptive: false },
  sjf: { name: "Shortest Job First (SJF)", preemptive: false },
  srtf: { name: "Shortest Remaining Time First (SRTF)", preemptive: true },
  priority: { name: "Priority (non-preemptive)", preemptive: false },
  "priority-p": { name: "Priority (preemptive)", preemptive: true },
  rr: { name: "Round Robin (RR)", preemptive: true, needsQuantum: true },
};

export function validateProcesses(processes) {
  const errors = [];
  if (!Array.isArray(processes) || processes.length === 0) errors.push("Add at least one process.");
  const ids = new Set();
  (processes ?? []).forEach((p, i) => {
    const label = p.id || `row ${i + 1}`;
    if (!p.id) errors.push(`Row ${i + 1}: give the process a name.`);
    if (ids.has(p.id)) errors.push(`${label}: duplicate name.`);
    ids.add(p.id);
    if (!Number.isInteger(p.arrival) || p.arrival < 0) errors.push(`${label}: arrival must be a whole number ≥ 0.`);
    if (!Number.isInteger(p.burst) || p.burst <= 0) errors.push(`${label}: burst must be a whole number > 0.`);
    if (p.priority !== undefined && !Number.isInteger(p.priority)) errors.push(`${label}: priority must be a whole number.`);
  });
  return errors;
}

/**
 * Run a scheduling algorithm.
 * @returns {{ timeline: {id: string|null, start: number, end: number}[],
 *             rows: {id, arrival, burst, priority, completion, turnaround, waiting, response}[],
 *             averages: {turnaround, waiting, response}, makespan: number, utilisation: number }}
 * `id: null` in the timeline means the CPU was idle.
 */
export function schedule(processes, algorithm, { quantum = 2 } = {}) {
  const errors = validateProcesses(processes);
  if (errors.length) throw new Error(errors.join(" "));
  if (!ALGORITHMS[algorithm]) throw new Error(`Unknown algorithm "${algorithm}".`);
  if (algorithm === "rr" && (!Number.isInteger(quantum) || quantum <= 0)) {
    throw new Error("Time quantum must be a whole number > 0.");
  }

  const procs = processes.map((p, order) => ({ ...p, priority: p.priority ?? 0, order }));
  const raw =
    algorithm === "fcfs" ? nonPreemptive(procs, (p) => [p.arrival, p.order])
    : algorithm === "sjf" ? nonPreemptive(procs, (p) => [p.burst, p.arrival, p.order])
    : algorithm === "priority" ? nonPreemptive(procs, (p) => [p.priority, p.arrival, p.order])
    : algorithm === "srtf" ? preemptive(procs, (p, rem) => [rem, p.arrival, p.order])
    : algorithm === "priority-p" ? preemptive(procs, (p) => [p.priority, p.arrival, p.order])
    : roundRobin(procs, quantum);

  return summarise(procs, merge(raw));
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function pickBy(list, key) {
  return list.reduce((best, p) => (compareKeys(key(p), key(best)) < 0 ? p : best));
}

function nonPreemptive(procs, key) {
  const timeline = [];
  const done = new Set();
  let t = 0;
  while (done.size < procs.length) {
    const ready = procs.filter((p) => !done.has(p) && p.arrival <= t);
    if (!ready.length) {
      const next = Math.min(...procs.filter((p) => !done.has(p)).map((p) => p.arrival));
      timeline.push({ id: null, start: t, end: next });
      t = next;
      continue;
    }
    const p = pickBy(ready, key);
    timeline.push({ id: p.id, start: t, end: t + p.burst });
    t += p.burst;
    done.add(p);
  }
  return timeline;
}

// One time unit at a time; re-decides at every tick, so new arrivals can preempt.
function preemptive(procs, key) {
  const remaining = new Map(procs.map((p) => [p, p.burst]));
  const timeline = [];
  let t = 0;
  let left = procs.length;
  while (left > 0) {
    const ready = procs.filter((p) => remaining.get(p) > 0 && p.arrival <= t);
    if (!ready.length) {
      const next = Math.min(...procs.filter((p) => remaining.get(p) > 0).map((p) => p.arrival));
      timeline.push({ id: null, start: t, end: next });
      t = next;
      continue;
    }
    const p = pickBy(ready, (q) => key(q, remaining.get(q)));
    timeline.push({ id: p.id, start: t, end: t + 1 });
    remaining.set(p, remaining.get(p) - 1);
    if (remaining.get(p) === 0) left--;
    t++;
  }
  return timeline;
}

// Standard textbook rule: processes that arrive while a slice is running join the
// queue BEFORE the process whose slice just ended.
function roundRobin(procs, quantum) {
  const arrivals = [...procs].sort((a, b) => a.arrival - b.arrival || a.order - b.order);
  const remaining = new Map(procs.map((p) => [p, p.burst]));
  const queue = [];
  const timeline = [];
  let next = 0;
  let t = 0;
  const admit = (upTo) => {
    while (next < arrivals.length && arrivals[next].arrival <= upTo) queue.push(arrivals[next++]);
  };
  admit(t);
  while (queue.length || next < arrivals.length) {
    if (!queue.length) {
      const nt = arrivals[next].arrival;
      timeline.push({ id: null, start: t, end: nt });
      t = nt;
      admit(t);
      continue;
    }
    const p = queue.shift();
    const run = Math.min(quantum, remaining.get(p));
    timeline.push({ id: p.id, start: t, end: t + run });
    t += run;
    remaining.set(p, remaining.get(p) - run);
    admit(t);
    if (remaining.get(p) > 0) queue.push(p);
  }
  return timeline;
}

function merge(timeline) {
  const out = [];
  for (const seg of timeline) {
    const last = out[out.length - 1];
    if (last && last.id === seg.id && last.end === seg.start) last.end = seg.end;
    else if (seg.end > seg.start) out.push({ ...seg });
  }
  return out;
}

function summarise(procs, timeline) {
  const rows = procs.map((p) => {
    const segs = timeline.filter((s) => s.id === p.id);
    const completion = segs[segs.length - 1].end;
    const turnaround = completion - p.arrival;
    return {
      id: p.id, arrival: p.arrival, burst: p.burst, priority: p.priority,
      completion, turnaround, waiting: turnaround - p.burst, response: segs[0].start - p.arrival,
    };
  });
  const avg = (k) => round2(rows.reduce((s, r) => s + r[k], 0) / rows.length);
  const start = timeline[0].start;
  const makespan = timeline[timeline.length - 1].end - start;
  const busy = timeline.filter((s) => s.id !== null).reduce((s, x) => s + x.end - x.start, 0);
  return {
    timeline, rows,
    averages: { turnaround: avg("turnaround"), waiting: avg("waiting"), response: avg("response") },
    makespan, utilisation: round2((100 * busy) / makespan),
    contextSwitches: timeline.filter((s) => s.id !== null).length - 1,
  };
}

export const round2 = (x) => Math.round(x * 100) / 100;

/** Compare a student's answers with the correct result. Returns per-cell feedback. */
export function checkAnswers(result, answers) {
  let correct = 0;
  let total = 0;
  const cells = result.rows.map((r) => {
    const a = answers[r.id] ?? {};
    const row = {};
    for (const k of ["completion", "turnaround", "waiting"]) {
      if (a[k] === undefined || a[k] === "" || a[k] === null) { row[k] = "blank"; total++; continue; }
      total++;
      const ok = Number(a[k]) === r[k];
      if (ok) correct++;
      row[k] = ok ? "right" : "wrong";
    }
    return { id: r.id, ...row };
  });
  return { cells, correct, total };
}
