// ⚠️ Doit rester la TOUTE PREMIÈRE ligne de code de l'application.
// Ce module installe les écouteurs qui absorbent les fins de session normales
// (« Invalid Refresh Token ») avant que React ou Supabase ne puissent rejeter
// une promesse. Le retirer ou le déplacer réintroduit des erreurs de session
// signalées comme des plantages.
import '@/lib/staleSessionGuard';
import { installChunkRecovery } from '@/lib/chunkRecovery';

// Récupération automatique après une mise à jour du site (fichiers JS/CSS
// d'une ancienne version devenus introuvables) : rechargement au lieu de
// l'écran « Un problème est survenu ».
installChunkRecovery();

import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)