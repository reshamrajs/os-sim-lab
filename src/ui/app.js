// UI wiring. All algorithm logic lives in ../algorithms and is unit tested.
import { ALGORITHMS, schedule, checkAnswers, round2 } from "../algorithms/scheduling.js";
import { PAGING_ALGORITHMS, parseReferenceString, replacePages } from "../algorithms/paging.js";
import { safety, requestResources, need } from "../algorithms/bankers.js";

const $ = (s) => document.querySelector(s);
const el = (tag, { dataset, ...props } = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props);
  if (dataset) Object.assign(n.dataset, dataset);
  n.append(...children);
  return n;
};
const COLORS = ["#2563eb", "#d9480f", "#2b8a3e", "#ae3ec9", "#e8590c", "#0c8599", "#c2255c", "#5f3dc4", "#a61e4d", "#087f5b"];

// ---------------- tabs ----------------
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
  history.replaceState(null, "", `#${tab.id.replace("tab-", "")}`);
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => selectTab(t));
  t.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; selectTab(n); n.focus(); }
  });
});
selectTab(tabs.find((t) => `#${t.id.replace("tab-", "")}` === location.hash) ?? tabs[0]);

// ---------------- CPU scheduling ----------------
const CPU_EXAMPLES = {
  classic: { algo: "fcfs", procs: [["P1", 0, 24, 0], ["P2", 0, 3, 0], ["P3", 0, 3, 0]] },
  srtf: { algo: "srtf", procs: [["P1", 0, 8, 0], ["P2", 1, 4, 0], ["P3", 2, 9, 0], ["P4", 3, 5, 0]] },
  priority: { algo: "priority", procs: [["P1", 0, 10, 3], ["P2", 0, 1, 1], ["P3", 0, 2, 4], ["P4", 0, 1, 5], ["P5", 0, 5, 2]] },
};
const procBody = $("#proc-table tbody");
const cpuAlgo = $("#cpu-algo");
for (const [k, a] of Object.entries(ALGORITHMS)) cpuAlgo.add(new Option(a.name, k));
let lastCpu = null;

function addProcRow([id, arrival, burst, priority] = [`P${procBody.rows.length + 1}`, 0, 1, 0]) {
  const num = (v, label, min) => el("input", { type: "number", value: v, min, ariaLabel: label });
  const tr = el("tr", {},
    el("td", {}, el("input", { className: "name", value: id, ariaLabel: "Name" })),
    el("td", {}, num(arrival, "Arrival", 0)),
    el("td", {}, num(burst, "Burst", 1)),
    el("td", {}, num(priority, "Priority", 0)),
    el("td", {}, el("button", { className: "icon", type: "button", textContent: "✕", ariaLabel: `Remove ${id}`,
      onclick: () => { tr.remove(); runCpu(); } })));
  procBody.append(tr);
}
function setProcs(list) { procBody.replaceChildren(); list.forEach(addProcRow); }
function readProcs() {
  return [...procBody.rows].map((tr) => {
    const [n, a, b, p] = tr.querySelectorAll("input");
    return { id: n.value.trim(), arrival: Number(a.value), burst: Number(b.value), priority: Number(p.value) };
  });
}

function runCpu() {
  $("#cpu-error").textContent = "";
  $("#check-feedback").textContent = "";
  $("#quantum-wrap").hidden = !ALGORITHMS[cpuAlgo.value].needsQuantum;
  const procs = readProcs();
  const quantum = Number($("#quantum").value);
  try {
    lastCpu = schedule(procs, cpuAlgo.value, { quantum });
  } catch (e) {
    $("#cpu-error").textContent = e.message;
    $("#gantt").replaceChildren();
    $("#cpu-results").replaceChildren();
    $("#cpu-stats").replaceChildren();
    $("#cpu-compare").replaceChildren();
    return;
  }
  drawGantt(lastCpu, procs);
  drawCpuStats(lastCpu);
  drawCpuTable();
  drawCompare(procs, quantum);
}

