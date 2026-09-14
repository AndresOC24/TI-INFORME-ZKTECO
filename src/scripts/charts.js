/* Gráficos SVG a medida, tematizados por variables CSS (soportan claro/oscuro).
   Interacción: resaltado por :hover + <title> nativo accesible. */

const NBSP = ' ';
export const fmtInt = (n) => new Intl.NumberFormat('es-BO').format(Math.round(n || 0)).replace(/ /g, ' ');
export const fmtPct = (n) => `${(n * 100).toLocaleString('es-BO', { maximumFractionDigits: 1 })}%`;

const SVGNS = 'http://www.w3.org/2000/svg';
const shortDate = (day) => {
  const m = String(day).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : day;
};

/* Afluencia por hora del día: columnas agrupadas entradas/salidas.

   Las salidas no son el espejo de las entradas y por eso se muestran: dicen
   cuánta gente queda adentro a cada hora (entradas menos salidas acumuladas),
   cuánto se quedan, y a qué hora se satura la portería de vuelta. También son
   el control de calidad de la dirección: una entrada carga temprano y una
   salida carga tarde, así que un paso mal etiquetado se delata por su forma. */
export function hourlyChart(hourEnt, hourSal, opts = {}) {
  const W = opts.w || 760, H = opts.h || 268, padL = 44, padR = 12, padT = 32, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, ...hourEnt, ...hourSal);
  const peak = hourEnt.indexOf(Math.max(...hourEnt));
  const slot = iw / 24;
  const bw = Math.max(3, slot * 0.34);
  const ticks = 4;

  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const y = padT + ih - (v / max) * ih;
    grid += `<line class="grid" x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"/>`
      + `<text class="axis" x="${padL - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${fmtInt(v)}</text>`;
  }

  let bars = '', labels = '';
  for (let h = 0; h < 24; h++) {
    const cx = padL + slot * h + slot / 2;
    const he = (hourEnt[h] / max) * ih, hs = (hourSal[h] / max) * ih;
    const isPeak = h === peak && hourEnt[h] > 0;
    const hh = String(h).padStart(2, '0');
    // franja invisible de ancho completo: basta apuntar a la columna, no a la barra
    bars += `<g class="hbar${isPeak ? ' peak' : ''}" role="img"`
      + ` aria-label="${hh}:00 — ${fmtInt(hourEnt[h])} entradas, ${fmtInt(hourSal[h])} salidas"`
      + ` data-tip-title="${hh}:00 – ${hh}:59"`
      + (opts.days > 1 ? ` data-tip-foot="acumulado de ${opts.days} días"` : '')
      + ` data-tip-rows="ent|Entradas|${fmtInt(hourEnt[h])};sal|Salidas|${fmtInt(hourSal[h])}">`
      + `<rect class="hit" x="${(padL + slot * h).toFixed(1)}" y="${padT}" width="${slot.toFixed(1)}" height="${ih}"/>`
      + `<rect class="col-ent" x="${(cx - bw - 1).toFixed(1)}" y="${(padT + ih - he).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, he).toFixed(1)}" rx="1.5"/>`
      + `<rect class="col-sal" x="${(cx + 1).toFixed(1)}" y="${(padT + ih - hs).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, hs).toFixed(1)}" rx="1.5"/>`
      + `</g>`;
    // las 24 horas rotuladas si entran; si no, una de cada 3
    if (slot >= 24 || h % 3 === 0) labels += `<text class="axis" x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`;
  }
  let peakTag = '';
  if (hourEnt[peak] > 0) {
    const cx = Math.min(W - padR - 30, Math.max(padL + 30, padL + slot * peak + slot / 2));
    const enDias = opts.days > 1 ? ` en ${opts.days} días` : '';
    peakTag = `<text class="peak-tag" x="${cx.toFixed(1)}" y="16" text-anchor="middle">pico ${String(peak).padStart(2, '0')}:00 · ${fmtInt(hourEnt[peak])} entradas${enDias}</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" preserveAspectRatio="xMidYMid meet"
    aria-label="Afluencia por hora del día, entradas y salidas">${grid}${bars}${labels}${peakTag}</svg>`;
}

