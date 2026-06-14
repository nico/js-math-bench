#!/usr/bin/env python3
"""Generate test_data.json from core-math worst-case files and systematic inputs.

Usage: uvx --with mpmath python3 generate_test_data.py
"""

import json
import math
import os
import random
import struct
import sys

import mpmath

mpmath.mp.dps = 200  # 200 decimal digits of precision

# Map JS Math function names to mpmath functions
UNARY_FUNCTIONS = {
    'acos':  mpmath.acos,
    'acosh': mpmath.acosh,
    'asin':  mpmath.asin,
    'asinh': mpmath.asinh,
    'atan':  mpmath.atan,
    'atanh': mpmath.atanh,
    'cbrt':  lambda x: -mpmath.cbrt(-x) if x < 0 else mpmath.cbrt(x),
    'cos':   mpmath.cos,
    'cosh':  mpmath.cosh,
    'exp':   mpmath.exp,
    'expm1': mpmath.expm1,
    'log':   mpmath.log,
    'log1p': mpmath.log1p,
    'log2':  lambda x: mpmath.log(x) / mpmath.log(2),
    'log10': lambda x: mpmath.log(x) / mpmath.log(10),
    'sin':   mpmath.sin,
    'sinh':  mpmath.sinh,
    'sqrt':  mpmath.sqrt,
    'tan':   mpmath.tan,
    'tanh':  mpmath.tanh,
}

BINARY_FUNCTIONS = {
    'atan2': mpmath.atan2,
    'hypot': mpmath.hypot,
    'pow':   mpmath.power,
}

ALL_FUNCTIONS = list(UNARY_FUNCTIONS.keys()) + list(BINARY_FUNCTIONS.keys())

# Domain definitions for systematic inputs
# Each entry: (start, end, count) — generate `count` evenly spaced values in [start, end]
DOMAINS = {
    'acos':  [(-1, 1, 200)],
    'acosh': [(1, 10, 100), (1, 1.001, 100), (10, 1000, 50)],
    'asin':  [(-1, 1, 200)],
    'asinh': [(-10, 10, 150), (-1000, 1000, 50), (-1e-10, 1e-10, 50)],
    'atan':  [(-100, 100, 150), (-1e-10, 1e-10, 50), (-1e10, 1e10, 50)],
    'atanh': [(-0.999, 0.999, 200)],
    'cbrt':  [(-1000, 1000, 150), (-1e-10, 1e-10, 50), (1e10, 1e15, 50)],
    'cos':   [(-math.pi, math.pi, 150), (-100, 100, 50), (-1e-10, 1e-10, 50)],
    'cosh':  [(-10, 10, 150), (-700, 700, 50), (-1e-10, 1e-10, 50)],
    'exp':   [(-10, 10, 150), (-745, 709, 50), (-1e-10, 1e-10, 50)],
    'expm1': [(-10, 10, 150), (-1e-10, 1e-10, 100)],
    'log':   [(1e-300, 1, 100), (1, 10, 100), (10, 1e300, 50)],
    'log1p': [(-0.999, 10, 150), (-1e-15, 1e-15, 100)],
    'log2':  [(1e-300, 1, 100), (1, 10, 100), (10, 1e300, 50)],
    'log10': [(1e-300, 1, 100), (1, 10, 100), (10, 1e300, 50)],
    'pow':   [],  # handled specially as binary
    'sin':   [(-math.pi, math.pi, 150), (-100, 100, 50), (-1e-10, 1e-10, 50)],
    'sinh':  [(-10, 10, 150), (-700, 700, 50), (-1e-10, 1e-10, 50)],
    'sqrt':  [(0, 1, 100), (1, 100, 100), (100, 1e20, 50)],
    'tan':   [(-1.5, 1.5, 150), (-100, 100, 50), (-1e-10, 1e-10, 50)],
    'tanh':  [(-10, 10, 150), (-1e-10, 1e-10, 100)],
    'atan2': [],  # handled specially as binary
    'hypot': [],  # handled specially as binary
}

