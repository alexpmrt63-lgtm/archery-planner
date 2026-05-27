import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/messages/:archerId — historique complet des messages
router.get('/:archerId', requireAuth, async (req, res) => {
  const { archerId } = req.params;
  if (req.user.role === 'archer' && req.user.id !== archerId) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('archer_id', archerId)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// POST /api/messages — envoyer un message (archer ou coach)
router.post('/', requireAuth, async (req, res) => {
  const { archer_id, content } = req.body;
  if (!archer_id || !content?.trim()) {
    return res.status(400).json({ error: 'archer_id et content requis' });
  }
  const { data, error } = await supabase
    .from('messages')
    .insert({
      archer_id,
      sender_role: req.user.role,
      sender_name: req.user.name,
      content: content.trim(),
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

export default router;
