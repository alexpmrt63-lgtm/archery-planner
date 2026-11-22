import { useState } from 'react';
import { format, startOfISOWeek } from 'date-fns';
import WeekPicker from '../shared/WeekPicker.jsx';
import MobileDayView from '../shared/MobileDayView.jsx';
import ArcherStats from './ArcherStats.jsx';
import ArcherMessages from './ArcherMessages.jsx';
import GroupChat from '../shared/GroupChat.jsx';
import WelcomeScreen from '../shared/WelcomeScreen.jsx';
import MobileAddSheet from './MobileAddSheet.jsx';

// Vue coach sur téléphone uniquement (moins de 768 px).
// Reprend les couleurs et composants de la version ordinateur ;
// toutes les données et actions viennent de CoachDashboard.

const TABS = [
  { id: 'planning', label: 'Planning',     icon: '📅' },
  { id: 'stats',    label: 'Statistiques', icon: '📊' },
  { id: 'messages', label: 'Messages',     icon: '💬' },
];

export default function CoachMobile({
  user, logout,
  archers, selectedArcher, setSelectedArcher,
  weekStart, setWeekStart,
  coursSlots, trainingSessions, trainingTypes,
  activeTab, setActiveTab,
  loading, archerComment,
  onAddTraining, onViewSession, onShare,
}) {
  const [day, setDay] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  function openArcher(archer) {
    setSelectedArcher(archer);
    setActiveTab('planning');
    setWeekStart(format(startOfISOWeek(new Date()), 'yyyy-MM-dd'));
  }

  function backToList() {
    setSelectedArcher(null);
    setActiveTab('planning');
  }

  // ── Chat de groupe ─────────────────────────────────────────────────────────
  if (activeTab === 'groupe') {
    return (
      <div className="flex flex-col bg-gray-50" style={{ height: '100dvh' }}>
        <header className="bg-white border-b border-gray-200 px-2 py-2 flex items-center gap-1 shrink-0">
          <button onClick={() => setActiveTab('planning')} aria-label="Retour" className="w-11 h-11 flex items-center justify-center text-2xl text-gray-500">‹</button>
          <h1 className="font-bold text-gray-900">👥 Chat de groupe</h1>
        </header>
        <div className="flex-1 overflow-hidden">
          <GroupChat currentUser={user} />
        </div>
      </div>
    );
  }

  // ── Liste de l'effectif (comme la barre latérale de l'ordinateur) ─────────
  if (!selectedArcher) {
    if (showWelcome) {
      return (
        <div className="flex flex-col bg-gray-50" style={{ height: '100dvh' }}>
          <header className="bg-white border-b border-gray-200 px-2 py-2 flex items-center gap-1 shrink-0">
            <button onClick={() => setShowWelcome(false)} aria-label="Retour" className="w-11 h-11 flex items-center justify-center text-2xl text-gray-500">‹</button>
            <h1 className="font-bold text-gray-900">Accueil</h1>
          </header>
          <div className="flex-1 overflow-y-auto">
            <WelcomeScreen userName={user?.name} role="coach" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col bg-blue-900 text-white" style={{ height: '100dvh' }}>
        <div className="flex items-center gap-4 p-4 border-b border-blue-800 shrink-0">
          <div className="w-16 h-16 rounded-full bg-white shadow-md overflow-hidden flex items-center justify-center shrink-0">
            <img src="/pole-logo.jpeg" alt="Pôle France Relève" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-blue-300">Bonjour,</p>
            <p className="text-lg font-bold truncate">{user?.name}</p>
          </div>
          <button
            onClick={() => setShowWelcome(true)}
            className="ml-auto text-xs text-blue-300 hover:text-white px-2 py-2"
          >
            Citation du jour
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <p className="text-xs text-blue-400 px-4 mb-2 uppercase tracking-wider font-semibold">Effectif</p>
          {archers.map(archer => (
            <button
              key={archer.id}
              onClick={() => openArcher(archer)}
              className="w-full text-left px-4 py-3.5 text-base transition flex items-center gap-3 text-blue-100 active:bg-blue-800"
            >
              <span className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0 text-white">
                {archer.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1">{archer.name}</span>
              <span className="text-blue-400 text-xl">›</span>
            </button>
          ))}
          {archers.length === 0 && <p className="text-xs text-blue-400 px-4">Aucun archer inscrit</p>}
        </div>

        <div className="p-4 border-t border-blue-800 flex items-center justify-between shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => setActiveTab('groupe')}
            className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800"
          >
            <span className="text-base leading-none">👥</span>
            Chat de groupe
          </button>
          <button onClick={logout} className="text-sm text-blue-400 hover:text-white px-2 py-2.5">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // ── Fiche d'un archer ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-gray-50" style={{ height: '100dvh' }}>
      <header className="bg-white border-b border-gray-200 px-2 pt-2 pb-1 shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={backToList} aria-label="Retour à l'effectif" className="w-11 h-11 flex items-center justify-center text-2xl text-gray-500">‹</button>
          <h1 className="font-bold text-gray-900 flex-1 truncate">{selectedArcher.name}</h1>
          {loading && (
            <svg className="animate-spin w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
          {activeTab === 'planning' && (
            <button
              onClick={onShare}
              disabled={trainingSessions.length === 0}
              aria-label="Partager ce planning avec d'autres archers"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-blue-700 disabled:opacity-40"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        {activeTab === 'planning' && (
          <div className="flex justify-center pb-1">
            <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
          </div>
        )}
      </header>

      <div className="flex border-b border-gray-200 bg-white shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'planning' && (
        <div className="flex-1 overflow-y-auto p-4 pb-28 relative">
          {archerComment && (
            <div className="mb-4 flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-lg shrink-0">💬</span>
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-0.5">Message de {selectedArcher.name}</p>
                <p className="text-sm text-amber-800 whitespace-pre-line">{archerComment}</p>
              </div>
            </div>
          )}
          <MobileDayView
            weekStart={weekStart}
            coursSlots={coursSlots}
            trainingSessions={trainingSessions}
            onViewSession={onViewSession}
            onDayChange={setDay}
          />
        </div>
      )}
      {activeTab === 'stats' && (
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <ArcherStats archer={selectedArcher} weekStart={weekStart} />
        </div>
      )}
      <div className={`flex-1 overflow-hidden${activeTab === 'messages' ? '' : ' hidden'}`}>
        <ArcherMessages archer={selectedArcher} />
      </div>

      {activeTab === 'planning' && (
        <button
          onClick={() => setAddOpen(true)}
          className="fixed right-4 z-40 flex items-center gap-2 px-5 h-14 rounded-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold shadow-lg"
          style={{ bottom: 'max(20px, calc(env(safe-area-inset-bottom) + 12px))' }}
        >
          <span className="text-xl leading-none">+</span>
          Ajouter
        </button>
      )}

      {addOpen && (
        <MobileAddSheet
          defaultDay={day}
          trainingTypes={trainingTypes}
          onConfirm={form => { onAddTraining(form); setAddOpen(false); }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