# Systematic inputs for binary functions
BINARY_DOMAINS = {
    'atan2': [
        # (y_range, x_range, count)
        ((-10, 10), (-10, 10), 200),
        ((-1e-10, 1e-10), (-1e-10, 1e-10), 50),
        ((1, 1000), (1, 1000), 50),
    ],
    'hypot': [
        ((-10, 10), (-10, 10), 150),
        ((-1e-10, 1e-10), (-1e-10, 1e-10), 50),
        ((1, 1000), (1, 1000), 50),
    ],
    'pow': [
        # (base_range, exp_range, count)
        ((0.1, 10), (-5, 5), 150),
        ((0.5, 2), (-100, 100), 50),
        ((2, 100), (0, 10), 50),
    ],
}


def double_to_hex(f):
    """Convert a Python float to a hex float string like '0x1.921fb54442d18p+1'."""
    if math.isnan(f):
        return 'NaN'
    if math.isinf(f):
        return '+Infinity' if f > 0 else '-Infinity'
    if f == 0.0:
        # Distinguish +0 and -0
        if math.copysign(1.0, f) < 0:
            return '-0'
        return '0'
    return f.hex()


def mpf_to_double(x):
    """Convert an mpmath mpf to the nearest Python float (correctly rounded).

    Workaround for https://github.com/mpmath/mpmath/issues/1078:
    mpmath's __float__() rounds to 53 mantissa bits, which is correct for
    normal doubles but wrong for denormals (which have fewer significant bits).
    Near-midpoint denormal values can round the wrong way. We fix this by
    checking the neighboring doubles and picking the closest one.
    """
    if isinstance(x, mpmath.mpc):
        return float('nan')  # Complex result means undefined for reals
    if mpmath.isnan(x):
        return float('nan')
    if mpmath.isinf(x):
        return float('inf') if x > 0 else float('-inf')
    d = float(x)
    if not math.isfinite(d) or d == 0.0:
        return d
    # The bug only affects denormals (abs(d) < 2^-1022), but float() may
    # have rounded a denormal result up to the smallest normal, so also
    # check when abs(d) is exactly 2^-1022.
    if abs(d) > 2.2250738585072014e-308:
        return d
    # Check neighbors to fix potential misrounding
    bits, = struct.unpack('>Q', struct.pack('>d', d))
    best = d
    best_err = abs(x - mpmath.mpf(d))
    for offset in [-1, 1]:
        b = bits + offset
        if b < 0 or b > 0x7FFFFFFFFFFFFFFF:
            continue
        candidate = struct.unpack('>d', struct.pack('>Q', b))[0]
        err = abs(x - mpmath.mpf(candidate))
        if err < best_err:
            best = candidate
            best_err = err
        elif err == best_err:
            # Tie: round to even (last bit = 0)
            cb, = struct.unpack('>Q', struct.pack('>d', candidate))
            if (cb & 1) == 0:
                best = candidate
    return best


def parse_hex_float(s):
    """Parse a hex float string from a .wc file to a Python float."""
    s = s.strip()
    if s in ('+snan', '+nan', '-snan', '-nan', 'nan', 'NaN'):
        return float('nan')
    if s in ('+inf', '-inf', 'inf', '+Infinity', '-Infinity', 'Infinity'):
        return float(s.replace('+inf', 'inf').replace('+Infinity', 'inf').replace('-Infinity', '-inf'))
    if s in ('+0', '-0'):
        return float(s)
    # Handle hex floats: some .wc files use '0x' prefix, some use '0xN.NNNp+N'
    # Python's float.fromhex handles these
    try:
        return float.fromhex(s)
    except ValueError:
        return None


def is_special(x):
    """Check if x is NaN, Inf, or ±0."""
    if x is None:
        return True
    return math.isnan(x) or math.isinf(x) or x == 0.0


