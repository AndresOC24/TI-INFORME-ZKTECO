import * as XLSX from 'xlsx';
import { docenteHeader, isDocenteNameHeader, normName, nameKey, ciKey, canonCareer } from './parse.js';
import { daysBetween } from './dates.js';

export function docentesPorDia(rows, from, to) {
  const counts = new Map(daysBetween(from, to).map(day => [day, 0]));
  // aggregateDocentes ya agrupa todos los IDs de una persona y deduplica sus días.
  for (const row of rows) {
    for (const day of row.dias) {
      if (counts.has(day)) counts.set(day, counts.get(day) + 1);
    }
  }
  return [...counts].map(([day, count]) => ({ day, count }));
}

export function parseDocentes(wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1, defval: '', raw: false, blankrows: false,
  });
  const hr = docenteHeader(rows);
  if (hr < 0) throw new Error('Faltan las columnas de nombre del docente, CI y CARRERA.');
  const header = rows[hr].map(normName);
  const at = (row, label) => String(row[header.indexOf(label)] || '').trim();
  const nameCol = header.findIndex(isDocenteNameHeader);
  const byCI = new Map(), records = new Map();
  let duplicateRows = 0;
  for (const row of rows.slice(hr + 1)) {
    const nombre = String(row[nameCol] || '').trim();
    if (!nombre) continue;
    const ci = at(row, 'CI');
    const key = ciKey(ci) ? `ci:${ciKey(ci)}` : `nombre:${nameKey(nombre)}`;
    const carreras = at(row, 'CARRERA').split(/[,;/]+/).map(c => canonCareer(c.trim().toUpperCase())).filter(Boolean);
    const existing = records.get(key);
    if (existing) {
      existing.carreras = [...new Set([...existing.carreras, ...carreras])];
      duplicateRows++;
      continue;
    }
    const person = { key, nombre, ci, carreras, telefono: at(row, 'TELEFONO'),
      email: at(row, 'EMAIL'), condicion: at(row, 'DOCENTE ANTIGUO NUEVO'), registered: true };
    records.set(key, person);
    if (ciKey(ci)) byCI.set(ciKey(ci), person);
  }
  const teachers = [...records.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (!teachers.length) throw new Error('El archivo no contiene docentes con nombre.');
  // Los homonimos no se resuelven por nombre: necesitan el CI del padron.
  const byName = new Map();
  for (const person of teachers) {
    const key = nameKey(person.nombre);
    byName.set(key, byName.has(key) ? null : person);
  }
  return { kind: 'docentes', teachers, byCI, byName, total: teachers.length, duplicateRows };
}

// El Excel actualizado determina la población. ZKTeco solo aporta IDs y contacto.
export function docentesDesdeUsuarios(usuarios, directorio) {
  if (!directorio) return null;
  const teachers = directorio.teachers.map(person => ({ ...person, zktecoIds: [] }));
  const byKey = new Map(teachers.map(person => [person.key, person]));
  const byCI = new Map([...directorio.byCI].map(([ci, person]) => [ci, byKey.get(person.key)]));
  const byName = new Map([...directorio.byName].map(([name, person]) => [name, person ? byKey.get(person.key) : null]));
  const roster = { ...directorio, teachers, byCI, byName, byId: new Map(), total: teachers.length };
  for (const [id, user] of usuarios?.byId || []) {
    const person = matchDocente(roster, user, `${user.apellido} ${user.nombre}`).person;
    if (!person) continue;
    person.zktecoIds.push(id);
    person.telefono ||= user.telefono || '';
    person.email ||= user.email || '';
    roster.byId.set(id, person);
  }
  return roster;
}

function matchDocente(roster, user, nombre) {
  const ci = ciKey(user?.ci);
  const byCI = ci && roster.byCI.get(ci);
  if (byCI) return { person: byCI, match: 'CI' };
  const names = [user && `${user.apellido} ${user.nombre}`, nombre].filter(Boolean);
  for (const name of names) {
    const person = roster.byName.get(nameKey(name));
    // Un nombre igual no debe unir personas con documentos distintos.
    if (person && !(ci && ciKey(person.ci) && ci !== ciKey(person.ci))) return { person, match: 'Nombre' };
  }
  return {};
}

export function linkDocentes(raw, roster, usuarios) {
  const byId = new Map();
  if (!raw || !roster) return byId;
  for (const [id, name] of raw.names) {
    const user = usuarios?.byId.get(id);
    const person = roster.byId?.get(id);
    if (person) { byId.set(id, { person, match: 'ID ZKTeco' }); continue; }
    const link = matchDocente(roster, user, `${name.apellido} ${name.nombre}`);
    if (link.person) byId.set(id, link);
  }
  return byId;
}

export function aggregateDocentes(raw, roster, links, from, to) {
  const rows = new Map();
  const add = (person) => {
    if (!rows.has(person.key)) rows.set(person.key, { ...person, ids: new Set(person.zktecoIds || []), matches: new Set(),
      events: [], entradas: 0, salidas: 0, denegados: 0, dias: new Set(), last: '' });
    return rows.get(person.key);
  };
  for (const person of roster?.teachers || []) add(person);
  for (const event of raw?.events || []) {
    if ((from && event.day < from) || (to && event.day > to)) continue;
    const link = links.get(event.id);
    if (!link) continue;
    const row = add(link.person);
    row.ids.add(event.id); row.matches.add(link.match); row.events.push(event);
    if (event.dir === 'E') { row.entradas++; row.dias.add(event.day); }
    if (event.dir === 'S') row.salidas++;
    if (event.dir === 'X') row.denegados++;
    const timestamp = `${event.day} ${event.time}`;
    if (timestamp > row.last) row.last = timestamp;
  }
  return [...rows.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
