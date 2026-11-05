import { dateOf, isoDay, addDays, selectDay } from './dates.js';

export function initDateRange(onApply) {
  const $ = selector => document.querySelector(selector);
  const dialog = $('#range-calendar'), trigger = $('#range-picker');
  const grid = $('#calendar-days');
  const format = day => dateOf(day).toLocaleDateString('es-BO', { timeZone: 'UTC' });
  const label = (from, to) => from === to ? format(from) : `${format(from)} – ${format(to)}`;
  let bounds = {}, selection = {}, month;

  function render(focusDay) {
    const first = dateOf(`${month}-01`);
    $('#calendar-month').textContent = first.toLocaleDateString('es-BO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    $('#calendar-prev').disabled = month <= bounds.min.slice(0, 7);
    $('#calendar-next').disabled = month >= bounds.max.slice(0, 7);
    const offset = (first.getUTCDay() + 6) % 7;
    const end = new Date(first);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    grid.innerHTML = '<span aria-hidden="true"></span>'.repeat(offset);
    for (let n = 1; n <= end.getUTCDate(); n++) {
      const day = `${month}-${String(n).padStart(2, '0')}`;
      const selected = day >= selection.from && day <= selection.to;
      const edge = day === selection.from || day === selection.to;
      const fullLabel = dateOf(day).toLocaleDateString('es-BO', { dateStyle: 'full', timeZone: 'UTC' });
      grid.insertAdjacentHTML('beforeend', `<button type="button" class="calendar__day${selected ? ' is-range' : ''}${edge ? ' is-edge' : ''}" data-day="${day}" aria-label="${fullLabel}" aria-pressed="${selected}" ${day < bounds.min || day > bounds.max ? 'disabled' : ''}>${n}</button>`);
    }
    $('#calendar-selection').textContent = label(selection.from, selection.to);
    if (focusDay) grid.querySelector(`[data-day="${focusDay}"]`)?.focus();
  }

  trigger.addEventListener('click', () => {
    selection = { from: bounds.from, to: bounds.to, pending: false };
    month = selection.from.slice(0, 7);
    render();
    dialog.showModal();
    grid.querySelector(`[data-day="${selection.from}"]`)?.focus();
  });
  for (const [id, delta] of [['#calendar-prev', -1], ['#calendar-next', 1]]) {
    $(id).addEventListener('click', () => {
      const date = dateOf(`${month}-01`);
      date.setUTCMonth(date.getUTCMonth() + delta);
      month = isoDay(date).slice(0, 7);
      render();
    });
  }
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-day]');
    if (!button || button.disabled) return;
    selection = selectDay(selection, button.dataset.day);
    render(button.dataset.day);
  });
  grid.addEventListener('keydown', event => {
    const day = event.target.dataset.day;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!day || !delta) return;
    event.preventDefault();
    const next = addDays(day, delta);
    if (next < bounds.min || next > bounds.max) return;
    month = next.slice(0, 7);
    render(next);
  });
  $('#calendar-cancel').addEventListener('click', () => dialog.close());
  $('#calendar-apply').addEventListener('click', () => {
    dialog.close();
    onApply(selection.from, selection.to);
  });
  dialog.addEventListener('close', () => trigger.focus());

  return function sync(value) {
    bounds = value;
    trigger.disabled = !bounds.min;
    trigger.textContent = bounds.min ? label(bounds.from, bounds.to) : 'Sin fechas disponibles';
  };
}
