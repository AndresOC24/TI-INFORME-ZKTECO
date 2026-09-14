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
   VISITA / POSTGRADO / General). La carrera se recupera cruzando la persona
   contra la BD de estudiantes; ver `linkStudents`. Los exports viejos, que sí
   traían el código, se siguen leyendo igual. */
const STUDENT_ROLE = 'ESTUDIANTE';

/* ======================= GESTIÓN ACTUAL =======================
   «Nuevos inscritos» son los que ingresaron EXACTAMENTE en esta gestión, ni
   antes ni después. Es el único lugar donde se define: cambiá esta línea al
   empezar cada gestión y el informe se acomoda solo.
   Formato: 'II/2026' (segundo semestre) o 'I/2026' (primero).
   ============================================================== */
export const GESTION_ACTUAL = 'II/2026';

/* Estudiante que ingresó pero que la BD no pudo identificar. Se cuenta en los
   totales — la persona pasó por el molinete — y se separa en la vista por
   carrera para que el hueco quede a la vista en vez de disolverse. */
export const UNKNOWN_CAREER = 'S/C';

/* Códigos distintos que son la MISMA carrera. La universidad cambió el código
   de Diseño Gráfico: las cohortes viejas figuran como DGP y las nuevas entran
   como DDP. Verificado contra la BD — DGP no tiene ni un ingreso en II/26 y
   DDP tiene 20 — así que son la misma carrera en dos momentos, no dos carreras.
   Sin unificar salían dos barras separadas de Diseño Gráfico.

   Para volver a verlos como códigos separados, dejá este objeto vacío: {}. */
export const CAREER_ALIASES = { DDP: 'DGP' };

/* Código canónico de una carrera. Se aplica en cuanto el código entra al
   sistema (al leer la BD y al leer el departamento de un export viejo), así
   que de ahí para adentro ya no hay que acordarse de los alias. */
export const canonCareer = (code) => CAREER_ALIASES[code] || code;

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
  DGP: 'Diseño Gráfico',
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

/* Solo las primeras filas: alcanza para `detectKind` (que mira 12 como mucho) y
   evita parsear entero un export de molinetes de varios MB nada más que para
   saber qué es. Lo usa el servidor al revisar la carpeta `archives/`. */
export function readHeader(arrayBuffer) {
  return XLSX.read(arrayBuffer, { sheetRows: 12 });
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

/* ---------- identidad de la persona ----------

   Los tres sistemas escriben el mismo nombre de forma distinta: la BD académica
   respeta tildes y Ñ («PEÑA GUTIÉRREZ JOSÉ»), el ZKTeco casi siempre los pierde
   («PENA GUTIERREZ JOSE»), y el reparto entre apellidos y nombres no coincide
   (la BD tiene tres columnas, el ZKTeco dos). Por eso la comparación se hace
   sobre una clave canónica y no sobre el texto crudo. */

/* Mayúsculas, sin tildes (Ñ→N), sin puntuación ni dobles espacios. */
export const normName = (s) => String(s || '')
  .toUpperCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* Clave de nombre: las palabras ordenadas alfabéticamente. Ordenarlas hace la
   comparación inmune al reparto apellidos/nombres y al orden en que cada
   sistema los escribe. Verificado contra los archivos reales: las 2.760 filas
   de la BD dan 2.760 claves distintas, así que no hay riesgo de colisión. */
export const nameKey = (s) => normName(s).split(' ').filter(Boolean).sort().join(' ');

/* Clave de CI: el primer bloque de dígitos, sin ceros a la izquierda.
   Solo el PRIMER bloque, porque en los archivos reales el CI viene a veces con
   sufijo — «892333-1G», «12959610-OLD» — y arrastrar esos dígitos al número
   («892333-1G» → 8923331) rompía la coincidencia. Los ceros a la izquierda se
   quitan porque los dos sistemas rellenan distinto: «0027317» y «27317» son la
   misma persona. */
export const ciKey = (s) => {
  const m = String(s || '').match(/\d+/);
  return m ? m[0].replace(/^0+/, '') : '';
};

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
   (ver `aggregate`). Un evento: { day, hour, id, dir } con
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
  const careerById = new Map();      // id -> código de carrera (export viejo)
  const studentById = new Map();     // id -> ficha de la BD (lo llena `linkStudents`)
  const matchById = new Map();       // id -> cómo se identificó ('CI' | 'NOMBRE' | …)
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
    if (!id) continue;
    if (!names.has(id)) {
      names.set(id, { nombre: String(row[cNom] || '').trim(), apellido: String(row[cApe] || '').trim() });
    }
    if (legacyCareer) careerById.set(id, canonCareer(dept));   // export viejo: la carrera ya venía
    events.push({ day: t.day, hour: t.hour, id, dir });
    dayset.add(t.day);
  }

  const daysWithData = [...dayset].sort();
  return {
    kind: 'molinetes',
    events, names, careerById, studentById, matchById, daysWithData,
    minDay: daysWithData[0] || null,
    maxDay: daysWithData[daysWithData.length - 1] || null,
  };
}

