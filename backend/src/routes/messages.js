import { Router } from 'express';
import webpush from 'web-push';
import supabase from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Configure les clés VAPID (déjà présentes dans les variables d'env Render)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@archery-planner.fr',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

/**
 * Envoie une notification push à tous les appareils abonnés d'un utilisateur.
 * Fire-and-forget : les erreurs ne bloquent pas la réponse HTTP.
 */
async function pushToUser(userId, payload) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('user_id', userId);

  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map(({ endpoint, subscription }) =>
      webpush.sendNotification(subscription, JSON.stringify(payload)).catch(err => {
        // Abonnement expiré (410) → nettoyage automatique
        if (err.statusCode === 410) {
          supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).then(() => {});
        }
      })
    )
  );
}

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

  // Réponse immédiate — la notification part en arrière-plan
  res.status(201).json(data);

  // Payload de la notification — tag unique par message pour éviter la déduplication
  const payload = {
    title: `💬 ${req.user.name}`,
    body: content.trim(),
    tag: `message-${data.id}`,
    url: '/',
  };

  // Coach → notifie l'archer ; Archer → notifie tous les coachs
  (async () => {
    try {
      if (req.user.role === 'coach') {
        await pushToUser(archer_id, payload);
      } else {
        const { data: coaches } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'coach');
        await Promise.all((coaches ?? []).map(c => pushToUser(c.id, payload)));
      }
    } catch (e) {
      console.error('[Push] Erreur notification message :', e.message);
    }
  })();
});

export default router;
