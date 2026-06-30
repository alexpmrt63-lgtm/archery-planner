import { useState, useEffect } from 'react';
import api from '../api/client.js';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function doSubscribe() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  const { data } = await api.get('/push/vapid-public-key');
  const serverKey = urlBase64ToUint8Array(data.key);
  const existing = await reg.pushManager.getSubscription();
  const subscription = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: serverKey,
  });
  await api.post('/push/subscribe', subscription.toJSON());
}

export function usePushSubscription() {
  const [needsPrompt, setNeedsPrompt] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const perm = Notification.permission;
    if (perm === 'granted') {
      doSubscribe().catch(err => console.warn('[Push] Abonnement échoué :', err.message));
    } else if (perm === 'default') {
      const dismissed = localStorage.getItem('push-banner-dismissed');
      if (!dismissed) setNeedsPrompt(true);
    }
  }, []);

  async function enableNotifications() {
    setNeedsPrompt(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await doSubscribe();
      }
    } catch (err) {
      console.warn('[Push] Erreur :', err.message);
    }
  }

  function dismissBanner() {
    setNeedsPrompt(false);
    localStorage.setItem('push-banner-dismissed', '1');
  }

  return { needsPrompt, enableNotifications, dismissBanner };
}
