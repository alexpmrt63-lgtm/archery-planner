import { useState, useMemo } from 'react';

// Ajout d'une séance au doigt, sur téléphone (remplace le glisser-déposer).
// Même style que les fenêtres de la version ordinateur.

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export default function MobileAddSheet({ defaultDay, trainingTypes, onConfirm, onClose }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    day_of_week: defaultDay || 1,
    start_time: '09:00',
    end_time: '11:00',
    training_type_id: '',
    notes: '',
  });

  const filtered = useMemo(() => {
    const q = normalize(search);
    return [...trainingTypes]
      .filter(t => !q || normalize(t.title).includes(q))
      .sort((a, b) => a.color.localeCompare(b.color) || a.title.localeCompare(b.title, 'fr'));
  }, [trainingTypes, search]);

  function pickType(type) {
    setForm(f => ({
      ...f,
      training_type_id: type.id,
      end_time: addMinutes(f.start_time, type.duration_minutes || 120),
    }));
  }

  function changeStart(value) {
    const type = trainingTypes.find(t => t.id === form.training_type_id);
    setForm(f => ({
      ...f,
      start_time: value,
      end_time: type ? addMinutes(value, type.duration_minutes || 120) : f.end_time,
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Ajouter un entraînement"
        className="bg-white rounded-t-2xl shadow-xl w-full max-h-[92dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Ajouter un entraînement</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Rechercher une situation…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 flex flex-col gap-1 max-h-56 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 italic py-2">Aucune situation ne correspond.</p>
              )}
              {filtered.map(t => {
                const selected = form.training_type_id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickType(t)}
                    className={`w-full rounded-lg text-white px-3 min-h-[44px] flex items-center justify-between gap-2 shadow-sm ${
                      selected ? 'ring-2 ring-offset-2 ring-blue-700' : ''
                    }`}
                    style={{ backgroundColor: t.color }}
                  >
                    <span className="text-sm font-bold truncate">{selected ? '✓ ' : ''}{t.title}</span>
                    <span className="text-xs opacity-80 font-medium shrink-0">{formatDuration(t.duration_minutes || 120)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jour</label>
            <select
              value={form.day_of_week}
              onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DAYS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => changeStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 pt-3 border-t border-gray-200 shrink-0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button onClick={onClose} className="flex-1 py-3 text-sm text-gray-600 border border-gray-300 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(form)}
            disabled={!form.training_type_id || form.end_time <= form.start_time}
            className="flex-1 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
