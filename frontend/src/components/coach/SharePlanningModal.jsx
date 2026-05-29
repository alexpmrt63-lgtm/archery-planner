import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../api/client.js';

export default function SharePlanningModal({ sourceArcher, weekStart, allArchers, onClose, onShared }) {
  const [selected, setSelected] = useState(new Set());
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(null); // { copied, sessions }

  // Exclut l'archer source de la liste
  const targets = allArchers.filter(a => a.id !== sourceArcher.id);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === targets.length ? new Set() : new Set(targets.map(a => a.id))
    );
  }

  async function handleShare() {
    if (!selected.size) return;
    setLoading(true);
    try {
      const { data } = await api.post('/planning/copy', {
        source_archer_id: sourceArcher.id,
        week_start:       weekStart,
        target_archer_ids: [...selected],
      });
      setDone(data);
      onShared?.();
    } catch (err) {
      alert('Erreur : ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }

  const weekLabel = format(parseISO(weekStart), "'Semaine du' d MMMM yyyy", { locale: fr });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-700 px-6 py-4 text-white">
          <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">{weekLabel}</p>
          <h2 className="text-lg font-bold mt-0.5">
            Partager le planning de {sourceArcher.name}
          </h2>
        </div>

        {done ? (
          /* ── Confirmation ── */
          <div className="p-6 text-center space-y-3">
            <div className="text-4xl">✅</div>
            <p className="font-semibold text-gray-800">
              Planning copié vers {done.copied} archer{done.copied > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-gray-500">
              {done.sessions} séance{done.sessions > 1 ? 's' : ''} attribuée{done.sessions > 1 ? 's' : ''}
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition"
            >
              Fermer
            </button>
          </div>
        ) : (
          /* ── Sélection des archers ── */
          <>
            <div className="px-6 pt-4 pb-2">
              <p className="text-xs text-gray-500 mb-3">
                Sélectionnez les archers qui recevront le même planning.
                Leurs séances existantes pour cette semaine seront remplacées.
              </p>

              {targets.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-4 text-center">
                  Aucun autre archer disponible
                </p>
              ) : (
                <>
                  {/* Tout sélectionner */}
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mb-2 transition"
                  >
                    {selected.size === targets.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>

                  {/* Liste des archers */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {targets.map(archer => (
                      <label
                        key={archer.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border-2 transition ${
                          selected.has(archer.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                          selected.has(archer.id)
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                          onClick={() => toggle(archer.id)}
                        >
                          {selected.has(archer.id) && (
                            <span className="text-white text-xs font-bold leading-none">✓</span>
                          )}
                        </div>
                        <span
                          className="flex items-center gap-2 flex-1"
                          onClick={() => toggle(archer.id)}
                        >
                          <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {archer.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{archer.name}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Avertissement */}
            {selected.size > 0 && (
              <div className="mx-6 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                ⚠️ Le planning existant de {selected.size} archer{selected.size > 1 ? 's' : ''} sera remplacé.
              </div>
            )}

            {/* Actions */}
            <div className="px-6 pb-5 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={handleShare}
                disabled={loading || !selected.size}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl disabled:opacity-40 transition"
              >
                {loading ? '…' : `Partager (${selected.size})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
