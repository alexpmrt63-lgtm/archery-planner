import { useState, useRef, useEffect } from 'react';
import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns';
import { seasonMonths, textOn, formatRange, KIND_LABEL } from '../../utils/season.js';

// Vue « Année » sur ordinateur : les mois en colonnes, les jours en lignes,
// comme le calendrier Excel du coach. Chaque évènement est une barre verticale.
// Coach : glisser une barre change ses dates ; un clic la sélectionne et affiche
// les poignées pour l'étirer ou la réduire ; un second clic ouvre la modification.

const ROW = 18;
const DRAG_THRESHOLD = 4; // px avant de considérer qu'on glisse (sinon c'est un clic)

const pad = n => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const shift = (iso, n) => format(addDays(parseISO(iso), n), 'yyyy-MM-dd');

function monthSegments(events, mo) {
  const first = isoOf(mo.y, mo.m, 1);
  const last = isoOf(mo.y, mo.m, mo.days);
  const segs = [];
  let prev = null;
  events
    .filter(e => e.end_date >= first && e.start_date <= last)
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date))
    .forEach(e => {
      const sd = e.start_date < first ? 1 : Number(e.start_date.slice(8, 10));
      const ed = e.end_date > last ? mo.days : Number(e.end_date.slice(8, 10));
      const seg = {
        e, top: (sd - 1) * ROW + 1, height: (ed - sd + 1) * ROW - 2, ed, lane: null,
        isStart: e.start_date >= first, isEnd: e.end_date <= last,
      };
      if (prev && prev.ed >= sd) {
        const overlap = prev.ed - sd + 1;
        if (overlap === 1) {
          // Deux évènements le même jour : ce jour est partagé en deux
          prev.height -= ROW / 2;
          seg.top += ROW / 2;
          seg.height -= ROW / 2;
        } else {
          // Chevauchement plus long : côte à côte
          prev.lane = prev.lane ?? 0;
          seg.lane = prev.lane === 0 ? 1 : 0;
        }
      }
      segs.push(seg);
      prev = seg;
    });
  return segs;
}

