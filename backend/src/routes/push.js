import { Router } from 'express';
import supabase from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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

export default router;
