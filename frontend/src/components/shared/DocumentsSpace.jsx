import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../api/client.js';

// ── Rubriques ────────────────────────────────────────────────────────────────
export const DOC_CATEGORIES = [
  { id: 'administratif', label: 'Administratif' },
  { id: 'competitions',  label: 'Compétitions'  },
  { id: 'stages',        label: 'Stages'        },
  { id: 'sante',         label: 'Santé'         },
  { id: 'autre',         label: 'Autre'         },
];
const catLabel = id => DOC_CATEGORIES.find(c => c.id === id)?.label ?? 'Autre';

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv';

// ── Pastille du type de fichier ──────────────────────────────────────────────
function fileBadge(mime = '', name = '') {
  const ext = name.split('.').pop()?.toLowerCase();
  if (mime === 'application/pdf')                       return { t: 'PDF', c: 'bg-red-50 text-red-600' };
  if (mime.startsWith('image/'))                        return { t: 'IMG', c: 'bg-purple-50 text-purple-700' };
  if (/sheet|excel|csv/.test(mime) || ['xls', 'xlsx', 'ods', 'csv'].includes(ext))
                                                        return { t: 'XLS', c: 'bg-green-50 text-green-700' };
  if (/presentation|powerpoint/.test(mime))             return { t: 'PPT', c: 'bg-orange-50 text-orange-600' };
  if (/word|opendocument\.text/.test(mime))             return { t: 'DOC', c: 'bg-blue-50 text-blue-700' };
  return { t: (ext || 'TXT').slice(0, 3).toUpperCase(), c: 'bg-gray-100 text-gray-600' };
}

function fmtSize(b) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