/* ---------- USUARIOS DEL ZKTECO ----------

   Padrón de personas dadas de alta en los molinetes. Es la pieza que une las
   dos puntas: los eventos traen un `ID` interno del dispositivo y ningún CI;
   este archivo traduce ese `ID` a un CI («Documento / Cédula») que sí existe en
   la BD académica. Sin él solo se puede cruzar por nombre. */
export function parseUsuarios(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = sheetRows(ws);
  const hr = findHeaderRow(rows, ['ID', 'Documento / Cédula']);
  if (hr === -1) {
    throw new Error('No parece el padrón de usuarios del ZKTeco: falta la columna Documento / Cédula.');
  }
  const ix = colIndexer(rows[hr]);
  const cId = ix('ID'), cNom = ix('Nombre'), cApe = ix('Apellido'), cDoc = ix('Documento / Cédula');

  const byId = new Map();            // id del molinete -> { nombre, apellido, ci }
  let total = 0, sinCI = 0;

  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r];
    const id = String(row[cId] || '').trim();
    if (!id) continue;
    const nombre = String(row[cNom] || '').trim();
    const apellido = String(row[cApe] || '').trim();
    const ci = ciKey(row[cDoc]);
    /* Filas sin nombre ni CI: altas incompletas del ZKTeco. No aportan nada al
       cruce, pero tampoco son un error del archivo. */
    if (!nombre && !apellido && !ci) continue;
    total++;
    if (!ci) sinCI++;
    byId.set(id, { nombre, apellido, ci });
  }

  return { kind: 'usuarios', byId, total, sinCI };
}

/* ---------- cruce de identidad ----------

   Resuelve cada persona vista en el molinete contra su ficha de la BD. Dos
   caminos, en este orden:

     1. Por CI, vía el padrón de usuarios (ID del molinete → CI → BD). Es el
        camino exacto y resuelve la gran mayoría.
     2. Por nombre canónico (`nameKey`), que ignora tildes, Ñ y el orden de
        apellidos/nombres. Recupera a quien tiene el CI mal cargado en alguno
        de los dos sistemas — verificado: 25 personas cuyo CI NO coincide, o
        falta, y que sin este paso se perderían.

   Si el padrón no está cargado se cruza por el nombre que trae el propio
   evento, que es peor (el ZKTeco abrevia) pero funciona.

   Idempotente y barata (recorre personas, no eventos), así que puede llamarse
   en cada recálculo: los archivos pueden cargarse en cualquier orden. */
export function linkStudents(molinetes, bd, usuarios) {
  if (!molinetes) return;
  molinetes.studentById.clear();
  molinetes.matchById.clear();
  if (!bd) return;

  for (const [id, n] of molinetes.names) {
    const u = usuarios ? usuarios.byId.get(id) : null;

    // 1. CI del padrón contra el CI de la BD
    if (u && u.ci) {
      const hit = bd.byCI.get(u.ci);
      if (hit) { molinetes.studentById.set(id, hit); molinetes.matchById.set(id, 'CI'); continue; }
    }

    // 2. nombre canónico — primero el del padrón, que viene completo
    if (u) {
      const hit = bd.byName.get(nameKey(`${u.apellido} ${u.nombre}`));
      if (hit) { molinetes.studentById.set(id, hit); molinetes.matchById.set(id, 'NOMBRE'); continue; }
    }

    // 3. sin padrón (o sin suerte): el nombre que trae el propio evento
    const hit = bd.byName.get(nameKey(`${n.apellido} ${n.nombre}`));
    if (hit) { molinetes.studentById.set(id, hit); molinetes.matchById.set(id, 'NOMBRE'); }
  }

  /* La carrera del export viejo sigue mandando donde la BD no llegó: es un dato
     del propio molinete, no una inferencia. */
  for (const [id, code] of molinetes.careerById) {
    if (!molinetes.studentById.has(id)) molinetes.matchById.set(id, 'DEPTO');
  }
}

