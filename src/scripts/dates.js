// Fechas de calendario en UTC para evitar desplazamientos por zona horaria.
export const dateOf = day => new Date(`${day}T00:00:00Z`);
export const isoDay = date => date.toISOString().slice(0, 10);
export function addDays(day, amount) {
  const date = dateOf(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDay(date);
}
export function daysBetween(from, to) {
  if (!from || !to || from > to) return [];
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}
export function selectDay(selection, day) {
  if (!selection.pending) return { from: day, to: day, pending: true };
  return { from: day < selection.from ? day : selection.from,
    to: day > selection.from ? day : selection.from, pending: false };
}