// ── Fenêtre d'ajout ──────────────────────────────────────────────────────────
function AddDocumentModal({ onClose, onAdded }) {
  const [file, setFile]         = useState(null);
  const [title, setTitle]       = useState('');
  const [category, setCategory] = useState('administratif');
  const [notify, setNotify]     = useState(true);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const [over, setOver]         = useState(false);
  const inputRef = useRef(null);

  function pick(f) {
    setError('');
    if (!f) return;
    if (f.size > MAX_SIZE) { setError('Ce fichier dépasse 10 Mo. Choisis un fichier plus léger.'); return; }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  }

  async function submit(e) {
    e.preventDefault();
    if (!file) { setError('Choisis un fichier.'); return; }
    setSending(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      fd.append('category', category);
      fd.append('notify', notify ? 'true' : 'false');
      const { data } = await api.post('/documents', fd);
      onAdded(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Envoi impossible. Vérifie ta connexion et réessaie.');
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 flex flex-col gap-4"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Ajouter un document</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
          className={`border-2 border-dashed rounded-xl p-5 text-center transition ${over ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-blue-50/40 hover:bg-blue-50'}`}
        >
          <p className="text-sm font-medium text-blue-700">📎 Choisir un fichier</p>
          <p className="text-xs text-gray-500 mt-1">ou le glisser ici · PDF, Word, Excel, image · 10 Mo max</p>
          {file && (
            <p className="text-xs text-gray-700 mt-3 bg-white border border-gray-200 rounded-lg px-2 py-1.5 inline-block max-w-full truncate">
              {file.name} · {fmtSize(file.size)}
            </p>
          )}
        </button>
        <input ref={inputRef} id="doc-file" type="file" accept={ACCEPT} className="hidden" onChange={e => pick(e.target.files?.[0])} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Titre</span>
          <input id="doc-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={150}
            placeholder="Ex. Convocation Championnat de France"
            className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Rubrique</span>
          <select id="doc-category" value={category} onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {DOC_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input id="doc-notify" type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
          Prévenir le groupe (notification)
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Annuler</button>
          <button type="submit" disabled={sending || !file}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50">
            {sending ? 'Envoi…' : 'Ajouter'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Espace Documents (commun coach / archers, ordinateur / téléphone) ───────
export default function DocumentsSpace({ currentUser, compact = false }) {
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery]         = useState('');
  const [filter, setFilter]       = useState('all');
  const [adding, setAdding]       = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId]       = useState(null);

  const isCoach = currentUser?.role === 'coach';

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const { data } = await api.get('/documents');
      setDocs(data);
    } catch (err) {
      setLoadError(err.response?.status === 404
        ? "L'espace Documents n'est pas encore activé sur le serveur."
        : 'Impossible de charger les documents.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { all: docs.length };
    docs.forEach(d => { c[d.category] = (c[d.category] || 0) + 1; });
    return c;
  }, [docs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter(d =>
      (filter === 'all' || d.category === filter) &&
      (!q || d.title.toLowerCase().includes(q) || d.file_name.toLowerCase().includes(q) || d.uploader_name.toLowerCase().includes(q))
    );
  }, [docs, query, filter]);

  async function openDoc(doc) {
    // Fenêtre ouverte tout de suite (sinon bloquée par le navigateur), remplie ensuite.
    const w = window.open('', '_blank');
    try {
      const { data } = await api.get(`/documents/${doc.id}/url`);
      if (w) w.location.href = data.url; else window.location.href = data.url;
    } catch {
      w?.close();
      setLoadError("Impossible d'ouvrir ce document.");
    }
  }

  async function togglePin(doc) {
    setBusyId(doc.id);
    try {
      const { data } = await api.patch(`/documents/${doc.id}`, { pinned: !doc.pinned });
      setDocs(ds => ds.map(d => d.id === doc.id ? data : d)
        .sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at)));
    } catch { setLoadError("Impossible d'épingler ce document."); }
    finally { setBusyId(null); }
  }

  async function remove(doc) {
    setBusyId(doc.id);
    try {
      await api.delete(`/documents/${doc.id}`);
      setDocs(ds => ds.filter(d => d.id !== doc.id));
    } catch (err) { setLoadError(err.response?.data?.error || 'Suppression impossible.'); }
    finally { setBusyId(null); setConfirmId(null); }
  }

  const canDelete = doc => isCoach || doc.uploaded_by === currentUser?.id;

  return (
    <div className={`h-full overflow-y-auto bg-gray-50 ${compact ? 'p-3' : 'p-6'}`}>
      <div className="flex flex-col gap-3 sm:gap-4 max-w-5xl">
        {/* Barre d'outils */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <input
            id="doc-search"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="🔍 Rechercher un document"
            aria-label="Rechercher un document"
            className={`${compact ? 'flex-1 min-w-0 py-2' : 'w-64 py-1.5'} border border-gray-200 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {compact && (
            <button onClick={() => setAdding(true)} className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800">
              + Ajouter
            </button>
          )}
          <div className={`flex gap-1.5 text-xs font-medium ${compact ? 'w-full overflow-x-auto scrollbar-none whitespace-nowrap' : 'flex-wrap'}`}>
            {[{ id: 'all', label: 'Tous' }, ...DOC_CATEGORIES].map(c => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                aria-pressed={filter === c.id}
                className={`px-3 py-1 rounded-full transition shrink-0 ${filter === c.id ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {c.label}{counts[c.id] ? ` · ${counts[c.id]}` : ''}
              </button>
            ))}
          </div>
          {!compact && (
            <button onClick={() => setAdding(true)} className="ml-auto px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 transition">
              + Ajouter un document
            </button>
          )}
        </div>

        {loadError && (
          <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">
            <span>{loadError}</span>
            <button onClick={() => { setLoadError(''); load(); }} className="text-xs font-medium underline shrink-0">Réessayer</button>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <p className="text-sm text-gray-400 px-1">Chargement…</p>
        ) : shown.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-10 text-center">
            <p className="text-3xl mb-2">📁</p>
            <p className="text-sm font-medium text-gray-700">
              {docs.length === 0 ? 'Aucun document pour le moment' : 'Aucun document ne correspond'}
            </p>
            {docs.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">Ajoute le règlement, une convocation ou le programme d'un stage avec « + Ajouter ».</p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {shown.map(doc => {
              const b = fileBadge(doc.mime_type, doc.file_name);
              const mine = doc.uploaded_by === currentUser?.id;
              const meta = [
                catLabel(doc.category),
                `${doc.uploader_name}${mine ? ' (moi)' : doc.uploader_role === 'coach' ? ' (coach)' : ''}`,
                format(parseISO(doc.created_at), 'd MMM yyyy', { locale: fr }),
                !compact && fmtSize(doc.size_bytes),
              ].filter(Boolean).join(' · ');
              return (
                <div key={doc.id} className={`flex items-center gap-3 ${compact ? 'px-3' : 'px-4'} py-3`}>
                  <button onClick={() => openDoc(doc)} className="flex items-center gap-3 flex-1 min-w-0 text-left" title="Ouvrir">
                    <span className={`w-9 h-9 rounded-lg text-[10px] font-bold flex items-center justify-center shrink-0 ${b.c}`}>{b.t}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-gray-900 truncate">{doc.pinned ? '📌 ' : ''}{doc.title}</span>
                      <span className="block text-xs text-gray-500 truncate">{meta}</span>
                    </span>
                  </button>

                  {confirmId === doc.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-600 hidden sm:inline">Supprimer ?</span>
                      <button onClick={() => remove(doc)} disabled={busyId === doc.id}
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg disabled:opacity-50">Oui</button>
                      <button onClick={() => setConfirmId(null)}
                        className="text-xs text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-100">Non</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {!compact && (
                        <button onClick={() => openDoc(doc)}
                          className="text-xs font-medium text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 border border-blue-200 mr-1">Ouvrir</button>
                      )}
                      {isCoach && (
                        <button onClick={() => togglePin(doc)} disabled={busyId === doc.id}
                          title={doc.pinned ? 'Désépingler' : 'Épingler en haut'} aria-label={doc.pinned ? 'Désépingler' : 'Épingler en haut'}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm hover:bg-gray-100 ${doc.pinned ? '' : 'grayscale opacity-40 hover:opacity-80'}`}>📌</button>
                      )}
                      {canDelete(doc) && (
                        <button onClick={() => setConfirmId(doc.id)} title="Supprimer" aria-label="Supprimer"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-gray-400 hover:bg-red-50 hover:text-red-600">🗑</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {adding && (
        <AddDocumentModal
          onClose={() => setAdding(false)}
          onAdded={doc => {
            setAdding(false);
            setDocs(ds => [doc, ...ds].sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at)));
          }}
        />
      )}
    </div>
  );
}
