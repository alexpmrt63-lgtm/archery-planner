import { useState, useEffect, useRef, useCallback } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../api/client.js';

// ── Palette d'avatars (hachage du nom) ───────────────────────────────────────
const PALETTE = [
  'bg-blue-500',    'bg-emerald-500', 'bg-orange-500',
  'bg-purple-500',  'bg-rose-500',    'bg-teal-500',
  'bg-amber-500',   'bg-indigo-400',
];
function avatarBg(name) {
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTE[n % PALETTE.length];
}

// ── Formatage de la date ─────────────────────────────────────────────────────
function fmtDate(iso) {
  const d = parseISO(iso);
  if (isToday(d))     return `Aujourd'hui ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Hier ${format(d, 'HH:mm')}`;
  return format(d, "d MMM 'à' HH:mm", { locale: fr });
}

const POLL_MS = 30_000;

export default function GroupChat({ currentUser }) {
  const [messages, setMessages] = useState([]);
  const [content,  setContent]  = useState('');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const bottomRef   = useRef(null);
  const intervalRef = useRef(null);
  const inputRef    = useRef(null);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/group-chat');
      setMessages(data);
    } catch { /* ignore */ }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { loadMessages(false); }, [loadMessages]);

  // Rafraîchissement automatique toutes les 30 s
  useEffect(() => {
    intervalRef.current = setInterval(() => loadMessages(true), POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [loadMessages]);

  // Scroll vers le dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    setContent('');
    try {
      const { data } = await api.post('/group-chat', { content: text });
      setMessages(prev => [...prev, data]);
      inputRef.current?.focus();
    } catch (err) {
      setContent(text); // restitue le texte si erreur
      alert('Erreur : ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── En-tête ── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl shrink-0">
          👥
        </div>
        <div>
          <h2 className="font-semibold text-gray-800 text-sm sm:text-base leading-tight">Chat de groupe</h2>
          <p className="text-[11px] text-gray-400">Pôle France Relève · Archers &amp; Coaches</p>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 space-y-0.5">

        {/* Spinner de chargement */}
        {loading && (
          <div className="flex justify-center py-12">
            <svg className="animate-spin w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          </div>
        )}

        {/* État vide */}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-5xl mb-4">👥</span>
            <p className="text-sm font-semibold text-gray-500">Pas encore de messages</p>
            <p className="text-xs mt-1">Commencez la conversation !</p>
          </div>
        )}

        {/* Bulles */}
        {messages.map((msg, idx) => {
          const isMe    = msg.user_id === currentUser.id;
          const isCoach = msg.user_role === 'coach';
          const prev    = messages[idx - 1];
          // Regroupe les messages consécutifs du même utilisateur
          const newGroup = !prev || prev.user_id !== msg.user_id;

          return (
            <div
              key={msg.id}
              className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'} ${newGroup ? 'mt-3' : 'mt-0.5'}`}
            >
              {/* Avatar (affiché seulement pour les autres, et seulement sur la dernière bulle du groupe) */}
              <div className="w-7 shrink-0">
                {!isMe && newGroup && (
                  <div className={`w-7 h-7 rounded-full ${avatarBg(msg.user_name)} text-white flex items-center justify-center text-xs font-bold`}>
                    {msg.user_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className={`flex flex-col gap-0.5 max-w-[78%] sm:max-w-[60%] ${isMe ? 'items-end' : 'items-start'}`}>

                {/* Nom + heure (premier message du groupe) */}
                {newGroup && (
                  <div className={`flex items-center gap-1.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[11px] font-semibold text-gray-600">
                      {isMe ? 'Vous' : msg.user_name}
                    </span>
                    {isCoach && !isMe && (
                      <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                        coach
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">{fmtDate(msg.created_at)}</span>
                  </div>
                )}

                {/* Bulle */}
                <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : isCoach
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-bl-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Saisie ── */}
      <form
        onSubmit={handleSend}
        className="bg-white border-t border-gray-200 px-3 sm:px-4 py-3 flex gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Écrire un message au groupe…"
          disabled={sending}
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 transition"
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {sending ? '…' : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