function drawGantt(r, procs) {
  const total = r.timeline.at(-1).end - r.timeline[0].start;
  const colour = Object.fromEntries(procs.map((p, i) => [p.id, COLORS[i % COLORS.length]]));
  const segs = r.timeline.map((s, i) => {
    const seg = el("div", {
      className: `seg${s.id === null ? " idle" : ""}`,
      textContent: s.id ?? "idle",
      title: `${s.id ?? "idle"}: ${s.start} → ${s.end}`,
    });
    seg.style.flex = `${s.end - s.start} 1 0`;
    seg.style.animationDelay = `${i * 60}ms`;
    if (s.id !== null) seg.style.background = colour[s.id];
    seg.append(el("span", { className: "t", textContent: s.start }));
    if (i === r.timeline.length - 1) seg.append(el("span", { className: "t end", textContent: s.end }));
    return seg;
  });
  $("#gantt").replaceChildren(...segs);
  $("#gantt").setAttribute("aria-label", `Gantt chart, total time ${total}: ` +
    r.timeline.map((s) => `${s.id ?? "idle"} ${s.start} to ${s.end}`).join(", "));
}

function stat(value, label) { return el("div", { className: "stat" }, el("b", { textContent: value }), el("span", { textContent: label })); }

function drawCpuStats(r) {
  const practice = $("#practice").checked;
  $("#cpu-stats").replaceChildren(
    stat(practice ? "?" : r.averages.waiting, "Avg waiting"),
    stat(practice ? "?" : r.averages.turnaround, "Avg turnaround"),
    stat(practice ? "?" : r.averages.response, "Avg response"),
    stat(`${r.utilisation}%`, "CPU utilisation"),
    stat(r.contextSwitches, "Context switches"));
}

function drawCpuTable() {
  const r = lastCpu;
  const practice = $("#practice").checked;
  const head = el("tr", {}, ...["Process", "Arrival", "Burst", "Priority", "Completion", "Turnaround", "Waiting", "Response"]
    .map((h) => el("th", { textContent: h })));
  const rows = r.rows.map((row) => el("tr", { dataset: { id: row.id } },
    el("td", { textContent: row.id }), el("td", { textContent: row.arrival }),
    el("td", { textContent: row.burst }), el("td", { textContent: row.priority }),
    ...["completion", "turnaround", "waiting"].map((k) => el("td", { dataset: { k } },
      practice ? el("input", { type: "number", ariaLabel: `${row.id} ${k}` }) : String(row[k]))),
    el("td", { textContent: practice ? "?" : row.response })));
  const table = $("#cpu-results");
  table.replaceChildren(el("thead", {}, head), el("tbody", {}, ...rows));
  if (practice) {
    table.append(el("tfoot", {}, el("tr", {}, el("td", { colSpan: 8 },
      el("button", { type: "button", textContent: "Check my answers", onclick: checkCpu })))));
  }
}

function checkCpu() {
  const answers = {};
  for (const tr of $("#cpu-results tbody").rows) {
    answers[tr.dataset.id] = Object.fromEntries([...tr.querySelectorAll("td[data-k]")]
      .map((td) => [td.dataset.k, td.querySelector("input").value]));
  }
  const fb = checkAnswers(lastCpu, answers);
  fb.cells.forEach((c) => {
    const tr = $(`#cpu-results tbody tr[data-id="${CSS.escape(c.id)}"]`);
    for (const k of ["completion", "turnaround", "waiting"]) {
      const td = tr.querySelector(`td[data-k="${k}"]`);
      td.className = c[k] === "right" ? "right" : c[k] === "wrong" ? "wrong" : "";
    }
  });
  $("#check-feedback").textContent = fb.correct === fb.total
    ? `All ${fb.total} correct. Well done!`
    : `${fb.correct} of ${fb.total} correct. Red cells are wrong or blank; untick practice mode to see the answers.`;
}

