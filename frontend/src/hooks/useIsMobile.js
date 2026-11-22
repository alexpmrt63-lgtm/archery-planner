import { useState, useEffect } from 'react';

// Vrai sur un écran de téléphone (moins de 768 px de large).
// La version ordinateur n'est jamais concernée : au-delà, rien ne change.
const QUERY = '(max-width: 767px)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = e => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
