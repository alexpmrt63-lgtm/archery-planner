import { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfISOWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../api/client.js';
import { useAuthContext } from '../../context/AuthContext.jsx';
import WeeklyPlanner from '../shared/WeeklyPlanner.jsx';
import WeekPicker from '../shared/WeekPicker.jsx';
import WelcomeScreen from '../shared/WelcomeScreen.jsx';
import { usePushSubscription } from '../../hooks/usePushSubscription.js';

const REFRESH_INTERVAL = 30_000; // 30 secondes

function currentMonday() {
  return format(startOfISOWeek(new Date()), 'yyyy-MM-dd');
}

export default function ArcherDashboard() {
  const { user, logout } = useAuthContext();
  usePushSubscription(); // abonnement aux notifications push
  const [weekStart, setWeekStart]               = useState(currentMonday());
  const [uploadWeekStart, setUploadWeekStart]   = useState(currentMonday());
  const [coursSlots, setCoursSlots]             = useState([]);
  const [trainingSessions, setTrainingSessions] = useState([]);
  const [uploading, setUploading]               = useState(false);
  const [uploadMsg, setUploadMsg]               = useState('');
  const [uploadedSlots, setUploadedSlots]       = useState([]);
  const [comment, setComment]                   = useState('');
  const [tab, setTab]                           = useState('accueil');
  const [loading, setLoading]                   = useState(false);
  const [lastRefresh, setLastRefresh]           = useState(null);
  const intervalRef = useRef(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [coursRes, trainingRes] = await Promise.all([
        api.get(`/schedule/${user.id}/${weekStart}`),
        api.get(`/planning/${user.id}/${weekStart}`),
      ]);
      setCoursSlots(coursRes.data);
      setTrainingSessions(trainingRes.data);
      setLastRefresh(new Date());
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user.id, weekStart]);

  // Chargement initial + quand la semaine change
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Rafraîchissement automatique toutes les 30s
  useEffect(() => {
    intervalRef.current = setInterval(() => loadData(true), REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [loadData]);

  // Rafraîchissement quand l'archer revient sur l'onglet navigateur
  // + recalage automatique sur la semaine courante si la page reste ouverte de nuit
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        const monday = currentMonday();
        setWeekStart(prev => prev < monday ? monday : prev);
        loadData(true);
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadData]);

  // Réinitialise le message d'upload quand on change de semaine d'upload
  useEffect(() => {
    setUploadMsg('');
    setUploadedSlots([]);
    setComment('');
  }, [uploadWeekStart]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    setUploadedSlots([]);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('week_start', uploadWeekStart);
      form.append('archer_id', user.id); // fallback explicite au cas où le JWT manque
      if (comment.trim()) form.append('comment', comment.trim());
      // Ne pas forcer le Content-Type : le navigateur ajoute automatiquement le boundary
      const res = await api.post('/schedule/upload', form);
      setUploadedSlots(res.data.slots || []);
      setUploadMsg(`✓ ${res.data.slots.length} créneau(x) détecté(s) et importé(s) pour la semaine du ${format(parseISO(uploadWeekStart), 'd MMMM yyyy', { locale: fr })}.`);
      // Bascule sur la semaine uploadée dans le planning
      setWeekStart(uploadWeekStart);
      // Recharge les données et bascule vers le planning après un court délai
      await loadData(false);
      setTimeout(() => setTab('planning'), 1200);
    } catch (err) {
      setUploadMsg('Erreur : ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[56px] h-[56px] rounded-full bg-white shadow-sm border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
            <img
              src="/pole-logo.jpeg"
              alt="Pôle France Relève"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-xs text-gray-500 border-l border-gray-200 pl-3">
            Bonjour, {user?.name}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {tab === 'planning' && (
            <>
              <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
              <button
                onClick={() => loadData(false)}
                disabled={loading}
                title="Rafraîchir"
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-40"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          )}
          <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition">
            Déconnexion
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-0">
        {[
          { id: 'accueil',  label: 'Accueil',                  icon: '🏠' },
          { id: 'planning', label: 'Mon planning',              icon: '📅' },
          { id: 'upload',   label: 'Emploi du temps scolaire',  icon: '📷' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => {
              if (t.id === 'upload') { setUploadMsg(''); setUploadedSlots([]); }
              setTab(t.id);
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'accueil' && (
          <WelcomeScreen userName={user?.name} role="archer" />
        )}

        {tab === 'planning' && (
          <div className="p-6">
            {/* Indicateur de chargement */}
            {loading && (
              <div className="flex items-center justify-center gap-3 mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <svg className="animate-spin w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <span className="text-sm text-blue-700 font-medium">Chargement du planning…</span>
              </div>
            )}

            {/* Aucun créneau */}
            {!loading && coursSlots.length === 0 && trainingSessions.length === 0 && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                Aucun créneau pour cette semaine. Uploadez votre emploi du temps scolaire pour commencer.
              </div>
            )}

            <WeeklyPlanner
              weekStart={weekStart}
              coursSlots={coursSlots}
              trainingSessions={trainingSessions}
              readOnly={true}
            />

            {/* Légende + heure de dernière sync */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-gray-300 inline-block" /> Cours scolaire
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Entraînement
                </span>
              </div>
              {lastRefresh && (
                <span className="text-[11px] text-gray-400">
                  Mis à jour à {format(lastRefresh, 'HH:mm')}
                </span>
              )}
            </div>
          </div>
        )}

        {tab === 'upload' && (
          <div className="p-6">
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
              <div>
                <h2 className="font-bold text-gray-900 mb-0.5">Importer l'emploi du temps</h2>
                <p className="text-sm text-gray-500">
                  Uploadez une capture d'écran de votre emploi du temps scolaire. L'IA l'analysera automatiquement.
                </p>
              </div>

              {/* Sélecteur de semaine dédié */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Pour quelle semaine ?
                </p>
                <div className="flex items-center justify-center">
                  <WeekPicker weekStart={uploadWeekStart} onChange={setUploadWeekStart} />
                </div>
              </div>

              {/* Commentaire / avis de l'archer */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Commentaire pour le coach <span className="font-normal text-gray-400">(optionnel)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  disabled={uploading}
                  rows={3}
                  placeholder="Ex : j'ai cours supplémentaire mercredi, semaine chargée…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 transition"
                />
              </div>

              {/* Zone de dépôt */}
              <label className="block">
                <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                  uploading
                    ? 'border-blue-300 bg-blue-50 cursor-not-allowed'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
                }`}>
                  <div className="text-3xl mb-2">{uploading ? '⏳' : '📷'}</div>
                  <p className="text-sm font-medium text-gray-700">
                    {uploading ? 'Analyse en cours…' : 'Cliquez pour choisir une image'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — max 8 Mo</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>

              {uploading && (
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Claude Vision analyse votre emploi du temps…
                </div>
              )}

              {uploadMsg && (
                <div className={`text-sm px-4 py-3 rounded-lg ${
                  uploadMsg.startsWith('✓')
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {uploadMsg}
                </div>
              )}

              {uploadedSlots.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Créneaux importés ({uploadedSlots.length})
                  </p>
                  <div className="space-y-1">
                    {uploadedSlots.map((s, i) => (
                      <div key={i} className="flex gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                        <span className="font-medium">{['','Lun','Mar','Mer','Jeu','Ven','Sam'][s.day]}</span>
                        <span>{s.start} – {s.end}</span>
                        <span className="text-gray-400 truncate">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </main>
    </div>
  );
}