function drawCompare(procs, quantum) {
  const results = Object.entries(ALGORITHMS).map(([k, a]) => {
    const r = schedule(procs, k, { quantum });
    return { name: k === "rr" ? `${a.name}, q=${quantum}` : a.name, ...r.averages, switches: r.contextSwitches };
  });
  const best = Math.min(...results.map((r) => r.waiting));
  const head = el("tr", {}, ...["Algorithm", "Avg waiting", "Avg turnaround", "Avg response", "Context switches"]
    .map((h) => el("th", { textContent: h })));
  const rows = results.map((r) => el("tr", { className: r.waiting === best ? "best" : "" },
    el("td", { textContent: r.name + (r.waiting === best ? "  ★ lowest waiting" : "") }),
    el("td", { textContent: r.waiting }), el("td", { textContent: r.turnaround }),
    el("td", { textContent: r.response }), el("td", { textContent: r.switches })));
  $("#cpu-compare").replaceChildren(el("thead", {}, head), el("tbody", {}, ...rows));
}

$("#add-proc").addEventListener("click", () => { addProcRow(); runCpu(); });
$("#random-proc").addEventListener("click", () => {
  const n = 4 + Math.floor(Math.random() * 3);
  setProcs(Array.from({ length: n }, (_, i) => [`P${i + 1}`, Math.floor(Math.random() * 8), 1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 5)]));
  runCpu();
});
$("#cpu-example").addEventListener("change", (e) => {
  const ex = CPU_EXAMPLES[e.target.value];
  if (!ex) return;
  setProcs(ex.procs);
  cpuAlgo.value = ex.algo;
  e.target.value = "";
  runCpu();
});
$("#run-cpu").addEventListener("click", runCpu);
cpuAlgo.addEventListener("change", runCpu);
$("#quantum").addEventListener("change", runCpu);
procBody.addEventListener("change", runCpu);
$("#practice").addEventListener("change", () => { if (lastCpu) { drawCpuStats(lastCpu); drawCpuTable(); } $("#check-feedback").textContent = ""; });

setProcs(CPU_EXAMPLES.srtf.procs);
cpuAlgo.value = "srtf";
runCpu();

// ---------------- Page replacement ----------------
const pageAlgo = $("#page-algo");
for (const [k, name] of Object.entries(PAGING_ALGORITHMS)) pageAlgo.add(new Option(name, k));
let paging = null;
let step = 0;
let timer = null;

function runPaging() {
  stopPlay();
  $("#paging-error").textContent = "";
  try {
    const refs = parseReferenceString($("#refs").value);
    const frames = Number($("#frames").value);
    paging = { refs, frames, result: replacePages(refs, frames, pageAlgo.value) };
  } catch (e) {
    $("#paging-error").textContent = e.message;
    return;
  }
  step = paging.refs.length;
  drawPaging();
  drawPagingCompare();
}

function drawPaging() {
  const { refs, frames, result } = paging;
  const shownFaults = result.steps.slice(0, step).filter((s) => !s.hit).length;
  $("#paging-stats").replaceChildren(
    stat(shownFaults, "Page faults"), stat(step - shownFaults, "Hits"),
    stat(step ? `${round2(((step - shownFaults) / step) * 100)}%` : "-", "Hit ratio"),
    stat(`${step}/${refs.length}`, "Step"));
  $("#step-label").textContent = step < refs.length ? `Showing ${step} of ${refs.length} references` : "";

  const cls = (t) => (t >= step ? "future" : t === step - 1 ? "current" : "");
  const head = el("tr", {}, el("th", { textContent: "Ref" }),
    ...refs.map((p, t) => el("th", { textContent: p, className: cls(t) })));
  const body = Array.from({ length: frames }, (_, f) => el("tr", {}, el("th", { textContent: `Frame ${f + 1}` }),
    ...result.steps.map((s, t) => {
      const td = el("td", { textContent: s.frames[f] ?? "", className: cls(t) });
      if (t < step && !s.hit && s.slot === f) td.classList.add("cell-changed");
      return td;
    })));
  const status = el("tr", { className: "status" }, el("th", { textContent: "Result" }),
    ...result.steps.map((s, t) => el("td", {
      textContent: t < step ? (s.hit ? "✓" : "F") : "",
      className: `${t < step ? (s.hit ? "hit" : "fault") : ""} ${cls(t)}`,
      title: t < step ? (s.hit ? "Hit" : s.evicted === null ? "Fault (free frame)" : `Fault, replaced ${s.evicted}`) : "",
    })));
  $("#paging-table").replaceChildren(el("thead", {}, head), el("tbody", {}, ...body, status));
}

