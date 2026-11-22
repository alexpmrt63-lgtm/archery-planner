import { format } from 'date-fns';
import { seasonMonths, textOn, formatRange, KIND_LABEL } from '../../utils/season.js';

// Vue « Année » sur ordinateur : les mois en colonnes, les jours en lignes,
// comme le calendrier Excel du coach. Chaque évènement est une barre verticale.

const ROW = 18;

function monthSegments(events, mo) {
  const first = `${mo.y}-${String(mo.m + 1).padStart(2, '0')}-01`;
  const last = `${mo.y}-${String(mo.m + 1).padStart(2, '0')}-${String(mo.days).padStart(2, '0')}`;
  const segs = [];
  let prev = null;
  events
    .filter(e => e.end_date >= first && e.start_date <= last)
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date))
    .forEach(e => {
      const sd = e.start_date < first ? 1 : Number(e.start_date.slice(8, 10));
      const ed = e.end_date > last ? mo.days : Number(e.end_date.slice(8, 10));
      const seg = { e, top: (sd - 1) * ROW + 1, height: (ed - sd + 1) * ROW - 2, ed };
      // Deux évènements le même jour : ce jour est partagé en deux
      if (prev && prev.ed >= sd) {
        const overlap = prev.ed - sd + 1;
        prev.height -= overlap * ROW / 2;
        seg.top += overlap * ROW / 2;
        seg.height -= overlap * ROW / 2;
      }
      segs.push(seg);
      prev = seg;
    });
  return segs;
}

export default function SeasonYearView({ events = [], onEventClick, actions, error }) {
  const months = seasonMonths(events);
  const today = format(new Date(), 'yyyy-MM-dd');
  const first = months[0], last = months[months.length - 1];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold text-gray-900">
            Saison {first.year} – {last.year}
          </span>
          <span className="text-xs text-gray-500">
            {events.length} évènement{events.length > 1 ? 's' : ''} · compétitions et stages
          </span>
        </div>
        <div className="flex-1" />
        {actions}
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="flex min-w-max">
          <div className="w-8 shrink-0 border-r border-gray-200 bg-gray-50">
            <div className="h-[34px] border-b border-gray-200" />
            {days.map(d => (
              <div key={d} className="text-[10px] text-gray-500 text-center" style={{ height: ROW, lineHeight: `${ROW}px` }}>{d}</div>
            ))}
          </div>
          {months.map(mo => {
            const segs = monthSegments(events, mo);
            const isThisMonth = today.slice(0, 7) === `${mo.y}-${String(mo.m + 1).padStart(2, '0')}`;
            return (
              <div key={`${mo.y}-${mo.m}`} className="flex-1 min-w-[58px] border-r border-gray-100 last:border-r-0">
                <div className="h-[34px] border-b border-gray-200 bg-gray-50 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold text-gray-700 leading-tight">{mo.label}</span>
                  <span className="text-[10px] text-gray-500 leading-tight">{mo.year}</span>
                </div>
                <div className="relative" style={{ height: 31 * ROW }}>
                  {days.map(d => {
                    const dow = d <= mo.days ? new Date(mo.y, mo.m, d).getDay() : -1;
                    const bg = dow === -1 ? 'bg-gray-300' : (dow === 0 || dow === 6 ? 'bg-slate-100' : 'bg-white');
                    return <div key={d} className={`${bg} border-b border-gray-50`} style={{ height: ROW }} />;
                  })}
                  {isThisMonth && (
                    <div
                      className="absolute inset-x-0 border-2 border-blue-600 rounded pointer-events-none"
                      style={{ top: (Number(today.slice(8, 10)) - 1) * ROW, height: ROW }}
                    />
                  )}
                  {segs.map(({ e, top, height }) => {
                    const label = `${e.title} · ${KIND_LABEL[e.kind] || ''} · ${formatRange(e)}${e.notes ? `\n${e.notes}` : ''}`;
                    const style = { top, height: Math.max(height, 8), backgroundColor: e.color, color: textOn(e.color) };
                    const cls = 'absolute left-0.5 right-0.5 rounded-[5px] text-left text-[10px] font-bold leading-3 px-1 py-[3px] overflow-hidden shadow-[0_0_0_1px_#fff]';
                    if (!onEventClick) {
                      return <div key={`${e.id}-${mo.m}`} title={label} className={cls} style={style}>{e.title}</div>;
                    }
                    return (
                      <button
                        key={`${e.id}-${mo.m}`}
                        type="button"
                        title={label}
                        aria-label={label}
                        onClick={() => onEventClick(e)}
                        className={`${cls} hover:brightness-95`}
                        style={style}
                      >
                        {e.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {onEventClick ? 'Clique sur un évènement pour le modifier. ' : ''}Week-ends en gris clair, aujourd'hui entouré en bleu.
      </p>
    </div>
  );
}
