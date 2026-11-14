import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Filet de sécurité global : au lieu de laisser un écran entièrement blanc
 * lorsqu'une erreur inattendue survient au rendu, on affiche un message clair
 * avec un bouton de rechargement. L'utilisateur n'est plus jamais bloqué face
 * à une page vide sans explication.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Trace de diagnostic en console, jamais exposée dans l'interface.
    console.error('[ErrorBoundary] Erreur de rendu interceptée :', error, info);

    // Cas fréquent après une mise à jour du site : l'ancien fichier de page
    // (chargé à la demande) n'existe plus sur le serveur. L'utilisateur
    // tombait sur un écran d'erreur alors qu'un simple rechargement suffit.
    // On le fait une seule fois par session pour éviter toute boucle.
    const message = error?.message ?? '';
    const isChunkError =
      /dynamically imported module|module script failed|ChunkLoadError|Loading chunk/i.test(message);
    if (!isChunkError) return;
    try {
      const KEY = 'app:chunk-reload';
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
      }
    } catch {
      // Stockage indisponible : on laisse le bouton « Recharger » à l'écran.
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background-50 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-100 text-accent-700">
            <i className="ri-error-warning-line text-3xl"></i>
          </div>
          <h1 className="mt-5 font-heading text-xl font-bold text-foreground-950">
            Un problème est survenu
          </h1>
          <p className="mt-2 max-w-md text-sm text-foreground-500">
            La page n&apos;a pas pu s&apos;afficher correctement. Cliquez sur le bouton ci-dessous
            pour recharger l&apos;application.
          </p>
          <button
            onClick={this.handleReload}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-refresh-line"></i>
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}