// Page replacement: FIFO, LRU and Optimal (OPT / Belady's MIN).
// Frames are fixed slots, so the step table looks like the one in textbooks.

export const PAGING_ALGORITHMS = {
  fifo: "FIFO",
  lru: "LRU (Least Recently Used)",
  opt: "Optimal (OPT)",
};

export function parseReferenceString(text) {
  const parts = String(text).trim().split(/[\s,]+/).filter(Boolean);
  const refs = parts.map(Number);
  if (!refs.length || refs.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error("Reference string must be whole numbers ≥ 0 separated by spaces or commas.");
  }
  return refs;
}

/**
 * @returns {{ steps: {page, frames: (number|null)[], hit: boolean, slot: number|null, evicted: number|null}[],
 *             faults: number, hits: number, hitRatio: number }}
 */
export function replacePages(refs, frameCount, algorithm) {
  if (!Number.isInteger(frameCount) || frameCount < 1) throw new Error("Frames must be a whole number ≥ 1.");
  if (!PAGING_ALGORITHMS[algorithm]) throw new Error(`Unknown algorithm "${algorithm}".`);

  const frames = Array(frameCount).fill(null);
  const loadedAt = Array(frameCount).fill(-1); // for FIFO
  const lastUsed = new Map(); // page -> time, for LRU
  const steps = [];
  let faults = 0;

  refs.forEach((page, t) => {
    const at = frames.indexOf(page);
    let slot = null;
    let evicted = null;
    if (at !== -1) {
      lastUsed.set(page, t);
      steps.push({ page, frames: [...frames], hit: true, slot: at, evicted: null });
      return;
    }
    faults++;
    const empty = frames.indexOf(null);
    if (empty !== -1) {
      slot = empty;
    } else if (algorithm === "fifo") {
      slot = argMin(loadedAt);
    } else if (algorithm === "lru") {
      slot = argMin(frames.map((p) => lastUsed.get(p)));
    } else {
      // OPT: evict the page used furthest in the future (never used again = Infinity).
      const nextUse = frames.map((p) => {
        const i = refs.indexOf(p, t + 1);
        return i === -1 ? Infinity : i;
      });
      slot = argMax(nextUse);
    }
    evicted = frames[slot];
    frames[slot] = page;
    loadedAt[slot] = t;
    lastUsed.set(page, t);
    steps.push({ page, frames: [...frames], hit: false, slot, evicted });
  });

  const hits = refs.length - faults;
  return { steps, faults, hits, hitRatio: Math.round((hits / refs.length) * 10000) / 100 };
}

// First index wins ties, which keeps results deterministic.
function argMin(values) {
  return values.reduce((best, v, i) => (v < values[best] ? i : best), 0);
}
function argMax(values) {
  return values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
}