/* Ingresos únicos por día: área + línea. */
export function dailyTrend(days, perDayEntradas, opts = {}) {
  const W = opts.w || 760, H = opts.h || 220, padL = 44, padR = 12, padT = 18, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, ...perDayEntradas);
  const n = days.length;
  const ticks = 4;

  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const y = padT + ih - (v / max) * ih;
    grid += `<line class="grid" x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"/>`
      + `<text class="axis" x="${padL - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${fmtInt(v)}</text>`;
  }

  if (n === 1) {
    const cx = padL + iw / 2, bw = Math.min(120, iw * 0.4);
    const bh = (perDayEntradas[0] / max) * ih;
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" preserveAspectRatio="xMidYMid meet"
      aria-label="Ingresos únicos del día">${grid}
      <rect class="col-ent" x="${(cx - bw / 2).toFixed(1)}" y="${(padT + ih - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3"/>
      <text class="axis" x="${cx}" y="${H - 10}" text-anchor="middle">${shortDate(days[0])}</text></svg>`;
  }

  const xAt = (i) => padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const yAt = (v) => padT + ih - (v / max) * ih;
  const pts = perDayEntradas.map((v, i) => [xAt(i), yAt(v)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${xAt(n - 1).toFixed(1)} ${(padT + ih).toFixed(1)} L${padL.toFixed(1)} ${(padT + ih).toFixed(1)} Z`;

  let dots = '', labels = '';
  // tantas fechas rotuladas como quepan sin encimarse (~46px cada una)
  const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 46))));
  const band = iw / Math.max(1, n - 1);
  const salidas = opts.salidas || null;
  pts.forEach((p, i) => {
    const rows = `ent|Ingresos|${fmtInt(perDayEntradas[i])}`
      + (salidas ? `;sal|Salidas|${fmtInt(salidas[i])}` : '');
    // banda invisible por día: se puede apuntar a cualquier altura de la columna
    dots += `<g class="dot" role="img" aria-label="${shortDate(days[i])} — ${fmtInt(perDayEntradas[i])} ingresos"`
      + ` data-tip-title="${shortDate(days[i])}" data-tip-rows="${rows}">`
      + `<rect class="hit" x="${(p[0] - band / 2).toFixed(1)}" y="${padT}" width="${band.toFixed(1)}" height="${ih}"/>`
      + `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2"/></g>`;
    if (i % step === 0 || i === n - 1) labels += `<text class="axis" x="${p[0].toFixed(1)}" y="${H - 10}" text-anchor="middle">${shortDate(days[i])}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" preserveAspectRatio="xMidYMid meet"
    aria-label="Ingresos únicos por día">${grid}
    <path class="area" d="${area}"/><path class="trend" d="${line}"/>${dots}${labels}</svg>`;
}

/* Mapa de calor día × hora: una fila por día del rango, 24 columnas (00–23).
   Muestra pasajes (sin deduplicar), igual que el gráfico de afluencia.
   metric: 'ent' entradas · 'sal' salidas. */
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function dayLabel(day) {
  return `${weekday(day)} ${shortDate(day)}`;
}
function weekday(day) {
  const m = String(day).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return DIAS[new Date(+m[1], +m[2] - 1, +m[3]).getDay()];   // local: sin corrimiento de zona
}

/* `labels` son los rótulos de fila ya formateados (un día, una carrera…),
   `rows` los valores { ent:[24], sal:[24] } en el mismo orden. */
export function hourHeatmap(labels, rows, metric = 'ent', opts = {}) {
  const cell = 30, gap = 3, padT = 30, padR = 10, padB = 6;
  const padL = opts.padL || 92;
  const W = padL + 24 * (cell + gap) + padR;
  const H = padT + labels.length * (cell + gap) + padB;
  const at = (r, h) => (metric === 'sal' ? r.sal[h] : r.ent[h]);

  let max = 1;
  for (const r of rows) for (let h = 0; h < 24; h++) max = Math.max(max, at(r, h));

  let head = '';
  for (let h = 0; h < 24; h++) {
    head += `<text class="axis" x="${(padL + h * (cell + gap) + cell / 2).toFixed(1)}" y="${padT - 10}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`;
  }

  const label = metric === 'sal' ? 'salidas' : 'entradas';
  let body = '';
  rows.forEach((r, i) => {
    const y = padT + i * (cell + gap);
    body += `<text class="axis hm-day" x="${padL - 10}" y="${(y + cell / 2 + 3.5).toFixed(1)}" text-anchor="end">${labels[i]}</text>`;
    for (let h = 0; h < 24; h++) {
      const v = at(r, h);
      // realce no lineal: las horas flojas siguen siendo visibles junto al pico
      const t = v === 0 ? 0 : 0.1 + 0.9 * Math.pow(v / max, 0.6);
      const cap = `${labels[i]}${NBSP}·${NBSP}${String(h).padStart(2, '0')}:00`;
      const tone = metric === 'sal' ? 'sal' : 'ent';
      body += `<rect class="hm-cell${v === 0 ? ' is-zero' : ''}" x="${(padL + h * (cell + gap)).toFixed(1)}" y="${y.toFixed(1)}"`
        + ` width="${cell}" height="${cell}" rx="3" fill-opacity="${t.toFixed(3)}" role="img"`
        + ` aria-label="${cap} — ${fmtInt(v)} ${label}"`
        + ` data-tip-title="${cap}" data-tip-rows="${tone}|${label[0].toUpperCase() + label.slice(1)}|${fmtInt(v)}"/>`;
    }
  });

  return `<svg viewBox="0 0 ${W} ${H}" class="chart heatmap" role="img" preserveAspectRatio="xMinYMin meet"
    style="width:${W}px;min-width:${W}px" aria-label="Mapa de calor de ${label} por día y hora">${head}${body}</svg>`;
}

/* Escala de referencia del heatmap. */
export function heatmapLegend(maxLabel) {
  const steps = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => `<span class="hm-key" style="--o:${t === 0 ? 0 : (0.1 + 0.9 * Math.pow(t, 0.6)).toFixed(3)}"></span>`)
    .join('');
  return `<span class="hm-legend"><span>0</span>${steps}<span>${maxLabel}</span></span>`;
}
