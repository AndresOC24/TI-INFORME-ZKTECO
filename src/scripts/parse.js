import * as XLSX from 'xlsx';

/* Reglas de datos verificadas contra los exports reales de UNIFRANZ.
   Ver PRODUCT.md → Capabilities and Constraints. */

export const STUDENT_CAREERS = [
  'ADM', 'AHT', 'ARQ', 'BYF', 'CPU', 'DDP', 'DER', 'DGP', 'ENF',
  'GAC', 'ICO', 'MED', 'ODO', 'PER', 'PSI', 'PYM', 'SIS', 'THO',
];
const STUDENT_SET = new Set(STUDENT_CAREERS);

/* Desde el export de agosto 2026, «Nombre de Departamento» dejó de traer el
   código de carrera y trae el rol (ESTUDIANTE / DOCENTE / ADMINISTRATIVOS /
   VISITA / POSTGRADO / General). La carrera se recupera cruzando nombre y
   apellido contra la BD de estudiantes; ver `linkCareers`. Los exports viejos,
   que sí traían el código, se siguen leyendo igual. */
const STUDENT_ROLE = 'ESTUDIANTE';

/* Estudiante que ingresó pero que la BD no pudo identificar. Se cuenta en los
   totales — la persona pasó por el molinete — y se separa en la vista por
   carrera para que el hueco quede a la vista en vez de disolverse. */
export const UNKNOWN_CAREER = 'S/C';

/* Los CÓDIGOS de carrera son la fuente de verdad. Estos nombres son de apoyo;
   corrige/completa los que falten sin tocar la lógica. Donde no hay nombre
   confiable se muestra el propio código. */
export const CAREER_NAMES = {
  MED: 'Medicina',
  ODO: 'Odontología',
  ENF: 'Enfermería',
  BYF: 'Bioquímica y Farmacia',
  PSI: 'Psicología',
  DER: 'Derecho',
  ARQ: 'Arquitectura',
  SIS: 'Ingeniería de Sistemas',
  ICO: 'Ingeniería Comercial',
  ADM: 'Administración de Empresas',
  AHT: 'Administración Hotelera y Turismo',
  DGP: 'Diseño Gráfico y Publicidad',
  PYM: 'Publicidad y Marketing',
  GAC: 'Gastronomía',
  CPU: 'Contaduría Pública',
  PER: 'Periodismo',
  [UNKNOWN_CAREER]: 'Sin carrera identificada',
};

export function careerName(code) {
  return CAREER_NAMES[code] || code;
}

/* ---------- utilidades ---------- */

export function readWorkbook(arrayBuffer) {
  return XLSX.read(arrayBuffer, { cellDates: true });
}

function sheetRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
}

function findHeaderRow(rows, needles) {
  const wanted = needles.map((n) => n.toLowerCase());
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = rows[i].map((c) => String(c).trim().toLowerCase());
    if (wanted.every((w) => cells.some((c) => c === w))) return i;
  }
  return -1;
}

function colIndexer(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => { map[String(h).trim()] = i; });
  return (name) => (name in map ? map[name] : -1);
}

const norm = (s) =>
  String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/* "2026-04-24 11:08:41" -> { day:'2026-04-24', hour:11 }. Tolera Date y d/m/Y. */
function parseTime(v) {
  if (v instanceof Date && !isNaN(v)) {
    const p = (n) => String(n).padStart(2, '0');
    return { day: `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`, hour: v.getHours() };
  }
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return { day: `${m[1]}-${m[2]}-${m[3]}`, hour: +m[4] };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})/);
  if (m) {
    const p = (n) => String(n).padStart(2, '0');
    return { day: `${m[3]}-${p(m[2])}-${p(m[1])}`, hour: +m[4] };
  }
  return null;
}

/* Dirección: texto de "Punto del Evento". Excepción molinete 106 (sin palabra):
   106-1 = Entrada, 106-2 = Salida. Ignora "Nombre de Área" y "Nombre de Lector". */
function direction(punto) {
  const p = String(punto || '');
  if (/salida/i.test(p)) return 'Salida';
  if (/entrada/i.test(p)) return 'Entrada';
  const m = p.match(/106-(\d)/);
  if (m) return m[1] === '1' ? 'Entrada' : m[1] === '2' ? 'Salida' : null;
  return null;
}

