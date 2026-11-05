import { normName, careerName } from './parse.js';
import { fmtInt } from './charts.js';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const direction = { E: 'Entrada', S: 'Salida', X: 'Acceso denegado' };

export function initEstudiantesView(downloadCSV) {
  let rows = [], filtered = [], loaded = false, selected = null;
  const status = (row) => !loaded ? 'Sin archivo de eventos' : row.entradas ? 'Con entradas'
    : row.denegados ? 'Acceso denegado' : row.salidas ? 'Solo salidas' : 'Sin entrada registrada';

  function renderTable() {
    const query = normName($('#student-search').value);
    const career = $('#student-career').value, filter = $('#student-status').value;
    filtered = rows.filter(row => (!query || normName(`${row.nombre} ${row.ci} ${row.cod} ${[...row.ids].join(' ')}`).includes(query))
      && (!career || row.carreras.includes(career))
      && (!filter || (filter === 'entered' && loaded && row.entradas > 0)
        || (filter === 'no-entry' && loaded && !row.entradas)
        || (filter === 'denied' && loaded && row.denegados > 0)
        || (filter === 'unmatched' && !row.registered)));
    $('#students-count').textContent = fmtInt(rows.length);
    $('#students-result').textContent = `${fmtInt(filtered.length)} de ${fmtInt(rows.length)} estudiantes · selecciona «Ver ficha» para consultar sus datos y marcaciones.`;
    $('#students-export').disabled = !filtered.length;
    $('#students-tbody').innerHTML = filtered.length ? filtered.map(row => `<tr>
      <td>${esc(row.nombre)}${!row.registered ? '<br><small>Sin coincidencia en los archivos de referencia</small>' : ''}</td>
      <td>${esc(row.ci || '—')}</td><td>${esc(row.carreras.join(', ') || '—')}</td>
      <td><span class="teacher-status${row.entradas ? ' teacher-status--entered' : ''}">${status(row)}</span></td>
      <td class="num">${loaded ? fmtInt(row.entradas) : '—'}</td><td class="num">${loaded ? fmtInt(row.salidas) : '—'}</td>
      <td><button type="button" class="btn btn--ghost" data-student="${esc(row.key)}" aria-label="Ver ficha de ${esc(row.nombre)}">Ver ficha</button></td>
    </tr>`).join('') : '<tr><td colspan="7">No hay estudiantes que coincidan con los filtros.</td></tr>';
  }

  function renderDetail() {
    const row = rows.find(r => r.key === selected);
    $('#student-detail').hidden = !row;
    if (!row) return;
    $('#student-detail-title').textContent = row.nombre;
    const fields = [['CI', row.ci], ['Carrera', row.carreras.map(careerName).join(', ')],
      ['Código académico', row.cod], ['Gestión de ingreso', row.gestIngreso],
      ['Identificación', !row.registered ? 'Sin coincidencia en los archivos de referencia' : row.matches.size ? [...row.matches].join(', ') : row.cod ? 'BD de estudiantes' : 'Padrón ZKTeco'],
      ['ID ZKTeco', [...row.ids].join(', ')], ['Días con entrada', loaded ? fmtInt(row.dias.size) : '—'],
      ['Última marcación del período', row.last]];
    $('#student-info').innerHTML = fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value || '—')}</dd></div>`).join('');
    $('#student-events-note').textContent = loaded
      ? `${fmtInt(row.entradas)} entradas · ${fmtInt(row.salidas)} salidas · ${fmtInt(row.denegados)} accesos denegados en el período seleccionado. Los accesos denegados no cuentan como entradas.`
      : 'Sube el archivo de molinetes para consultar las marcaciones de este estudiante.';
    const events = [...row.events].sort((a, b) => `${b.day} ${b.time}`.localeCompare(`${a.day} ${a.time}`));
    $('#student-events').innerHTML = events.length ? events.map(event => `<tr><td>${esc(event.day)}</td><td>${esc(event.time)}</td><td>${direction[event.dir]}</td><td>${esc(event.point)}</td><td>${esc(event.id)}</td></tr>`).join('')
      : '<tr><td colspan="5">No hay marcaciones para mostrar.</td></tr>';
  }

  $('#student-search').addEventListener('input', renderTable);
  $('#student-career').addEventListener('change', renderTable);
  $('#student-status').addEventListener('change', renderTable);
  $('#students-tbody').addEventListener('click', event => {
    const button = event.target.closest('[data-student]');
    if (!button) return;
    selected = button.dataset.student;
    renderDetail();
    $('#student-detail').focus({ preventScroll: true });
    $('#student-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#student-close').addEventListener('click', () => {
    const button = [...document.querySelectorAll('[data-student]')].find(b => b.dataset.student === selected);
    selected = null; renderDetail();
    (button || $('#student-search')).focus();
  });
  $('#students-export').addEventListener('click', () => downloadCSV('estudiantes',
    ['Estudiante', 'CI', 'Carreras', 'Código académico', 'Gestión de ingreso', 'Estado', 'Entradas', 'Salidas', 'Denegados', 'Días con entrada'],
    filtered.map(row => [row.nombre, row.ci, row.carreras.join(', '), row.cod, row.gestIngreso,
      status(row), loaded ? row.entradas : '', loaded ? row.salidas : '', loaded ? row.denegados : '', loaded ? row.dias.size : ''])));

  return function render(data, reference, hasEvents, loading = false) {
    rows = data; loaded = hasEvents;
    $('#students-note').textContent = loading ? 'Cargando archivos de referencia…' : reference
      ? 'Estudiantes activos de la Base de datos. Las marcaciones corresponden al rango de fechas seleccionado.'
      : 'Sin BD de estudiantes: se muestran los estudiantes del padrón ZKTeco y del archivo de molinetes disponibles.';
    const previousCareer = $('#student-career').value;
    const careers = [...new Set(rows.flatMap(row => row.carreras))].sort();
    $('#student-career').innerHTML = '<option value="">Todas las carreras</option>' + careers.map(c => `<option value="${esc(c)}">${esc(c)} · ${esc(careerName(c))}</option>`).join('');
    $('#student-career').value = careers.includes(previousCareer) ? previousCareer : '';
    $('#student-status').disabled = !loaded;
    if (!loaded) $('#student-status').value = '';
    renderTable(); renderDetail();
  };
}