/* Compatibilidad con el nombre anterior. */
export const linkCareers = linkStudents;

/* Carrera de una persona del molinete: la de su ficha si se pudo identificar,
   si no la que traía el export viejo, si no «sin carrera». */
function careerFor(parsed, id) {
  const st = parsed.studentById.get(id);
  if (st) return st.carrera || UNKNOWN_CAREER;
  return parsed.careerById.get(id) || UNKNOWN_CAREER;
}

/* Calcula todas las métricas del informe para el rango [fromDay, toDay]
   (fechas ISO 'YYYY-MM-DD', comparables como texto). Sin argumentos usa
   el período completo del archivo. */
export function aggregate(parsed, fromDay, toDay, bd) {
  const from = fromDay || parsed.minDay;
  const to = toDay || parsed.maxDay;

  const entradasByDay = new Map();   // day -> Set(id)
  const salidasByDay = new Map();    // day -> Set(id)
  const hourEnt = new Array(24).fill(0);
  const hourSal = new Array(24).fill(0);
  const career = new Map();          // code -> { entDays, salDays, denied, hEnt, hSal }
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

  const seen = new Set();            // personas distintas contadas en el período
  const seenCodes = new Set();       // códigos de la BD que aparecieron en el rango
  const excluidos = new Set();       // personas descartadas por no ser de la gestión

  for (const ev of parsed.events) {
    if (ev.day < from || ev.day > to) continue;
    const code = careerFor(parsed, ev.id);

    /* El informe cuenta SOLO estudiantes activos de la gestión. Por el molinete
       también pasa gente que el ZKTeco tiene como «ESTUDIANTE» pero que no está
       en la BD — egresados, retirados, fichas viejas, personal — y esos no son
       asistencia estudiantil: se descartan enteros, no van ni a los totales, ni
       a la afluencia por hora, ni a los bloqueados.

       El descarte necesita una BD contra la cual decidir. Sin BD cargada no hay
       forma de saber quién es quién, así que se cuenta todo: es preferible un
       informe completo sin carreras a uno vacío. */
    if (bd && code === UNKNOWN_CAREER) { excluidos.add(ev.id); continue; }

    studentEvents++;
    const cr = careerOf(code);
    seen.add(ev.id);

    /* Asistió quien tiene al menos una ENTRADA. Es la misma definición que usa
       la tarjeta «Ingresos», para que los dos números del resumen no digan
       cosas distintas.

       Deliberadamente NO cuenta a quien solo registra salidas. Parece raro —si
       salió, estaba adentro— pero el log trae 2 805 salidas más que entradas, y
       tomarlas como asistencia metía 196 personas en un solo día apoyándose en
       una entrada que nunca se registró. Ante la duda, se cuenta lo que consta.
       Un intento denegado tampoco es asistencia: el molinete no lo dejó pasar. */
    if (ev.dir === 'E') {
      const st = parsed.studentById.get(ev.id);
      if (st) seenCodes.add(st.cod);
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
    /* personas contadas y personas descartadas por no pertenecer a la gestión */
    careerCoverage: { students: seen.size, excluidos: excluidos.size },
    /* padrón del rango: quién de la BD vino y quién no (ver `roster`) */
    roster: roster(parsed, bd, seenCodes),
  };
}

/* ---------- padrón del rango ----------

   El archivo de eventos cubre solo las fechas que se pidieron al exportar, así
   que un estudiante que no aparece casi nunca es un error de cruce: es alguien
   que no vino en esas fechas. Separar las dos cosas es lo que hace legible el
   informe, y es la razón de esta función:

     · asistieron  — activos de la BD vistos en el rango
     · ausentes    — activos de la BD que NO aparecen (no vinieron)
     · noActivos   — personas vistas en el molinete que no están en la BD de la
                     gestión (egresados, retirados, arrastres del padrón)

   «ausentes» es información, no un fallo. «noActivos» tampoco: son gente real
   que pasó por la puerta pero que no cuenta como estudiante de la gestión. */
function roster(parsed, bd, seenCodes) {
  if (!bd) return null;
  const seenPeople = new Set();
  for (const id of parsed.names.keys()) seenPeople.add(id);

  const ausentes = [];
  for (const st of bd.students) {
    if (!seenCodes.has(st.cod)) ausentes.push(st);
  }
  const ausentesByCareer = new Map();
  for (const st of ausentes) {
    ausentesByCareer.set(st.carrera, (ausentesByCareer.get(st.carrera) || 0) + 1);
  }

  /* Asistencia POR CARRERA: cuántos de los inscritos en cada carrera vinieron.
     Es una tasa, no un conteo, justamente para poder comparar carreras de
     tamaños muy distintos — MED tiene 762 inscritos y GAC 22, así que en
     números crudos MED gana siempre y no se ve quién asiste mejor. */
  const totalPorCarrera = new Map();
  for (const st of bd.students) {
    totalPorCarrera.set(st.carrera, (totalPorCarrera.get(st.carrera) || 0) + 1);
  }
  const porCarrera = [...totalPorCarrera.entries()]
    .map(([code, total]) => {
      const faltan = ausentesByCareer.get(code) || 0;
      const vinieron = total - faltan;
      return { code, total, vinieron, faltan, tasa: total ? vinieron / total : 0 };
    })
    .sort((a, b) => b.tasa - a.tasa || b.total - a.total);

  return {
    activos: bd.total,
    asistieron: seenCodes.size,
    ausentes: ausentes.length,
    ausentesList: ausentes,
    ausentesByCareer: [...ausentesByCareer.entries()].sort((a, b) => b[1] - a[1]),
    porCarrera,
    tasa: bd.total ? seenCodes.size / bd.total : 0,
  };
}

/* ---------- BD ESTUDIANTES ---------- */

/* «Gest. Ingreso» es la gestión en que el estudiante entró a la universidad:
   «0I/26» = primer semestre de 2026, «II/26» = segundo. Los exports nuevos ya
   no traen la columna Nuevo/Antiguo, así que hay que deducirla.

   Deducirla como «la gestión más alta del archivo» NO funciona: el export de
   septiembre de 2026 trae 5 estudiantes ya matriculados para 0I/27, y esos 5
   se llevaban toda la categoría «nuevos» dejando a los 170 reales de II/26
   contados como antiguos. La gestión de referencia sale de la FECHA del
   informe, que es el dato que de verdad la determina. */
/* Compara gestiones sin importar cómo estén escritas: la BD usa «0I/26» y
   «II/26», y GESTION_ACTUAL se escribe con el año completo («II/2026»). */
function gestionRank(g) {
  const m = String(g || '').trim().toUpperCase().match(/^(II|0I|I)\/(\d{4}|\d{2})$/);
  if (!m) return -1;
  const anio = m[2].length === 4 ? +m[2].slice(2) : +m[2];
  return anio * 10 + (m[1] === 'II' ? 2 : 1);
}

/* Reparte los activos en nuevos y antiguos. Nuevo = ingresó EXACTAMENTE en
   GESTION_ACTUAL; todo lo demás es antiguo, incluidas las matrículas
   adelantadas a la gestión siguiente. No depende del rango de fechas que se
   mire en el informe: los nuevos de la gestión son los mismos se filtre lo que
   se filtre. Si la BD trae la columna Nuevo/Antiguo se respeta tal cual. */
export function cohortFor(bd) {
  if (!bd) return null;
  if (bd.hasGestionCol) return { gestion: '', nuevos: bd.nuevos, antiguos: bd.antiguos };
  const rank = gestionRank(GESTION_ACTUAL);
  let nuevos = 0, antiguos = 0;
  for (const st of bd.students) {
    if (gestionRank(st.gestIngreso) === rank) nuevos++; else antiguos++;
  }
  return { gestion: GESTION_ACTUAL, nuevos, antiguos };
}

export function parseBD(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = sheetRows(ws);
  const hr = findHeaderRow(rows, ['Carrera', 'Código']);
  if (hr === -1) throw new Error('No parece la BD de estudiantes: faltan las columnas Carrera / Código.');
  const ix = colIndexer(rows[hr]);
  const cCod = ix('Código'), cCar = ix('Carrera');
  const cAp = ix('Apellido Paterno'), cAm = ix('Apellido Materno'), cNo = ix('Nombre(s)');
  /* Exports viejos traían «Gestión» (Nuevo/Antiguo); los nuevos, «Gest. Ingreso». */
  const cGes = ix('Gestión'), cGesIng = ix('Gest. Ingreso');
  const cDeuda = ix('Deuda Molinete');

  const students = [];
  const byCI = new Map();           // CI -> ficha
  const byName = new Map();         // nombre canónico -> ficha
  const ciByName = new Map();       // compatibilidad: nombre canónico -> CI
  const careerByName = new Map();   // compatibilidad: nombre canónico -> carrera
  const byCareer = new Map();
  let total = 0, nuevos = 0, antiguos = 0;

  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r];
    const cod = String(row[cCod] || '').trim();
    if (!cod) continue;
    total++;
    const carrera = canonCareer(String(row[cCar] || '').trim());
    byCareer.set(carrera, (byCareer.get(carrera) || 0) + 1);

    const ap = String(row[cAp] || '').trim();
    const am = String(row[cAm] || '').trim();
    const no = String(row[cNo] || '').trim();
    /* El CI es la parte numérica del Código académico («ADM14512233» →
       «14512233»). La columna «Carnet» NO es el CI: trae montos de beca. */
    const ci = ciKey(cod);
    const gestIngreso = cGesIng === -1 ? '' : String(row[cGesIng] || '').trim();
    const st = {
      cod, ci, carrera, ap, am, no,
      nombreCompleto: `${ap} ${am} ${no}`.replace(/\s+/g, ' ').trim(),
      gestIngreso,
      deuda: parseFloat(String(row[cDeuda] ?? '0').replace(/[^\d.-]/g, '')) || 0,
    };
    students.push(st);

    if (ci && !byCI.has(ci)) byCI.set(ci, st);
    const key = nameKey(`${ap} ${am} ${no}`);
    if (key && !byName.has(key)) {
      byName.set(key, st);
      ciByName.set(key, ci);
      if (carrera) careerByName.set(key, carrera);
    }

    if (cGes !== -1) {
      const g = String(row[cGes] || '').trim().toLowerCase();
      if (g === 'nuevo') nuevos++; else if (g === 'antiguo') antiguos++;
    }
  }

  /* Sin columna «Gestión», el reparto nuevos/antiguos lo hace `cohortFor`
     contra GESTION_ACTUAL. */
  return {
    kind: 'bd', total, nuevos, antiguos, byCareer,
    hasGestionCol: cGes !== -1,
    students, byCI, byName, ciByName, careerByName,
  };
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