/* ---------- MOLINETES ---------- */

/* Extrae los eventos de estudiantes SIN agregarlos. Guardar el detalle permite
   recalcular el informe para cualquier rango de fechas sin releer el archivo
   (ver `aggregate`). Un evento: { day, hour, id, dept, dir } con
   dir = 'E' entrada · 'S' salida · 'X' intento denegado (Deshabilitada). */
export function parseMolinetes(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = sheetRows(ws);
  const hr = findHeaderRow(rows, ['Tiempo', 'Punto del Evento', 'ID']);
  if (hr === -1) {
    throw new Error('No parece un export de molinetes: faltan las columnas Tiempo / Punto del Evento / ID.');
  }
  const ix = colIndexer(rows[hr]);
  const cTime = ix('Tiempo'), cPunto = ix('Punto del Evento'), cDesc = ix('Descripción del Evento');
  const cId = ix('ID'), cNom = ix('Nombre'), cApe = ix('Apellido'), cDept = ix('Nombre de Departamento');

  const events = [];
  const names = new Map();           // id -> { nombre, apellido }
  const careerById = new Map();      // id -> código de carrera (lo llena `linkCareers`)
  const dayset = new Set();

  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const dept = String(row[cDept] || '').trim();
    const legacyCareer = STUDENT_SET.has(dept);
    if (dept !== STUDENT_ROLE && !legacyCareer) continue;   // solo estudiantes
    const t = parseTime(row[cTime]);
    if (!t) continue;

    let dir;
    if (String(row[cDesc] || '').trim() === 'Deshabilitada') {
      dir = 'X';
    } else {
      const d = direction(row[cPunto]);
      if (d === 'Entrada') dir = 'E';
      else if (d === 'Salida') dir = 'S';
      else continue;                                 // evento de sistema, sin dirección
    }

    const id = String(row[cId] || '').trim();
    if (!names.has(id)) {
      names.set(id, { nombre: String(row[cNom] || '').trim(), apellido: String(row[cApe] || '').trim() });
    }
    if (legacyCareer) careerById.set(id, dept);      // export viejo: la carrera ya venía
    events.push({ day: t.day, hour: t.hour, id, dir });
    dayset.add(t.day);
  }

  const daysWithData = [...dayset].sort();
  return {
    kind: 'molinetes',
    events, names, careerById, daysWithData,
    minDay: daysWithData[0] || null,
    maxDay: daysWithData[daysWithData.length - 1] || null,
  };
}

/* Rellena `careerById` cruzando «Apellido Nombre» del molinete contra la BD.
   Idempotente y barata (recorre personas, no eventos), así que puede llamarse
   en cada recálculo: la BD puede cargarse después del archivo de molinetes.
   Nunca pisa una carrera que ya venía en el propio export. */
export function linkCareers(molinetes, bd) {
  if (!molinetes || !bd) return;
  for (const [id, n] of molinetes.names) {
    if (molinetes.careerById.has(id)) continue;
    const code = bd.careerByName.get(norm(`${n.apellido} ${n.nombre}`));
    if (code) molinetes.careerById.set(id, code);
  }
}

/* Calcula todas las métricas del informe para el rango [fromDay, toDay]
   (fechas ISO 'YYYY-MM-DD', comparables como texto). Sin argumentos usa
   el período completo del archivo. */
