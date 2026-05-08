# js-math-bench Implementation Plan

## Overview
A browser-first (also CLI-runnable) benchmark measuring **accuracy** and **performance**
of JavaScript `Math` functions. Accuracy is the primary metric; performance is secondary.

## Functions Under Test
`acos`, `acosh`, `asin`, `asinh`, `atan`, `atan2`, `cos`, `cosh`, `exp`, `expm1`,
`atanh`, `log`, `log1p`, `log2`, `log10`, `cbrt`, `pow`, `sin`, `sinh`, `sqrt`,
`tan`, `tanh`

## Step 1: Generate Test Data (`generate_test_data.py`)

A Python script (run via `uvx`) that produces `test_data.json`:

### Input sources per function:
1. **Worst-case inputs** (~1000 per function): sampled from core-math `.wc` files.
   These are inputs where the exact result is closest to the midpoint between two
   representable doubles — the hardest inputs to round correctly.
2. **Systematic inputs** (~500 per function): evenly spaced across the function's
   useful domain, plus values near interesting points (0, ±1, ±pi, domain boundaries).
3. **Edge cases** (~30 per function): ±0, ±Infinity, NaN, denormals, MAX_VALUE,
   MIN_VALUE, etc.

### Computation:
- Use Python `mpmath` at 200 decimal digits of precision.
- For each input, compute the exact result, then round to the nearest double.
- Store as hex float strings (e.g. `"0x1.921fb54442d18p+1"`) for exact representation.

### Output format (`test_data.json`):
```json
{
  "sin": {
    "worstCase": [{"in": "0x1.abc...", "out": "0x1.def..."}],
    "systematic": [...],
    "edgeCases": [...]
  },
  "atan2": {
    "worstCase": [{"in": ["0x1.abc...", "0x1.def..."], "out": "0x1.ghi..."}],
    ...
  }
}
```

## Step 2: Core Benchmark Logic (`bench.js`)

### Accuracy test:
For each function and each test input:
1. Parse hex float input(s) to JS number.
2. Call `Math.fn(input)`.
3. Compare to expected output.
4. Compute ULP error: `|result - expected| / ulp(expected)`.

Report per function:
- Max ULP error
- Mean ULP error
- % correctly rounded (ULP ≤ 0.5)
- % faithfully rounded (ULP ≤ 1.0)

### Performance test:
For each function, pre-generate arrays of inputs (seeded PRNG for reproducibility):
- Set A: 100K random values in [0, 1]
- Set B: 100K random values in [-10, 10]
- Set C: integers 0..99999
- Set D: 100K values in the function's "interesting" domain

Time each set, report ops/sec. Run multiple iterations, take median.

### Scoring:
- **Accuracy score (0–100)**: `100 × (fraction of inputs with ≤ 0.5 ULP error)`.
  This is the primary score. Deductions for any input with > 1 ULP error.
- **Performance bonus (0–20)**: `20 × min(1, median_ops_per_sec / reference_rate)`.
  Capped so it can't dominate.
- **Per-function score**: `accuracy_score + performance_bonus` (max 120).
- **Overall score**: Geometric mean of per-function scores.

This ensures that a fast-but-inaccurate implementation scores poorly, while a
correctly-rounded-but-slow implementation still scores well.

## Step 3: Browser UI (`index.html`)

Single self-contained HTML file (or with bench.js as a separate script).

### UI elements:
- Header with benchmark name and description
- "Run Benchmark" button
- Progress bar showing current function and phase (accuracy/perf)
- Results table with columns: Function, Accuracy Score, Max ULP, Mean ULP,
  % Correctly Rounded, Ops/sec, Performance Bonus, Total Score
- Color coding: green (≤0.5 ULP), yellow (≤1 ULP), red (>1 ULP)
- Overall score prominently displayed
- Expandable detail rows showing worst inputs per function

### Execution:
- Use `requestIdleCallback` / chunked processing to keep UI responsive
- Load test_data.json via fetch

## Step 4: CLI Runner (`runner-cli.js`)

Thin wrapper that:
- Loads test_data.json from disk
- Runs the same bench.js core
- Prints results as a formatted table to stdout
- Works with Node.js (and potentially d8/jsc with minor shims)

## File Structure
```
js-math-bench/
├── PLAN.md                  # This file
├── README.md                # User-facing documentation
├── generate_test_data.py    # Build step: .wc files + mpmath → test_data.json
├── test_data.json           # Pre-computed accuracy test data
├── index.html               # Browser benchmark UI
├── bench.js                 # Core benchmark logic
├── runner-cli.js            # CLI runner for Node/d8/jsc
├── .gitignore
└── core-math/               # git-ignored, cloned for data generation
```

## Build / Run Instructions
```bash
# One-time: generate test data
git clone --depth 1 https://gitlab.inria.fr/core-math/core-math.git
uvx --with mpmath python3 generate_test_data.py

# Browser: serve and open
python3 -m http.server 8000
open http://localhost:8000

# CLI:
node runner-cli.js
```
