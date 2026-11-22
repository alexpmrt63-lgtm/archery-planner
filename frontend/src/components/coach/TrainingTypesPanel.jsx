import { useState, useMemo } from 'react';
import api from '../../api/client.js';
import { textOn, formatRange, KIND_LABEL } from '../../utils/season.js';

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

const DURATION_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1h',     value: 60 },
  { label: '1h30',   value: 90 },
  { label: '2h',     value: 120 },
  { label: '2h30',   value: 150 },
  { label: '3h',     value: 180 },
  { label: '3h30',   value: 210 },
  { label: '4h',     value: 240 },
];


// Noms par défaut des groupes (un groupe = une couleur). Le coach peut les renommer.
const DEFAULT_GROUP_NAMES = {
  '#3b82f6': 'Bleu',   '#10b981': 'Vert',  '#f59e0b': 'Orange clair', '#ef4444': 'Rouge',
  '#8b5cf6': 'Violet', '#06b6d4': 'Cyan',  '#f97316': 'Orange',       '#ec4899': 'Rose',
};
const GROUP_NAMES_KEY = 'library-group-names';
const COLLAPSED_KEY   = 'library-collapsed-groups';

function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}

// « Footing de base - FC1 » et « footing de base FC1 » donnent la même clé
function normalizeTitle(title) {
  return title
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const PX_PER_HOUR   = 36;   // hauteur visuelle par heure en mode développé
const COMPACT_H     = 34;   // hauteur en mode compact

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function LibraryBlock({ type, isDuplicate, onEdit, onDelete, onLibDragStart, onLibDragEnd }) {
  const [expanded, setExpanded] = useState(false);

  const duration   = type.duration_minutes || 120;
  const fullHeight = Math.max(Math.round((duration / 60) * PX_PER_HOUR), 52);

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('application/x-library', JSON.stringify({
          training_type_id: type.id,
          duration_minutes: duration,
        }));
        e.dataTransfer.effectAllowed = 'copy';
        onLibDragStart?.({ ...type, duration_minutes: duration });
      }}
      onDragEnd={() => onLibDragEnd?.()}
      onClick={() => setExpanded(v => !v)}
      className="relative rounded-lg cursor-grab active:cursor-grabbing text-white px-2.5 select-none group shadow-sm overflow-hidden"
      style={{
        backgroundColor: type.color,
        height: expanded ? `${fullHeight}px` : `${COMPACT_H}px`,
        transition: 'height 0.18s ease',
      }}
    >
      {/* Boutons édition/suppression — visibles au hover */}
      <div
        className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => onEdit(type)}
          className="text-white/80 hover:text-white text-[11px] w-5 h-5 flex items-center justify-center rounded bg-black/25 hover:bg-black/45"
          title="Modifier"
        >✎</button>
        <button
          onClick={() => onDelete(type.id)}
          className="text-white/80 hover:text-white text-[11px] w-5 h-5 flex items-center justify-center rounded bg-black/25 hover:bg-black/45"
          title="Supprimer"
        >✕</button>
      </div>

      {/* Mode compact : tout sur une ligne */}
      {!expanded && (
        <div className="flex items-center justify-between h-full gap-2 pr-12">
          <span className="text-xs font-bold truncate leading-none">
            {isDuplicate && <span title="Nom proche d'une autre situation : doublon possible">⚠️ </span>}
            {type.title}
          </span>
          <span className="text-[10px] opacity-70 font-medium shrink-0">{formatDuration(duration)}</span>
        </div>
      )}

      {/* Mode développé : layout pleine hauteur */}
      {expanded && (
        <div className="flex flex-col justify-between h-full py-2 pr-10">
          <span className="text-xs font-bold leading-tight">{type.title}</span>
          <div className="flex items-center gap-1 mt-auto">
            <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6"  r="1.5"/><circle cx="15" cy="6"  r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
            </svg>
            <span className="text-[10px] opacity-70 font-medium">{formatDuration(duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrainingTypesPanel({ types, onUpdate, onLibDragStart, onLibDragEnd, weekEvents = [] }) {
  const [form, setForm]       = useState({ title: '', color: PRESET_COLORS[0], duration_minutes: 120 });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [groupNames, setGroupNames] = useState(() => readStore(GROUP_NAMES_KEY, {}));
  const [collapsed, setCollapsed]   = useState(() => readStore(COLLAPSED_KEY, {}));

  // Titres présents plusieurs fois (après normalisation) → doublons possibles
  const duplicateKeys = useMemo(() => {
    const counts = {};
    types.forEach(t => { const k = normalizeTitle(t.title); counts[k] = (counts[k] || 0) + 1; });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [types]);

  // Filtre par recherche puis regroupe par couleur, tri alphabétique dans chaque groupe
  const groups = useMemo(() => {
    const q = normalizeTitle(search);
    const filtered = q ? types.filter(t => normalizeTitle(t.title).includes(q)) : types;
    const byColor = {};
    filtered.forEach(t => { (byColor[t.color] ||= []).push(t); });
    const order = c => { const i = PRESET_COLORS.indexOf(c); return i === -1 ? 99 : i; };
    return Object.keys(byColor)
      .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
      .map(color => ({
        color,
        items: byColor[color].sort((a, b) => a.title.localeCompare(b.title, 'fr')),
      }));
  }, [types, search]);

  function groupName(color) {
    return groupNames[color] || DEFAULT_GROUP_NAMES[color] || 'Autres';
  }

  function renameGroup(color) {
    const name = prompt('Nom de ce groupe (ex : Technique, Physique, Récup, Vie quotidienne) :', groupName(color));
    if (name === null) return;
    const next = { ...groupNames, [color]: name.trim() };
    if (!name.trim()) delete next[color];
    setGroupNames(next);
    writeStore(GROUP_NAMES_KEY, next);
  }

  function toggleGroup(color) {
    const next = { ...collapsed, [color]: !collapsed[color] };
    setCollapsed(next);
    writeStore(COLLAPSED_KEY, next);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      if (editing) {
        await api.put(`/training-types/${editing.id}`, form);
        setEditing(null);
      } else {
        await api.post('/training-types', form);
      }
      setForm({ title: '', color: PRESET_COLORS[0], duration_minutes: 120 });
      await onUpdate(); // ← await : attend que la liste soit rechargée avant de finir
    } finally {
      setLoading(false);
    }
  }

  function startEdit(type) {
    setEditing(type);
    setForm({ title: type.title, color: type.color, duration_minutes: type.duration_minutes || 120 });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ title: '', color: PRESET_COLORS[0], duration_minutes: 120 });
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce type d\'entraînement ?')) return;
    await api.delete(`/training-types/${id}`);
    await onUpdate();
  }

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Bibliothèque ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ── Évènements de la saison qui ont lieu cette semaine ── */}
        {weekEvents.length > 0 && (
          <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex flex-col gap-2">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Cette semaine</p>
            {weekEvents.map(ev => (
              <div
                key={ev.id}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/x-library', JSON.stringify({
                    season_event_id: ev.id,
                    duration_minutes: 120,
                  }));
                  e.dataTransfer.effectAllowed = 'copy';
                  onLibDragStart?.({ id: `event_${ev.id}`, title: ev.title, color: ev.color, duration_minutes: 120 });
                }}
                onDragEnd={() => onLibDragEnd?.()}
                title="Glisser sur le planning"
                className="rounded-lg px-2.5 py-2 cursor-grab active:cursor-grabbing select-none shadow-sm flex flex-col gap-0.5"
                style={{ backgroundColor: ev.color, color: textOn(ev.color) }}
              >
                <span className="text-xs font-bold leading-tight">{ev.title}</span>
                <span className="text-[10px] font-medium">{KIND_LABEL[ev.kind]} · {formatRange(ev)}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Bibliothèque · glisser sur le planning
        </p>

        {types.length === 0 && (
          <p className="text-xs text-gray-400 italic">Créez un premier type ci-dessous.</p>
        )}

        {types.length > 0 && (
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Rechercher une situation…"
            className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {search && groups.length === 0 && (
          <p className="text-xs text-gray-400 italic">Aucune situation ne correspond.</p>
        )}

        <div className="flex flex-col gap-2">
          {groups.map(({ color, items }) => {
            const isOpen = search ? true : !collapsed[color];
            return (
              <div key={color}>
                <div className="flex items-center gap-1.5 mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(color)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                    title={isOpen ? 'Replier' : 'Déplier'}
                  >
                    <span className="text-[10px] text-gray-400 w-3">{isOpen ? '▾' : '▸'}</span>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold text-gray-700 truncate">{groupName(color)}</span>
                    <span className="text-[10px] text-gray-400">{items.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => renameGroup(color)}
                    className="text-[11px] text-gray-400 hover:text-gray-700 px-1"
                    title="Renommer ce groupe"
                  >✎</button>
                </div>
                {isOpen && (
                  <div className="flex flex-col gap-1">
                    {items.map(t => (
                      <LibraryBlock
                        key={t.id}
                        type={t}
                        isDuplicate={duplicateKeys.has(normalizeTitle(t.title))}
                        onEdit={startEdit}
                        onDelete={handleDelete}
                        onLibDragStart={onLibDragStart}
                        onLibDragEnd={onLibDragEnd}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Formulaire ── */}
      <div className="border-t border-gray-200 pt-3 shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          {editing ? `Modifier — ${editing.title}` : 'Nouvelle situation'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            placeholder="Nom de la situation…"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={form.duration_minutes}
            onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
            className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DURATION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className="w-6 h-6 rounded-full border-2 transition"
                style={{ backgroundColor: c, borderColor: form.color === c ? '#1d4ed8' : 'transparent' }}
              />
            ))}
          </div>

          {/* Aperçu */}
          {form.title && (
            <div
              className="w-full rounded-lg px-2.5 py-1.5 text-white text-xs font-bold truncate"
              style={{ backgroundColor: form.color }}
            >
              {form.title} · {formatDuration(form.duration_minutes)}
            </div>
          )}

          <div className="flex gap-2">
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="flex-1 text-sm border border-gray-300 text-gray-600 hover:text-gray-800 rounded-lg py-1.5"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !form.title.trim()}
              className="flex-1 text-sm bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-1.5 font-medium disabled:opacity-50"
            >
              {loading ? '…' : editing ? 'Enregistrer' : '+ Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