function drawPagingCompare() {
  const { refs } = paging;
  const counts = Array.from({ length: 7 }, (_, i) => i + 1);
  const head = el("tr", {}, el("th", { textContent: "Algorithm" }), ...counts.map((c) => el("th", { textContent: `${c} frame${c > 1 ? "s" : ""}` })));
  const rows = Object.entries(PAGING_ALGORITHMS).map(([k, name]) => {
    const faults = counts.map((c) => replacePages(refs, c, k).faults);
    return el("tr", {}, el("td", { textContent: name }), ...faults.map((f, i) => el("td", {
      textContent: f,
      className: i > 0 && f > faults[i - 1] ? "wrong" : "",
      title: i > 0 && f > faults[i - 1] ? "Belady's anomaly: more frames, more faults" : "",
    })));
  });
  $("#paging-compare").replaceChildren(el("thead", {}, head), el("tbody", {}, ...rows));
}

function stopPlay() { clearInterval(timer); timer = null; $("#play").textContent = "▶ Play"; }
$("#run-paging").addEventListener("click", runPaging);
pageAlgo.addEventListener("change", runPaging);
$("#frames").addEventListener("change", runPaging);
$("#refs").addEventListener("keydown", (e) => { if (e.key === "Enter") runPaging(); });
$("#step-back").addEventListener("click", () => { if (paging && step > 0) { stopPlay(); step--; drawPaging(); } });
$("#step-fwd").addEventListener("click", () => { if (paging && step < paging.refs.length) { stopPlay(); step++; drawPaging(); } });
$("#play").addEventListener("click", () => {
  if (!paging) return;
  if (timer) return stopPlay();
  if (step >= paging.refs.length) step = 0;
  $("#play").textContent = "❚❚ Pause";
  timer = setInterval(() => {
    step++;
    drawPaging();
    if (step >= paging.refs.length) stopPlay();
  }, 600);
  drawPaging();
});
$("#belady").addEventListener("click", () => {
  $("#refs").value = "1 2 3 4 1 2 5 1 2 3 4 5";
  pageAlgo.value = "fifo";
  $("#frames").value = 4;
  runPaging();
  $("#paging-error").textContent = "";
  $("#step-label").textContent = "FIFO: 9 faults with 3 frames, but 10 with 4 frames (see the table below).";
});
runPaging();

// ---------------- Banker's algorithm ----------------
const BK_EXAMPLE = {
  available: [3, 3, 2],
  max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
  allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
};
let bkState = structuredClone(BK_EXAMPLE);
const R = (j) => `R${j}`;

function drawBkTable() {
  const n = bkState.max.length;
  const m = bkState.available.length;
  const num = (v, label, onInput) => el("input", { type: "number", min: 0, value: v, ariaLabel: label, oninput: onInput });
  const groupHead = el("tr", {}, el("th"),
    el("th", { colSpan: m, textContent: "Allocation" }), el("th", { colSpan: m, textContent: "Max" }),
    el("th", { colSpan: m, textContent: "Need (= Max − Allocation)" }));
  const resHead = el("tr", {}, el("th", { textContent: "Process" }),
    ...[0, 1, 2].flatMap(() => Array.from({ length: m }, (_, j) => el("th", { textContent: R(j) }))));
  const needM = need(bkState.max, bkState.allocation);
  const rows = Array.from({ length: n }, (_, i) => el("tr", {}, el("th", { textContent: `P${i}` }),
    ...bkState.allocation[i].map((v, j) => el("td", {}, num(v, `P${i} allocation ${R(j)}`, (e) => { bkState.allocation[i][j] = Number(e.target.value); drawNeed(); }))),
    ...bkState.max[i].map((v, j) => el("td", {}, num(v, `P${i} max ${R(j)}`, (e) => { bkState.max[i][j] = Number(e.target.value); drawNeed(); }))),
    ...needM[i].map((v, j) => el("td", { textContent: v, dataset: { need: `${i}-${j}` } }))));
  const avail = el("tr", {}, el("th", { textContent: "Available" }),
    ...bkState.available.map((v, j) => el("td", {}, num(v, `Available ${R(j)}`, (e) => { bkState.available[j] = Number(e.target.value); }))));
  $("#bk-table").replaceChildren(el("thead", {}, groupHead, resHead), el("tbody", {}, ...rows, avail));
  drawRequestForm();
}

