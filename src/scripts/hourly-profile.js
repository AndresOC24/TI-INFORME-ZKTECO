// El promedio usa todos los días seleccionados; los días sin registros aportan cero.
export function hourlyProfile(metrics, view = 'total') {
  const days = metrics.dailyCounts.map(row => row.day);
  const count = days.length;
  if (view === 'average') {
    return {
      ent: metrics.hourEnt.map(value => count ? value / count : 0),
      sal: metrics.hourSal.map(value => count ? value / count : 0),
      days: count, average: true,
    };
  }
  if (view !== 'total') {
    const row = metrics.hourByDay[metrics.days.indexOf(view)];
    return { ent: row?.ent || Array(24).fill(0), sal: row?.sal || Array(24).fill(0), days: 1, average: false };
  }
  return { ent: metrics.hourEnt, sal: metrics.hourSal, days: count, average: false };
}
