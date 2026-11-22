import { useState, useEffect } from 'react';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import WeeklyPlanner from './WeeklyPlanner.jsx';

const VIEW_KEY = 'mobile-planning-view';
function readView() {
  try { return localStorage.getItem(VIEW_KEY) === 'semaine' ? 'semaine' : 'jour'; } catch { return 'jour'; }
}

// Vue « jour » du planning, utilisée uniquement sur téléphone.
// Mêmes couleurs que la grille ordinateur : blocs d'entraînement colorés,
// cours scolaires en gris, créneaux perso en pointillés.

const DAY_LABELS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

function todayIndexIn(weekStart) {
  const monday = parseISO(weekStart);
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    if (isSameDay(addDays(monday, i), today)) return i + 1;
  }
  return 1;
}

function durationLabel(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const min = (eh * 60 + em) - (sh * 60 + sm);
  if (min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export default function MobileDayView({
  weekStart,
  coursSlots = [],
  trainingSessions = [],
  onViewSession,
  onResizeSlot,
  day: controlledDay,
  onDayChange,
}) {
  const [view, setViewState] = useState(readView);
  const setView = v => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* stockage indisponible */ } };
  const [editingSlot, setEditingSlot] = useState(null);
  const [ownDay, setOwnDay] = useState(() => todayIndexIn(weekStart));
  const day = controlledDay ?? ownDay;
  const setDay = d => { setOwnDay(d); onDayChange?.(d); };

  // Changement de semaine : on se place sur aujourd'hui (ou le lundi)
  useEffect(() => { setDay(todayIndexIn(weekStart)); }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const monday = parseISO(weekStart);
  const dates = DAY_LABELS.map((_, i) => addDays(monday, i));

  const countByDay = d =>
    trainingSessions.filter(s => s.day_of_week === d).length;

  const items = [
    ...trainingSessions.filter(s => s.day_of_week === day).map(s => ({ kind: 'training', s })),
    ...coursSlots.filter(s => s.day_of_week === day).map(s => ({ kind: s.type === 'perso' ? 'perso' : 'cours', s })),
  ].sort((a, b) => a.s.start_time.localeCompare(b.s.start_time));

  const toggle = (
    <div className="flex bg-gray-100 rounded-lg p-1 self-center" role="group" aria-label="Affichage du planning">
      {[['jour', 'Jour'], ['semaine', 'Semaine']].map(([id, label]) => (
        <button
          key={id}
          onClick={() => setView(id)}
          aria-pressed={view === id}
          className={`px-5 py-2 rounded-md text-sm font-medium transition ${
            view === id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (view === 'semaine') {
    return (
      <div className="flex flex-col gap-3">
        {toggle}
        <WeeklyPlanner
          weekStart={weekStart}
          coursSlots={coursSlots}
          trainingSessions={trainingSessions}
          readOnly={true}
          onViewSession={onViewSession}
          onResizeSlot={onResizeSlot}
          dayColWidth={64}
        />
        <p className="text-xs text-gray-400 text-center">Fais glisser la grille sur le côté pour voir toute la semaine.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {toggle}
      {/* Bandeau des 7 jours */}
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date, i) => {
          const d = i + 1;
          const active = d === day;
          const hasSessions = countByDay(d) > 0;
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              aria-label={format(date, 'EEEE d MMMM', { locale: fr })}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 min-h-[56px] transition ${
                active ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              <span className="text-[10px] font-semibold tracking-wide">{DAY_LABELS[i]}</span>
              <span className="text-base font-bold leading-none">{format(date, 'd')}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${hasSessions ? (active ? 'bg-white' : 'bg-blue-500') : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>

      <p className="text-sm font-bold text-gray-900 first-letter:uppercase">
        {format(dates[day - 1], 'EEEE d MMMM', { locale: fr })}
      </p>

      {items.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-500 text-center">
          Rien de prévu ce jour-là.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items.map(({ kind, s }) => {
          const time = `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`;
          if (kind === 'training') {
            return (
              <button
                key={s.id}
                onClick={() => onViewSession?.(s)}
                className="w-full text-left rounded-lg text-white shadow-sm px-3 py-2.5 flex flex-col gap-0.5"
                style={{ backgroundColor: s.training_type?.color || '#3b82f6' }}
              >
                <span className="text-sm font-bold leading-tight">{s.training_type?.title || 'Entraînement'}</span>
                <span className="text-xs opacity-80 font-medium">
                  {time} · {durationLabel(s.start_time.slice(0, 5), s.end_time.slice(0, 5))}
                </span>
                {s.notes && <span className="text-xs opacity-90 leading-snug">{s.notes}</span>}
              </button>
            );
          }
          const editable = !!onResizeSlot;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!editable}
              onClick={() => setEditingSlot(s)}
              className={`w-full text-left rounded-lg px-3 py-2 flex items-center gap-2 ${
                kind === 'perso'
                  ? 'bg-zinc-200 border border-zinc-400 border-dashed text-zinc-600'
                  : 'bg-gray-200 border border-gray-300 text-gray-600'
              }`}
            >
              <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-tight">{s.label || (kind === 'perso' ? 'Perso' : 'Cours')}</span>
                <span className="text-xs opacity-75 font-medium">{time}</span>
              </span>
              {editable && <span className="text-xs opacity-60">✎ Horaire</span>}
            </button>
          );
        })}
      </div>

      {editingSlot && (
        <SlotTimeModal
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSave={times => {
            onResizeSlot(editingSlot.id, { day_of_week: editingSlot.day_of_week, ...times });
            setEditingSlot(null);
          }}
        />
      )}
    </div>
  );
}

// Ajustement de l'horaire d'un cours au doigt (vue jour sur téléphone)
function SlotTimeModal({ slot, onClose, onSave }) {
  const [start, setStart] = useState(slot.start_time.slice(0, 5));
  const [end, setEnd]     = useState(slot.end_time.slice(0, 5));
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Ajuster l'horaire"
        className="bg-white rounded-t-2xl shadow-xl w-full p-5 space-y-4"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-bold text-gray-900">Ajuster l'horaire</h2>
          <p className="text-sm text-gray-500">{slot.label || 'Cours'}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg">Annuler</button>
          <button
            onClick={() => onSave({ start_time: start, end_time: end })}
            disabled={!start || !end || end <= start}
            className="flex-1 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
