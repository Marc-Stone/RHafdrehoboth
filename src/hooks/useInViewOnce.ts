import { useEffect, useRef, useState } from 'react';

/**
 * Détecte le moment où un élément approche de la zone visible.
 *
 * Un seul IntersectionObserver est partagé par toute l'application : avec des
 * listes de plusieurs centaines de lignes, créer un observer par photo coûte
 * cher au navigateur. Ici on n'observe qu'une seule fois par élément, puis on
 * se désinscrit dès qu'il a été vu (aucun travail inutile ensuite).
 */

type InViewCallback = () => void;

let sharedObserver: IntersectionObserver | null = null;
const callbacks = new Map<Element, InViewCallback>();

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return null;
  }
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const callback = callbacks.get(entry.target);
          if (!callback) return;
          callbacks.delete(entry.target);
          sharedObserver?.unobserve(entry.target);
          callback();
        });
      },
      // 300px de marge : la photo a le temps d'arriver avant que la ligne
      // n'entre réellement à l'écran, donc aucun clignotement visible.
      { rootMargin: '300px 0px', threshold: 0.01 },
    );
  }
  return sharedObserver;
}

export function useInViewOnce<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const element = ref.current;
    if (!element) return;

    const observer = getSharedObserver();
    // Navigateur sans IntersectionObserver : on charge directement, jamais
    // d'image bloquée pour toujours.
    if (!observer) {
      setInView(true);
      return;
    }

    callbacks.set(element, () => setInView(true));
    observer.observe(element);

    return () => {
      callbacks.delete(element);
      observer.unobserve(element);
    };
  }, [inView]);

  return { ref, inView };
}

export default useInViewOnce;