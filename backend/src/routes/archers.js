import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth, requireCoach } from '../middleware/auth.js';

const router = Router();

// Coach: liste de tous les archers
router.get('/', requireAuth, requireCoach, async (_req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'archer')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
