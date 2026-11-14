import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import FormError from '@/components/base/FormError';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, recoveryMode, setupComplete, signIn, signUp, resetPassword, updatePassword, authError } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [signupSent, setSignupSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryDone, setRecoveryDone] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    navigate('/');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Veuillez saisir votre nom complet.');
      return;
    }
    setSubmitting(true);
    const res = await signUp(name, email, password);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.sessionCreated) {
      navigate('/');
    } else {
      setSignupSent(true);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await resetPassword(email);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResetSent(true);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (newPassword.length < 8) {
      setRecoveryError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError('Les mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    const res = await updatePassword(newPassword);
    setSubmitting(false);
    if (res.error) {
      setRecoveryError(res.error);
      return;
    }
    setRecoveryDone(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-50">
        <div className="flex items-center gap-2 text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span className="text-sm">Chargement...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background-50">
      {/* Left image panel */}
      <div className="relative hidden w-1/2 lg:block">
        <img
          src="https://storage.helloreaddy.io/project_files/1edc38f1-7907-47dc-a7bd-f1732e935f20/3f1cc1b8-12d8-414b-b646-0966ab476b0c_compressed_cropped-Untitled-design-1-removebg-preview.webp"
          alt="Sanctuaire de l'église"
          title="Gestion des présences d'église - sanctuaire"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/20"></div>
        <div className="absolute inset-x-0 bottom-0 p-12 text-background-50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background-50/20 backdrop-blur">
            <i className="ri-home-line text-2xl"></i>
          </div>
          <h2 className="mt-6 font-heading text-3xl font-bold leading-tight tracking-tight">
            Gérez votre communauté avec simplicité.
          </h2>
          <p className="mt-3 max-w-md text-background-200">
            Membres, communautés, événements et pointage par QR Code — tout au même endroit.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center bg-gradient-to-b from-background-50 via-background-50 to-background-100/50 px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 text-background-50">
              <i className="ri-home-line text-xl"></i>
            </div>
            <div>
              <p className="font-heading text-lg font-bold text-foreground-950">Gestion des présences</p>
              <p className="text-sm text-foreground-500">Espace sécurisé</p>
            </div>
          </div>

          {authError && (
            <div className="mb-6">
              <FormError message={authError} />
            </div>
          )}

          {recoveryMode ? (
            <>
              <h1 className="font-heading text-2xl font-bold text-foreground-950">
                Choisir un nouveau mot de passe
              </h1>
              <p className="mt-2 text-sm text-foreground-500">
                Saisissez un nouveau mot de passe pour votre compte.
              </p>

              {recoveryDone ? (
                <div className="mt-8 rounded-lg bg-primary-100 p-4 text-sm text-primary-800">
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 items-center justify-center">
                      <i className="ri-checkbox-circle-line"></i>
                    </span>
                    <p>Mot de passe mis à jour ! Vous pouvez maintenant vous connecter.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdatePassword} className="mt-8 space-y-4">
                  <FormError message={recoveryError} />
                  <div>
                    <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-foreground-700">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
                        <i className="ri-lock-line text-sm"></i>
                      </span>
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        name="new_password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-10 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-foreground-700">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
                        <i className="ri-lock-password-line text-sm"></i>
                      </span>
                      <input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        name="confirm_password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-10 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <i className="ri-loader-4-line animate-spin"></i>
                        Mise à jour...
                      </>
                    ) : (
                      'Mettre à jour le mot de passe'
                    )}
                  </button>
                </form>
              )}

              {recoveryDone && (
                <button
                  onClick={() => {
                    setRecoveryDone(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setMode('login');
                  }}
                  className="mt-6 flex items-center gap-1 text-sm font-medium text-foreground-500 hover:text-foreground-800"
                >
                  <i className="ri-arrow-left-line"></i>
                  Retour à la connexion
                </button>
              )}
            </>
          ) : resetMode ? (
            <>
              <h1 className="font-heading text-2xl font-bold text-foreground-950">
                Réinitialiser le mot de passe
              </h1>
              <p className="mt-2 text-sm text-foreground-500">
                Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.
              </p>

              {resetSent ? (
                <div className="mt-8 rounded-lg bg-primary-100 p-4 text-sm text-primary-800">
                  <div className="flex items-start gap-3">
                    <span className="flex h-5 w-5 items-center justify-center">
                      <i className="ri-checkbox-circle-line"></i>
                    </span>
                    <p>
                      Un e-mail de réinitialisation a été envoyé à <strong>{email || 'votre adresse'}</strong>.
                      Vérifiez votre boîte de réception.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReset} className="mt-8 space-y-4">
                  <FormError message={error} />
                  <div>
                    <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-foreground-700">
                      Adresse e-mail
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@eglise.org"
                      className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 px-3 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <i className="ri-loader-4-line animate-spin"></i>
                        Envoi...
                      </>
                    ) : (
                      'Envoyer le lien'
                    )}
                  </button>
                </form>
              )}

              <button
                onClick={() => {
                  setResetMode(false);
                  setResetSent(false);
                  setError(null);
                }}
                className="mt-6 flex items-center gap-1 text-sm font-medium text-foreground-500 hover:text-foreground-800"
              >
                <i className="ri-arrow-left-line"></i>
                Retour à la connexion
              </button>
            </>
          ) : signupSent ? (
            <>
              <h1 className="font-heading text-2xl font-bold text-foreground-950">
                Vérifiez votre boîte mail
              </h1>
              <p className="mt-2 text-sm text-foreground-500">
                Un e-mail de confirmation a été envoyé.
              </p>
              <div className="mt-8 rounded-lg bg-primary-100 p-4 text-sm text-primary-800">
                <div className="flex items-start gap-3">
                  <span className="flex h-5 w-5 items-center justify-center">
                    <i className="ri-checkbox-circle-line"></i>
                  </span>
                  <p>
                    Confirmez votre adresse <strong>{email || 'e-mail'}</strong> en cliquant sur le lien reçu,
                    puis connectez-vous.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSignupSent(false);
                  setMode('login');
                }}
                className="mt-6 flex items-center gap-1 text-sm font-medium text-foreground-500 hover:text-foreground-800"
              >
                <i className="ri-arrow-left-line"></i>
                Retour à la connexion
              </button>
            </>
          ) : (
            <>
              <p className="eyebrow mb-2">Espace sécurisé</p>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground-950">
                {mode === 'login' ? 'Bon retour parmi nous 👋' : 'Créer le compte administrateur'}
              </h1>
              <p className="mt-2 text-sm text-foreground-500">
                {mode === 'login'
                  ? 'Connectez-vous pour accéder à votre espace.'
                  : "Première configuration : créez le compte Super Administrateur de l'église."}
              </p>

              <form onSubmit={mode === 'login' ? handleSubmit : handleSignUp} className="mt-8 space-y-4">
                <FormError message={error} />

                {mode === 'signup' && (
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground-700">
                      Nom complet
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
                        <i className="ri-user-line text-sm"></i>
                      </span>
                      <input
                        id="name"
                        type="text"
                        name="full_name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Votre nom complet"
                        className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-3 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground-700">
                    Adresse e-mail
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
                      <i className="ri-mail-line text-sm"></i>
                    </span>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@eglise.org"
                      className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-3 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-foreground-700">
                      Mot de passe
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setResetMode(true)}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        Mot de passe oublié ?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
                      <i className="ri-lock-line text-sm"></i>
                    </span>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-10 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400 hover:text-foreground-600"
                    >
                      <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`}></i>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      Traitement...
                    </>
                  ) : mode === 'login' ? (
                    'Se connecter'
                  ) : (
                    'Créer le compte'
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-foreground-500">
                {mode === 'login' ? (
                  !setupComplete ? (
                    <>
                      Pas encore de compte ?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup');
                          setError(null);
                        }}
                        className="font-semibold text-primary-600 hover:text-primary-700"
                      >
                        Créer un compte
                      </button>
                    </>
                  ) : (
                    <>Les nouveaux comptes sont créés par un administrateur.</>
                  )
                ) : (
                  <>
                    Déjà un compte ?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className="font-semibold text-primary-600 hover:text-primary-700"
                    >
                      Se connecter
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}