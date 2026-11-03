import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { detectKind, parseMolinetes } from '../src/scripts/parse.js';
import { parseDocentes, linkDocentes, aggregateDocentes } from '../src/scripts/docentes-data.js';

const workbook = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Datos');
  return wb;
};
const directory = (rows) => workbook([
  ['N°', '9 DOCENTE GII-2026', 'CI', 'CARRERA', 'TELEFONO', 'Docente Antiguo / Nuevo', 'Email'], ...rows,
]);
const roster = () => parseDocentes(directory([
  [1, 'JOSÉ PEÑA', '00123', 'SIS', '70000000', 'Nuevo', 'ejemplo@example.test'],
  [2, 'MARÍA DÍAZ', '456', 'MED'],
]));
const eventBook = () => workbook([
  ['Todos los Eventos'], [],
  ['Tiempo', 'Punto del Evento', 'ID', 'Nombre', 'Apellido', 'Nombre de Departamento', 'Descripción del Evento'],
  ['2026-10-01 09:05:07', 'Entrada', '10', 'Jose', 'Pena', 'DOCENTE', 'Verificado'],
  ['2026-10-01 12:15:00', 'Salida', '10', 'Jose', 'Pena', 'DOCENTE', 'Verificado'],
  ['2026-10-02 09:00:00', 'Entrada', '10', 'Jose', 'Pena', 'DOCENTE', 'Deshabilitada'],
  ['2026-10-01 10:00:00', 'Entrada', '20', 'Alumno', 'Prueba', 'ESTUDIANTE', 'Verificado'],
  ['2026-10-01 10:30:00', 'Entrada', '30', 'Desconocido', 'Prueba', 'DOCENTE', 'Verificado'],
  ['2026-10-01 11:00:00', 'Entrada', '40', 'Personal', 'Prueba', 'ADMINISTRATIVOS', 'Verificado'],
]);

test('detecta la cabecera real, ignora filas vacias y combina carreras de un mismo CI', () => {
  const wb = directory([[1, 'JOSÉ PEÑA', '00123', 'DDP'], [], [2, 'JOSÉ PEÑA', '123', 'SIS']]);
  assert.equal(detectKind(wb), 'docentes');
  const parsed = parseDocentes(wb);
  assert.equal(parsed.total, 1);
  assert.equal(parsed.duplicateRows, 1);
  assert.deepEqual(parsed.teachers[0].carreras, ['DGP', 'SIS']);
});

test('rechaza un directorio vacio o sin columnas requeridas', () => {
  assert.throws(() => parseDocentes(directory([])), /no contiene docentes/);
  assert.throws(() => parseDocentes(workbook([['Nombre'], ['Prueba']])), /Faltan/);
});

test('el parser predeterminado conserva exclusivamente los eventos estudiantiles', () => {
  const students = parseMolinetes(eventBook());
  assert.equal(students.events.length, 1);
  assert.equal(students.events[0].id, '20');
  const all = parseMolinetes(eventBook(), { allRoles: true });
  assert.equal(all.events.length, 6);
  assert.equal(all.events[0].time, '09:05:07');
});

test('cruza por nombre sin tildes y distingue denegaciones, no entradas y desconocidos', () => {
  const raw = parseMolinetes(eventBook(), { allRoles: true });
  const reference = roster();
  const links = linkDocentes(raw, reference, null);
  const rows = aggregateDocentes(raw, reference, links);
  assert.equal(rows.length, 3);
  assert.equal(links.has('20'), false);
  assert.equal(links.has('40'), false);
  const jose = rows.find(r => r.key === 'ci:123');
  assert.equal(jose.entradas, 1);
  assert.equal(jose.salidas, 1);
  assert.equal(jose.denegados, 1);
  assert.equal(jose.dias.size, 1);
  assert.equal(rows.find(r => r.key === 'ci:456').events.length, 0);
  assert.equal(rows.find(r => r.key === 'zkteco:30').registered, false);
});

test('filtra fechas sin arrastrar marcaciones fuera del rango', () => {
  const raw = parseMolinetes(eventBook(), { allRoles: true });
  const reference = roster();
  const rows = aggregateDocentes(raw, reference, linkDocentes(raw, reference), '2026-10-02', '2026-10-02');
  assert.equal(rows.length, 2);
  const jose = rows.find(r => r.key === 'ci:123');
  assert.equal(jose.entradas, 0);
  assert.equal(jose.denegados, 1);
  assert.equal(jose.last, '2026-10-02 09:00:00');
});

test('el CI del padron tiene prioridad, incluso con otro departamento y nombre abreviado', () => {
  const raw = parseMolinetes(eventBook(), { allRoles: true });
  const users = { byId: new Map([['40', { ci: '000456', nombre: 'M', apellido: 'D' }]]) };
  const links = linkDocentes(raw, roster(), users);
  assert.equal(links.get('40').person.key, 'ci:456');
  assert.equal(links.get('40').match, 'CI');
});

test('los homonimos quedan sin coincidencia por nombre y se pueden resolver por CI', () => {
  const reference = parseDocentes(directory([[1, 'JOSE PENA', '123', 'SIS'], [2, 'JOSE PENA', '456', 'MED']]));
  const raw = parseMolinetes(eventBook(), { allRoles: true });
  assert.equal(linkDocentes(raw, reference).get('10').person.registered, false);
  const users = { byId: new Map([['10', { ci: '456' }]]) };
  assert.equal(linkDocentes(raw, reference, users).get('10').person.key, 'ci:456');
});

test('sin directorio conserva los eventos DOCENTE sin incluir visitantes ni estudiantes', () => {
  const raw = parseMolinetes(eventBook(), { allRoles: true });
  const links = linkDocentes(raw, null, null);
  assert.deepEqual([...links.keys()], ['10', '30']);
});
