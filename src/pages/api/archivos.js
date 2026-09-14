import { listar, guardar, TIPOS } from '../../lib/archivos.js';

export const prerender = false;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/* Qué archivos de referencia hay guardados ahora mismo. */
export async function GET() {
  return json({ tipos: TIPOS, archivos: await listar() });
}

/* Registra (o reemplaza) el archivo de un tipo. multipart/form-data: `tipo` + `archivo`. */
const MAX_BYTES = 60 * 1024 * 1024;

export async function POST({ request }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'La carga no llegó completa. Intenta de nuevo.' }, 400);
  }

  const tipo = String(form.get('tipo') || '');
  const archivo = form.get('archivo');
  if (!archivo || typeof archivo === 'string') {
    return json({ error: 'No llegó ningún archivo.' }, 400);
  }
  if (archivo.size > MAX_BYTES) {
    return json({ error: `El archivo pesa ${(archivo.size / 1048576).toFixed(1)} MB; el máximo es ${MAX_BYTES / 1048576} MB.` }, 413);
  }

  try {
    const reg = await guardar(tipo, archivo.name, Buffer.from(await archivo.arrayBuffer()));
    return json({ ok: true, archivo: reg });
  } catch (err) {
    return json({ error: err.message || 'No se pudo guardar el archivo.' }, err.status || 500);
  }
}
