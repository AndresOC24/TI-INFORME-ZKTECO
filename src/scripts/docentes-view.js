import { normName, careerName } from './parse.js';
import { fmtInt } from './charts.js';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const direction = { E: 'Entrada', S: 'Salida', X: 'Acceso denegado' };

export function initDocentesView(downloadCSV) {
  let rows = [], filtered = [], loaded = false, selected = null, roster = null;
  const status = (row) => !loaded ? 'Sin archivo de eventos' : row.entradas ? 'Con entradas'
    : row.denegados ? 'Acceso denegado' : row.salidas ? 'Solo salidas' : 'Sin entrada registrada';

  function renderTable() {
    const query = normName($('#teacher-search').value);
    const career = $('#teacher-career').value, filter = $('#teacher-status').value;
    filtered = rows.filter(row => (!query || normName(`${row.nombre} ${row.ci} ${[...row.ids].join(' ')}`).includes(query))
      && (!career || row.carreras.includes(career))
      && (!filter || (filter === 'entered' && loaded && row.entradas > 0)
        || (filter === 'no-entry' && loaded && !row.entradas)
        || (filter === 'denied' && loaded && row.denegados > 0)
        || (filter === 'unmatched' && !row.registered)));
    $('#teachers-count').textContent = fmtInt(rows.length);
    $('#teachers-result').textContent = `${fmtInt(filtered.length)} de ${fmtInt(rows.length)} docentes · selecciona «Ver ficha» para consultar sus datos y marcaciones.`;
    $('#teachers-export').disabled = !filtered.length;
    $('#teachers-tbody').innerHTML = filtered.length ? filtered.map(row => `<tr>
      <td>${esc(row.nombre)}${!row.registered ? '<br><small>Sin coincidencia en el directorio</small>' : ''}</td>
      <td>${esc(row.ci || '—')}</td><td>${esc(row.carreras.join(', ') || '—')}</td>
      <td><span class="teacher-status${row.entradas ? ' teacher-status--entered' : ''}">${status(row)}</span></td>
      <td class="num">${loaded ? fmtInt(row.entradas) : '—'}</td><td class="num">${loaded ? fmtInt(row.salidas) : '—'}</td>
      <td><button type="button" class="btn btn--ghost" data-teacher="${esc(row.key)}" aria-label="Ver ficha de ${esc(row.nombre)}">Ver ficha</button></td>
    </tr>`).join('') : '<tr><td colspan="7">No hay docentes que coincidan con los filtros.</td></tr>';
  }

  function renderDetail() {
    const row = rows.find(r => r.key === selected);
    $('#teacher-detail').hidden = !row;
    if (!row) return;
    $('#teacher-detail-title').textContent = row.nombre;
    const fields = [['CI', row.ci], ['Carrera', row.carreras.map(careerName).join(', ')],
      ['Condición', row.condicion], ['Teléfono', row.telefono], ['Correo', row.email],
      ['Identificación', !row.registered ? 'Sin coincidencia en el directorio' : row.matches.size ? [...row.matches].join(', ') : 'Directorio de docentes'],
      ['ID ZKTeco', [...row.ids].join(', ')], ['Días con entrada', loaded ? fmtInt(row.dias.size) : '—'],
      ['Última marcación del período', row.last]];
    $('#teacher-info').innerHTML = fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value || '—')}</dd></div>`).join('');
    $('#teacher-events-note').textContent = loaded
      ? `${fmtInt(row.entradas)} entradas · ${fmtInt(row.salidas)} salidas · ${fmtInt(row.denegados)} accesos denegados en el período seleccionado. Los accesos denegados no cuentan como entradas.`
      : 'Sube el archivo de molinetes para consultar las marcaciones de este docente.';
    const events = [...row.events].sort((a, b) => `${b.day} ${b.time}`.localeCompare(`${a.day} ${a.time}`));
    $('#teacher-events').innerHTML = events.length ? events.map(event => `<tr><td>${esc(event.day)}</td><td>${esc(event.time)}</td><td>${direction[event.dir]}</td><td>${esc(event.point)}</td><td>${esc(event.id)}</td></tr>`).join('')
      : '<tr><td colspan="5">No hay marcaciones para mostrar.</td></tr>';
  }

  $('#teacher-search').addEventListener('input', renderTable);
  $('#teacher-career').addEventListener('change', renderTable);
  $('#teacher-status').addEventListener('change', renderTable);
  $('#teachers-tbody').addEventListener('click', event => {
    const button = event.target.closest('[data-teacher]');
    if (!button) return;
    selected = button.dataset.teacher;
    renderDetail();
    $('#teacher-detail').focus({ preventScroll: true });
    $('#teacher-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#teacher-close').addEventListener('click', () => {
    const button = [...document.querySelectorAll('[data-teacher]')].find(b => b.dataset.teacher === selected);
    selected = null; renderDetail();
    (button || $('#teacher-search')).focus();
  });
  $('#teachers-export').addEventListener('click', () => downloadCSV('docentes',
    ['Docente', 'CI', 'Carreras', 'Condición', 'Teléfono', 'Correo', 'Estado', 'Entradas', 'Salidas', 'Denegados', 'Días con entrada'],
    filtered.map(row => [row.nombre, row.ci, row.carreras.join(', '), row.condicion, row.telefono, row.email,
      status(row), loaded ? row.entradas : '', loaded ? row.salidas : '', loaded ? row.denegados : '', loaded ? row.dias.size : ''])));

  return function render(data, reference, hasEvents, loading = false) {
    rows = data; roster = reference; loaded = hasEvents;
    const previousCareer = $('#teacher-career').value;
    const careers = [...new Set(rows.flatMap(row => row.carreras))].sort();
    $('#teacher-career').innerHTML = '<option value="">Todas las carreras</option>' + careers.map(c => `<option value="${esc(c)}">${esc(c)} · ${esc(careerName(c))}</option>`).join('');
    $('#teacher-career').value = careers.includes(previousCareer) ? previousCareer : '';
    $('#teacher-status').disabled = !loaded;
    if (!loaded) $('#teacher-status').value = '';
    const unmatched = rows.filter(r => !r.registered).length;
    $('#teachers-note').textContent = loading ? 'Cargando el directorio de docentes…' : roster
      ? `${fmtInt(roster.total)} docentes en el directorio. ${loaded ? 'Consulta las marcaciones del período y abre la ficha de cada docente.' : 'Puedes buscar sus datos ahora. Sube el XLS de molinetes para ver entradas y salidas.'}${unmatched ? ` ${fmtInt(unmatched)} personas con rol DOCENTE no coinciden con el directorio.` : ''}`
      : 'No se pudo cargar el directorio de docentes. Registra DOCENTES.xlsx en Archivos para consultar sus datos completos.';
    const stats = [['En el directorio', roster ? roster.total : '—'],
      ['Docentes con entrada', loaded ? rows.filter(r => r.entradas).length : '—'],
      ['Marcaciones de entrada', loaded ? rows.reduce((sum, r) => sum + r.entradas, 0) : '—'],
      ['Con acceso denegado', loaded ? rows.filter(r => r.denegados).length : '—']];
    $('#teachers-summary').innerHTML = stats.map(([label, value]) => `<div class="teacher-stat"><strong>${typeof value === 'number' ? fmtInt(value) : value}</strong><span>${label}</span></div>`).join('');
    renderTable(); renderDetail();
  };
}
