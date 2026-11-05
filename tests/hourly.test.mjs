import test from 'node:test';
import assert from 'node:assert/strict';
import { hourlyProfile } from '../src/scripts/hourly-profile.js';
import { hourlyChart } from '../src/scripts/charts.js';

const hours = (hour, value) => Array.from({ length: 24 }, (_, i) => i === hour ? value : 0);
const metrics = {
  dailyCounts: ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'].map(day => ({ day })),
  days: ['2026-10-28', '2026-10-30'],
  hourEnt: hours(7, 5), hourSal: hours(17, 3),
  hourByDay: [
    { ent: hours(7, 4), sal: hours(17, 1) },
    { ent: hours(7, 1), sal: hours(17, 2) },
  ],
};

test('afluencia por fecha conserva las horas y no confunde fechas con huecos', () => {
  assert.deepEqual(hourlyProfile(metrics, '2026-10-30').ent, hours(7, 1));
  assert.deepEqual(hourlyProfile(metrics, '2026-10-30').sal, hours(17, 2));
  assert.deepEqual(hourlyProfile(metrics, '2026-10-29').ent, Array(24).fill(0));
  assert.deepEqual(hourlyProfile(metrics).ent, hours(7, 5));
});

test('el promedio incluye todos los días del rango y conserva las fracciones', () => {
  const profile = hourlyProfile(metrics, 'average');
  assert.equal(profile.days, 4);
  assert.equal(profile.ent[7], 1.25);
  assert.equal(profile.sal[17], .75);
  assert.equal(profile.average, true);
  const empty = hourlyProfile({ ...metrics, dailyCounts: [], hourEnt: hours(0, 0), hourSal: hours(0, 0) }, 'average');
  assert.equal(empty.ent.every(n => n === 0), true);
});

test('el gráfico identifica el promedio y muestra decimales en su información accesible', () => {
  const profile = hourlyProfile(metrics, 'average');
  const svg = hourlyChart(profile.ent, profile.sal, { average: true, days: 4 });
  const decimal = (1.25).toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  assert.ok(svg.includes(`${decimal} entradas`));
  assert.ok(svg.includes('promedio diario sobre 4 días seleccionados'));
  assert.ok(svg.includes('07:00'));
  assert.ok(svg.includes('Hora de mayor entrada'));
  assert.ok(!svg.includes('acumulado de'));
});

test('no se anuncia una hora de mayor entrada cuando no hay entradas o se ven solo salidas', () => {
  const zero = hours(0, 0);
  assert.ok(!hourlyChart(zero, zero).includes('Mayor entrada'));
  assert.ok(!hourlyChart(hours(7, 5), hours(17, 3), { metric: 'sal' }).includes('Mayor entrada'));
  for (const hour of [0, 23]) {
    const svg = hourlyChart(hours(hour, 5), zero);
    assert.ok(svg.includes(`${String(hour).padStart(2, '0')}:00`));
    assert.ok(!svg.includes('NaN'));
  }
});
