import { Suspense, type ReactNode } from 'react';
import PageLoader from './PageLoader';

/**
 * Encapsule une page chargée à la demande (code splitting) avec un fallback
 * propre. Garde la sidebar / le haut de page en place pendant le chargement.
 */
export default function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}