import supabase from '../supabase.js';

// web-push est optionnel : si les clés VAPID ne sont pas configurées,
// les notifications sont simplement ignorées sans faire planter le serveur.
let webpush = null;
try {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const wp = await import('web-push');
    webpush = wp.default ?? wp;
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@archery-planner.fr',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  } else {
    console.warn('[Push] Clés VAPID manquantes — notifications push désactivées.');
  }
} catch (e) {
  console.warn('[Push] web-push non disponible :', e.message);
}

/**
 * Envoie une notification push à tous les appareils d'un utilisateur.
 * @param {string} userId  — UUID de l'utilisateur cible
 * @param {{ title: string, body: string, tag?: string, url?: string }} payload
 */
export async function sendPushToUser(userId, payload) {
  if (!webpush) return; // pas configuré

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('user_id', userId);

  if (error || !subs?.length) return;

  const notification = JSON.stringify(payload);
  const expiredEndpoints = [];

  await Promise.allSettled(
    subs.map(async row => {
      try {
        await webpush.sendNotification(row.subscription, notification);
      } catch (err) {
        // 410 Gone / 404 Not Found → abonnement révoqué → nettoyer
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredEndpoints.push(row.endpoint);
        }
      }
    })
  );

  // Supprime les abonnements expirés
  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
  }
}

/**
 * Envoie une notification à tous les coachs enregistrés.
 */
export async function sendPushToAllCoaches(payload) {
  if (!webpush) return; // pas configuré

  const { data: coaches } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'coach');

  if (!coaches?.length) return;
  await Promise.allSettled(coaches.map(c => sendPushToUser(c.id, payload)));
}
