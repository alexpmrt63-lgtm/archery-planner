import { useState } from 'react';

export default function EditTrainingModal({ session, trainingTypes, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    training_type_id: session.training_type_id || trainingTypes[0]?.id || '',
    start_time:       session.start_time.slice(0, 5),
    end_time:         session.end_time.slice(0, 5),
    notes:            session.notes || '',
  });

  const DAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const selectedType = trainingTypes.find(t => t.id === form.training_type_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header coloré avec le type actuel */}
        <div
          className="px-6 py-4 text-white"
          style={{ backgroundColor: selectedType?.color || '#3b82f6' }}
        >
          <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">
            {DAYS[session.day_of_week]} · Modifier l'entraînement
          </p>
          <h2 className="text-lg font-bold mt-0.5">{selectedType?.title || 'Entraînement'}</h2>
        </div>

        <div className="p-6 space-y-4">

          {/* Type d'entraînement */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Type
            </label>
            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
              {trainingTypes.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, training_type_id: t.id }))}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 text-left transition ${
                    form.training_type_id === t.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="text-sm font-medium text-gray-800">{t.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Horaires */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Horaires
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Début</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fin</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Notes / Commentaires
            </label>
            <textarea
              rows={3}
              placeholder="Instructions, objectifs, remarques…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center gap-2">
          <button
            onClick={() => onDelete(session.id)}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition"
          >
            Supprimer
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave(session.id, form)}
            disabled={!form.training_type_id || !form.start_time || !form.end_time}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50 transition"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
