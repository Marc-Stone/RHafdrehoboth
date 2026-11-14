import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError, reloadForNewVersion } from '@/lib/chunkRecovery';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * `app`  : filet global (plein écran).
   * `page` : limité au contenu d'une page — le menu et la barre du haut
   *          restent utilisables.
   */
  variant?: 'app' | 'page' | 'silent';
  /** Quand cette valeur change (ex. changement de page), l'erreur est effacée. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  updating: boolean;
}

/**
 * Filet de sécurité : au lieu d'un écran blanc, un message clair avec des
 * actions de récupération.
 *
 * - Fichier manquant après une mise à jour du site : rechargement automatique
 *   (voir `chunkRecovery.ts`), l'écran d'erreur n'apparaît pas.
 * - Erreur dans une page : seule la page est remplacée ; changer de page ou
 *   cliquer sur « Réessayer » suffit, sans perdre la session.
 * - Le détail technique est affiché (repliable) pour pouvoir diagnostiquer.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, updating: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Erreur de rendu interceptée :', error, info.componentStack);
    if (isChunkLoadError(error) && reloadForNewVersion()) {
      this.setState({ updating: true });
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, updating: false });
    }
  }

  handleRetry = () => {
    this.setState({ error: null, updating: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, updating } = this.state;
    if (!error) return this.props.children;
    // Élément secondaire (ex. notifications flottantes) : on le masque
    // simplement, sans perturber le reste de l'écran.
    if (this.props.variant === 'silent') return null;

    const isPage = this.props.variant === 'page';
    const chunk = isChunkLoadError(error);

    if (updating) {
      return (
        <div className={`flex flex-col items-center justify-center px-6 text-center ${isPage ? 'py-24' : 'min-h-screen bg-background-50'}`}>
          <i className="ri-loader-4-line animate-spin text-3xl text-primary-500"></i>
          <p className="mt-3 text-sm text-foreground-500">Mise à jour de l&apos;application…</p>
        </div>
      );
    }

    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center px-6 text-center ${isPage ? 'py-16' : 'min-h-screen bg-background-50'}`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-100 text-accent-700">
          <i className={chunk ? 'ri-refresh-line text-3xl' : 'ri-error-warning-line text-3xl'}></i>
        </div>
        <h1 className="mt-5 font-heading text-xl font-bold text-foreground-950">
          {chunk ? 'Une nouvelle version est disponible' : 'Un problème est survenu'}
        </h1>
        <p className="mt-2 max-w-md text-sm text-foreground-500">
          {chunk
            ? "L'application a été mise à jour. Rechargez la page pour utiliser la nouvelle version."
            : isPage
              ? "Cette page n'a pas pu s'afficher. Vous pouvez réessayer ou ouvrir une autre page depuis le menu."
              : "L'application n'a pas pu s'afficher. Rechargez la page pour continuer."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {!chunk && (
            <button
              onClick={this.handleRetry}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-5 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-arrow-go-back-line"></i>
              Réessayer
            </button>
          )}
          <button
            onClick={this.handleReload}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-refresh-line"></i>
            Recharger la page
          </button>
        </div>
        {!chunk && (
          <details className="mt-6 max-w-lg text-left text-xs text-foreground-400">
            <summary className="cursor-pointer select-none">Détails techniques (à transmettre au support)</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background-100 p-3 text-foreground-600">
              {`${error.name}: ${error.message}\nPage : ${window.location.pathname}`}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
