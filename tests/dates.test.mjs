import test from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, selectDay, addDays } from '../src/scripts/dates.js';

test('el rango incluye ambos extremos, los días sin eventos y cambios de mes y año', () => {
  assert.deepEqual(daysBetween('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(daysBetween('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29', '2028-03-01']);
  assert.deepEqual(daysBetween('2026-10-01', '2026-10-01'), ['2026-10-01']);
  assert.deepEqual(daysBetween(null, null), []);
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});

test('el calendario permite un día, un rango invertido y comenzar otra selección', () => {
  const single = selectDay({}, '2026-10-28');
  assert.deepEqual(single, { from: '2026-10-28', to: '2026-10-28', pending: true });
  const range = selectDay(single, '2026-10-26');
  assert.deepEqual(range, { from: '2026-10-26', to: '2026-10-28', pending: false });
  assert.deepEqual(selectDay(range, '2026-11-01'), { from: '2026-11-01', to: '2026-11-01', pending: true });
  assert.deepEqual(selectDay(single, '2026-10-28'), { from: '2026-10-28', to: '2026-10-28', pending: false });
});
