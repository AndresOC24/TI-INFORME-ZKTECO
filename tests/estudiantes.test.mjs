import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseBD, parseMolinetes, estudiantesDesdeUsuarios, linkStudents, aggregate } from '../src/scripts/parse.js';
import { aggregateEstudiantes, estudiantesPorRevisar } from '../src/scripts/estudiantes-data.js';

const workbook = rows => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Datos');
  return wb;
};

test('revisión muestra THO sin eventos y recupera casos excluidos sin alterar los KPI', () => {
  const { raw, bd, usuarios } = fixture();
  const tho = { cod: 'THO999', ci: '999', carrera: 'THO', nombreCompleto: 'Estudiante THO' };
  bd.students.push(tho);
  const before = aggregate(raw, '2026-10-01', '2026-10-01', bd).entradasUnicas;
  const rows = estudiantesPorRevisar(raw, bd, usuarios, '2026-10-01', '2026-10-01');
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.cod === 'THO999').dias.size, 0);
  assert.ok(rows.find(r => r.ids.has('40')).motivo.includes('Sin coincidencia en la BD'));
  assert.equal(rows.some(r => r.ids.has('30')), false);
  assert.equal(aggregate(raw, '2026-10-01', '2026-10-01', bd).entradasUnicas, before);
  assert.equal(estudiantesPorRevisar(raw, bd, usuarios, '2026-10-02', '2026-10-02').length, 1);
  assert.equal(estudiantesPorRevisar(null, bd, usuarios).length, 1);
});

test('revisión agrupa varios IDs del mismo estudiante THO y cuenta días de entrada', () => {
  const { raw, bd, usuarios } = fixture();
  bd.students[0].carrera = 'THO';
  const entrada = raw.events.find(e => e.id === '10' && e.dir === 'E');
  raw.events.push({ ...entrada, id: '11' });
  const rows = estudiantesPorRevisar(raw, bd, usuarios, '2026-10-01', '2026-10-02');
  const tho = rows.find(r => r.carrera === 'THO');
  assert.deepEqual([...tho.ids].sort(), ['10', '11']);
  assert.equal(tho.dias.size, 1);
  assert.ok(!tho.motivo.includes('Sin coincidencia'));
});
function fixture() {
  const bd = parseBD(workbook([
    ['Carrera', 'Código', 'Apellido Paterno', 'Apellido Materno', 'Nombre(s)', 'Gest. Ingreso'],
    ['SIS', 'SIS123', 'Peña', '', 'José', 'II/26'],
    ['MED', 'MED456', 'Díaz', '', 'María', 'I/25'],
  ]));
  const usuarios = { byId: new Map([
    ['10', { nombre: 'Jose', apellido: 'Pena', ci: '123', rol: 'ESTUDIANTE' }],
    ['11', { nombre: 'Jose', apellido: 'Pena', ci: '123', rol: 'ESTUDIANTE' }],
    ['20', { nombre: 'Maria', apellido: 'Diaz', ci: '456', rol: 'ESTUDIANTE' }],
    ['30', { nombre: 'Personal', apellido: 'Prueba', ci: '789', rol: 'DOCENTE' }],
  ]) };
  const all = parseMolinetes(workbook([
    ['Tiempo', 'Punto del Evento', 'ID', 'Nombre', 'Apellido', 'Nombre de Departamento', 'Descripción del Evento'],
    ['2026-10-01 08:00:00', 'Entrada', '10', 'Jose', 'Pena', 'ESTUDIANTE', 'Verificado'],
    ['2026-10-01 12:00:00', 'Salida', '11', 'Jose', 'Pena', 'ESTUDIANTE', 'Verificado'],
    ['2026-10-02 08:00:00', 'Entrada', '10', 'Jose', 'Pena', 'ESTUDIANTE', 'Deshabilitada'],
    ['2026-10-01 08:00:00', 'Entrada', '30', 'Personal', 'Prueba', 'ESTUDIANTE', 'Verificado'],
    ['2026-10-01 08:00:00', 'Entrada', '40', 'Otro', 'Estudiante', 'ESTUDIANTE', 'Verificado'],
  ]), { allRoles: true });
  const raw = estudiantesDesdeUsuarios(all, usuarios);
  linkStudents(raw, bd, usuarios);
  return { raw, bd, usuarios };
}

