import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';
import { uploadChurchImage, removeChurchImage } from '@/lib/storage';
import { defaultSettings } from '@/lib/constants';
import { readCache, writeCache, dedupe } from '@/lib/dataCache';
import type { ChurchSettings } from '@/lib/types';

/** Les paramètres sont lus par la sidebar ET la page paramètres : un cache
 * court évite deux requêtes identiques à chaque navigation. */
const SETTINGS_CACHE_KEY = 'settings:row';
const SETTINGS_CACHE_TTL = 60_000;

interface SettingsCache {
  settings: ChurchSettings;
  logoUrl: string | null;
  rowId: string | null;
}

interface SettingsRow {
  id: string;
  church_name: string | null;
  slogan: string | null;
  pastor_name: string | null;
  leader_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  founded_year: number | null;
  timezone: string | null;
  logo_url: string | null;
}

function toSettings(row: SettingsRow): ChurchSettings {
  return {
    churchName: row.church_name ?? defaultSettings.churchName,
    slogan: row.slogan ?? defaultSettings.slogan,
    pastorName: row.pastor_name ?? defaultSettings.pastorName,
    leaderName: row.leader_name ?? defaultSettings.leaderName,
    address: row.address ?? defaultSettings.address,
    phone: row.phone ?? defaultSettings.phone,
    email: row.email ?? defaultSettings.email,
    website: row.website ?? defaultSettings.website,
    foundedYear: row.founded_year ?? defaultSettings.foundedYear,
    timezone: row.timezone ?? defaultSettings.timezone,
  };
}

function toDb(s: ChurchSettings) {
  return {
    church_name: s.churchName || null,
    slogan: s.slogan || null,
    pastor_name: s.pastorName || null,
    leader_name: s.leaderName || null,
    address: s.address || null,
    phone: s.phone || null,
    email: s.email || null,
    website: s.website || null,
    founded_year: s.foundedYear,
    timezone: s.timezone || null,
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<ChurchSettings>(defaultSettings);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);

  const load = useCallback(async (silent: boolean, options?: { force?: boolean }) => {
    const cached = options?.force
      ? null
      : readCache<SettingsCache>(SETTINGS_CACHE_KEY, SETTINGS_CACHE_TTL);
    if (cached) {
      setSettings(cached.settings);
      setLogoUrl(cached.logoUrl);
      setRowId(cached.rowId);
      setError(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const payload = await dedupe(SETTINGS_CACHE_KEY, async () => {
        const { data, error: fErr } = await supabase
          .from('settings')
          .select('*')
          .limit(1)
          .maybeSingle();
        if (fErr) throw fErr;
        const row = (data as SettingsRow | null) ?? null;
        return {
          settings: row ? toSettings(row) : defaultSettings,
          logoUrl: row?.logo_url ?? null,
          rowId: row?.id ?? null,
        } as SettingsCache;
      });
      writeCache(SETTINGS_CACHE_KEY, payload);
      setRowId(payload.rowId);
      setSettings(payload.settings);
      setLogoUrl(payload.logoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les paramètres.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(() => load(false, { force: true }), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const saveSettings = async (next: ChurchSettings) => {
    let savedId = rowId;
    if (rowId) {
      const { error: updErr } = await supabase.from('settings').update(toDb(next)).eq('id', rowId);
      if (updErr) return { error: updErr.message };
    } else {
      const { data, error: insErr } = await supabase.from('settings').insert(toDb(next)).select('id').single();
      if (insErr) return { error: insErr.message };
      if (data) {
        savedId = (data as { id: string }).id;
        setRowId(savedId);
      }
    }
    setSettings(next);
    // Cache tenu à jour : la sidebar affiche immédiatement le nouveau nom
    // sans rejouer la requête.
    writeCache(SETTINGS_CACHE_KEY, { settings: next, logoUrl, rowId: savedId });
    await logActivity('modification', "a modifié les paramètres de l'église");
    return { error: null };
  };

  const updateLogo = async (dataUrl: string): Promise<{ error: string | null }> => {
    try {
      const url = await uploadChurchImage('logo/logo', dataUrl);
      let savedId = rowId;
      if (rowId) {
        const { error: updErr } = await supabase.from('settings').update({ logo_url: url }).eq('id', rowId);
        if (updErr) return { error: updErr.message };
      } else {
        const { data, error: insErr } = await supabase
          .from('settings')
          .insert({ ...toDb(settings), logo_url: url })
          .select('id')
          .single();
        if (insErr) return { error: insErr.message };
        if (data) {
          savedId = (data as { id: string }).id;
          setRowId(savedId);
        }
      }
      setLogoUrl(url);
      writeCache(SETTINGS_CACHE_KEY, { settings, logoUrl: url, rowId: savedId });
      await logActivity('modification', "a modifié le logo de l'église");
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Impossible d'enregistrer le logo." };
    }
  };

  const removeLogo = async (): Promise<{ error: string | null }> => {
    try {
      await removeChurchImage('logo/logo');
    } catch {
      // fichier absent, on continue
    }
    if (rowId) {
      const { error: updErr } = await supabase.from('settings').update({ logo_url: null }).eq('id', rowId);
      if (updErr) return { error: updErr.message };
    }
    setLogoUrl(null);
    writeCache(SETTINGS_CACHE_KEY, { settings, logoUrl: null, rowId });
    return { error: null };
  };

  return { settings, logoUrl, loading, error, fetchSettings, saveSettings, updateLogo, removeLogo };
}