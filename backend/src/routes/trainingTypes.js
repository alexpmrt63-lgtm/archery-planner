import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth, requireCoach } from '../middleware/auth.js';

const router = Router();

// Liste tous les types d'entraînement
router.get('/', requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from('training_types')
    .select('*')
    .order('title');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Coach: crée un type
router.post('/', requireAuth, requireCoach, async (req, res) => {
  const { title, color, duration_minutes = 120 } = req.body;
  if (!title || !color) return res.status(400).json({ error: 'Titre et couleur requis' });

  const { data, error } = await supabase
    .from('training_types')
    .insert({ title, color, duration_minutes })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Coach: modifie un type
router.put('/:id', requireAuth, requireCoach, async (req, res) => {
  const { id } = req.params;
  const { title, color, duration_minutes } = req.body;

  const { data, error } = await supabase
    .from('training_types')
    .update({ title, color, ...(duration_minutes !== undefined && { duration_minutes }) })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Coach: supprime un type
router.delete('/:id', requireAuth, requireCoach, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('training_types').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
