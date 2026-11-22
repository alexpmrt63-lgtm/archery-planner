import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

// Saison affichée par défaut : septembre 2026 → décembre 2027 (demande du coach).
// Elle s'élargit toute seule si un évènement tombe en dehors.
export const SEASON_START = '2026-09';
export const SEASON_END = '2027-12';

export const EVENT_COLORS = ['#70AD47', '#AD4ADE', '#5B9BD5', '#FFC000', '#FFFF00', '#ED7D31', '#FF0000', '#44546A', '#3b82f6', '#9ca3af'];

export const KIND_LABEL = { competition: 'Compétition', stage: 'Stage' };

const MONTH_SHORT = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

// Texte lisible sur la couleur de l'évènement (noir sur jaune, blanc sur ardoise…)
export function textOn(hex) {
  const h = (hex || '#3b82f6').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 110 ? '#111827' : '#ffffff';
}

function ym(str) { const [y, m] = str.split('-').map(Number); return y * 12 + (m - 1); }

// Liste des mois de la saison : [{ y, m (0-11), label, year, days }]
export function seasonMonths(events = []) {
  let from = ym(SEASON_START), to = ym(SEASON_END);
  for (const e of events) {
    from = Math.min(from, ym(e.start_date.slice(0, 7)));
    to = Math.max(to, ym(e.end_date.slice(0, 7)));
  }
  const months = [];
  for (let k = from; k <= to; k++) {
    const y = Math.floor(k / 12), m = k % 12;
    months.push({ y, m, label: MONTH_SHORT[m], year: y, days: new Date(y, m + 1, 0).getDate() });
  }
  return months;
}

export function formatRange(e) {
  const s = parseISO(e.start_date), t = parseISO(e.end_date);
  if (e.start_date === e.end_date) return format(s, 'd MMM', { locale: fr });
  if (s.getMonth() === t.getMonth()) return `${format(s, 'd')} → ${format(t, 'd MMM', { locale: fr })}`;
  return `${format(s, 'd MMM', { locale: fr })} → ${format(t, 'd MMM', { locale: fr })}`;
}

// Évènements qui ont lieu pendant la semaine qui commence le lundi weekStart
export function eventsInWeek(events = [], weekStart) {
  if (!weekStart) return [];
  const sunday = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');
  return events.filter(e => e.start_date <= sunday && e.end_date >= weekStart);
}
