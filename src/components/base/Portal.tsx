import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface PortalProps {
  children: ReactNode;
}

/**
 * Rend ses enfants directement dans <body>.
 * Indispensable pour les fenêtres modales : certains ancêtres de la page
 * appliquent un `transform` (ex. animations), ce qui casse le positionnement
 * `fixed` en le rendant relatif à cet ancêtre au lieu de l'écran.
 */
export default function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(children, document.body);
}