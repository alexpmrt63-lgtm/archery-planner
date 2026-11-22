import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { textOn, formatRange, KIND_LABEL } from '../../utils/season.js';

// Vue « Année » sur téléphone : les évènements de la saison, mois par mois.
export default function SeasonList({ events = [], onEventClick, error }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const groups = [];
  [...events].sort((a, b) => a.start_date.localeCompare(b.start_date)).forEach(e => {
    const key = e.start_date.slice(0, 7);
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, label: format(parseISO(`${key}-01`), 'MMMM yyyy', { locale: fr }), items: [] }; groups.push(g); }
    g.items.push(e);
  });

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">{error}</div>}
      {!error && events.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-500 text-center">
          Aucune compétition ni aucun stage pour l'instant.
        </div>
      )}
      {groups.map(g => (
        <div key={g.key} className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mt-1">{g.label}</p>
          {g.items.map(e => {
            const past = e.end_date < today;
            const Tag = onEventClick ? 'button' : 'div';
            return (
              <Tag
                key={e.id}
                {...(onEventClick ? { type: 'button', onClick: () => onEventClick(e) } : {})}
                className={`w-full text-left rounded-lg shadow-sm px-3 py-2.5 flex flex-col gap-0.5 ${past ? 'opacity-50' : ''}`}
                style={{ backgroundColor: e.color, color: textOn(e.color) }}
              >
                <span className="text-sm font-bold leading-tight">{e.title}</span>
                <span className="text-xs font-medium">{KIND_LABEL[e.kind]} · {formatRange(e)}</span>
                {e.notes && <span className="text-xs leading-snug opacity-90">{e.notes}</span>}
              </Tag>
            );
          })}
        </div>
      ))}
    </div>
  );
}
