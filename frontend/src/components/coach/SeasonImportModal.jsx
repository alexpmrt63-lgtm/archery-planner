import { useState } from 'react';
import { parseSeasonFile } from '../../utils/importSeason.js';
import { SEASON_START, KIND_LABEL, formatRange, textOn } from '../../utils/season.js';

// Import d'un calendrier de saison depuis un fichier Excel ou CSV.
// Le fichier est lu dans le navigateur ; on montre la liste avant d'enregistrer.
export default function SeasonImportModal({ archerName, onImport, onClose }) {
  const [startYear, setStartYear] = useState(Number(SEASON_START.slice(0, 4)));
  const [file, setFile] = useState(null);
  const [events, setEvents] = useState(null);
  const [excluded, setExcluded] = useState(() => new Set());
  const [scope, setScope] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function read(f, year) {
    if (!f) return;
    setError(''); setEvents(null); setExcluded(new Set()); setBusy(true);
    try { setEvents(await parseSeasonFile(f, year)); }
    catch (e) { setError(e.message || 'Lecture du fichier impossible.'); }
    finally { setBusy(false); }
  }

  const chosen = (events || []).filter((_, i) => !excluded.has(i));

  async function submit() {
    setBusy(true); setError('');
    try { await onImport(chosen, scope); }
    catch (e) { setError(e?.response?.data?.error || 'Import impossible, réessaie.'); setBusy(false); }
  }

  function toggle(i) {
    setExcluded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Importer un calendrier" onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4 max-h-[92dvh]">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Importer un calendrier</h2>
          <p className="text-sm text-gray-500">
            Le calendrier du coach (mois en colonnes, jours en lignes) ou un tableau Nom | Type | Début | Fin | Couleur.
          </p>
        </div>

        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="imp-file" className="block text-sm font-medium text-gray-700 mb-1">Fichier Excel ou CSV</label>
            <input id="imp-file" type="file" accept=".xlsx,.xlsm,.csv"
              onChange={e => { const f = e.target.files?.[0] || null; setFile(f); read(f, startYear); }}
              className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium" />
          </div>
          <div>
            <label htmlFor="imp-year" className="block text-sm font-medium text-gray-700 mb-1">La saison commence en</label>
            <input id="imp-year" type="number" min="2020" max="2100" value={startYear}
              onChange={e => { const y = Number(e.target.value); setStartYear(y); if (file) read(file, y); }}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        {busy && !events && <p className="text-sm text-gray-500">Lecture du fichier…</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}

        {events && (
          <>
            <p className="text-sm text-gray-700">
              <strong>{events.length}</strong> évènement{events.length > 1 ? 's' : ''} trouvé{events.length > 1 ? 's' : ''}. Décoche ceux à ne pas importer.
            </p>
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1.5 pr-1">
              {events.map((e, i) => (
                <label key={i} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm cursor-pointer ${excluded.has(i) ? 'opacity-40' : ''}`}
                  style={{ backgroundColor: e.color, color: textOn(e.color) }}>
                  <input type="checkbox" checked={!excluded.has(i)} onChange={() => toggle(i)} />
                  <span className="font-bold flex-1 truncate">{e.title}</span>
                  <span className="text-xs font-medium shrink-0">{KIND_LABEL[e.kind]} · {formatRange(e)}</span>
                </label>
              ))}
            </div>
            <fieldset className="border border-gray-200 rounded-xl px-3 py-2.5 space-y-2">
              <legend className="text-sm font-semibold text-gray-700 px-1">Ajouter au planning de</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="imp-scope" checked={scope === 'all'} onChange={() => setScope('all')} /> Tous les archers
              </label>
              {archerName && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="imp-scope" checked={scope === 'one'} onChange={() => setScope('one')} /> {archerName} seulement
                </label>
              )}
            </fieldset>
            <p className="text-xs text-gray-500">Les évènements s'ajoutent à ceux déjà présents : rien n'est effacé.</p>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg">Annuler</button>
          <button type="button" onClick={submit} disabled={!chosen.length || busy}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50">
            Importer {chosen.length ? `(${chosen.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