test('listado de estudiantes conserva activos sin eventos y agrupa sus IDs sin incluir otros roles', () => {
  const { raw, bd, usuarios } = fixture();
  const rows = aggregateEstudiantes(raw, bd, usuarios);
  assert.equal(rows.length, 2);
  const jose = rows.find(r => r.ci === '123');
  assert.deepEqual([...jose.ids].sort(), ['10', '11']);
  assert.equal(jose.entradas, 1);
  assert.equal(jose.salidas, 1);
  assert.equal(jose.denegados, 1);
  assert.equal(jose.events.length, 3);
  assert.equal(jose.gestIngreso, 'II/26');
  assert.equal(rows.find(r => r.ci === '456').entradas, 0);
});

test('el rango actualiza la ficha sin convertir accesos denegados en entradas', () => {
  const { raw, bd, usuarios } = fixture();
  const rows = aggregateEstudiantes(raw, bd, usuarios, '2026-10-02', '2026-10-02');
  const jose = rows.find(r => r.ci === '123');
  assert.equal(jose.entradas, 0);
  assert.equal(jose.salidas, 0);
  assert.equal(jose.denegados, 1);
  assert.equal(jose.last, '2026-10-02 08:00:00');
  assert.equal(jose.dias.size, 0);
  assert.equal(rows.length, 2);
});

test('el directorio funciona sin eventos y sin BD usa el padrón estudiantil', () => {
  const { raw, bd, usuarios } = fixture();
  const before = aggregateEstudiantes(null, bd, usuarios);
  assert.equal(before.length, 2);
  assert.equal(before.every(r => r.events.length === 0), true);
  linkStudents(raw, null, usuarios);
  const fallback = aggregateEstudiantes(raw, null, usuarios);
  assert.equal(fallback.some(r => r.ids.has('30')), false);
  assert.equal(fallback.find(r => r.ids.has('40')).registered, false);
  assert.equal(fallback.find(r => r.ids.has('20')).events.length, 0);
});

test('los KPI cuentan una entrada por estudiante y día, incluso con varios IDs', () => {
  const { raw, bd } = fixture();
  const entrada = raw.events.find(e => e.id === '10' && e.dir === 'E');
  raw.events.push(
    { ...entrada, time: '14:00:00', hour: 14 },
    { ...entrada, id: '11', time: '16:00:00', hour: 16 },
    { ...entrada, day: '2026-10-03' },
    { ...entrada, day: '2026-10-03', id: '20', dir: 'S' },
  );
  raw.daysWithData = ['2026-10-01', '2026-10-02', '2026-10-03'];
  const m = aggregate(raw, '2026-10-01', '2026-10-04', bd);
  assert.deepEqual(m.dailyCounts.map(d => d.entradas), [1, 0, 1, 0]);
  assert.equal(m.entradasUnicas, 2);
  assert.equal(m.distinctInPeriod, 1);
  assert.equal(m.roster.asistieron, 1);
  assert.equal(m.byCareer.find(c => c.code === 'SIS').entradas, 2);
  assert.equal(m.dailyCounts[1].hasRecords, true); // Solo acceso denegado.
  assert.equal(m.dailyCounts[3].hasRecords, false); // Hueco del archivo.
  assert.equal(m.dailyCounts.reduce((sum, d) => sum + d.entradas, 0), m.entradasUnicas);

  const single = aggregate(raw, '2026-10-01', '2026-10-01', bd);
  assert.equal(single.entradasUnicas, 1);
  assert.equal(single.distinctInPeriod, 1);
  const denied = aggregate(raw, '2026-10-02', '2026-10-02', bd);
  assert.equal(denied.entradasUnicas, 0);
  assert.equal(denied.blockedCount, 1);
});

test('sin BD los KPI deduplican las entradas repetidas del mismo ID cada día', () => {
  const { raw, usuarios } = fixture();
  linkStudents(raw, null, usuarios);
  const entrada = raw.events.find(e => e.id === '10' && e.dir === 'E');
  raw.events.push({ ...entrada, hour: 14 }, { ...entrada, day: '2026-10-02' });
  const m = aggregate(raw, '2026-10-01', '2026-10-02');
  assert.deepEqual(m.dailyCounts.map(d => d.entradas), [2, 1]);
  assert.equal(m.entradasUnicas, 3);
  assert.equal(m.distinctInPeriod, 2);
});
