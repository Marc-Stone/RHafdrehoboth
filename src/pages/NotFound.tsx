import { useLocation, useNavigate } from 'react-router-dom';

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background-50 px-4 text-center">
      <span className="pointer-events-none absolute bottom-0 select-none font-heading text-9xl font-black text-background-100 md:text-[12rem]">
        404
      </span>
      <div className="relative z-10 animate-fade-up">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
          <i className="ri-compass-3-line text-3xl"></i>
        </div>
        <h1 className="mt-6 font-heading text-2xl font-bold text-foreground-950 md:text-3xl">
          Page introuvable
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-foreground-500">
          La page <span className="font-mono text-foreground-700">{location.pathname}</span> n'existe pas
          ou a été déplacée.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
        >
          <i className="ri-arrow-left-line"></i>
          Retour au tableau de bord
        </button>
      </div>
    </div>
  );
}