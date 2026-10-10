import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transform } from 'esbuild';

const source = await readFile(new URL('../app/payouts-data.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' });
const { createPayouts, parseUsdCents } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('reference totals and 14-day dates match the supplied screenshot', () => {
  const data = createPayouts(['1749.19', '850.20'], '2026-10-09');
  assert.equal(data.total, '$2,599.39');
  assert.equal(data.latestDate, 'Oct 9, 2026');
  assert.deepEqual(data.records.map(({ amount, date }) => ({ amount, date })), [
    { amount: '$1,749.19', date: 'Oct 9, 2026' },
    { amount: '$850.20', date: 'Sep 25, 2026' },
  ]);
});

test('currency uses integer cents, accepts US grouping, and retains two decimals', () => {
  assert.equal(createPayouts(['0.10', '0.20'], '2026-01-01').total, '$0.30');
  assert.equal(createPayouts(['1,234,567.89', '0.01', '10'], '2026-01-01').total, '$1,234,577.90');
  assert.equal(parseUsdCents('850.2'), 85020);
  assert.equal(createPayouts(['0'], '2026-01-01').total, '$0.00');
  assert.equal(createPayouts(['999999999999.99', '999999999999.99', '999999999999.99'], '2026-01-01').total, '$2,999,999,999,999.97');
});

test('three records step backwards through months, leap days, and years', () => {
  assert.deepEqual(createPayouts(['1', '2', '3'], '2026-01-09').records.map(r => r.date),
    ['Jan 9, 2026', 'Dec 26, 2025', 'Dec 12, 2025']);
  assert.deepEqual(createPayouts(['1', '2', '3'], '2024-03-14').records.map(r => r.date),
    ['Mar 14, 2024', 'Feb 29, 2024', 'Feb 15, 2024']);
});

test('calendar results do not change with the host timezone or DST', () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Auckland']) {
      process.env.TZ = timezone;
      assert.deepEqual(createPayouts(['1', '2', '3'], '2026-03-15').records.map(r => r.date),
        ['Mar 15, 2026', 'Mar 1, 2026', 'Feb 15, 2026']);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('invalid amounts, impossible dates, and more than three records are rejected', () => {
  for (const value of ['', '-1', '1.234', '1e3', '12,34', 'NaN', '1000000000000']) {
    assert.throws(() => parseUsdCents(value), undefined, value);
  }
  for (const value of ['', '2026-02-29', '2026-13-01', '10/9/2026']) {
    assert.throws(() => createPayouts(['1'], value), undefined, value);
  }
  assert.throws(() => createPayouts([], '2026-10-09'));
  assert.throws(() => createPayouts(['1', '2', '3', '4'], '2026-10-09'));
  assert.throws(() => createPayouts(['1', '2', '3'], '0001-01-01'));
});
