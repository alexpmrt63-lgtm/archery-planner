import { useState } from 'react';
import { EVENT_COLORS } from '../../utils/season.js';

// Le coach ajoute ou modifie une compétition / un stage de la saison.
// Même style que les fenêtres de modification des situations.
export default function SeasonEventModal({ event, archerName, defaultDate, onSave, onDelete, onClose }) {
  const isNew = !event;
  const [form, setForm] = useState({
    title: event?.title || '',
    kind: event?.kind || 'competition',
    start_date: event?.start_date || defaultDate || '',
    end_date: event?.end_date || defaultDate || '',
    color: event?.color || '#FF0000',
    notes: event?.notes || '',
  });
  const [scope, setScope] = useState('one');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title.trim() && form.start_date && form.end_date && form.end_date >= form.start_date;

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true); setError('');
    try { await onSave(form, scope); }
    catch (err) { setError(err?.response?.data?.error || 'Enregistrement impossible, réessaie.'); setSaving(false); }
  }

  async function remove() {
    setSaving(true); setError('');
    try { await onDelete(scope); }
    catch (err) { setError(err?.response?.data?.error || 'Suppression impossible, réessaie.'); setSaving(false); }
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-label={isNew ? 'Ajouter un évènement' : "Modifier l'évènement"}
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[92dvh] overflow-y-auto"
      >
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg border border-gray-200 shrink-0" style={{ backgroundColor: form.color }} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Ajouter un évènement' : "Modifier l'évènement"}</h2>
            {archerName && <p className="text-sm text-gray-500">Planning de {archerName}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="ev-title" className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
          <input id="ev-title" className={input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex. TNJ 1, Stage PFR Vichy…" autoFocus={isNew} />
        </div>

        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1">Type</span>
          <div className="inline-flex bg-gray-100 rounded-lg p-1" role="group" aria-label="Type d'évènement">
            {[['competition', 'Compétition'], ['stage', 'Stage']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={form.kind === id}
                onClick={() => set('kind', id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${form.kind === id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ev-start" className="block text-sm font-medium text-gray-700 mb-1">Du</label>
            <input id="ev-start" type="date" className={input} value={form.start_date}
              onChange={e => { const v = e.target.value; setForm(f => ({ ...f, start_date: v, end_date: !f.end_date || f.end_date < v ? v : f.end_date })); }} />
          </div>
          <div>
            <label htmlFor="ev-end" className="block text-sm font-medium text-gray-700 mb-1">Au</label>
            <input id="ev-end" type="date" className={input} value={form.end_date} min={form.start_date || undefined} onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1.5">Couleur</span>
          <div className="flex flex-wrap gap-2 items-center">
            {EVENT_COLORS.map(c => (
              <button
                key={c}
                type="button"
                aria-label={`Couleur ${c}`}
                aria-pressed={form.color.toLowerCase() === c.toLowerCase()}
                onClick={() => set('color', c)}
                className={`w-7 h-7 rounded-full border border-black/10 ${form.color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-2 ring-blue-700' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input type="color" aria-label="Autre couleur" value={form.color} onChange={e => set('color', e.target.value)} className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer" />
          </div>
        </div>

        <div>
          <label htmlFor="ev-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
          <textarea id="ev-notes" rows={2} className={`${input} resize-none`} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <fieldset className="border border-gray-200 rounded-xl px-3 py-2.5 space-y-2">
          <legend className="text-sm font-semibold text-gray-700 px-1">Appliquer à</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="scope" checked={scope === 'one'} onChange={() => setScope('one')} />
            {archerName ? `${archerName} seulement` : 'Cet archer seulement'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="scope" checked={scope !== 'one'} onChange={() => setScope(isNew ? 'all' : 'group')} />
            {isNew ? 'Tous les archers' : 'Tous les archers qui ont cet évènement'}
          </label>
        </fieldset>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          {!isNew && (
            confirmDelete ? (
              <button type="button" disabled={saving} onClick={remove} className="px-3 py-2.5 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-50">
                Confirmer la suppression
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="px-1 py-2.5 text-sm font-medium text-red-700 hover:text-red-800">
                Supprimer
              </button>
            )
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg">Annuler</button>
          <button
            type="submit"
            disabled={!valid || saving}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-50 bg-blue-700 hover:bg-blue-800 text-white"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          La semaine de l'évènement, il est proposé en haut de la banque de situations.
        </p>
      </form>
    </div>
  );
}
