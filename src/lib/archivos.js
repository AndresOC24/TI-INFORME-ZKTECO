import fs from 'node:fs/promises';
import path from 'node:path';
import { readHeader, detectKind } from '../scripts/parse.js';

/* Archivos de referencia que se registran desde /registrar y quedan guardados
   en disco. A diferencia del export de molinetes — que se sube en cada consulta
   y cambia todo el tiempo — estos dos cambian cada varios meses, así que vale
   la pena guardarlos una vez y que /principal los tome solo.

   `Nuevos inscritos` está fuera a pedido: el parser sigue en parse.js, así que
   devolverlo es agregar una entrada acá y su zona de carga. */
export const TIPOS = {
  bd: {
    titulo: 'BD de estudiantes',
    detalle: 'Listado de estudiantes activos de la gestión. Da el total de activos, la carrera y el CI.',
    ejemplo: 'DB_Estudiantes-10_09_2026.xls',
  },
  usuarios: {
    titulo: 'Usuarios del ZKTeco',
    detalle: 'Padrón de personas dadas de alta en los molinetes. Traduce el ID del molinete a CI.',
    ejemplo: 'Usuarios-Estudiantes.xls',
  },
};

export const ES_TIPO_REGISTRABLE = (k) => Object.hasOwn(TIPOS, k);

/* Por defecto la carpeta `archives/` del proyecto. Se puede mover con
   ARCHIVES_DIR para no depender de desde dónde se arrancó el servidor. */
const DIR = path.resolve(process.env.ARCHIVES_DIR || path.join(process.cwd(), 'archives'));

const EXT_OK = new Set(['.xls', '.xlsx', '.csv']);

/* Detectar el tipo obliga a leer y parsear cabeceras — medio segundo para un
   export de molinetes de varios MB. Como el contenido de un archivo en disco
   solo cambia si cambia su tamaño o su fecha, se cachea contra esas dos cosas. */
const cache = new Map();   // nombre -> { size, mtimeMs, kind }

async function detectar(nombre, stat) {
  const hit = cache.get(nombre);
  if (hit && hit.size === stat.size && hit.mtimeMs === stat.mtimeMs) return hit.kind;
  let kind = 'desconocido';
  try {
    kind = detectKind(readHeader(await fs.readFile(path.join(DIR, nombre))));
  } catch {
    kind = 'desconocido';                       // archivo corrupto o a medio copiar
  }
  cache.set(nombre, { size: stat.size, mtimeMs: stat.mtimeMs, kind });
  return kind;
}

/* Ignora temporales de Excel/LibreOffice (`.~lock.…#`, `~$…`) y ocultos. */
const esCandidato = (n) =>
  !n.startsWith('.') && !n.startsWith('~$') && EXT_OK.has(path.extname(n).toLowerCase());

/* Qué hay guardado hoy, por tipo. No hay manifiesto que mantener sincronizado:
   el tipo se deduce del propio contenido, así que los archivos que ya estaban
   en la carpeta antes de que existiera esta pantalla se reconocen igual. */
export async function listar() {
  let nombres = [];
  try {
    nombres = await fs.readdir(DIR);
  } catch {
    return {};                                  // la carpeta todavía no existe
  }

  const out = {};
  for (const nombre of nombres.filter(esCandidato)) {
    let stat;
    try { stat = await fs.stat(path.join(DIR, nombre)); } catch { continue; }
    if (!stat.isFile()) continue;
    const kind = await detectar(nombre, stat);
    if (!ES_TIPO_REGISTRABLE(kind)) continue;
    /* Si quedaran dos del mismo tipo, manda el más reciente. */
    if (out[kind] && out[kind].mtimeMs >= stat.mtimeMs) continue;
    out[kind] = { kind, nombre, bytes: stat.size, mtimeMs: stat.mtimeMs, actualizado: new Date(stat.mtimeMs).toISOString() };
  }
  return out;
}

export async function leer(kind) {
  const reg = (await listar())[kind];
  if (!reg) return null;
  return { ...reg, buffer: await fs.readFile(path.join(DIR, reg.nombre)) };
}

/* Nombre de archivo seguro: solo la base, sin rutas ni caracteres raros. */
function nombreSeguro(nombre, ext) {
  const base = path.basename(String(nombre || '')).replace(/[^\w.\- ]+/g, '_').trim();
  const conExt = EXT_OK.has(path.extname(base).toLowerCase()) ? base : base + ext;
  return conExt.replace(/^[.\s]+/, '') || `archivo${ext}`;
}

/* Guarda el archivo como el registrado para `kind`, reemplazando al anterior.

   El tipo NO se cree de lo que diga la pantalla ni de cómo se llame el archivo:
   se deduce del contenido y se exige que coincida con la zona donde se soltó.
   Así, soltar un export de molinetes en «BD de estudiantes» falla en vez de
   dejar el informe calculando sobre el archivo equivocado. */
export async function guardar(kind, nombreOriginal, buffer) {
  if (!ES_TIPO_REGISTRABLE(kind)) {
    const e = new Error(`«${kind}» no es un tipo que se pueda registrar aquí.`);
    e.status = 400; throw e;
  }
  if (!buffer || !buffer.length) {
    const e = new Error('El archivo llegó vacío.');
    e.status = 400; throw e;
  }

  let real;
  try {
    real = detectKind(readHeader(buffer));
  } catch {
    const e = new Error('No se pudo leer el archivo. ¿Es un Excel válido (.xls / .xlsx)?');
    e.status = 400; throw e;
  }

  if (real !== kind) {
    const dicho = TIPOS[kind].titulo;
    const nombreReal = TIPOS[real]?.titulo
      || { molinetes: 'Registro de molinetes', nuevos: 'Nuevos inscritos' }[real];
    const e = new Error(nombreReal
      ? `Ese archivo es «${nombreReal}», no «${dicho}». No se guardó nada.`
      : `El archivo no tiene el formato de «${dicho}»: no se reconocen sus columnas. No se guardó nada.`);
    e.status = 400; throw e;
  }

  await fs.mkdir(DIR, { recursive: true });
  const ext = path.extname(nombreOriginal || '').toLowerCase();
  const destino = nombreSeguro(nombreOriginal, EXT_OK.has(ext) ? ext : '.xls');
  const previo = (await listar())[kind];

  /* Escribir a un temporal y renombrar: si el proceso muere a mitad no queda un
     archivo truncado ocupando el lugar del que sí servía. */
  const tmp = path.join(DIR, `.tmp-${Date.now()}-${destino}`);
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, path.join(DIR, destino));

  /* El anterior se borra solo si cambió el nombre; si no, ya lo pisó el rename. */
  if (previo && previo.nombre !== destino) {
    await fs.rm(path.join(DIR, previo.nombre), { force: true });
    cache.delete(previo.nombre);
  }
  cache.delete(destino);

  return { ...(await listar())[kind], reemplazo: previo ? previo.nombre : null };
}
