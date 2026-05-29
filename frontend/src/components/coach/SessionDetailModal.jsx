import { useState } from 'react';
import api from '../../api/client.js';

const DAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function formatDuration(start, end) {
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const total = toMin(end) - toMin(start);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export default function SessionDetailModal({ session, role, onClose, onEdit, onDelete, onUpdate }) {
  const [notes,       setNotes]       = useState(session.notes        || '');
  const [archerNotes, setArcherNotes] = useState(session.archer_notes || '');
  const [completed,   setCompleted]   = useState(session.completed    || false);
  const [saving,      setSaving]      = useState(false);

  const color = session.training_type?.color || '#3b82f6';
  const title = session.training_type?.title || 'Entraînement';

  const hasChanges = role === 'coach'
    ? (notes !== (session.notes || '') || completed !== (session.completed || false))
    : archerNotes !== (session.archer_notes || '');

  async function handleSave() {
    setSaving(true);
    try {
      const payload = role === 'coach'
        ? { notes, completed }
        : { archer_notes: archerNotes };
      const { data } = await api.patch(`/planning/${session.id}`, payload);
      onUpdate?.(data);
      onClose();
    } catch (err) {
      alert('Erreur : ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header coloré ── */}
        <div className="px-6 py-4 text-white" style={{ backgroundColor: color }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold opacity-75 uppercase tracking-wider truncate">
                {DAYS[session.day_of_week]} · {session.start_time?.slice(0, 5)} – {session.end_time?.slice(0, 5)}
                {' '}({formatDuration(session.start_time, session.end_time)})
              </p>
              <h2 className="text-xl font-bold mt-0.5 truncate">{title}</h2>
            </div>
            <span className={`shrink-0 mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              completed
                ? 'bg-white/25 text-white'
                : 'bg-black/20 text-white/80'
            }`}>
              {completed ? '✓ Réalisée' : 'À venir'}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[58vh] overflow-y-auto">

          {/* Coach : case à cocher */}
          {role === 'coach' && (
            <button
              type="button"
              onClick={() => setCompleted(v => !v)}
              className="flex items-center gap-3 w-full text-left group"
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition shrink-0 ${
                completed
                  ? 'border-green-500 bg-green-500'
                  : 'border-gray-300 group-hover:border-green-400'
              }`}>
                {completed && <span className="text-white text-xs font-bold leading-none">✓</span>}
              </div>
              <span className="text-sm font-medium text-gray-700">
                Marquer la séance comme réalisée
              </span>
            </button>
          )}

          {/* Instructions du coach */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              📋 Instructions du coach
            </p>
            {role === 'coach' ? (
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Objectifs, consignes, exercices…"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            ) : (
              <div className={`rounded-xl px-3 py-2.5 text-sm ${
                notes
                  ? 'bg-gray-50 border border-gray-200 text-gray-700 whitespace-pre-wrap'
                  : 'text-gray-400 italic'
              }`}>
                {notes || 'Aucune instruction pour cette séance'}
              </div>
            )}
          </div>

          {/* Commentaire de l'archer */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              ✏️ Commentaire de l'archer
            </p>
            {role === 'archer' ? (
              <textarea
                rows={3}
                value={archerNotes}
                onChange={e => setArcherNotes(e.target.value)}
                placeholder="Vos observations, ressentis, questions…"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            ) : (
              <div className={`rounded-xl px-3 py-2.5 text-sm ${
                archerNotes
                  ? 'bg-amber-50 border border-amber-200 text-amber-800 whitespace-pre-wrap'
                  : 'text-gray-400 italic'
              }`}>
                {archerNotes || 'Aucun commentaire de l\'archer'}
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex items-center gap-2">
          {role === 'coach' && (
            <>
              <button
                onClick={() => { onDelete?.(session.id); onClose(); }}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition"
              >
                Supprimer
              </button>
              <button
                onClick={() => { onEdit?.(session); onClose(); }}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-300 rounded-xl transition"
              >
                ✎ Horaires / type
              </button>
            </>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-xl transition"
          >
            Fermer
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl disabled:opacity-40 transition"
          >
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
