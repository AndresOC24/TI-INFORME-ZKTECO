import * as XLSX from 'xlsx';
import { docenteHeader, isDocenteNameHeader, normName, nameKey, ciKey, canonCareer } from './parse.js';

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

export function linkDocentes(raw, roster, usuarios) {
  const byId = new Map();
  if (!raw) return byId;
  const teacherIds = new Set(raw.events.filter(e => /^DOCENTES?$/.test(normName(e.department))).map(e => e.id));
  for (const [id, name] of raw.names) {
    const user = usuarios?.byId.get(id);
    const ci = ciKey(user?.ci);
    let person = ci ? roster?.byCI.get(ci) : null;
    let match = person ? 'CI' : '';
    if (!person) {
      person = (user && roster?.byName.get(nameKey(`${user.apellido} ${user.nombre}`)))
        || roster?.byName.get(nameKey(`${name.apellido} ${name.nombre}`));
      if (person) match = 'Nombre';
    }
    if (person) byId.set(id, { person, match });
    else if (teacherIds.has(id)) byId.set(id, { match: 'Sin coincidencia', person: {
      key: `zkteco:${id}`, nombre: `${name.apellido} ${name.nombre}`.trim() || `ID ${id}`,
      ci: user?.ci || '', carreras: [], telefono: '', email: '', condicion: '', registered: false,
    } });
  }
  return byId;
}

export function aggregateDocentes(raw, roster, links, from, to) {
  const rows = new Map();
  const add = (person) => {
    if (!rows.has(person.key)) rows.set(person.key, { ...person, ids: new Set(), matches: new Set(),
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
