import { useEffect } from 'react';
import api from '../api/client.js';

// Convertit une clé VAPID base64url → Uint8Array (requis par l'API PushManager)
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/**
 * À appeler dans le composant racine de chaque dashboard (coach et archer).
 * Enregistre le service worker, demande la permission, s'abonne aux push
 * et envoie l'abonnement au backend (upsert idempotent).
 */
export function usePushSubscription() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function subscribe() {
      try {
        // 1. Enregistre le service worker
        const reg = await navigator.serviceWorker.register('/sw.js');

        // 2. Demande la permission (ne demande qu'une seule fois, l'OS mémorise)
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // 3. Vérifie si un abonnement existe déjà
        const existing = await reg.pushManager.getSubscription();

        // 4. Récupère la clé VAPID publique depuis le backend
        const { data } = await api.get('/push/vapid-public-key');
        const serverKey = urlBase64ToUint8Array(data.key);

        // 5. Crée ou réutilise l'abonnement
        const subscription = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: serverKey,
        });

        // 6. Envoie (upsert) au backend
        await api.post('/push/subscribe', subscription.toJSON());
      } catch (err) {
        // Notification non supportée ou refusée : pas bloquant
        console.warn('[Push] Abonnement échoué :', err.message);
      }
    }

    subscribe();
  }, []);
}
