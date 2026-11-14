/**
 * Indicateur de chargement utilisé entre deux pages (code splitting).
 * Volontairement discret et centré pour éviter tout clignotement brutal.
 */
export default function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-foreground-500">
        <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
        <span className="text-sm">Chargement…</span>
      </div>
    </div>
  );
}