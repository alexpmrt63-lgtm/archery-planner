export default function NotificationBanner({ onEnable, onDismiss }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3">
      <div className="max-w-md mx-auto bg-white border border-blue-200 rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
        <span className="text-2xl shrink-0">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Activer les notifications</p>
          <p className="text-xs text-gray-500">Reçois les messages et rappels d'entraînement.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onDismiss}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            Plus tard
          </button>
          <button
            onClick={onEnable}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            Activer
          </button>
        </div>
      </div>
    </div>
  );
}
