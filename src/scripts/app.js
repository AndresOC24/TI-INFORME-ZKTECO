import {
  readWorkbook, detectKind, parseMolinetes, aggregate, parseBD, parseNuevos,
  resolveBlockedList, careerName, linkCareers, UNKNOWN_CAREER,
} from './parse.js';
import { hourlyChart, dailyTrend, hourHeatmap, heatmapLegend, dayLabel, fmtInt, fmtPct } from './charts.js';

/* molRaw = eventos crudos del archivo; mol = métricas del rango seleccionado. */
const state = { molRaw: null, mol: null, bd: null, nuevos: null, from: null, to: null };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const KIND_LABEL = { molinetes: 'Registro de molinetes', bd: 'BD de estudiantes', nuevos: 'Nuevos inscritos' };

const MESES = {
  '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun',
  '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic',
};
function humanDate(day) {
  const m = String(day).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${+m[3]} ${MESES[m[2]]} ${m[1]}` : day;
}

/* ---------- carga de archivos ---------- */

async function handleFiles(fileList, hintKind) {
  for (const file of fileList) {
    const zone = hintKind && zoneEl(hintKind);
    try {
      setZoneState(hintKind, 'busy', 'Procesando…', file.name);
      await raf();
      const buf = await file.arrayBuffer();
      const wb = readWorkbook(buf);
      const kind = detectKind(wb);
      if (kind === 'desconocido') {
        setZoneState(hintKind, 'error', 'Archivo no reconocido', file.name);
        continue;
      }
      if (kind === 'molinetes') {
        state.molRaw = parseMolinetes(wb);
        state.from = state.molRaw.minDay;            // rango inicial = todo el archivo
        state.to = state.molRaw.maxDay;
        recompute();
      }
      else if (kind === 'bd') {
        state.bd = parseBD(wb);
        recompute();      // la BD es la que pone la carrera: hay que recalcular
      }
      else if (kind === 'nuevos') state.nuevos = parseNuevos(wb);

      // el archivo puede haber caído en otra zona: reflejarlo en la correcta
      const rightZone = zoneEl(kind);
      setZoneStateEl(rightZone, 'done', okMsg(kind), file.name);
      if (hintKind && hintKind !== kind && zone) resetZone(zone);
      renderAll();
    } catch (err) {
      console.error(err);
      setZoneState(hintKind, 'error', err.message || 'No se pudo leer el archivo', file.name);
    }
  }
}

function okMsg(kind) {
  if (kind === 'molinetes') return `${fmtInt(state.mol.entradasUnicas)} ingresos únicos`;
  if (kind === 'bd') return `${fmtInt(state.bd.total)} estudiantes activos`;
  if (kind === 'nuevos') return `${fmtInt(state.nuevos.total)} nuevos inscritos`;
  return 'Listo';
}

const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const zoneEl = (kind) => $(`.drop[data-kind="${kind}"]`);
function setZoneState(kind, st, msg, name) { setZoneStateEl(zoneEl(kind), st, msg, name); }
function setZoneStateEl(el, st, msg, name) {
  if (!el) return;
  el.dataset.state = st;
  $('.drop__status', el).textContent = msg;
  if (name) $('.drop__file', el).textContent = name;
}
function resetZone(el) {
  el.dataset.state = 'idle';
  $('.drop__status', el).textContent = el.dataset.hint;
  $('.drop__file', el).textContent = '';
}

/* ---------- rango de fechas ---------- */

/* Recalcula todo el informe desde los eventos ya parseados: no relee el Excel. */
function recompute() {
  if (!state.molRaw) { state.mol = null; return; }
  linkCareers(state.molRaw, state.bd);
  state.mol = aggregate(state.molRaw, state.from, state.to);
}

function setRange(from, to) {
  const raw = state.molRaw;
  if (!raw) return;
  const clamp = (d) => (d < raw.minDay ? raw.minDay : d > raw.maxDay ? raw.maxDay : d);
  let a = clamp(from || raw.minDay);
  let b = clamp(to || raw.maxDay);
  if (a > b) [a, b] = [b, a];              // fechas invertidas: se corrigen solas
  state.from = a; state.to = b;
  recompute();
  renderAll();
}

/* Últimos N días CON registros, no de calendario: si el archivo tiene huecos
   (fines de semana, feriados) igual devuelve N días con datos reales. */
function lastDays(n) {
  const d = state.molRaw.daysWithData;
  setRange(d[Math.max(0, d.length - n)], state.molRaw.maxDay);
}

function isFullRange() {
  return state.from === state.molRaw.minDay && state.to === state.molRaw.maxDay;
}

function syncRange() {
  const raw = state.molRaw;
  const from = $('#range-from'), to = $('#range-to');
  from.min = to.min = raw.minDay;
  from.max = to.max = raw.maxDay;
  from.value = state.from;
  to.value = state.to;

  const full = isFullRange();
  $('#range-all').disabled = full;
  $('#range-7').disabled = raw.daysWithData.length <= 7;
  const nd = state.mol ? state.mol.days.length : 0;
  $('#range-info').innerHTML =
    `<b>${fmtInt(nd)}</b> ${nd === 1 ? 'día' : 'días'} con registros`
    + (full ? ' · todo el archivo' : ` · el archivo abarca ${humanDate(raw.minDay)} – ${humanDate(raw.maxDay)}`);
}

function renderPeriod() {
  const line = state.from === state.to
    ? `Datos del <strong>${humanDate(state.from)}</strong>`
    : `Del <strong>${humanDate(state.from)}</strong> al <strong>${humanDate(state.to)}</strong>`;
  $('#period').innerHTML = line + (isFullRange() ? '' : ' <span class="period__flag">· rango filtrado</span>');
}

/* ---------- render ---------- */

function renderAll() {
  const raw = state.molRaw;
  $('#empty').hidden = !!raw;
  $('#report').hidden = !raw;
  if (!raw) return;

  syncRange();
  renderPeriod();

  const m = state.mol;
  const sinDatos = !m || m.days.length === 0;
  $('#range-empty').hidden = !sinDatos;
  $('#report-body').hidden = sinDatos;
  if (sinDatos) return;

  renderSummary(m);
  /* La nota deja explícito que las barras son la SUMA del rango, no un día:
     es la confusión natural entre "pasajes acumulados" y "personas". */
  const d = m.days.length;
  $('#hourly-note').textContent = d === 1
    ? 'Pasajes por hora del día. Cada pasada cuenta: no son personas distintas.'
    : `Suma de los ${d} días del rango, hora por hora. Cada pasada cuenta: no son personas distintas.`;
  $('#chart-hourly').innerHTML = hourlyChart(m.hourEnt, m.hourSal, { days: d });
  renderPeakCareers(m);
  $('#chart-daily').innerHTML = dailyTrend(m.days, m.perDayEntradas, { salidas: m.perDaySalidas });
  renderCareers(m);
  renderBlocked(m);
  renderAdmissions();
  playReveal();
}

function renderSummary(m) {
  const bd = state.bd;
  /* Sin promedios: es la razón directa entre dos conteos verificables —
     personas distintas que ingresaron en el período ÷ activos de la BD. */
  const rate = bd && bd.total ? m.distinctInPeriod / bd.total : null;
  const hero = rate != null
    ? {
        big: fmtPct(rate),
        label: 'Asistencia del período',
        sub: `${fmtInt(m.distinctInPeriod)} de ${fmtInt(bd.total)} estudiantes activos ingresó al menos una vez`,
      }
    : { big: fmtInt(m.entradasUnicas), label: 'Ingresos únicos', sub: 'Carga la BD de estudiantes para ver la asistencia (%)' };

  const stats = [
    { v: fmtInt(m.entradasUnicas), k: 'Ingresos', note: `${m.days.length} ${m.days.length === 1 ? 'día' : 'días'}` },
    { v: fmtInt(m.distinctInPeriod), k: 'Estudiantes', note: 'ingresados' },
    { v: fmtInt(m.blockedCount), k: 'Bloqueados por deuda', tone: 'alert' },
  ];

  /* Antiguos y nuevos salen los dos de la columna «Gestión» de la BD, así que
     su suma cierra exactamente el total de activos (2.526 + 164 = 2.690). */
  if (bd) {
    const difiere = state.nuevos && state.nuevos.total !== bd.nuevos;
    stats.push({ v: fmtInt(bd.antiguos), k: 'Estudiantes antiguos' });
    stats.push({
      v: fmtInt(bd.nuevos),
      k: 'Nuevos inscritos',
      // solo aparece si los dos archivos se contradicen; en el caso normal, nada
      note: difiere ? `admisiones dice ${fmtInt(state.nuevos.total)}` : '',
    });
  } else if (state.nuevos) {
    stats.push({ v: fmtInt(state.nuevos.total), k: 'Nuevos inscritos', note: 'del archivo de admisiones' });
  }

  $('#summary').innerHTML = `
    <div class="hero">
      <div class="hero__num" data-count="${hero.big}">${hero.big}</div>
      <div class="hero__meta"><span class="hero__label">${hero.label}</span><span class="hero__sub">${hero.sub}</span></div>
    </div>
    <dl class="stats">
      ${stats.map((s) => `
        <div class="stat${s.tone === 'alert' ? ' stat--alert' : ''}">
          <dt>${s.k}</dt>
          <dd data-count="${s.v}">${s.v}</dd>
          ${s.note ? `<p class="stat__note">${s.note}</p>` : ''}
        </div>`).join('')}
    </dl>`;
}

/* Responde "a qué hora y de qué carrera" sin abrir el modal. */
function renderPeakCareers(m) {
  const pico = m.hourEnt.indexOf(Math.max(...m.hourEnt));
  const top = m.byCareer
    .map((c) => ({ code: c.code, n: c.hourEnt[pico] }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  $('#hourly-peak').innerHTML = top.length
    ? `<span class="peak__h">${String(pico).padStart(2, '0')}:00</span> es la hora de mayor afluencia · llegan sobre todo `
      + top.map((c) => `<b>${c.code}</b> ${fmtInt(c.n)}`).join(' · ')
    : '';
}

function renderCareers(m) {
  const max = Math.max(1, ...m.byCareer.map((c) => c.entradas));
  renderCareerCoverage(m);
  $('#careers').innerHTML = m.byCareer.map((c) => `
    <div class="cbar">
      <div class="cbar__id"><span class="cbar__code">${c.code}</span><span class="cbar__name">${careerName(c.code) === c.code ? '' : careerName(c.code)}</span></div>
      <div class="cbar__track"><span class="cbar__fill" style="--w:${(c.entradas / max) * 100}%"></span></div>
      <div class="cbar__val">${fmtInt(c.entradas)}${c.denied ? `<span class="cbar__deny" title="${fmtInt(c.denied)} bloqueados por deuda">${fmtInt(c.denied)}</span>` : ''}</div>
    </div>`).join('');
}

/* La carrera ya no viene en el export del molinete: sale de cruzar nombre y
   apellido contra la BD. El cruce nunca es perfecto (nombres escritos distinto
   en los dos sistemas), así que se dice cuántos quedaron sin identificar en vez
   de presentar el desglose como completo. */
function renderCareerCoverage(m) {
  const el = $('#careers-coverage');
  if (!el) return;
  const { students, unresolved } = m.careerCoverage;
  if (!state.bd) {
    el.textContent = 'Carga la BD de estudiantes para desglosar por carrera.';
  } else if (unresolved) {
    el.textContent = `${fmtInt(unresolved)} de ${fmtInt(students)} estudiantes no coinciden por nombre con la BD: van en «${UNKNOWN_CAREER}».`;
  } else {
    el.textContent = '';
  }
}

function renderBlocked(m) {
  const bd = state.bd;
  const list = resolveBlockedList(m, bd);
  const withCI = list.filter((r) => r.ci).length;
  const byCareer = {};
  for (const r of list) byCareer[r.dept] = (byCareer[r.dept] || 0) + 1;
  const careerRows = Object.entries(byCareer).sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(1, ...careerRows.map((r) => r[1]));

  $('#blocked-count').textContent = fmtInt(m.blockedCount);
  $('#blocked-by-career').innerHTML = careerRows.map(([code, n]) => `
    <div class="cbar cbar--alert">
      <div class="cbar__id"><span class="cbar__code">${code}</span></div>
      <div class="cbar__track"><span class="cbar__fill" style="--w:${(n / maxC) * 100}%"></span></div>
      <div class="cbar__val">${fmtInt(n)}</div>
    </div>`).join('');

  const cov = bd
    ? `${fmtInt(withCI)} de ${fmtInt(list.length)} con CI${withCI < list.length ? ` · ${list.length - withCI} sin coincidencia en la BD` : ''}`
    : 'Carga la BD de estudiantes para incluir el CI';
  $('#blocked-coverage').textContent = cov;

  $('#blocked-tbody').innerHTML = list.map((r) => `
    <tr><td>${r.dept}</td><td>${r.apellido}</td><td>${r.nombre}</td><td class="num">${r.ci || '—'}</td></tr>`).join('');
  $('#blocked-toggle').querySelector('.count').textContent = `(${fmtInt(list.length)})`;
  state._blockedList = list;
}

function renderAdmissions() {
  const n = state.nuevos;
  $('#admissions').hidden = !n;
  if (!n) return;
  $('#adm-total').textContent = fmtInt(n.total);
  const maxCar = Math.max(1, ...n.byCareer.map((c) => c[1]));
  $('#adm-careers').innerHTML = n.byCareer.map(([code, v]) => `
    <div class="cbar">
      <div class="cbar__id"><span class="cbar__code">${code}</span></div>
      <div class="cbar__track"><span class="cbar__fill" style="--w:${(v / maxCar) * 100}%"></span></div>
      <div class="cbar__val">${fmtInt(v)}</div>
    </div>`).join('');
  const maxMon = Math.max(1, ...n.byMonth.map((c) => c[1]));
  $('#adm-months').innerHTML = n.byMonth.map(([mes, v]) => `
    <div class="mbar"><span class="mbar__col" style="--h:${(v / maxMon) * 100}%"><b>${fmtInt(v)}</b></span><span class="mbar__lab">${mes.slice(0, 3)}</span></div>`).join('');
}

/* ---------- tooltip de gráficos ----------
   Uno solo para toda la página. Los elementos con datos traen
   data-tip-title y data-tip-rows="tono|etiqueta|valor;…" (ya formateados). */

function initTooltip() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  let target = null;

  const build = (el) => {
    const rows = (el.dataset.tipRows || '').split(';').filter(Boolean).map((r) => {
      const [tone, label, value] = r.split('|');
      return `<div class="tip__row"><span class="tip__dot tip__dot--${tone}"></span>`
        + `<span class="tip__k">${label}</span><b class="tip__v">${value}</b></div>`;
    }).join('');
    const foot = el.dataset.tipFoot ? `<div class="tip__f">${el.dataset.tipFoot}</div>` : '';
    return `<div class="tip__t">${el.dataset.tipTitle || ''}</div>${rows}${foot}`;
  };

  const place = (e) => {
    const pad = 14, r = tip.getBoundingClientRect();
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;    // no se sale por la derecha
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad; // ni por abajo
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  };

  const hide = () => { target = null; tip.hidden = true; };

  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('[data-tip-title]');
    if (!el) { if (target) hide(); return; }
    if (el !== target) { target = el; tip.innerHTML = build(el); tip.hidden = false; }
    place(e);
  });
  document.addEventListener('pointerdown', hide);
  addEventListener('scroll', hide, true);
  addEventListener('blur', hide);
}

/* ---------- modal: gráficos ampliados ---------- */

let lastFocus = null;
let heatMetric = 'ent';

const rangeLabel = () =>
  state.from === state.to ? humanDate(state.from) : `${humanDate(state.from)} – ${humanDate(state.to)}`;

const segmented = (opts, cur) => opts
  .map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v === cur)}">${l}</button>`)
  .join('');

