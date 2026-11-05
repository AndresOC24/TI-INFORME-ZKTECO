import { ciKey, nameKey, UNKNOWN_CAREER } from './parse.js';

// El directorio parte de los activos de la BD, incluso sin marcaciones.
// Sin BD, se muestran los estudiantes del padrón y del archivo de eventos.
export function aggregateEstudiantes(raw, bd, usuarios, from, to) {
  const rows = new Map(), byStudent = new Map(), byId = new Map();
  const add = (key, values) => {
    if (!rows.has(key)) rows.set(key, { key, nombre: '', ci: '', carreras: [], cod: '', gestIngreso: '',
      registered: false, ids: new Set(), matches: new Set(), events: [], entradas: 0,
      salidas: 0, denegados: 0, dias: new Set(), last: '', ...values });
    return rows.get(key);
  };
  for (const student of bd?.students || []) {
    const row = add(`bd:${student.cod}`, { nombre: student.nombreCompleto, ci: student.ci,
      carreras: student.carrera ? [student.carrera] : [], cod: student.cod,
      gestIngreso: student.gestIngreso, registered: true });
    byStudent.set(student, row);
  }
  for (const [id, user] of usuarios?.byId || []) {
    if (user.rol && user.rol !== 'ESTUDIANTE') continue;
    const nombre = `${user.apellido} ${user.nombre}`.trim();
    const student = bd && ((user.ci && bd.byCI.get(ciKey(user.ci))) || bd.byName.get(nameKey(nombre)));
    const row = student ? byStudent.get(student) : !bd && add(`zkteco:${id}`, {
      nombre, ci: user.ci, registered: true,
    });
    if (row) { row.ids.add(id); byId.set(id, row); }
  }
  for (const [id, name] of raw?.names || []) {
    const student = raw.studentById.get(id);
    let row = student ? byStudent.get(student) : byId.get(id);
    const career = student?.carrera || raw.careerById.get(id) || UNKNOWN_CAREER;
    // Misma regla de inclusión que el resumen del informe.
    if (bd && career === UNKNOWN_CAREER) { byId.delete(id); continue; }
    if (!row) row = add(`zkteco:${id}`, {
      nombre: `${name.apellido} ${name.nombre}`.trim() || `ID ${id}`,
      ci: usuarios?.byId.get(id)?.ci || '', carreras: career === UNKNOWN_CAREER ? [] : [career],
    });
    row.ids.add(id);
    if (!row.carreras.length && career !== UNKNOWN_CAREER) row.carreras = [career];
    if (raw.matchById.get(id)) row.matches.add(raw.matchById.get(id));
    byId.set(id, row);
  }
  for (const event of raw?.events || []) {
    if ((from && event.day < from) || (to && event.day > to)) continue;
    const row = byId.get(event.id);
    if (!row) continue;
    row.events.push(event);
    if (event.dir === 'E') { row.entradas++; row.dias.add(event.day); }
    if (event.dir === 'S') row.salidas++;
    if (event.dir === 'X') row.denegados++;
    const timestamp = `${event.day} ${event.time}`;
    if (timestamp > row.last) row.last = timestamp;
  }
  return [...rows.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