export function aggregate(parsed, fromDay, toDay) {
  const from = fromDay || parsed.minDay;
  const to = toDay || parsed.maxDay;

  const entradasByDay = new Map();   // day -> Set(id)
  const salidasByDay = new Map();    // day -> Set(id)
  const hourEnt = new Array(24).fill(0);
  const hourSal = new Array(24).fill(0);
  const career = new Map();          // code -> { entDays:Map<day,Set>, salDays:Map<day,Set>, denied:Set(id) }
  const blocked = new Map();         // id -> { nombre, apellido, dept }
  const dayHour = new Map();         // day -> { ent:[24], sal:[24] } — pasajes, sin deduplicar
  let studentEvents = 0;

  const careerOf = (code) => {
    if (!career.has(code)) {
      career.set(code, {
        entDays: new Map(), salDays: new Map(), denied: new Set(),
        hEnt: new Array(24).fill(0), hSal: new Array(24).fill(0),   // cruce carrera × hora
      });
    }
    return career.get(code);
  };
  const dayHourOf = (day) => {
    if (!dayHour.has(day)) dayHour.set(day, { ent: new Array(24).fill(0), sal: new Array(24).fill(0) });
    return dayHour.get(day);
  };
  const addUnique = (map, day, id) => {
    if (!map.has(day)) map.set(day, new Set());
    map.get(day).add(id);
  };

  const seen = new Set();            // personas distintas del período (para la cobertura)
  let resolved = 0;

  for (const ev of parsed.events) {
    if (ev.day < from || ev.day > to) continue;
    studentEvents++;
    const code = parsed.careerById.get(ev.id) || UNKNOWN_CAREER;
    const cr = careerOf(code);
    if (!seen.has(ev.id)) {
      seen.add(ev.id);
      if (code !== UNKNOWN_CAREER) resolved++;
    }

    if (ev.dir === 'X') {             // un intento denegado no es un ingreso efectivo
      cr.denied.add(ev.id);
      if (!blocked.has(ev.id)) {
        const n = parsed.names.get(ev.id) || { nombre: '', apellido: '' };
        blocked.set(ev.id, { nombre: n.nombre, apellido: n.apellido, dept: code });
      }
    } else if (ev.dir === 'E') {
      addUnique(entradasByDay, ev.day, ev.id);
      addUnique(cr.entDays, ev.day, ev.id);
      hourEnt[ev.hour]++;
      dayHourOf(ev.day).ent[ev.hour]++;
      cr.hEnt[ev.hour]++;
    } else {
      addUnique(salidasByDay, ev.day, ev.id);
      addUnique(cr.salDays, ev.day, ev.id);
      hourSal[ev.hour]++;
      dayHourOf(ev.day).sal[ev.hour]++;
      cr.hSal[ev.hour]++;
    }
  }

  const days = [...new Set([...entradasByDay.keys(), ...salidasByDay.keys()])].sort();
  const sumUnique = (map) => [...map.values()].reduce((a, s) => a + s.size, 0);
  const perDayEntradas = days.map((d) => (entradasByDay.get(d)?.size || 0));
  const perDaySalidas = days.map((d) => (salidasByDay.get(d)?.size || 0));

  // estudiantes distintos que ingresaron al menos una vez en el período
  const distinctInPeriod = new Set();
  for (const s of entradasByDay.values()) for (const id of s) distinctInPeriod.add(id);

  const byCareer = [...career.entries()]
    .map(([code, c]) => {
      const pasajesEnt = c.hEnt.reduce((a, b) => a + b, 0);
      // hora en que esa carrera concentra más llegadas
      const peakHour = pasajesEnt ? c.hEnt.indexOf(Math.max(...c.hEnt)) : null;
      return {
        code,
        entradas: sumUnique(c.entDays),
        salidas: sumUnique(c.salDays),
        denied: c.denied.size,
        hourEnt: c.hEnt, hourSal: c.hSal,
        pasajesEnt,
        peakHour,
        peakHourEnt: peakHour == null ? 0 : c.hEnt[peakHour],
      };
    })
    .sort((a, b) => {
      // «Sin carrera» al final: es un hueco de datos, no una carrera más
      if ((a.code === UNKNOWN_CAREER) !== (b.code === UNKNOWN_CAREER)) {
        return a.code === UNKNOWN_CAREER ? 1 : -1;
      }
      return b.entradas - a.entradas;
    });

  return {
    from, to, days,
    studentEvents,
    entradasUnicas: sumUnique(entradasByDay),
    salidasUnicas: sumUnique(salidasByDay),
    perDayEntradas, perDaySalidas,
    distinctInPeriod: distinctInPeriod.size,
    hourEnt, hourSal,
    /* matriz día × hora (24 columnas por día) para el heatmap ampliado */
    hourByDay: days.map((d) => dayHour.get(d) || { ent: new Array(24).fill(0), sal: new Array(24).fill(0) }),
    byCareer,
    blocked,                 // Map id -> {nombre, apellido, dept}
    blockedCount: blocked.size,
    /* cuántas de las personas del período pudo identificar la BD */
    careerCoverage: { students: seen.size, resolved, unresolved: seen.size - resolved },
  };
}

/* ---------- BD ESTUDIANTES ---------- */

