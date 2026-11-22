import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPushToAllCoaches } from '../utils/webpush.js';

const router = Router();

// POST /api/comments — archer envoie un commentaire pour une semaine
router.post('/', requireAuth, async (req, res) => {
  const { week_start, comment } = req.body;
  const archer_id = req.user.id;

  if (!week_start || !comment?.trim()) {
    return res.status(400).json({ error: 'week_start et comment requis' });
  }

  // Ajoute le message à la suite de ceux déjà envoyés pour cette semaine,
  // au lieu de remplacer le précédent.
  const { data: existing } = await supabase
    .from('archer_comments')
    .select('comment')
    .eq('archer_id', archer_id)
    .eq('week_start', week_start)
    .maybeSingle();

  const text = comment.trim();
  const fullComment = existing?.comment ? `${existing.comment}\n${text}` : text;

  const { data, error } = await supabase
    .from('archer_comments')
    .upsert(
      { archer_id, week_start, comment: fullComment },
      { onConflict: 'archer_id,week_start' }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);

  // Copie dans la conversation privée + notification aux coachs (en arrière-plan)
  (async () => {
    try {
      const [y, m, d] = week_start.split('-');
      const content = `📅 Semaine du ${d}/${m}/${y} : ${text}`;
      const { data: msg } = await supabase
        .from('messages')
        .insert({
          archer_id,
          sender_role: req.user.role,
          sender_name: req.user.name,
          content,
        })
        .select()
        .single();
      await sendPushToAllCoaches({
        title: `💬 ${req.user.name}`,
        body: content,
        tag: `message-${msg?.id ?? Date.now()}`,
        url: '/',
      });
    } catch (e) {
      console.error('[Comments] Copie/notification échouée :', e.message);
    }
  })();
});

// GET /api/comments/:archerId/:weekStart — coach ou archer lit le commentaire
router.get('/:archerId/:weekStart', requireAuth, async (req, res) => {
  const { archerId, weekStart } = req.params;

  if (req.user.role === 'archer' && req.user.id !== archerId) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const { data } = await supabase
    .from('archer_comments')
    .select('comment, created_at')
    .eq('archer_id', archerId)
    .eq('week_start', weekStart)
    .maybeSingle();

  res.json({ comment: data?.comment ?? null });
});

export default router;
