import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPushToUser } from '../utils/webpush.js';

const router = Router();

// ── Rate-limiter : max 1 notif de groupe par destinataire toutes les 5 min ──
const GROUP_NOTIF_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const groupNotifLastSent   = new Map();       // userId → timestamp ms

function canSendGroupNotif(userId) {
  const last = groupNotifLastSent.get(userId);
  const now  = Date.now();
  if (!last || now - last >= GROUP_NOTIF_COOLDOWN) {
    groupNotifLastSent.set(userId, now);
    return true;
  }
  return false;
}

// GET /api/group-chat — 100 derniers messages (ordre chronologique)
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('group_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/group-chat — envoyer un message de groupe
router.post('/', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Message vide' });

  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      user_id:   req.user.id,
      user_name: req.user.name,
      user_role: req.user.role,
      content:   content.trim(),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);

  // Notifie tous les autres utilisateurs (fire-and-forget, rate-limitée)
  const msgId = data.id;
  (async () => {
    const { data: allUsers } = await supabase
      .from('users')
      .select('id')
      .neq('id', req.user.id);

    if (!allUsers?.length) return;

    const body    = content.trim().length > 80 ? content.trim().slice(0, 77) + '…' : content.trim();
    const payload = {
      title: `👥 ${req.user.name}`,
      body,
      tag:  `group-chat-${msgId}`,  // tag unique → pas de remplacement
      url:  '/',
    };

    await Promise.allSettled(
      allUsers
        .filter(u => canSendGroupNotif(u.id))
        .map(u => sendPushToUser(u.id, payload))
    );
  })();
});

export default router;
