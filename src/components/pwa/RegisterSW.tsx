'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // só registra em https ou localhost
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!('serviceWorker' in navigator) || !isSecure) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // força atualização quando houver nova versão do SW
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed') {
              // opcional: notificar que há update
              // console.log('SW atualizado. Recarregue para usar a nova versão.');
            }
          });
        });
      } catch (err) {
        console.error('[SW] register failed:', err);
      }
    };
    register();
  }, []);

  return null;
}