/* ---------- cruce bloqueados -> CI ----------

   El CI sale de la ficha ya resuelta (CI del padrón o nombre canónico), no de
   un cruce aparte: así el listado hereda la misma cobertura que el resto del
   informe en vez de volver a fallar por tildes. */
export function resolveBlockedList(molinetes, parsed) {
  const src = parsed || molinetes;
  const out = [];
  for (const [id, { nombre, apellido, dept }] of molinetes.blocked) {
    const st = src.studentById ? src.studentById.get(id) : null;
    out.push({
      apellido: st ? `${st.ap} ${st.am}`.trim() : apellido,
      nombre: st ? st.no : nombre,
      dept: st ? st.carrera : dept,
      ci: st ? st.ci : '',
    });
  }
  out.sort((a, b) => a.dept.localeCompare(b.dept) || a.apellido.localeCompare(b.apellido));
  return out;
}

/* Detección de tipo de archivo por contenido (para aceptar cualquiera en
   cualquier zona y avisar si el usuario suelta el equivocado). */
export function detectKind(wb) {
  const rows = sheetRows(wb.Sheets[wb.SheetNames[0]]);
  if (findHeaderRow(rows, ['Tiempo', 'Punto del Evento', 'ID']) !== -1) return 'molinetes';
  if (findHeaderRow(rows, ['ID', 'Documento / Cédula']) !== -1) return 'usuarios';
  if (findHeaderRow(rows, ['CÓDIGO ESTUDIANTE', 'CARRERA']) !== -1) return 'nuevos';
  if (findHeaderRow(rows, ['Carrera', 'Código']) !== -1) return 'bd';
  return 'desconocido';
}
