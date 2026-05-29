import { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfISOWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../api/client.js';
import { useAuthContext } from '../../context/AuthContext.jsx';
import WeeklyPlanner from '../shared/WeeklyPlanner.jsx';
import WeekPicker from '../shared/WeekPicker.jsx';
import WelcomeScreen from '../shared/WelcomeScreen.jsx';
import ArcherMessages from '../coach/ArcherMessages.jsx';
import SessionDetailModal from '../coach/SessionDetailModal.jsx';
import { usePushSubscription } from '../../hooks/usePushSubscription.js';

const REFRESH_INTERVAL = 30_000;

function currentMonday() {
  return format(startOfISOWeek(new Date()), 'yyyy-MM-dd');
}

export default function ArcherDashboard() {
  const { user, logout } = useAuthContext();
  usePushSubscription();

  const [weekStart, setWeekStart]             = useState(currentMonday());
  const [uploadWeekStart, setUploadWeekStart] = useState(currentMonday());
  const [coursSlots, setCoursSlots]           = useState([]);
  const [trainingSessions, setTrainingSessions] = useState([]);
  const [uploading, setUploading]             = useState(false);
  const [uploadMsg, setUploadMsg]             = useState('');
  const [uploadedSlots, setUploadedSlots]     = useState([]);
  const [comment, setComment]                 = useState('');
  const [commentSending, setCommentSending]   = useState(false);
  const [commentMsg, setCommentMsg]           = useState('');
  const [tab, setTab]                         = useState('accueil');
  const [viewSession, setViewSession]         = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [lastRefresh, setLastRefresh]         = useState(null);
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

  useEffect(() => { loadData(false); }, [loadData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => loadData(true), REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [loadData]);

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

  useEffect(() => {
    setUploadMsg('');
    setUploadedSlots([]);
    setCommentMsg('');
    setComment('');
  }, [uploadWeekStart]);

  async function handleSendComment() {
    if (!comment.trim()) return;
    setCommentSending(true);
    setCommentMsg('');
    try {
      await api.post('/comments', { week_start: uploadWeekStart, comment: comment.trim() });
      setCommentMsg('✓ Message envoyé au coach !');
      setComment('');
    } catch (err) {
      setCommentMsg('Erreur : ' + (err.response?.data?.error || err.message));
    } finally {
      setCommentSending(false);
    }
  }

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
      form.append('archer_id', user.id);
      const res = await api.post('/schedule/upload', form);
      setUploadedSlots(res.data.slots || []);
      setUploadMsg(`✓ ${res.data.slots.length} créneau(x) détecté(s) pour la semaine du ${format(parseISO(uploadWeekStart), 'd MMMM', { locale: fr })}.`);
      setWeekStart(uploadWeekStart);
      await loadData(false);
      setTimeout(() => setTab('planning'), 1200);
    } catch (err) {
      setUploadMsg('Erreur : ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  // ── Définition des onglets ──────────────────────────────────────────────────
  const TABS = [
    { id: 'accueil',  icon: '🏠', label: 'Accueil',  shortLabel: 'Accueil'  },
    { id: 'planning', icon: '📅', label: 'Planning', shortLabel: 'Planning' },
    { id: 'upload',   icon: '📷', label: 'EDT',      shortLabel: 'EDT'      },
    { id: 'messages', icon: '💬', label: 'Messages', shortLabel: 'Messages' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 shrink-0">

        {/* Logo + nom */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 sm:w-14 sm:h-14 rounded-full bg-white shadow-sm border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
            <img src="/pole-logo.jpeg" alt="Pôle France Relève" className="w-full h-full object-contain" />
          </div>
          <p className="text-xs text-gray-500 border-l border-gray-200 pl-2 truncate hidden xs:block sm:block">
            {user?.name}
          </p>
        </div>

        {/* Droite : refresh + déconnexion */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {tab === 'planning' && (
            <button
              onClick={() => loadData(false)}
              disabled={loading}
              title="Rafraîchir"
              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-40"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1.5 rounded-lg hover:bg-gray-100"
          >
            {/* Icône sur mobile, texte sur desktop */}
            <svg className="w-4 h-4 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      {/* ── Onglets ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 flex shrink-0 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => {
              if (t.id === 'upload') { setUploadMsg(''); setUploadedSlots([]); setCommentMsg(''); }
              setTab(t.id);
            }}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-sm font-medium border-b-2 transition -mb-px whitespace-nowrap ${
              tab === t.id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="text-base sm:text-sm leading-none">{t.icon}</span>
            <span>{t.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* ── Contenu ────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Accueil */}
        {tab === 'accueil' && (
          <div className="flex-1 overflow-y-auto">
            <WelcomeScreen userName={user?.name} role="archer" />
          </div>
        )}

        {/* Planning */}
        {tab === 'planning' && (
          <div className="flex-1 overflow-y-auto px-2 py-3 sm:p-6">

            {/* WeekPicker centré sur mobile, en haut du contenu */}
            <div className="flex justify-center mb-3">
              <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 mb-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                <svg className="animate-spin w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <span className="text-sm text-blue-700 font-medium">Chargement…</span>
              </div>
            )}

            {!loading && coursSlots.length === 0 && trainingSessions.length === 0 && (
              <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                Aucun créneau pour cette semaine. Uploadez votre emploi du temps via l'onglet EDT.
              </div>
            )}

            <WeeklyPlanner
              weekStart={weekStart}
              coursSlots={coursSlots}
              trainingSessions={trainingSessions}
              readOnly={true}
              onViewSession={session => setViewSession(session)}
            />

            {/* Légende */}
            <div className="flex items-center justify-between mt-2 px-0.5">
              <div className="flex gap-3 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-300 inline-block" /> Scolaire</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" /> Entraînement</span>
              </div>
              {lastRefresh && (
                <span className="text-[10px] text-gray-400">
                  {format(lastRefresh, 'HH:mm')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        {tab === 'messages' && (
          <div className="flex-1 overflow-hidden">
            <ArcherMessages archer={user} />
          </div>
        )}

        {/* Upload EDT */}
        {tab === 'upload' && (
          <div className="flex-1 overflow-y-auto px-3 py-4 sm:p-6">
            <div className="max-w-lg mx-auto space-y-3 sm:space-y-4">

              {/* Sélecteur de semaine */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pour quelle semaine ?</p>
                <div className="flex items-center justify-center">
                  <WeekPicker weekStart={uploadWeekStart} onChange={setUploadWeekStart} />
                </div>
              </div>

              {/* Message au coach */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-3">
                <div>
                  <h2 className="font-bold text-gray-900 text-sm sm:text-base mb-0.5">💬 Message au coach</h2>
                  <p className="text-xs sm:text-sm text-gray-500">Contrainte ou remarque pour cette semaine.</p>
                </div>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  disabled={commentSending}
                  rows={3}
                  placeholder="Ex : semaine chargée, cours supplémentaire mercredi…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 transition"
                />
                <button
                  onClick={handleSendComment}
                  disabled={commentSending || !comment.trim()}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {commentSending ? 'Envoi…' : 'Envoyer au coach'}
                </button>
                {commentMsg && (
                  <div className={`text-sm px-3 py-2.5 rounded-xl ${
                    commentMsg.startsWith('✓')
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {commentMsg}
                  </div>
                )}
              </div>

              {/* Upload image */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-3">
                <div>
                  <h2 className="font-bold text-gray-900 text-sm sm:text-base mb-0.5">📷 Importer l'emploi du temps</h2>
                  <p className="text-xs sm:text-sm text-gray-500">Uploadez une capture d'écran. L'IA l'analysera automatiquement.</p>
                </div>
                <label className="block">
                  <div className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition ${
                    uploading ? 'border-blue-300 bg-blue-50 cursor-not-allowed' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30 active:bg-blue-50'
                  }`}>
                    <div className="text-3xl mb-2">{uploading ? '⏳' : '📷'}</div>
                    <p className="text-sm font-medium text-gray-700">{uploading ? 'Analyse en cours…' : 'Appuyez pour choisir une image'}</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — max 8 Mo</p>
                  </div>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} disabled={uploading} />
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
                  <div className={`text-sm px-3 py-2.5 rounded-xl ${
                    uploadMsg.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {uploadMsg}
                  </div>
                )}
                {uploadedSlots.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Créneaux importés ({uploadedSlots.length})</p>
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

      {viewSession && (
        <SessionDetailModal
          session={viewSession}
          role="archer"
          onClose={() => setViewSession(null)}
          onUpdate={updated => {
            setTrainingSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
            setViewSession(null);
          }}
        />
      )}
    </div>
  );
}
