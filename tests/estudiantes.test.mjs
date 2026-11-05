import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseBD, parseMolinetes, estudiantesDesdeUsuarios, linkStudents } from '../src/scripts/parse.js';
import { aggregateEstudiantes } from '../src/scripts/estudiantes-data.js';

const workbook = rows => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Datos');
  return wb;
};
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
