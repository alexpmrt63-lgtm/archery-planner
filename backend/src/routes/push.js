import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPushToUser } from '../utils/webpush.js';

const router = Router();

// Calcule le prochain lundi (semaine suivante) depuis n'importe quel jour
function getNextMondayDate() {
  const now  = new Date();
  const day  = now.getDay(); // 0=dim, 1=lun, ..., 6=sam
  const diff = day === 0 ? 1 : 8 - day; // sam→+2, dim→+1, lun→+7, etc.
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Expose la clé publique VAPID (le frontend en a besoin pour s'abonner)
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push non configuré' });
  res.json({ key });
});

// Enregistre (ou met à jour) l'abonnement d'un appareil
router.post('/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys, expirationTime } = req.body;
  if (!endpoint || !keys) return res.status(400).json({ error: 'Abonnement invalide' });

  const subscription = { endpoint, keys, expirationTime: expirationTime ?? null };

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: req.user.id, endpoint, subscription },
      { onConflict: 'endpoint' }
    );

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Désabonne un appareil (ex : déconnexion)
router.delete('/subscribe', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }
  res.json({ ok: true });
});

// ── Rappel hebdomadaire EDT ──────────────────────────────────────────────────
// POST /api/push/weekly-reminder
// Appelé chaque samedi à 18h par cron-job.org
// Protégé par Authorization: Bearer <CRON_SECRET>
router.post('/weekly-reminder', async (req, res) => {
  // Vérification du secret
  const token = req.headers.authorization?.replace('Bearer ', '').trim();
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const nextWeek = getNextMondayDate();

  // 1. Tous les archers
  const { data: archers, error: archersErr } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'archer');

  if (archersErr || !archers?.length) {
    return res.json({ sent: 0, week: nextWeek, detail: 'Aucun archer trouvé' });
  }

  // 2. Archers ayant déjà uploadé leur EDT pour la semaine prochaine
  const { data: uploaded } = await supabase
    .from('schedule_slots')
    .select('archer_id')
    .eq('week_start', nextWeek)
    .eq('type', 'cours');

  const alreadyUploaded = new Set((uploaded ?? []).map(r => r.archer_id));

  // 3. Archers qui n'ont PAS uploadé
  const missing = archers.filter(a => !alreadyUploaded.has(a.id));

  if (!missing.length) {
    return res.json({ sent: 0, week: nextWeek, detail: 'Tous les archers ont déjà uploadé' });
  }

  // 4. Envoi de la notification push à chacun
  const payload = {
    title: '📅 Rappel emploi du temps',
    body:  `N'oublie pas d'uploader ton emploi du temps pour la semaine du ${nextWeek} !`,
    tag:   `edt-reminder-${nextWeek}`,
    url:   '/',
  };

  await Promise.allSettled(missing.map(a => sendPushToUser(a.id, payload)));

  console.log(`[Reminder] Semaine ${nextWeek} — ${missing.length} archer(s) notifié(s) :`, missing.map(a => a.name));

  res.json({
    sent:    missing.length,
    week:    nextWeek,
    archers: missing.map(a => a.name),
  });
});

export default router;
