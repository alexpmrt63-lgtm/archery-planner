import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth, requireCoach } from '../middleware/auth.js';
import { sendPushToUser, sendPushToAllCoaches } from '../utils/webpush.js';

const router = Router();

// ── Rate-limiter notifications planning ──────────────────────────────────────
// Max 1 notification "planning" par archer sur une fenêtre glissante d'1 heure.
// Stocké en mémoire (suffit : si le serveur redémarre, la limite repart à zéro).
const PLANNING_NOTIF_COOLDOWN = 60 * 60 * 1000; // 1 heure en ms
const planningNotifLastSent   = new Map();        // archer_id → timestamp (ms)

/**
 * Renvoie true et mémorise l'heure si l'archer peut recevoir une notif planning.
 * Renvoie false si une notif a déjà été envoyée dans la dernière heure.
 */
function canNotifyArcher(archerId) {
  const last = planningNotifLastSent.get(archerId);
  const now  = Date.now();
  if (!last || now - last >= PLANNING_NOTIF_COOLDOWN) {
    planningNotifLastSent.set(archerId, now);
    return true;
  }
  return false;
}

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

  // Notifie l'archer seulement pour la première séance de la semaine,
  // et au maximum une fois par heure (fire-and-forget)
  if (isFirstSession && canNotifyArcher(archer_id)) {
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

  // Notifie l'archer que son planning a été modifié, max 1 fois/heure (fire-and-forget)
  if (canNotifyArcher(data.archer_id)) {
    sendPushToUser(data.archer_id, {
      title: '🏹 Planning modifié',
      body:  `${req.user.name} a modifié ton emploi du temps.`,
      tag:   `planning-update-${data.archer_id}-${data.week_start}`,
      url:   '/',
    }).catch(() => {});
  }

  res.json(data);
});

// Coach : copie le planning d'un archer vers plusieurs autres pour la même semaine
router.post('/copy', requireAuth, requireCoach, async (req, res) => {
  const { source_archer_id, week_start, target_archer_ids } = req.body;

  if (!source_archer_id || !week_start || !target_archer_ids?.length) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  // Sessions source (sans les IDs — on en crée de nouvelles)
  const { data: source, error: srcErr } = await supabase
    .from('training_sessions')
    .select('day_of_week, start_time, end_time, training_type_id, notes')
    .eq('archer_id', source_archer_id)
    .eq('week_start', week_start);

  if (srcErr)       return res.status(500).json({ error: srcErr.message });
  if (!source?.length) return res.status(400).json({ error: 'Aucune séance à copier pour cette semaine' });

  let copied = 0;
  for (const targetId of target_archer_ids) {
    // Remplace les sessions existantes de la semaine pour cet archer cible
    await supabase
      .from('training_sessions')
      .delete()
      .eq('archer_id', targetId)
      .eq('week_start', week_start);

    const rows = source.map(s => ({
      archer_id:        targetId,
      week_start,
      day_of_week:      s.day_of_week,
      start_time:       s.start_time,
      end_time:         s.end_time,
      training_type_id: s.training_type_id,
      notes:            s.notes,
      coach_id:         req.user.id,
    }));

    const { error: insErr } = await supabase.from('training_sessions').insert(rows);
    if (!insErr) {
      copied++;
      // Notifie l'archer, max 1 fois/heure (fire-and-forget)
      if (canNotifyArcher(targetId)) {
        sendPushToUser(targetId, {
          title: '🏹 Planning partagé',
          body:  `${req.user.name} t'a attribué un planning pour la semaine du ${week_start}.`,
          tag:   `planning-shared-${targetId}-${week_start}`,
          url:   '/',
        }).catch(() => {});
      }
    }
  }

  res.json({ copied, sessions: source.length });
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

    // Notifie tous les coachs qu'un archer a commenté une séance
    if (archer_notes?.trim()) {
      const sessionTitle = data.training_type?.title || 'une séance';
      sendPushToAllCoaches({
        title: `✏️ Commentaire de ${req.user.name}`,
        body:  `${req.user.name} a commenté "${sessionTitle}" : ${archer_notes.trim()}`,
        tag:   `archer-comment-${sessionId}`,
        url:   '/',
      }).catch(() => {});
    }

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
