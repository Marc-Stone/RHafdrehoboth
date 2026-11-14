import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { readFileAsDataUrl, readAvatarAsDataUrl } from '@/utils/file';
import { defaultSettings, timezoneOptions } from '@/lib/constants';
import type { ChurchSettings } from '@/lib/types';
import PageHeader from '@/components/base/PageHeader';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, updateAvatar, removeAvatar } = useAuth();
  const { settings, logoUrl: logo, saveSettings, updateLogo, removeLogo } = useSettings();
  const avatarUrl = user?.avatarUrl ?? null;
  const [form, setForm] = useState<ChurchSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [avatarError, setAvatarError] = useState('');

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const updateField = (key: keyof ChurchSettings, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setLogoError('');
      const dataUrl = await readFileAsDataUrl(file, 512, 'image/png');
      const res = await updateLogo(dataUrl);
      if (res.error) setLogoError(res.error);
    } catch {
      setLogoError("Impossible de lire cette image. Essayez un autre fichier.");
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setAvatarError('');
      const dataUrl = await readAvatarAsDataUrl(file);
      const res = await updateAvatar(dataUrl);
      if (res.error) setAvatarError(res.error);
    } catch {
      setAvatarError("Impossible de lire cette image. Essayez un autre fichier.");
    }
  };

  const handleRemoveLogo = async () => {
    setLogoError('');
    const res = await removeLogo();
    if (res.error) setLogoError(res.error);
  };

  const handleRemoveAvatar = async () => {
    setAvatarError('');
    const res = await removeAvatar();
    if (res.error) setAvatarError(res.error);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const res = await saveSettings(form);
    setSaving(false);
    if (res.error) {
      setSaveError(res.error);
    } else {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Système"
        icon="ri-settings-4-line"
        title="Paramètres"
        description="Gérez les informations de l'église et personnalisez l'apparence de l'application."
        tone="secondary"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSave}
            className="rounded-lg border border-background-200 bg-background-50 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-building-2-line text-xl"></i>
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground-900">Informations de l'église</h3>
                <p className="text-xs text-foreground-400">Ces informations apparaissent sur les cartes et les rapports.</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Nom de l'église</label>
                <input
                  type="text"
                  name="churchName"
                  value={form.churchName}
                  onChange={(e) => updateField('churchName', e.target.value)}
                  placeholder="Ex : Église de la Grâce"
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Slogan</label>
                <input
                  type="text"
                  name="slogan"
                  value={form.slogan}
                  onChange={(e) => updateField('slogan', e.target.value)}
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Pasteur principal</label>
                <input
                  type="text"
                  name="pastorName"
                  value={form.pastorName}
                  onChange={(e) => updateField('pastorName', e.target.value)}
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Leader / Responsable</label>
                <input
                  type="text"
                  name="leaderName"
                  value={form.leaderName}
                  onChange={(e) => updateField('leaderName', e.target.value)}
                  placeholder="Ex : Responsable de l'église"
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Année de fondation</label>
                <input
                  type="number"
                  name="foundedYear"
                  min={1800}
                  max={2100}
                  value={form.foundedYear || ''}
                  onChange={(e) => updateField('foundedYear', e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="Ex : 1998"
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Adresse</label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Téléphone</label>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Site web</label>
                <input
                  type="text"
                  name="website"
                  value={form.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground-700">Fuseau horaire</label>
                <select
                  name="timezone"
                  value={form.timezone}
                  onChange={(e) => updateField('timezone', e.target.value)}
                  className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {saveError && (
              <div className="mt-4 rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <i className="ri-error-warning-line"></i>
                  </span>
                  <p>{saveError}</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-background-200 pt-4">
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700">
                  <i className="ri-checkbox-circle-line"></i>
                  Modifications enregistrées
                </span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line"></i>
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-background-200 bg-background-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                <i className="ri-user-3-line text-xl"></i>
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground-900">Photo de profil</h3>
                <p className="text-xs text-foreground-400">Votre avatar apparaît dans la barre du haut et le menu.</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-background-200 bg-background-100">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Photo de profil" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-foreground-300">{user?.initials ?? '?'}</span>
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100">
                  <i className="ri-upload-line"></i>
                  {avatarUrl ? 'Changer la photo' : 'Téléverser une photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-accent-600 hover:bg-accent-100 hover:text-accent-700"
                  >
                    <i className="ri-delete-bin-line"></i>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
            {avatarError && (
              <p className="mt-3 text-xs font-medium text-accent-600">{avatarError}</p>
            )}
          </div>

          <div className="rounded-lg border border-background-200 bg-background-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-image-add-line text-xl"></i>
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground-900">Logo de l'église</h3>
                <p className="text-xs text-foreground-400">Affiché sur les cartes de membre et la barre latérale.</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-background-200 bg-background-100">
                {logo ? (
                  <img src={logo} alt="Logo de l'église" className="h-full w-full object-cover" />
                ) : (
                  <i className="ri-home-line text-3xl text-foreground-300"></i>
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100">
                  <i className="ri-upload-line"></i>
                  {logo ? 'Changer le logo' : 'Téléverser un logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
                {logo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-accent-600 hover:bg-accent-100 hover:text-accent-700"
                  >
                    <i className="ri-delete-bin-line"></i>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
            {logoError && (
              <p className="mt-3 text-xs font-medium text-accent-600">{logoError}</p>
            )}
          </div>

          <div className="rounded-lg border border-background-200 bg-background-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                <i className="ri-palette-line text-xl"></i>
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground-900">Apparence</h3>
                <p className="text-xs text-foreground-400">Choisissez le thème de l'application.</p>
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-background-200 bg-background-100 p-1">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  theme === 'light' ? 'bg-background-50 text-foreground-900' : 'text-foreground-500 hover:text-foreground-700'
                }`}
              >
                <i className="ri-sun-line"></i>
                Clair
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  theme === 'dark' ? 'bg-foreground-900 text-background-50' : 'text-foreground-500 hover:text-foreground-700'
                }`}
              >
                <i className="ri-moon-line"></i>
                Sombre
              </button>
            </div>

            <p className="mt-3 text-xs text-foreground-400">
              Le thème sombre réduit la fatigue visuelle en faible luminosité.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}