function drawNeed() {
  need(bkState.max, bkState.allocation).forEach((row, i) => row.forEach((v, j) => {
    const td = $(`[data-need="${i}-${j}"]`);
    td.textContent = v;
    td.className = v < 0 ? "wrong" : "";
  }));
}

function runBankers() {
  $("#bk-error").textContent = "";
  let r;
  try { r = safety(bkState); } catch (e) {
    $("#bk-error").textContent = e.message;
    $("#bk-verdict").textContent = "";
    $("#bk-steps").replaceChildren();
    return;
  }
  const v = $("#bk-verdict");
  v.className = `verdict ${r.safe ? "safe" : "unsafe"}`;
  v.textContent = r.safe
    ? `SAFE. Safe sequence: ${r.sequence.map((i) => `P${i}`).join(" → ")}`
    : `UNSAFE. No order lets ${r.stuck.map((i) => `P${i}`).join(", ")} finish, so deadlock is possible.`;
  const head = el("tr", {}, ...["Step", "Process", "Work before", "Need", "Need ≤ Work?", "Work after (+ Allocation)"].map((h) => el("th", { textContent: h })));
  const rows = r.steps.map((s, k) => el("tr", {},
    el("td", { textContent: k + 1 }), el("td", { textContent: `P${s.pid}` }),
    el("td", { textContent: `[${s.work.join(", ")}]` }), el("td", { textContent: `[${s.need.join(", ")}]` }),
    el("td", { textContent: "yes", className: "right" }), el("td", { textContent: `[${s.workAfter.join(", ")}]` })));
  $("#bk-steps").replaceChildren(el("thead", {}, head), el("tbody", {}, ...rows));
}

function drawRequestForm() {
  const m = bkState.available.length;
  const pid = el("select", { ariaLabel: "Requesting process" }, ...bkState.max.map((_, i) => new Option(`P${i}`, i)));
  const inputs = Array.from({ length: m }, (_, j) => el("input", { type: "number", min: 0, value: 0, ariaLabel: `Request ${R(j)}` }));
  const go = el("button", { type: "button", textContent: "Request", onclick: () => {
    const out = $("#bk-request-result");
    try {
      safety(bkState);
      const res = requestResources(bkState, Number(pid.value), inputs.map((x) => Number(x.value)));
      out.textContent = res.reason;
      out.style.color = res.granted ? "var(--hit)" : "var(--fault)";
      if (res.granted) {
        bkState = structuredClone(res.state);
        drawBkTable();
        runBankers();
        $("#bk-request-result").textContent = `${res.reason} The table now shows the new state.`;
      }
    } catch (e) { out.textContent = e.message; out.style.color = "var(--fault)"; }
  } });
  $("#bk-request").replaceChildren(
    el("label", {}, "Process", pid),
    ...inputs.map((x, j) => el("label", {}, R(j), x)), go);
}

$("#bk-run").addEventListener("click", runBankers);
$("#bk-example").addEventListener("click", () => {
  bkState = structuredClone(BK_EXAMPLE);
  $("#bk-n").value = 5;
  $("#bk-m").value = 3;
  $("#bk-request-result").textContent = "";
  drawBkTable();
  runBankers();
});
$("#bk-resize").addEventListener("click", () => {
  const n = Math.min(10, Math.max(1, Number($("#bk-n").value) || 1));
  const m = Math.min(6, Math.max(1, Number($("#bk-m").value) || 1));
  const fit = (row) => Array.from({ length: m }, (_, j) => row?.[j] ?? 0);
  bkState = {
    available: fit(bkState.available),
    max: Array.from({ length: n }, (_, i) => fit(bkState.max[i])),
    allocation: Array.from({ length: n }, (_, i) => fit(bkState.allocation[i])),
  };
  drawBkTable();
  runBankers();
});
drawBkTable();
runBankers();
