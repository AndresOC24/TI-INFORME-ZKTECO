import { initTheme } from './theme.js';

const $ = (s, r = document) => r.querySelector(s);

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fecha(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

const peso = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Estado dibujado: qué hay guardado por tipo. Se repinta entero tras cada
   carga, así la tarjeta siempre muestra lo que de verdad está en el servidor. */
let TIPOS = {};

function card(kind, info, reg) {
  const actual = reg
    ? `<div class="reg__current">
         <span class="reg__name">${esc(reg.nombre)}</span>
         <span class="reg__meta">${peso(reg.bytes)} · actualizado ${fecha(reg.actualizado)}</span>
       </div>`
    : `<div class="reg__current reg__current--empty">
         <span class="reg__meta">Todavía no hay ningún archivo registrado.</span>
       </div>`;

  return `
    <article class="reg__card" data-kind="${kind}">
      <div class="reg__head">
        <h3>${esc(info.titulo)}</h3>
        <span class="tally${reg ? ' tally--accent' : ''}">${reg ? 'registrado' : 'falta'}</span>
      </div>
      <p class="reg__detail">${esc(info.detalle)}</p>
      ${actual}
      <label class="drop" data-state="idle">
        <input class="drop__input" type="file" accept=".xls,.xlsx,.csv" hidden />
        <svg class="drop__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
        <span class="drop__body">
          <span class="drop__title">${reg ? 'Reemplazar archivo' : 'Subir archivo'}</span>
          <span class="drop__status">Arrastra o haz clic · .xls / .xlsx</span>
          <span class="drop__file"></span>
        </span>
      </label>
      <p class="reg__msg"></p>
    </article>`;
}

async function pintar() {
  const cont = $('#reg');
  try {
    const r = await fetch('/api/archivos', { cache: 'no-store' });
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
    const { tipos, archivos } = await r.json();
    TIPOS = tipos;
    cont.innerHTML = Object.entries(tipos).map(([k, info]) => card(k, info, archivos[k])).join('');
    Object.keys(tipos).forEach(wire);
  } catch (err) {
    cont.innerHTML = `<p class="reg__msg reg__msg--err">No se pudo consultar el servidor: ${esc(err.message)}</p>`;
  }
}

function wire(kind) {
  const card = $(`.reg__card[data-kind="${kind}"]`);
  const zone = $('.drop', card);
  const input = $('.drop__input', card);

  input.addEventListener('change', () => {
    if (input.files.length) subir(kind, input.files[0]);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-over'); }));
  zone.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files?.length) subir(kind, e.dataTransfer.files[0]);
  });
}

async function subir(kind, file) {
  const card = $(`.reg__card[data-kind="${kind}"]`);
  const zone = $('.drop', card);
  const msg = $('.reg__msg', card);

  zone.dataset.state = 'busy';
  $('.drop__status', zone).textContent = 'Subiendo…';
  $('.drop__file', zone).textContent = file.name;
  msg.className = 'reg__msg';
  msg.textContent = '';

  const fd = new FormData();
  fd.append('tipo', kind);
  fd.append('archivo', file);

  try {
    const r = await fetch('/api/archivos', { method: 'POST', body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `El servidor respondió ${r.status}`);

    /* Repintar antes del mensaje: la tarjeta debe mostrar ya el archivo nuevo. */
    await pintar();
    const nuevo = $(`.reg__card[data-kind="${kind}"] .reg__msg`);
    nuevo.className = 'reg__msg reg__msg--ok';
    nuevo.textContent = data.archivo?.reemplazo
      ? `Guardado. Reemplazó a «${data.archivo.reemplazo}».`
      : 'Guardado. El informe ya lo va a usar.';
  } catch (err) {
    zone.dataset.state = 'error';
    $('.drop__status', zone).textContent = 'No se guardó';
    msg.className = 'reg__msg reg__msg--err';
    msg.textContent = err.message;
  }
}

initTheme();
pintar();
