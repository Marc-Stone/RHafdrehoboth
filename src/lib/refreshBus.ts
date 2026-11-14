type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Petit bus de rafraîchissement : permet à la clôture automatique (qui tourne
 * globalement dans le layout) de demander aux hooks `useEvents` et
 * `useAttendances` de recharger leurs données sans couplage direct.
 */
export function subscribeRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitRefresh(): void {
  listeners.forEach((listener) => listener());
}