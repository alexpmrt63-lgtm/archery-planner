import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth, requireCoach } from '../middleware/auth.js';
import { sendPushToUser } from '../utils/webpush.js';

const router = Router();

// Récupère les entraînements d'un archer pour une semaine
router.get('/:archerId/:weekStart', requireAuth, async (req, res) => {
  const { archerId, weekStart } = req.params;

  if (req.user.role === 'archer' && req.user.id !== archerId) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const { data, error } = await supabase
    .from('training_sessions')
    .select('*, training_type:training_type_id(title, color)')
    .eq('archer_id', archerId)
    .eq('week_start', weekStart)
    .order('day_of_week')
    .order('start_time');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Coach: ajoute un entraînement
router.post('/', requireAuth, requireCoach, async (req, res) => {
  const { archer_id, week_start, day_of_week, start_time, end_time, training_type_id, notes } = req.body;

  // Vérifie si c'est la première séance de cette semaine pour cet archer
  const { count } = await supabase
    .from('training_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('archer_id', archer_id)
    .eq('week_start', week_start);
  const isFirstSession = count === 0;

  const { data, error } = await supabase
    .from('training_sessions')
    .insert({ archer_id, week_start, day_of_week, start_time, end_time, training_type_id, notes, coach_id: req.user.id })
    .select('*, training_type:training_type_id(title, color)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Notifie l'archer seulement pour la première séance de la semaine (fire-and-forget)
  if (isFirstSession) {
    sendPushToUser(archer_id, {
      title: '🏹 Planning mis à jour',
      body:  `${req.user.name} est en train de rédiger ton emploi du temps !`,
      tag:   `planning-${archer_id}-${week_start}`,
      url:   '/',
    }).catch(() => {});
  }

  res.status(201).json(data);
});

// Coach: modifie un entraînement (déplacement drag & drop ou édition)
router.put('/:sessionId', requireAuth, requireCoach, async (req, res) => {
  const { sessionId } = req.params;
  const { day_of_week, start_time, end_time, training_type_id, notes } = req.body;

  const { data, error } = await supabase
    .from('training_sessions')
    .update({ day_of_week, start_time, end_time, training_type_id, notes })
    .eq('id', sessionId)
    .select('*, training_type:training_type_id(title, color)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Notifie l'archer que son planning a été modifié (fire-and-forget)
  sendPushToUser(data.archer_id, {
    title: '🏹 Planning modifié',
    body:  `${req.user.name} a modifié ton emploi du temps.`,
    tag:   `planning-update-${data.archer_id}-${data.week_start}`,
    url:   '/',
  }).catch(() => {});

  res.json(data);
});

// Archer OU Coach : met à jour notes/completed/archer_notes (sans changer type ni horaires)
router.patch('/:sessionId', requireAuth, async (req, res) => {
  const { sessionId } = req.params;

  if (req.user.role === 'archer') {
    // Vérifie que la session appartient bien à cet archer
    const { data: session } = await supabase
      .from('training_sessions')
      .select('archer_id')
      .eq('id', sessionId)
      .single();
    if (!session || session.archer_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const { archer_notes } = req.body;
    const { data, error } = await supabase
      .from('training_sessions')
      .update({ archer_notes })
      .eq('id', sessionId)
      .select('*, training_type:training_type_id(title, color)')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Coach : peut modifier notes et completed
  const updates = {};
  if (req.body.notes     !== undefined) updates.notes     = req.body.notes;
  if (req.body.completed !== undefined) updates.completed = req.body.completed;

  const { data, error } = await supabase
    .from('training_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select('*, training_type:training_type_id(title, color)')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Coach: supprime un entraînement
router.delete('/:sessionId', requireAuth, requireCoach, async (req, res) => {
  const { sessionId } = req.params;
  const { error } = await supabase.from('training_sessions').delete().eq('id', sessionId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
