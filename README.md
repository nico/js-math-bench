# js-math-bench

A JavaScript benchmark that measures the **accuracy** and **performance** of `Math`
functions across engines. Unlike most benchmarks that focus solely on speed,
js-math-bench treats correctness as the primary metric.

## What it tests

22 `Math` functions: `acos`, `acosh`, `asin`, `asinh`, `atan`, `atan2`, `atanh`,
`cbrt`, `cos`, `cosh`, `exp`, `expm1`, `log`, `log1p`, `log2`, `log10`, `pow`,
`sin`, `sinh`, `sqrt`, `tan`, `tanh`

## How accuracy is measured

For each function, the benchmark tests ~1500 inputs:
- **Worst-case inputs** from the [core-math](https://gitlab.inria.fr/core-math/core-math)
  project — inputs where the exact result falls closest to the midpoint between two
  representable doubles, making correct rounding hardest.
- **Systematic inputs** across each function's domain.
- **Edge cases** (±0, ±Infinity, NaN, denormals, etc.)

Expected results are pre-computed using Python's `mpmath` library at 200 digits of
precision, then correctly rounded to double. The benchmark compares each engine's
output and reports ULP (Units in Last Place) error.

| ULP Error | Meaning |
|-----------|---------|
| 0         | Exact match to correctly rounded result |
| ≤ 0.5     | Correctly rounded |
| ≤ 1.0     | Faithfully rounded |
| > 1.0     | Inaccurate |

## Scoring

- **Accuracy score (0–100)**: percentage of inputs that are correctly rounded (≤ 0.5 ULP).
- **Performance bonus (0–20)**: throughput relative to a reference rate, capped at 20.
- **Per-function total**: accuracy + performance bonus (max 120).
- **Overall score**: geometric mean across all functions.

Accuracy dominates: a fast but inaccurate implementation scores poorly.

## Running in a browser

```bash
# Generate test data (one-time)
git clone --depth 1 https://gitlab.inria.fr/core-math/core-math.git
uvx --with mpmath python3 generate_test_data.py

# Serve
python3 -m http.server 8000
# Open http://localhost:8000
```

## Running from the command line

```bash
node runner-cli.js
```

Also works with other JS engines (d8, jsc) with minor modifications.

## Regenerating test data

The pre-computed `test_data.json` is checked into the repo. To regenerate:

```bash
uvx --with mpmath python3 generate_test_data.py
```

Requires the `core-math` directory to be present for worst-case input data.
