import { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfISOWeek, parseISO, addWeeks, subWeeks } from 'date-fns';
import api from '../../api/client.js';
import { useAuthContext } from '../../context/AuthContext.jsx';
import WeeklyPlanner from '../shared/WeeklyPlanner.jsx';
import WeekPicker from '../shared/WeekPicker.jsx';
import TrainingTypesPanel from './TrainingTypesPanel.jsx';
import AddTrainingModal from './AddTrainingModal.jsx';
import EditTrainingModal from './EditTrainingModal.jsx';
import ArcherStats from './ArcherStats.jsx';
import ArcherMessages from './ArcherMessages.jsx';
import SessionDetailModal from './SessionDetailModal.jsx';
import SharePlanningModal from './SharePlanningModal.jsx';
import WelcomeScreen from '../shared/WelcomeScreen.jsx';
import GroupChat from '../shared/GroupChat.jsx';
import { usePushSubscription } from '../../hooks/usePushSubscription.js';
import NotificationBanner from '../shared/NotificationBanner.jsx';

export default function CoachDashboard() {
  const { user, logout } = useAuthContext();
  const { needsPrompt, enableNotifications, dismissBanner } = usePushSubscription();
  const [archers, setArchers]               = useState([]);
  const [selectedArcher, setSelectedArcher] = useState(null);
  const [weekStart, setWeekStart]           = useState(format(startOfISOWeek(new Date()), 'yyyy-MM-dd'));
  const [coursSlots, setCoursSlots]         = useState([]);
  const [trainingSessions, setTrainingSessions] = useState([]);
  const [trainingTypes, setTrainingTypes]   = useState([]);
  const [addModal, setAddModal]             = useState(null);
  const [editModal, setEditModal]           = useState(null); // session en cours d'édition
  const [activeTab, setActiveTab]           = useState('planning'); // 'planning' | 'stats' | 'messages'
  const [viewModal, setViewModal]           = useState(null); // session à afficher en détail
  const [shareOpen, setShareOpen]           = useState(false); // modal partage planning
  const [libDrag, setLibDrag]               = useState(null); // bloc bibliothèque en cours de drag
  const [sidebarOpen, setSidebarOpen]       = useState(true);
  const [loading, setLoading]               = useState(false);
  const [archerComment, setArcherComment]   = useState(null); // commentaire archer pour la semaine affichée

  // Cache { key: { cours, training, ts } } — données valides 15 secondes
  const CACHE_TTL = 15_000;
  const cache = useRef({});
  const intervalRef = useRef(null);
  const activeKeyRef = useRef(null); // empêche les réponses tardives d'écraser la vue courante

  // ── Notification "planning terminé" ──────────────────────────────────────
  useEffect(() => {
    api.get('/archers').then(r => setArchers(r.data));
    api.get('/training-types').then(r => setTrainingTypes(r.data));
  }, []);

  function markPlanningChanged() {}

  // Recale sur la semaine courante si la page reste ouverte de nuit
  useEffect(() => {
    function checkWeekRollover() {
      const currentMonday = format(startOfISOWeek(new Date()), 'yyyy-MM-dd');
      setWeekStart(prev => prev < currentMonday ? currentMonday : prev);
    }
    window.addEventListener('focus', checkWeekRollover);
    return () => window.removeEventListener('focus', checkWeekRollover);
  }, []);

  const loadWeekData = useCallback(async (archer, week, showLoader = true) => {
    if (!archer) return;
    const key = `${archer.id}_${week}`;

    // activeKeyRef ne se met à jour que pour les chargements principaux (avec loader)
    // → le prefetch ne l'écrase pas et ne bloque pas le setLoading(false)
    if (showLoader) activeKeyRef.current = key;

    // Cache valide → affichage instantané, pas de requête réseau
    const cached = cache.current[key];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (activeKeyRef.current === key) {
        setCoursSlots(cached.cours);
        setTrainingSessions(cached.training);
      }
      return;
    }

    // Cache absent ou expiré → charge depuis le serveur
    if (showLoader) setLoading(true);
    try {
      const [coursRes, trainingRes] = await Promise.all([
        api.get(`/schedule/${archer.id}/${week}`),
        api.get(`/planning/${archer.id}/${week}`),
      ]);

      const data = { cours: coursRes.data, training: trainingRes.data, ts: Date.now() };
      cache.current[key] = data;

      // N'affiche que si c'est bien la semaine actuellement visible
      if (activeKeyRef.current === key) {
        setCoursSlots(data.cours);
        setTrainingSessions(data.training);
      }
    } finally {
      // Arrête toujours le spinner dès que le chargement principal est terminé
      if (showLoader) setLoading(false);
    }
  }, []);

  // Précharge les semaines adjacentes (navigation instantanée)
  const prefetchAdjacentWeeks = useCallback((archer, week) => {
    const d = parseISO(week);
    [subWeeks(d, 1), addWeeks(d, 1)].forEach(adj => {
      loadWeekData(archer, format(adj, 'yyyy-MM-dd'), false);
    });
  }, [loadWeekData]);

  // Chargement à chaque changement d'archer ou de semaine
  useEffect(() => {
    loadWeekData(selectedArcher, weekStart).then(() => {
      prefetchAdjacentWeeks(selectedArcher, weekStart);
    });
  }, [selectedArcher, weekStart, loadWeekData, prefetchAdjacentWeeks]);

  // Charge le commentaire de l'archer pour la semaine affichée
  useEffect(() => {
    setArcherComment(null);
    if (!selectedArcher) return;
    api.get(`/comments/${selectedArcher.id}/${weekStart}`)
      .then(r => setArcherComment(r.data.comment || null))
      .catch(() => setArcherComment(null));
  }, [selectedArcher, weekStart]);

  // Refs stables pour les timers
  const selectedArcherRef = useRef(selectedArcher);
  const weekStartRef = useRef(weekStart);
  useEffect(() => { selectedArcherRef.current = selectedArcher; }, [selectedArcher]);
  useEffect(() => { weekStartRef.current = weekStart; }, [weekStart]);

  // Auto-refresh toutes les 15s : expire le cache de la semaine affichée et recharge
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const archer = selectedArcherRef.current;
      const week   = weekStartRef.current;
      if (archer) delete cache.current[`${archer.id}_${week}`];
      loadWeekData(archer, week, false);
    }, 15_000);
    return () => clearInterval(intervalRef.current);
  }, [loadWeekData]);

  // Refresh immédiat au retour sur l'onglet
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      const archer = selectedArcherRef.current;
      const week   = weekStartRef.current;
      if (archer) delete cache.current[`${archer.id}_${week}`];
      loadWeekData(archer, week, false);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadWeekData]);

  function invalidateCache(archer, week) {
    delete cache.current[`${archer.id}_${week}`];
  }

  // -- Ajout optimiste --
  async function confirmAddTraining(form) {
    const tempId = `temp_${Date.now()}`;
    const type = trainingTypes.find(t => t.id === form.training_type_id);
    const optimistic = {
      id: tempId,
      archer_id: selectedArcher.id,
      week_start: weekStart,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      training_type_id: form.training_type_id,
      notes: form.notes,
      training_type: type ? { title: type.title, color: type.color } : null,
    };

    // Mise à jour immédiate de l'UI
    markPlanningChanged();
    setTrainingSessions(prev => [...prev, optimistic]);
    setAddModal(null);

    try {
      const { data } = await api.post('/planning', {
        ...form,
        archer_id: selectedArcher.id,
        week_start: weekStart,
      });
      // Remplace le temporaire par la vraie donnée
      setTrainingSessions(prev => prev.map(s => s.id === tempId ? data : s));
      invalidateCache(selectedArcher, weekStart);
    } catch {
      // Annule si erreur
      setTrainingSessions(prev => prev.filter(s => s.id !== tempId));
    }
  }

  // -- Suppression optimiste --
  async function handleDeleteTraining(sessionId) {
    // Suppression immédiate de l'UI, sans rollback
    markPlanningChanged();
    setTrainingSessions(prev => prev.filter(s => s.id !== sessionId));
    invalidateCache(selectedArcher, weekStart);
    // On ignore les erreurs serveur — l'UI reste cohérente
    api.delete(`/planning/${sessionId}`).catch(console.error);
  }

  // -- Dépôt depuis la bibliothèque (sans modale) --
  async function handleDropFromLibrary({ day, startTime, endTime, training_type_id }) {
    markPlanningChanged();
    const tempId = `temp_${Date.now()}`;
    const type   = trainingTypes.find(t => t.id === training_type_id);
    const optimistic = {
      id: tempId,
      archer_id: selectedArcher.id,
      week_start: weekStart,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      training_type_id,
      notes: '',
      training_type: type ? { title: type.title, color: type.color } : null,
    };
    setTrainingSessions(prev => [...prev, optimistic]);
    try {
      const { data } = await api.post('/planning', {
        archer_id: selectedArcher.id,
        week_start: weekStart,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        training_type_id,
        notes: '',
      });
      setTrainingSessions(prev => prev.map(s => s.id === tempId ? data : s));
      invalidateCache(selectedArcher, weekStart);
    } catch {
      setTrainingSessions(prev => prev.filter(s => s.id !== tempId));
    }
  }

  // -- Édition optimiste --
  async function handleEditTraining(sessionId, form) {
    markPlanningChanged();
    const backup = trainingSessions.find(s => s.id === sessionId);
    const type   = trainingTypes.find(t => t.id === form.training_type_id);
    const optimistic = {
      ...backup,
      ...form,
      training_type: type ? { title: type.title, color: type.color } : backup?.training_type,
    };
    setTrainingSessions(prev => prev.map(s => s.id === sessionId ? optimistic : s));
    setEditModal(null);
    invalidateCache(selectedArcher, weekStart);
    try {
      const { data } = await api.put(`/planning/${sessionId}`, form);
      setTrainingSessions(prev => prev.map(s => s.id === sessionId ? data : s));
    } catch {
      setTrainingSessions(prev => prev.map(s => s.id === sessionId ? backup : s));
    }
  }

  // -- Déplacement optimiste --
  async function handleMoveTraining(sessionId, updates) {
    markPlanningChanged();
    const backup = trainingSessions.find(s => s.id === sessionId);
    setTrainingSessions(prev =>
      prev.map(s => s.id === sessionId ? { ...s, ...updates } : s)
    );
    invalidateCache(selectedArcher, weekStart);
    try {
      const { data } = await api.put(`/planning/${sessionId}`, updates);
      setTrainingSessions(prev => prev.map(s => s.id === sessionId ? data : s));
    } catch {
      setTrainingSessions(prev => prev.map(s => s.id === sessionId ? backup : s));
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`flex flex-col bg-blue-900 text-white transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-14'} shrink-0`}>
        <div className="flex items-center justify-between p-4 border-b border-blue-800">
          {sidebarOpen && (
            <div className="w-[88px] h-[88px] rounded-full bg-white shadow-md overflow-hidden flex items-center justify-center shrink-0">
              <img
                src="/pole-logo.jpeg"
                alt="Pôle France Relève"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1 rounded hover:bg-blue-800 text-blue-300 hover:text-white ml-auto"
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        {sidebarOpen && (
          <div className="flex-1 overflow-y-auto py-3">
            <p className="text-xs text-blue-400 px-4 mb-2 uppercase tracking-wider font-semibold">Effectif</p>
            {archers.map(archer => (
              <button
                key={archer.id}
                onClick={() => {
                  setSelectedArcher(archer);
                  setActiveTab('planning');
                  // Recentre toujours sur la semaine courante au changement d'archer
                  setWeekStart(format(startOfISOWeek(new Date()), 'yyyy-MM-dd'));
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2 ${
                  selectedArcher?.id === archer.id
                    ? 'bg-blue-700 text-white font-semibold'
                    : 'text-blue-100 hover:bg-blue-800'
                }`}
              >
                <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {archer.name.charAt(0).toUpperCase()}
                </span>
                {archer.name}
              </button>
            ))}
            {archers.length === 0 && <p className="text-xs text-blue-400 px-4">Aucun archer inscrit</p>}
          </div>
        )}

        <div className="p-4 border-t border-blue-800 space-y-2">
          {sidebarOpen && <div className="text-xs text-blue-300 truncate">{user?.name}</div>}
          {/* Chat de groupe */}
          <button
            onClick={() => setActiveTab('groupe')}
            className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition ${
              activeTab === 'groupe'
                ? 'bg-blue-700 text-white font-semibold'
                : 'text-blue-400 hover:text-white hover:bg-blue-800'
            }`}
          >
            <span className="text-base leading-none shrink-0">👥</span>
            {sidebarOpen && 'Chat de groupe'}
          </button>
          <button onClick={logout} className="text-xs text-blue-400 hover:text-white transition block">
            {sidebarOpen ? 'Se déconnecter' : '⎋'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedArcher
              ? <h1 className="font-bold text-gray-900">{selectedArcher.name}</h1>
              : <h1 className="font-bold text-gray-400">Sélectionnez un archer</h1>
            }
            {loading && (
              <svg className="animate-spin w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
          </div>
          {selectedArcher && activeTab === 'planning' && (
            <div className="flex items-center gap-2">
              <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
              <button
                onClick={() => setShareOpen(true)}
                disabled={trainingSessions.length === 0}
                title="Partager ce planning avec d'autres archers"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Partager
              </button>
              <button
                onClick={() => {
                  if (selectedArcher) delete cache.current[`${selectedArcher.id}_${weekStart}`];
                  loadWeekData(selectedArcher, weekStart, true);
                }}
                title="Rafraîchir"
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'groupe' ? (
            /* ── Chat de groupe (indépendant de l'archer sélectionné) ── */
            <div className="flex-1 overflow-hidden">
              <GroupChat currentUser={user} />
            </div>
          ) : selectedArcher ? (
            <>
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Onglets */}
                <div className="flex gap-0 border-b border-gray-200 bg-white px-6 shrink-0">
                  {[
                    { id: 'planning',  label: 'Planning',      icon: '📅' },
                    { id: 'stats',     label: 'Statistiques',  icon: '📊' },
                    { id: 'messages',  label: 'Messages',       icon: '💬' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Contenu de l'onglet actif */}
                {activeTab === 'planning' && (
                  <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6">
                      {/* Commentaire de l'archer pour cette semaine */}
                      {archerComment && (
                        <div className="mb-4 flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                          <span className="text-lg shrink-0">💬</span>
                          <div>
                            <p className="text-xs font-semibold text-amber-700 mb-0.5">
                              Message de {selectedArcher.name}
                            </p>
                            <p className="text-sm text-amber-800">{archerComment}</p>
                          </div>
                        </div>
                      )}
                      <WeeklyPlanner
                        weekStart={weekStart}
                        coursSlots={coursSlots}
                        trainingSessions={trainingSessions}
                        readOnly={false}
                        onAddTraining={pos => setAddModal(pos)}
                        onDeleteTraining={handleDeleteTraining}
                        onMoveTraining={handleMoveTraining}
                        onDropFromLibrary={handleDropFromLibrary}
                        onEditTraining={session => setEditModal(session)}
                        onViewSession={session => setViewModal(session)}
                        libDrag={libDrag}
                      />
                    </div>
                    <div className="w-72 shrink-0 border-l border-gray-200 flex flex-col overflow-hidden p-4 bg-gray-50">
                      <TrainingTypesPanel
                        types={trainingTypes}
                        onUpdate={() => api.get('/training-types').then(r => setTrainingTypes(r.data))}
                        onLibDragStart={type => setLibDrag(type)}
                        onLibDragEnd={() => setLibDrag(null)}
                      />
                    </div>
                  </div>
                )}
                {activeTab === 'stats' && (
                  <div className="flex-1 overflow-y-auto bg-gray-50">
                    <ArcherStats archer={selectedArcher} weekStart={weekStart} />
                  </div>
                )}
                {activeTab === 'messages' && (
                  <div className="flex-1 overflow-hidden">
                    <ArcherMessages archer={selectedArcher} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <WelcomeScreen userName={user?.name} role="coach" />
            </div>
          )}
        </div>
      </main>

      {shareOpen && selectedArcher && (
        <SharePlanningModal
          sourceArcher={selectedArcher}
          weekStart={weekStart}
          allArchers={archers}
          onClose={() => setShareOpen(false)}
          onShared={() => {
            // Invalide le cache de tous les archers pour cette semaine
            archers.forEach(a => delete cache.current[`${a.id}_${weekStart}`]);
          }}
        />
      )}

      {viewModal && (
        <SessionDetailModal
          session={viewModal}
          role="coach"
          onClose={() => setViewModal(null)}
          onEdit={session => { setViewModal(null); setEditModal(session); }}
          onDelete={id => { handleDeleteTraining(id); setViewModal(null); }}
          onUpdate={updated => {
            setTrainingSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
            invalidateCache(selectedArcher, weekStart);
          }}
        />
      )}

      {addModal && (
        <AddTrainingModal
          defaultDay={addModal.day}
          defaultStart={addModal.startTime}
          trainingTypes={trainingTypes}
          onConfirm={confirmAddTraining}
          onClose={() => setAddModal(null)}
        />
      )}

      {editModal && (
        <EditTrainingModal
          session={editModal}
          trainingTypes={trainingTypes}
          onSave={handleEditTraining}
          onDelete={id => { handleDeleteTraining(id); setEditModal(null); }}
          onClose={() => setEditModal(null)}
        />
      )}
      {needsPrompt && (
        <NotificationBanner onEnable={enableNotifications} onDismiss={dismissBanner} />
      )}
    </div>
  );
}