def parse_wc_file(path, is_binary=False):
    """Parse a .wc file, returning a list of inputs.

    For unary functions: list of floats.
    For binary functions: list of (float, float) tuples.
    Skips entries with NaN, Inf, or ±0 since mpmath disagrees with
    the ECMAScript spec on those special cases.
    """
    inputs = []
    if not os.path.exists(path):
        return inputs
    with open(path) as f:
        for line in f:
            line = line.split('#')[0].strip()
            if not line:
                continue
            if is_binary:
                parts = line.split(',')
                if len(parts) >= 2:
                    a = parse_hex_float(parts[0])
                    b = parse_hex_float(parts[1])
                    if a is not None and b is not None and not is_special(a) and not is_special(b):
                        inputs.append((a, b))
            else:
                v = parse_hex_float(line)
                if v is not None and not is_special(v):
                    inputs.append(v)
    return inputs


def sample_worst_case(inputs, n=1000):
    """Sample up to n worst-case inputs, evenly spaced through the file."""
    if len(inputs) <= n:
        return inputs
    # Take evenly spaced samples
    step = len(inputs) / n
    return [inputs[int(i * step)] for i in range(n)]


def generate_systematic_unary(fn_name):
    """Generate systematic test inputs for a unary function."""
    inputs = []
    for start, end, count in DOMAINS.get(fn_name, []):
        for i in range(count):
            t = start + (end - start) * i / max(count - 1, 1)
            inputs.append(t)
    return inputs


def generate_systematic_binary(fn_name):
    """Generate systematic test inputs for a binary function."""
    inputs = []
    rng = random.Random(42)
    for (y_lo, y_hi), (x_lo, x_hi), count in BINARY_DOMAINS.get(fn_name, []):
        for _ in range(count):
            y = y_lo + (y_hi - y_lo) * rng.random()
            x = x_lo + (x_hi - x_lo) * rng.random()
            inputs.append((y, x))
    return inputs


def generate_edge_cases_unary(fn_name):
    """Generate edge case inputs for a unary function.

    Only includes finite, non-special inputs where mpmath can compute
    correct results. NaN/Inf behavior is spec compliance, not accuracy.
    """
    cases = []
    # Denormals
    cases.extend([5e-324, -5e-324])
    cases.extend([2.2250738585072014e-308, -2.2250738585072014e-308])
    # Very small values (near zero but not zero)
    cases.extend([1e-300, -1e-300, 1e-15, -1e-15])
    # Values near interesting points
    cases.extend([1.0, -1.0, 0.5, -0.5, 2.0, -2.0, 10.0, -10.0])
    cases.extend([math.pi, -math.pi, math.pi/2, -math.pi/2, math.e])
    # Near 1
    cases.extend([1.0 - 2**-52, 1.0 + 2**-52])
    # Large values
    cases.extend([1e100, -1e100, 1.7976931348623157e+308, -1.7976931348623157e+308])
    return cases


def generate_edge_cases_binary(fn_name):
    """Generate edge case inputs for a binary function.

    Only includes finite, non-NaN/Inf inputs where mpmath can compute
    correct results.
    """
    cases = []
    interesting = [0.5, 1.0, -1.0, 2.0, -2.0, 10.0, -10.0, 0.1, -0.1, 100.0]
    for a in interesting:
        for b in interesting:
            cases.append((a, b))
    # Additional interesting cases
    cases.extend([
        (math.e, math.pi), (math.pi, math.e), (0.5, 0.5),
        (1e-10, 0.5), (1e10, 0.1), (2.0, 53.0), (2.0, -53.0),
    ])
    return cases


def compute_expected_unary(fn_name, mp_fn, x):
    """Compute the correctly-rounded double result for fn(x)."""
    try:
        mp_x = mpmath.mpf(x)
        mp_result = mp_fn(mp_x)
        return mpf_to_double(mp_result)
    except Exception:
        return float('nan')


def compute_expected_binary(fn_name, mp_fn, x, y):
    """Compute the correctly-rounded double result for fn(x, y)."""
    try:
        mp_x = mpmath.mpf(x)
        mp_y = mpmath.mpf(y)
        mp_result = mp_fn(mp_x, mp_y)
        return mpf_to_double(mp_result)
    except Exception:
        return float('nan')


