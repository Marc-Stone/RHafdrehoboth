import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Forbidden() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-100 text-accent-700">
        <i className="ri-lock-line text-3xl"></i>
      </div>
      <h1 className="mt-6 font-heading text-2xl font-bold text-foreground-950">Accès refusé</h1>
      <p className="mt-2 max-w-md text-sm text-foreground-500">
        Vous n&apos;avez pas la permission d&apos;accéder à cette page
        {user?.roleLabel ? <> avec le rôle «&nbsp;{user.roleLabel}&nbsp;»</> : ''}.
        Contactez un administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
      </p>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
      >
        <i className="ri-arrow-left-line"></i>
        Retour au tableau de bord
      </button>
    </div>
  );
}