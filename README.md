# js-math-bench

A JavaScript benchmark that measures the **accuracy** and **performance** of `Math`
functions across engines. Unlike most benchmarks that focus solely on speed,
js-math-bench treats correctness as the primary metric.

## What it tests

22 `Math` functions: `acos`, `acosh`, `asin`, `asinh`, `atan`, `atan2`, `atanh`,
`cbrt`, `cos`, `cosh`, `exp`, `expm1`, `log`, `log1p`, `log2`, `log10`, `pow`,
`sin`, `sinh`, `sqrt`, `tan`, `tanh`

## How accuracy is measured

For each function, the benchmark tests ~1300 inputs:
- **Worst-case inputs** (~1000) from the
  [core-math](https://gitlab.inria.fr/core-math/core-math) project -- inputs where
  the exact result falls closest to the midpoint between two representable doubles,
  making correct rounding hardest.
- **Systematic inputs** (~250) evenly spaced across each function's domain, plus
  values near interesting points (domain boundaries, +-1, pi, etc.)
- **Edge cases** (~30) including denormals, very small/large values, and values near
  domain boundaries. (NaN/Inf/signed-zero inputs are excluded since those are spec
  compliance, not numerical accuracy.)

Expected results are pre-computed using Python's `mpmath` library at 200 digits of
precision, then correctly rounded to double. The benchmark compares each engine's
output and reports ULP (Units in Last Place) error.

| ULP Error | Meaning |
|-----------|---------|
| 0         | Exact match to correctly rounded result |
| <= 0.5    | Correctly rounded |
| <= 1.0    | Faithfully rounded |
| > 1.0     | Inaccurate |

## Scoring

- **Accuracy score (0-100)**: `100 / (1 + mean ULP)`. Every ULP of error counts:
  perfect = 100, mean ULP 0.1 = 90.9, mean ULP 0.5 = 66.7, mean ULP 1.0 = 50.
  Since this uses the mean (not median), a few large errors pull the score down hard.
- **Performance bonus (0-20)**: `20 * min(1, ops_per_sec / 1000M)`. Rewards
  throughput but capped so speed can't compensate for inaccuracy.
- **Per-function total**: accuracy + performance bonus (max 120).
- **Overall score**: geometric mean across all functions.

## Running in a browser

```bash
# Serve the directory
python3 -m http.server 8000
# Open http://localhost:8000 -- benchmark runs automatically
```

## Running from the command line

```bash
node runner-cli.js
```

Also works with other JS engines (d8, jsc) with minor modifications.

## Regenerating test data

The pre-computed `test_data.json` is checked into the repo. To regenerate:

```bash
git clone --depth 1 https://gitlab.inria.fr/core-math/core-math.git
uvx --with mpmath python3 generate_test_data.py
```