def make_entry_unary(x, expected):
    return {'in': double_to_hex(x), 'out': double_to_hex(expected)}


def make_entry_binary(x, y, expected):
    return {'in': [double_to_hex(x), double_to_hex(y)], 'out': double_to_hex(expected)}


def process_unary_function(fn_name):
    print(f'  Processing {fn_name}...')
    mp_fn = UNARY_FUNCTIONS[fn_name]
    result = {'worstCase': [], 'systematic': [], 'edgeCases': []}

    # Worst-case inputs from core-math
    wc_path = f'core-math/src/binary64/{fn_name}/{fn_name}.wc'
    wc_inputs = parse_wc_file(wc_path, is_binary=False)
    sampled = sample_worst_case(wc_inputs, 1000)
    print(f'    Worst-case: {len(sampled)} inputs (from {len(wc_inputs)} total)')
    for x in sampled:
        expected = compute_expected_unary(fn_name, mp_fn, x)
        result['worstCase'].append(make_entry_unary(x, expected))

    # Systematic inputs
    sys_inputs = generate_systematic_unary(fn_name)
    print(f'    Systematic: {len(sys_inputs)} inputs')
    for x in sys_inputs:
        expected = compute_expected_unary(fn_name, mp_fn, x)
        result['systematic'].append(make_entry_unary(x, expected))

    # Edge cases
    edge_inputs = generate_edge_cases_unary(fn_name)
    print(f'    Edge cases: {len(edge_inputs)} inputs')
    for x in edge_inputs:
        expected = compute_expected_unary(fn_name, mp_fn, x)
        result['edgeCases'].append(make_entry_unary(x, expected))

    return result


def process_binary_function(fn_name):
    print(f'  Processing {fn_name}...')
    mp_fn = BINARY_FUNCTIONS[fn_name]
    result = {'worstCase': [], 'systematic': [], 'edgeCases': []}

    # Worst-case inputs from core-math
    wc_path = f'core-math/src/binary64/{fn_name}/{fn_name}.wc'
    wc_inputs = parse_wc_file(wc_path, is_binary=True)
    sampled = sample_worst_case(wc_inputs, 1000)
    print(f'    Worst-case: {len(sampled)} inputs (from {len(wc_inputs)} total)')
    for x, y in sampled:
        expected = compute_expected_binary(fn_name, mp_fn, x, y)
        result['worstCase'].append(make_entry_binary(x, y, expected))

    # Systematic inputs
    sys_inputs = generate_systematic_binary(fn_name)
    print(f'    Systematic: {len(sys_inputs)} inputs')
    for x, y in sys_inputs:
        expected = compute_expected_binary(fn_name, mp_fn, x, y)
        result['systematic'].append(make_entry_binary(x, y, expected))

    # Edge cases
    edge_inputs = generate_edge_cases_binary(fn_name)
    print(f'    Edge cases: {len(edge_inputs)} inputs')
    for x, y in edge_inputs:
        expected = compute_expected_binary(fn_name, mp_fn, x, y)
        result['edgeCases'].append(make_entry_binary(x, y, expected))

    return result


def main():
    if not os.path.isdir('core-math'):
        print('Error: core-math/ directory not found.')
        print('Run: git clone --depth 1 https://gitlab.inria.fr/core-math/core-math.git')
        sys.exit(1)

    print('Generating test data...')
    data = {}

    for fn_name in sorted(UNARY_FUNCTIONS.keys()):
        data[fn_name] = process_unary_function(fn_name)

    for fn_name in sorted(BINARY_FUNCTIONS.keys()):
        data[fn_name] = process_binary_function(fn_name)

    # Summary
    total = 0
    for fn_name, fn_data in data.items():
        n = len(fn_data['worstCase']) + len(fn_data['systematic']) + len(fn_data['edgeCases'])
        total += n
        print(f'  {fn_name}: {n} test cases')
    print(f'Total: {total} test cases')

    out_path = 'test_data.json'
    with open(out_path, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f'Written to {out_path} ({size_mb:.1f} MB)')


if __name__ == '__main__':
    main()
