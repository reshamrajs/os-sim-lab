// Banker's algorithm: safety check and resource-request check (deadlock avoidance).
// Matrices are arrays of rows, one row per process, one column per resource type.

export function need(max, allocation) {
  return max.map((row, i) => row.map((m, j) => m - allocation[i][j]));
}

export function validateState({ available, max, allocation }) {
  const errors = [];
  const m = available?.length ?? 0;
  if (!m) errors.push("Enter at least one resource type.");
  if (!max?.length || max.length !== allocation?.length) errors.push("Max and Allocation need the same number of processes.");
  const isCount = (x) => Number.isInteger(x) && x >= 0;
  if (!available.every(isCount)) errors.push("Available must be whole numbers ≥ 0.");
  (max ?? []).forEach((row, i) => {
    const alloc = allocation?.[i] ?? [];
    if (row.length !== m || alloc.length !== m) errors.push(`P${i}: every row needs ${m} values.`);
    if (!row.every(isCount) || !alloc.every(isCount)) errors.push(`P${i}: values must be whole numbers ≥ 0.`);
    row.forEach((v, j) => {
      if (alloc[j] > v) errors.push(`P${i}: allocation of R${j} is more than its max.`);
    });
  });
  return errors;
}

const leq = (a, b) => a.every((x, j) => x <= b[j]);
const add = (a, b) => a.map((x, j) => x + b[j]);

/**
 * Safety algorithm. Sweeps the processes in order, repeatedly, granting any whose
 * Need ≤ Work, until all finish (safe) or a full sweep makes no progress (unsafe).
 * @returns {{ safe: boolean, sequence: number[], need: number[][],
 *             steps: {pid: number, work: number[], need: number[], workAfter: number[]}[],
 *             stuck: number[] }}
 */
export function safety({ available, max, allocation }) {
  const errors = validateState({ available, max, allocation });
  if (errors.length) throw new Error(errors.join(" "));
  const needM = need(max, allocation);
  const n = max.length;
  const finished = Array(n).fill(false);
  let work = [...available];
  const sequence = [];
  const steps = [];
  let progress = true;
  let i = 0;
  let sinceProgress = 0;
  while (sequence.length < n && progress) {
    if (!finished[i] && leq(needM[i], work)) {
      const workAfter = add(work, allocation[i]);
      steps.push({ pid: i, work, need: needM[i], workAfter });
      work = workAfter;
      finished[i] = true;
      sequence.push(i);
      sinceProgress = 0;
    } else if (++sinceProgress >= n) {
      progress = false;
    }
    i = (i + 1) % n;
  }
  return {
    safe: sequence.length === n, sequence, need: needM, steps,
    stuck: finished.map((f, k) => (f ? -1 : k)).filter((k) => k >= 0),
  };
}

/**
 * Process `pid` asks for `request`. Grant it only if the resulting state is safe.
 * @returns {{ granted: boolean, reason: string, state?: object, result?: object }}
 */
export function requestResources(state, pid, request) {
  const needM = need(state.max, state.allocation);
  if (!leq(request, needM[pid])) {
    return { granted: false, reason: `P${pid} asked for more than its remaining need [${needM[pid]}]. Error.` };
  }
  if (!leq(request, state.available)) {
    return { granted: false, reason: `Not enough available resources [${state.available}]. P${pid} must wait.` };
  }
  const trial = {
    available: state.available.map((a, j) => a - request[j]),
    max: state.max,
    allocation: state.allocation.map((row, i) => (i === pid ? row.map((a, j) => a + request[j]) : [...row])),
  };
  const result = safety(trial);
  return result.safe
    ? { granted: true, reason: `Granted: the new state is safe (${result.sequence.map((k) => `P${k}`).join(" → ")}).`, state: trial, result }
    : { granted: false, reason: `Denied: granting it would leave the system unsafe. P${pid} must wait.`, result };
}