export function parseBD(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = sheetRows(ws);
  const hr = findHeaderRow(rows, ['Carrera', 'Código']);
  if (hr === -1) throw new Error('No parece la BD de estudiantes: faltan las columnas Carrera / Código.');
  const ix = colIndexer(rows[hr]);
  const cCod = ix('Código'), cCar = ix('Carrera'), cGes = ix('Gestión');
  const cAp = ix('Apellido Paterno'), cAm = ix('Apellido Materno'), cNo = ix('Nombre(s)');

  const ciByName = new Map();       // "APELLIDOS NOMBRES" -> CI (parte numérica del Código)
  const careerByName = new Map();   // "APELLIDOS NOMBRES" -> código de carrera
  const byCareer = new Map();
  let total = 0, nuevos = 0, antiguos = 0;

  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r];
    const cod = String(row[cCod] || '').trim();
    if (!cod) continue;
    total++;
    const g = String(row[cGes] || '').trim().toLowerCase();
    if (g === 'nuevo') nuevos++; else if (g === 'antiguo') antiguos++;
    const car = String(row[cCar] || '').trim();
    byCareer.set(car, (byCareer.get(car) || 0) + 1);
    const ci = cod.replace(/\D/g, '');
    const key = norm(`${row[cAp]} ${row[cAm]} ${row[cNo]}`);
    if (key) {
      ciByName.set(key, ci);
      if (car) careerByName.set(key, car);
    }
  }

  return { kind: 'bd', total, nuevos, antiguos, byCareer, ciByName, careerByName };
}

/* ---------- NUEVOS INSCRITOS ---------- */

const MONTH_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

export function parseNuevos(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = sheetRows(ws);
  const hr = findHeaderRow(rows, ['CÓDIGO ESTUDIANTE', 'CARRERA']);
  if (hr === -1) throw new Error('No parece el archivo de Nuevos inscritos: falta la columna CÓDIGO ESTUDIANTE.');
  const ix = colIndexer(rows[hr]);
  const cCod = ix('CÓDIGO ESTUDIANTE'), cCar = ix('CARRERA'), cMes = ix('MES');

  const byCareer = new Map();
  const byMonth = new Map();
  let total = 0;
  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r];
    const cod = String(row[cCod] || '').trim();
    if (!cod) continue;
    total++;
    const car = String(row[cCar] || '').trim();
    if (car) byCareer.set(car, (byCareer.get(car) || 0) + 1);
    const mes = String(row[cMes] || '').trim().toUpperCase();
    if (mes) byMonth.set(mes, (byMonth.get(mes) || 0) + 1);
  }
  const months = [...byMonth.entries()]
    .sort((a, b) => {
      const ia = MONTH_ORDER.indexOf(a[0]); const ib = MONTH_ORDER.indexOf(b[0]);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1; if (ib === -1) return -1;
      return ia - ib;
    });
  return {
    kind: 'nuevos',
    total,
    byCareer: [...byCareer.entries()].sort((a, b) => b[1] - a[1]),
    byMonth: months,
  };
}

/* ---------- cruce bloqueados -> CI ---------- */

export function resolveBlockedList(molinetes, bd) {
  const out = [];
  for (const { nombre, apellido, dept } of molinetes.blocked.values()) {
    let ci = '';
    if (bd) {
      const key = norm(`${apellido} ${nombre}`);
      ci = bd.ciByName.get(key) || '';
    }
    out.push({ apellido, nombre, dept, ci });
  }
  out.sort((a, b) => a.dept.localeCompare(b.dept) || a.apellido.localeCompare(b.apellido));
  return out;
}

/* Detección de tipo de archivo por contenido (para aceptar cualquiera de los 3
   en cualquier zona y avisar si el usuario suelta el equivocado). */
export function detectKind(wb) {
  const rows = sheetRows(wb.Sheets[wb.SheetNames[0]]);
  if (findHeaderRow(rows, ['Tiempo', 'Punto del Evento', 'ID']) !== -1) return 'molinetes';
  if (findHeaderRow(rows, ['CÓDIGO ESTUDIANTE', 'CARRERA']) !== -1) return 'nuevos';
  if (findHeaderRow(rows, ['Carrera', 'Código']) !== -1) return 'bd';
  return 'desconocido';
}
