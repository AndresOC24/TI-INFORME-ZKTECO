import { leer, ES_TIPO_REGISTRABLE } from '../../../lib/archivos.js';

export const prerender = false;

/* Devuelve el archivo guardado tal cual, para que /principal lo parsee en el
   navegador con el mismo código que usa para los que se sueltan a mano. */
export async function GET({ params }) {
  const { kind } = params;
  if (!ES_TIPO_REGISTRABLE(kind)) return new Response('Tipo desconocido', { status: 404 });

  const reg = await leer(kind);
  if (!reg) return new Response('No hay archivo registrado para ese tipo', { status: 404 });

  return new Response(reg.buffer, {
    headers: {
      'content-type': 'application/vnd.ms-excel',
      'content-disposition': `inline; filename="${encodeURIComponent(reg.nombre)}"`,
      'cache-control': 'no-store',
      'x-archivo-nombre': encodeURIComponent(reg.nombre),
    },
  });
}