function openModal(title, sub, body, controls = '') {
  $('#modal-title').textContent = title;
  $('#modal-sub').textContent = sub;
  $('#modal-controls').innerHTML = controls;
  $('#modal-body').innerHTML = body;
  lastFocus = document.activeElement;
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#modal-close').focus();
}

function closeModal() {
  if ($('#modal').hidden) return;
  $('#modal').hidden = true;
  $('#modal-body').innerHTML = '';
  $('#modal-controls').innerHTML = '';
  document.body.style.overflow = '';
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
}

/* Afluencia: perfil de 24 h del rango + mapa de calor día × hora. */
function heatMax(m) {
  let max = 1;
  for (const r of m.hourByDay) {
    for (let h = 0; h < 24; h++) {
      const v = heatMetric === 'sal' ? r.sal[h] : heatMetric === 'total' ? r.ent[h] + r.sal[h] : r.ent[h];
      if (v > max) max = v;
    }
  }
  return max;
}

/* Carreras presentes en la hora pico, de mayor a menor. */
function careersAtHour(m, hour) {
  return m.byCareer
    .map((c) => ({ code: c.code, n: c.hourEnt[hour] }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
}

function hourlyBody() {
  const m = state.mol;
  const qué = heatMetric === 'sal' ? 'salidas' : heatMetric === 'total' ? 'pasajes (entradas + salidas)' : 'entradas';
  const pico = m.hourEnt.indexOf(Math.max(...m.hourEnt));
  const enPico = careersAtHour(m, pico);
  const maxPico = Math.max(1, ...enPico.map((c) => c.n));
  const conCarrera = m.byCareer.filter((c) => c.pasajesEnt > 0);
  const hh = (h) => `${String(h).padStart(2, '0')}:00`;

  return `
    <section class="modal__section">
      <h3>Perfil del rango · las 24 horas</h3>
      <p class="panel__note">Suma de los ${m.days.length} ${m.days.length === 1 ? 'día' : 'días'} del rango, hora por hora. Cada pasada cuenta: no son personas distintas.</p>
      <div class="modal__scroll">${hourlyChart(m.hourEnt, m.hourSal, { w: 1120, h: 340, days: m.days.length })}</div>
    </section>

    <section class="modal__section">
      <h3>Quiénes llegan en la hora pico · ${hh(pico)}</h3>
      <p class="panel__note">Carreras que componen las ${fmtInt(m.hourEnt[pico])} entradas de esa franja.</p>
      <div class="bars">${enPico.map((c) => `
        <div class="cbar">
          <div class="cbar__id"><span class="cbar__code">${c.code}</span><span class="cbar__name">${careerName(c.code) === c.code ? '' : careerName(c.code)}</span></div>
          <div class="cbar__track"><span class="cbar__fill" style="--w:${(c.n / maxPico) * 100}%"></span></div>
          <div class="cbar__val">${fmtInt(c.n)}</div>
        </div>`).join('')}</div>
    </section>

    <section class="modal__section">
      <h3>Carrera × hora</h3>
      <p class="panel__note">Una fila por carrera, una columna por hora — ${qué}. ${heatmapLegend('máx')}</p>
      <div class="modal__scroll">${hourHeatmap(
        conCarrera.map((c) => `${c.code}${careerName(c.code) === c.code ? '' : '  ' + careerName(c.code)}`),
        conCarrera.map((c) => ({ ent: c.hourEnt, sal: c.hourSal })),
        heatMetric,
        { padL: 210 },
      )}</div>
    </section>

    <section class="modal__section">
      <h3>Hora pico de cada carrera</h3>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Código</th><th>Carrera</th><th class="num">Hora pico</th><th class="num">Entradas en esa hora</th><th class="num">Entradas del rango</th></tr></thead>
          <tbody>${[...conCarrera].sort((a, b) => b.peakHourEnt - a.peakHourEnt).map((c) => `
            <tr><td>${c.code}</td><td>${careerName(c.code) === c.code ? '—' : careerName(c.code)}</td>
            <td class="num">${hh(c.peakHour)}</td><td class="num">${fmtInt(c.peakHourEnt)}</td>
            <td class="num">${fmtInt(c.pasajesEnt)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="modal__section">
      <h3>Día por día · 24 horas</h3>
      <p class="panel__note">Una fila por día, una columna por hora — ${qué}. ${heatmapLegend(fmtInt(heatMax(m)))}</p>
      <div class="modal__scroll">${hourHeatmap(m.days.map(dayLabel), m.hourByDay, heatMetric)}</div>
    </section>`;
}

function openHourly() {
  const m = state.mol;
  openModal(
    'Afluencia por hora',
    `${rangeLabel()} · ${m.days.length} ${m.days.length === 1 ? 'día' : 'días'} × 24 horas`,
    hourlyBody(),
    segmented([['ent', 'Entradas'], ['sal', 'Salidas'], ['total', 'Total']], heatMetric),
  );
  $$('#modal-controls button').forEach((b) => b.addEventListener('click', () => {
    heatMetric = b.dataset.v;
    $$('#modal-controls button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === heatMetric)));
    $('#modal-body').innerHTML = hourlyBody();
  }));
}

function openDaily() {
  const m = state.mol;
  openModal('Ingresos por día', `${rangeLabel()} · ${m.days.length} ${m.days.length === 1 ? 'día' : 'días'} con registros`, `
    <section class="modal__section">
      <p class="panel__note">Estudiantes distintos que ingresaron cada día (1 por persona).</p>
      <div class="modal__scroll">${dailyTrend(m.days, m.perDayEntradas, { w: 1120, h: 420, salidas: m.perDaySalidas })}</div>
    </section>
    <section class="modal__section">
      <h3>Detalle por día</h3>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Día</th><th class="num">Ingresos</th><th class="num">Salidas</th></tr></thead>
          <tbody>${m.days.map((d, i) => `
            <tr><td>${humanDate(d)}</td><td class="num">${fmtInt(m.perDayEntradas[i])}</td><td class="num">${fmtInt(m.perDaySalidas[i])}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`);
}

function openCareers() {
  const m = state.mol;
  const max = Math.max(1, ...m.byCareer.map((c) => c.entradas));
  openModal('Ingresos por carrera', `${rangeLabel()} · ${m.byCareer.length} carreras`, `
    <div class="bars">${m.byCareer.map((c) => `
      <div class="cbar">
        <div class="cbar__id"><span class="cbar__code">${c.code}</span><span class="cbar__name">${careerName(c.code) === c.code ? '' : careerName(c.code)}</span></div>
        <div class="cbar__track"><span class="cbar__fill" style="--w:${(c.entradas / max) * 100}%"></span></div>
        <div class="cbar__val">${fmtInt(c.entradas)}${c.denied ? `<span class="cbar__deny">${fmtInt(c.denied)}</span>` : ''}</div>
      </div>`).join('')}</div>
    <section class="modal__section">
      <h3>Detalle por carrera</h3>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Código</th><th>Carrera</th><th class="num">Ingresos</th><th class="num">Salidas</th><th class="num">Bloqueados</th></tr></thead>
          <tbody>${m.byCareer.map((c) => `
            <tr><td>${c.code}</td><td>${careerName(c.code) === c.code ? '—' : careerName(c.code)}</td>
            <td class="num">${fmtInt(c.entradas)}</td><td class="num">${fmtInt(c.salidas)}</td>
            <td class="num">${c.denied ? fmtInt(c.denied) : '—'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`);
}

function openBlocked() {
  const list = state._blockedList || [];
  const byCareer = {};
  for (const r of list) byCareer[r.dept] = (byCareer[r.dept] || 0) + 1;
  const rows = Object.entries(byCareer).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  openModal('Bloqueados por deuda', `${rangeLabel()} · ${fmtInt(list.length)} estudiantes con acceso denegado`, `
    <div class="bars">${rows.map(([code, n]) => `
      <div class="cbar cbar--alert">
        <div class="cbar__id"><span class="cbar__code">${code}</span><span class="cbar__name">${careerName(code) === code ? '' : careerName(code)}</span></div>
        <div class="cbar__track"><span class="cbar__fill" style="--w:${(n / max) * 100}%"></span></div>
        <div class="cbar__val">${fmtInt(n)}</div>
      </div>`).join('')}</div>`);
}

function openAdmissions() {
  const n = state.nuevos;
  if (!n) return;
  const maxCar = Math.max(1, ...n.byCareer.map((c) => c[1]));
  const maxMon = Math.max(1, ...n.byMonth.map((c) => c[1]));
  openModal('Nuevos inscritos', `${fmtInt(n.total)} inscritos · del archivo de admisiones, no depende del rango de fechas`, `
    <section class="modal__section">
      <h3>Por carrera</h3>
      <div class="bars">${n.byCareer.map(([code, v]) => `
        <div class="cbar">
          <div class="cbar__id"><span class="cbar__code">${code}</span><span class="cbar__name">${careerName(code) === code ? '' : careerName(code)}</span></div>
          <div class="cbar__track"><span class="cbar__fill" style="--w:${(v / maxCar) * 100}%"></span></div>
          <div class="cbar__val">${fmtInt(v)}</div>
        </div>`).join('')}</div>
    </section>
    <section class="modal__section">
      <h3>Por mes de inscripción</h3>
      <div class="months">${n.byMonth.map(([mes, v]) => `
        <div class="mbar"><span class="mbar__col" style="--h:${(v / maxMon) * 100}%"><b>${fmtInt(v)}</b></span><span class="mbar__lab">${mes.slice(0, 3)}</span></div>`).join('')}</div>
    </section>`);
}

const CHART_OPENERS = {
  hourly: openHourly, daily: openDaily, careers: openCareers,
  blocked: openBlocked, admissions: openAdmissions,
};

function initModal() {
  $$('[data-chart]').forEach((btn) => btn.addEventListener('click', () => {
    if (!state.mol || !state.mol.days.length) return;
    CHART_OPENERS[btn.dataset.chart]?.();
  }));
  $$('#modal [data-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // el foco no debe salirse del diálogo mientras está abierto
  $('.modal__box').addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button, [href], input, [tabindex]:not([tabindex="-1"])', $('.modal__box'))
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/* ---------- export ---------- */

function exportBlocked() {
  const list = state._blockedList || [];
  const period = state.from ? `${state.from}_a_${state.to}` : 'periodo';
  const head = ['Carrera', 'Apellidos', 'Nombres', 'CI'];
  const rows = list.map((r) => [r.dept, r.apellido, r.nombre, r.ci]);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bloqueados_deuda_${period}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- motion (un solo momento orquestado) ---------- */

function playReveal() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('[data-count]').forEach((el) => countUp(el));
}
function countUp(el) {
  const raw = el.dataset.count;
  const num = parseFloat(raw.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'));
  if (!isFinite(num)) return;
  const isPct = raw.includes('%');
  const suffix = raw.replace(/[\d.,\s%]/g, '');
  const dur = 620, t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, Math.max(0, (t - t0) / dur));
    const e = 1 - Math.pow(1 - p, 3);
    const val = num * e;
    el.textContent = isPct
      ? `${val.toLocaleString('es-BO', { maximumFractionDigits: 1 })}%`
      : `${new Intl.NumberFormat('es-BO').format(Math.round(val))}${suffix}`;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = raw;
  };
  requestAnimationFrame(tick);
}

/* ---------- tema ---------- */

function initTheme() {
  const btn = $('#theme-toggle');
  const apply = (t) => { document.documentElement.dataset.theme = t; btn.setAttribute('aria-pressed', String(t === 'dark')); };
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next); apply(next);
  });
}

/* ---------- wiring ---------- */

function initDropzones() {
  $$('.drop').forEach((zone) => {
    const kind = zone.dataset.kind;
    const input = $('.drop__input', zone);
    zone.dataset.hint = $('.drop__status', zone).textContent;
    input.addEventListener('change', () => { if (input.files.length) handleFiles(input.files, kind); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-over'); }));
    zone.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files, kind); });
  });
}

function initRange() {
  const from = $('#range-from'), to = $('#range-to');
  from.addEventListener('change', () => setRange(from.value, state.to));
  to.addEventListener('change', () => setRange(state.from, to.value));
  $('#range-all').addEventListener('click', () => setRange(state.molRaw.minDay, state.molRaw.maxDay));
  $('#range-7').addEventListener('click', () => lastDays(7));
}

function initBlockedToggle() {
  const btn = $('#blocked-toggle'), panel = $('#blocked-list');
  btn.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  $('#blocked-export').addEventListener('click', exportBlocked);
}

initTheme();
initDropzones();
initRange();
initModal();
initTooltip();
initBlockedToggle();
renderAll();