export default function SeasonYearView({ events = [], onEventClick, onEventChange, actions, error }) {
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);      // { id, start_date, end_date } pendant un glisser
  const dragRef = useRef(null);
  const draftRef = useRef(null);
  const colRefs = useRef([]);
  const editable = !!onEventChange;

  const shown = draft ? events.map(e => (e.id === draft.id ? { ...e, ...draft } : e)) : events;
  const months = seasonMonths(shown);
  const today = format(new Date(), 'yyyy-MM-dd');
  const first = months[0], last = months[months.length - 1];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // Date sous le pointeur (colonne = mois, ligne = jour)
  function dateAt(x, y) {
    const cols = colRefs.current;
    let idx = cols.findIndex(el => { if (!el) return false; const r = el.getBoundingClientRect(); return x >= r.left && x < r.right; });
    if (idx === -1) {
      const firstRect = cols[0]?.getBoundingClientRect();
      idx = firstRect && x < firstRect.left ? 0 : months.length - 1;
    }
    const rect = cols[idx].getBoundingClientRect();
    const mo = months[idx];
    const day = Math.min(Math.max(Math.floor((y - rect.top) / ROW) + 1, 1), mo.days);
    return isoOf(mo.y, mo.m, day);
  }

  useEffect(() => {
    function onMove(ev) {
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < DRAG_THRESHOLD) return;
      ev.preventDefault();
      d.moved = true;
      const at = dateAt(ev.clientX, ev.clientY);
      const { start_date: s, end_date: t } = d.event;
      let next;
      if (d.mode === 'move') {
        const delta = differenceInCalendarDays(parseISO(at), parseISO(d.grab));
        next = { start_date: shift(s, delta), end_date: shift(t, delta) };
      } else if (d.mode === 'start') {
        next = { start_date: at > t ? t : at, end_date: t };
      } else {
        next = { start_date: s, end_date: at < s ? s : at };
      }
      draftRef.current = { id: d.event.id, ...next };
      setDraft(draftRef.current);
    }
    function onUp() {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      const cur = draftRef.current;
      draftRef.current = null;
      setDraft(null);
      if (d.moved && cur && (cur.start_date !== d.event.start_date || cur.end_date !== d.event.end_date)) {
        onEventChange?.(d.event, { start_date: cur.start_date, end_date: cur.end_date });
      }
      if (!d.moved && d.mode === 'move') {
        // Simple clic : 1er clic = sélection (poignées), 2e clic = modifier
        if (selectedIdRef.current === d.event.id) onEventClick?.(d.event);
        else setSelectedId(d.event.id);
      }
    }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  });

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  function startDrag(ev, event, mode) {
    if (!editable || ev.button > 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    dragRef.current = { event, mode, x: ev.clientX, y: ev.clientY, grab: dateAt(ev.clientX, ev.clientY), moved: false };
    if (mode !== 'move') setSelectedId(event.id);
  }

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

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto" onPointerDown={() => setSelectedId(null)}>
        <div className={`flex min-w-max ${draft ? 'select-none' : ''}`}>
          <div className="w-8 shrink-0 border-r border-gray-200 bg-gray-50">
            <div className="h-[34px] border-b border-gray-200" />
            {days.map(d => (
              <div key={d} className="text-[10px] text-gray-500 text-center" style={{ height: ROW, lineHeight: `${ROW}px` }}>{d}</div>
            ))}
          </div>
          {months.map((mo, mi) => {
            const segs = monthSegments(shown, mo);
            const isThisMonth = today.slice(0, 7) === `${mo.y}-${pad(mo.m + 1)}`;
            return (
              <div key={`${mo.y}-${mo.m}`} className="flex-1 min-w-[58px] border-r border-gray-100 last:border-r-0">
                <div className="h-[34px] border-b border-gray-200 bg-gray-50 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold text-gray-700 leading-tight">{mo.label}</span>
                  <span className="text-[10px] text-gray-500 leading-tight">{mo.year}</span>
                </div>
                <div ref={el => { colRefs.current[mi] = el; }} className="relative" style={{ height: 31 * ROW }}>
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
                  {segs.map(({ e, top, height, lane, isStart, isEnd }) => {
                    const label = `${e.title} · ${KIND_LABEL[e.kind] || ''} · ${formatRange(e)}${e.notes ? `\n${e.notes}` : ''}`;
                    const selected = editable && selectedId === e.id;
                    const dragging = draft?.id === e.id;
                    const style = {
                      top, height: Math.max(height, 8),
                      left: lane === 1 ? '50%' : 2, right: lane === 0 ? '50%' : 2,
                      backgroundColor: e.color, color: textOn(e.color),
                    };
                    const cls = 'absolute rounded-[5px] text-left text-[10px] font-bold leading-3 px-1 py-[3px] overflow-hidden shadow-[0_0_0_1px_#fff]';
                    if (!onEventClick && !editable) {
                      return <div key={`${e.id}-${mo.m}`} title={label} className={cls} style={style}>{e.title}</div>;
                    }
                    return (
                      <div key={`${e.id}-${mo.m}`} className="contents">
                        <button
                          type="button"
                          title={editable ? `${label}\nGlisser pour déplacer · clic pour les poignées · 2e clic pour modifier` : label}
                          aria-label={label}
                          aria-pressed={editable ? selected : undefined}
                          onPointerDown={ev => (editable ? startDrag(ev, e, 'move') : undefined)}
                          onClick={ev => { if (!editable || ev.detail === 0) onEventClick?.(e); }}
                          className={`${cls} ${editable ? 'cursor-grab active:cursor-grabbing touch-none' : 'hover:brightness-95'} ${selected ? 'ring-2 ring-blue-600 z-20' : ''} ${dragging ? 'opacity-90 shadow-lg z-30' : ''}`}
                          style={style}
                        >
                          {e.title}
                        </button>
                        {selected && isStart && (
                          <span
                            role="slider"
                            aria-label={`Changer la date de début de ${e.title}`}
                            aria-valuetext={e.start_date}
                            title="Étirer pour changer la date de début"
                            onPointerDown={ev => startDrag(ev, e, 'start')}
                            className="absolute z-30 h-2.5 w-6 -translate-x-1/2 rounded-full bg-white border-2 border-blue-600 cursor-ns-resize touch-none"
                            style={{ top: top - 5, left: lane === 1 ? '75%' : lane === 0 ? '25%' : '50%' }}
                          />
                        )}
                        {selected && isEnd && (
                          <span
                            role="slider"
                            aria-label={`Changer la date de fin de ${e.title}`}
                            aria-valuetext={e.end_date}
                            title="Étirer pour changer la date de fin"
                            onPointerDown={ev => startDrag(ev, e, 'end')}
                            className="absolute z-30 h-2.5 w-6 -translate-x-1/2 rounded-full bg-white border-2 border-blue-600 cursor-ns-resize touch-none"
                            style={{ top: top + Math.max(height, 8) - 5, left: lane === 1 ? '75%' : lane === 0 ? '25%' : '50%' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {editable
          ? "Glisse un évènement pour changer ses dates. Clique dessus pour afficher les poignées et l'étirer ou le réduire, clique une 2e fois pour le modifier. "
          : onEventClick ? 'Clique sur un évènement pour le modifier. ' : ''}
        Week-ends en gris clair, aujourd'hui entouré en bleu.
      </p>
    </div>
  );
}
