import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../api/client.js';

export default function ArcherMessages({ archer, coachName }) {
  const [messages, setMessages]   = useState([]);
  const [content, setContent]     = useState('');
  const [sending, setSending]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!archer) return;
    setLoading(true);
    api.get(`/messages/${archer.id}`)
      .then(r => setMessages(r.data))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [archer]);

  // Scroll auto vers le bas quand nouveaux messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post('/messages', {
        archer_id: archer.id,
        content: content.trim(),
      });
      setMessages(prev => [...prev, data]);
      setContent('');
    } catch (err) {
      alert('Erreur : ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  }

  if (!archer) return null;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* En-tête */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <h2 className="font-semibold text-gray-800 text-sm">
          Conversation avec {archer.name}
        </h2>
        <p className="text-xs text-gray-400">{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Liste des messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-8">
            <svg className="animate-spin w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-4xl mb-3">💬</span>
            <p className="text-sm font-medium">Aucun message pour l'instant</p>
            <p className="text-xs mt-1">Les messages de {archer.name} apparaîtront ici</p>
          </div>
        )}

        {messages.map(msg => {
          const isCoach = msg.sender_role === 'coach';
          return (
            <div
              key={msg.id}
              className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] ${isCoach ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <span className="text-[11px] text-gray-400 px-1">
                  {msg.sender_name} · {format(parseISO(msg.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                </span>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isCoach
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <form
        onSubmit={handleSend}
        className="bg-white border-t border-gray-200 px-4 py-3 flex gap-2 shrink-0"
      >
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={`Répondre à ${archer.name}…`}
          disabled={sending}
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 transition"
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {sending ? '…' : 'Envoyer'}
        </button>
      </form>
    </div>
  );
}
