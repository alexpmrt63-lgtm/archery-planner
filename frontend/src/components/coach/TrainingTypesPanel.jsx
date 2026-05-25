import { useState } from 'react';
import api from '../../api/client.js';

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

const DURATION_OPTIONS = [
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

const PX_PER_HOUR = 32; // hauteur visuelle par heure dans la bibliothèque

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function LibraryBlock({ type, onEdit, onDelete, onLibDragStart, onLibDragEnd }) {
  const duration = type.duration_minutes || 120;
  const height   = Math.max(Math.round((duration / 60) * PX_PER_HOUR), 40);

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
      className="relative rounded-lg cursor-grab active:cursor-grabbing text-white px-2.5 py-2 flex flex-col justify-between select-none group shadow-sm transition-opacity hover:opacity-90"
      style={{ backgroundColor: type.color, height: `${height}px` }}
    >
      {/* Icône drag */}
      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={e => { e.stopPropagation(); onEdit(type); }}
          className="text-white/80 hover:text-white text-[11px] w-4 h-4 flex items-center justify-center rounded bg-black/20 hover:bg-black/40"
          title="Modifier"
        >✎</button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(type.id); }}
          className="text-white/80 hover:text-white text-[11px] w-4 h-4 flex items-center justify-center rounded bg-black/20 hover:bg-black/40"
          title="Supprimer"
        >✕</button>
      </div>

      <span className="text-xs font-bold leading-tight pr-10 truncate">{type.title}</span>

      <div className="flex items-center gap-1 mt-auto pt-1">
        {/* Icône de drag */}
        <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6"  r="1.5"/><circle cx="15" cy="6"  r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
        <span className="text-[10px] opacity-70 font-medium">{formatDuration(duration)}</span>
      </div>
    </div>
  );
}

export default function TrainingTypesPanel({ types, onUpdate, onLibDragStart, onLibDragEnd }) {
  const [form, setForm]     = useState({ title: '', color: PRESET_COLORS[0], duration_minutes: 120 });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

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
      onUpdate();
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
    onUpdate();
  }

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Bibliothèque ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Bibliothèque · glisser sur le planning
        </p>

        {types.length === 0 && (
          <p className="text-xs text-gray-400 italic">Créez un premier type ci-dessous.</p>
        )}

        <div className="space-y-2">
          {types.map(t => (
            <LibraryBlock
              key={t.id}
              type={t}
              onEdit={startEdit}
              onDelete={handleDelete}
              onLibDragStart={onLibDragStart}
              onLibDragEnd={onLibDragEnd}
            />
          ))}
        </div>
      </div>

      {/* ── Formulaire ── */}
      <div className="border-t border-gray-200 pt-3 shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          {editing ? `Modifier — ${editing.title}` : 'Nouveau type'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            placeholder="Nom du type…"
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

          {/* Aperçu du bloc */}
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
