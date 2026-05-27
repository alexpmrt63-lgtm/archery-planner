import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/comments — archer envoie un commentaire pour une semaine
router.post('/', requireAuth, async (req, res) => {
  const { week_start, comment } = req.body;
  const archer_id = req.user.id;

  if (!week_start || !comment?.trim()) {
    return res.status(400).json({ error: 'week_start et comment requis' });
  }

  const { data, error } = await supabase
    .from('archer_comments')
    .upsert(
      { archer_id, week_start, comment: comment.trim() },
      { onConflict: 'archer_id,week_start' }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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
