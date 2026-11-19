# OS-Sim Lab

[![Open the simulator](https://img.shields.io/badge/%E2%96%B6_Open_OS--Sim_Lab-2563eb?style=for-the-badge)](https://reshamrajs.github.io/os-sim-lab/)
[![All tools](https://img.shields.io/badge/All_open_tools-555?style=for-the-badge)](https://reshamrajs.github.io/open-tools/)
[![Tests](https://github.com/reshamrajs/os-sim-lab/actions/workflows/test.yml/badge.svg)](https://github.com/reshamrajs/os-sim-lab/actions/workflows/test.yml)

**An interactive operating-systems simulator for students and teachers.** Enter your own numbers or
load a textbook example, and watch the algorithm run. Practice mode hides the answers so students can
work out a problem and have it marked instantly.

No install, no build step, no tracking. It runs in any browser, including phones.

## What's inside

### CPU scheduling
- FCFS, SJF, SRTF, Priority (non-preemptive and preemptive), Round Robin
- Animated Gantt chart, including CPU idle time
- Completion, turnaround, waiting and response time for each process, with averages
- CPU utilisation and context-switch count
- **Practice mode**: fill in the table yourself and click *Check my answers*
- **Compare** every algorithm on the same processes in one table

### Page replacement
- FIFO, LRU and Optimal (OPT)
- Textbook-style frame table; step forward, step back, or play it as an animation
- Fault count, hit count and hit ratio
- Fault counts for 1 to 7 frames, with **Belady's anomaly** highlighted when it happens

### Banker's algorithm
- Any number of processes and resource types
- Need matrix computed live as you type
- Safety algorithm with a step-by-step Work/Need table and the safe sequence
- Resource-request checks: granted, must wait, or denied because the state would be unsafe

## Run it locally

```bash
python3 -m http.server 8802     # or: npm start
```

Open http://localhost:8802. (The page uses JavaScript modules, which need a local server; opening
`index.html` directly won't work.)

## Tests

The algorithms are checked against the standard examples from Silberschatz, *Operating System Concepts*:
FCFS average waiting 17, SJF 7, SRTF 6.5, RR (q = 4) 5.67, Priority 8.2; FIFO/LRU/OPT 15/12/9 faults;
Belady's anomaly 9 → 10 faults; and the Banker's safe sequence and request examples.

```bash
npm test        # Node 20+, no dependencies
```

## Project layout

```
index.html                  page structure
css/style.css               styles (light and dark mode)
src/algorithms/             pure algorithm code, no DOM; reuse it anywhere
  scheduling.js  paging.js  bankers.js
src/ui/app.js               connects the algorithms to the page
tests/                      node:test unit tests
```

## Deploy

Push to GitHub, then in **Settings → Pages** choose **GitHub Actions**. The included workflow runs
the tests and publishes the site on every push to `main`. Cloudflare Pages or Netlify also work
(no build command, output directory `/`).

## Contributing

New algorithms are welcome. Good first issues:
- Disk scheduling (FCFS, SSTF, SCAN, C-SCAN, LOOK)
- Multilevel feedback queue scheduling
- Deadlock detection with a resource-allocation graph
- Producer-consumer and dining-philosophers animations
- Hindi translation of the interface

Put the algorithm in `src/algorithms/` as a pure function, add tests with a textbook example,
then wire it up in `src/ui/`.

## Licence

MIT
