import { useState, useEffect } from 'react';
import { format, subWeeks, startOfISOWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../api/client.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

// weeks: nombre de semaines en arrière depuis aujourd'hui
// weeks: null  → tout l'historique
// weeks: 'planning' → semaine affichée dans le planning (passée via prop)
const PERIODS = [
  { label: 'Sem. affichée', weeks: 'planning' },
  { label: 'Cette sem.',    weeks: 0           },
  { label: '4 sem.',        weeks: 4           },
  { label: '3 mois',        weeks: 13          },
  { label: '6 mois',        weeks: 26          },
  { label: 'Tout',          weeks: null        },
];

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function formatHours(minutes) {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// ── Donut SVG (aucune dépendance externe) ─────────────────────────────────────

function DonutChart({ data, totalMinutes }) {
  const R = 56;
  const SW = 26; // stroke-width
  const SIZE = 160;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const circumference = 2 * Math.PI * R;

  let cumulative = 0;
  const segments = data.map(d => {
    const arc = totalMinutes > 0 ? (d.minutes / totalMinutes) * circumference : 0;
    const seg = { ...d, arc, offset: cumulative };
    cumulative += arc;
    return seg;
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {/* Donut */}
      <div className="shrink-0">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Piste grise */}
          <circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={SW}
          />
          {/* Segments */}
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={SW}
              strokeDasharray={`${seg.arc} ${circumference}`}
              strokeDashoffset={circumference * 0.25 - seg.offset}
              strokeLinecap="butt"
            />
          ))}
          {/* Centre */}
          <text x={cx} y={cy - 7} textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="system-ui">
            Total
          </text>
          <text x={cx} y={cy + 9} textAnchor="middle" fontSize="15" fill="#111827" fontWeight="700" fontFamily="system-ui">
            {formatHours(totalMinutes)}
          </text>
        </svg>
      </div>

      {/* Légende */}
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        {data.map((d, i) => {
          const pct = totalMinutes > 0 ? Math.round((d.minutes / totalMinutes) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2 min-w-0">
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700 truncate">{d.title}</span>
                  <span className="text-[10px] text-gray-400 shrink-0 font-medium">{pct}%</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  {formatHours(d.minutes)} · {d.sessions} séance{d.sessions > 1 ? 's' : ''}
                </div>
                {/* Mini barre de progression */}
                <div className="mt-0.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Barres hebdomadaires ───────────────────────────────────────────────────────

function WeeklyBars({ data }) {
  if (data.length === 0) return <p className="text-xs text-gray-400 italic">Aucune donnée</p>;

  const max = Math.max(...data.map(d => d.minutes), 1);
  // N'affiche pas plus de 26 semaines (pour lisibilité)
  const visible = data.slice(-26);

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-0.5" style={{ height: '80px' }}>
        {visible.map((d, i) => {
          const pct = (d.minutes / max) * 100;
          return (
            <div key={i} className="flex flex-col items-center justify-end flex-1 h-full group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                {format(parseISO(d.week_start), 'd MMM', { locale: fr })} — {formatHours(d.minutes)}
              </div>
              <div
                className="w-full rounded-t-sm bg-blue-500 hover:bg-blue-400 transition-colors"
                style={{ height: `${pct}%`, minHeight: d.minutes > 0 ? '3px' : '0' }}
              />
            </div>
          );
        })}
      </div>
      {/* Étiquettes : seulement 1 sur 4 pour éviter le chevauchement */}
      <div className="flex items-start gap-0.5">
        {visible.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            {i % 4 === 0 && (
              <span className="text-[8px] text-gray-400">
                {format(parseISO(d.week_start), 'd/M', { locale: fr })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Barres jours de semaine ────────────────────────────────────────────────────

function DayBars({ data }) {
  const max = Math.max(...data.map(d => d.minutes), 1);
  return (
    <div className="flex items-end gap-2" style={{ height: '80px' }}>
      {data.map((d, i) => {
        const pct = (d.minutes / max) * 100;
        const isTop = d.minutes === max && max > 0;
        return (
          <div key={i} className="flex flex-col items-center justify-end flex-1 h-full group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
              {DAYS_FR[i]} — {formatHours(d.minutes)}
            </div>
            <div
              className={`w-full rounded-t-sm transition-colors ${isTop ? 'bg-indigo-500' : 'bg-indigo-300 hover:bg-indigo-400'}`}
              style={{ height: `${pct}%`, minHeight: d.minutes > 0 ? '3px' : '0' }}
            />
            <span className={`text-[9px] mt-1 font-medium ${isTop ? 'text-indigo-600' : 'text-gray-400'}`}>
              {DAYS_FR[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Carte KPI ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${accent ? 'border-blue-200' : 'border-gray-200'}`}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-blue-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function ArcherStats({ archer, weekStart }) {
  const [period, setPeriod]   = useState(2); // 4 sem. par défaut
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!archer) return;
    setLoading(true);
    setStats(null);
    const { weeks } = PERIODS[period];

    let params = '';
    if (weeks === 'planning') {
      // Exactement la semaine affichée dans le planning
      params = `?from=${weekStart}&to=${weekStart}`;
    } else if (weeks !== null) {
      params = `?from=${format(startOfISOWeek(subWeeks(new Date(), weeks)), 'yyyy-MM-dd')}`;
    }

    api.get(`/stats/${archer.id}${params}`)
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [archer, period, weekStart]);

  if (!archer) return null;

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center space-y-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Calcul des statistiques…</p>
        </div>
      </div>
    );
  }

  const avgSession = stats.totalSessions > 0
    ? Math.round(stats.totalMinutes / stats.totalSessions)
    : 0;
  const topType    = stats.byType[0];
  const activeDays = stats.byDay.filter(d => d.minutes > 0).length;

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* En-tête + sélecteur de période */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800">Statistiques — {archer.name}</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map((p, i) => (
            <button
              key={i}
              onClick={() => setPeriod(i)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                period === i
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Heures totales"
          value={formatHours(stats.totalMinutes)}
          sub={`${stats.totalSessions} séance${stats.totalSessions > 1 ? 's' : ''}`}
          accent
        />
        <KpiCard
          label="Durée moyenne"
          value={formatHours(avgSession)}
          sub="par séance"
        />
        <KpiCard
          label="Séances / sem."
          value={stats.avgSessionsPerWeek}
          sub="en moyenne"
        />
        <KpiCard
          label="Jours actifs"
          value={`${activeDays}/6`}
          sub={topType ? `Surtout : ${topType.title}` : 'aucune séance'}
        />
      </div>

      {/* Donut + Jours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
            Répartition par type d'entraînement
          </p>
          {stats.byType.length === 0
            ? <p className="text-xs text-gray-400 italic">Aucune séance enregistrée</p>
            : <DonutChart data={stats.byType} totalMinutes={stats.totalMinutes} />
          }
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
            Volume par jour de semaine
          </p>
          {stats.byDay.every(d => d.minutes === 0)
            ? <p className="text-xs text-gray-400 italic">Aucune donnée</p>
            : <DayBars data={stats.byDay} />
          }
        </div>
      </div>

      {/* Volume hebdomadaire */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Volume hebdomadaire
          </p>
          {stats.byWeek.length > 0 && (
            <span className="text-[11px] text-gray-400">
              {stats.byWeek.length} semaine{stats.byWeek.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {stats.byWeek.length === 0
          ? <p className="text-xs text-gray-400 italic">Aucune donnée pour cette période</p>
          : <WeeklyBars data={stats.byWeek} />
        }
      </div>

      {/* Tableau détaillé par type */}
      {stats.byType.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Détail par type
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="text-left px-5 py-2 font-semibold">Type</th>
                <th className="text-right px-5 py-2 font-semibold">Séances</th>
                <th className="text-right px-5 py-2 font-semibold">Total</th>
                <th className="text-right px-5 py-2 font-semibold">Moy. / séance</th>
                <th className="text-right px-5 py-2 font-semibold">Part</th>
              </tr>
            </thead>
            <tbody>
              {stats.byType.map((t, i) => {
                const pct = stats.totalMinutes > 0
                  ? Math.round((t.minutes / stats.totalMinutes) * 100)
                  : 0;
                const avg = t.sessions > 0 ? Math.round(t.minutes / t.sessions) : 0;
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="font-medium text-gray-800">{t.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right text-gray-600 tabular-nums">{t.sessions}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-gray-800 tabular-nums">{formatHours(t.minutes)}</td>
                    <td className="px-5 py-2.5 text-right text-gray-500 tabular-nums">{formatHours(avg)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: t.color }} />
                        </div>
                        <span className="text-[11px] text-gray-400 tabular-nums w-7 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
