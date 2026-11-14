import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerViewProps {
  active: boolean;
  onScan: (value: string) => void;
  disabled?: boolean;
}

export default function ScannerView({ active, onScan, disabled = false }: ScannerViewProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Empêche deux instances du scanner sur le même élément lors d'un double-clic
  // rapide (html5-qrcode lève alors une erreur « already running »).
  const startingRef = useRef(false);
  // Arrêt demandé pendant le démarrage (changement de page, verrouillage) :
  // la caméra sera coupée dès que le démarrage se termine. Avant, elle restait
  // allumée en arrière-plan.
  const stopRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const lastScanRef = useRef({ value: '', time: 0 });

  // Toujours appeler la DERNIÈRE version de `onScan`. Le rappel de la caméra
  // est enregistré une seule fois au démarrage : sans cette référence, il
  // gardait l'ancien événement sélectionné (les scans partaient sur
  // l'événement précédent après un changement d'événement).
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopInstance = async (instance: Html5Qrcode) => {
    try {
      await instance.stop();
    } catch {
      // déjà arrêté
    }
    try {
      instance.clear();
    } catch {
      // rien à nettoyer
    }
  };

  const stop = async () => {
    if (startingRef.current) {
      stopRequestedRef.current = true;
      return;
    }
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (instance) await stopInstance(instance);
    if (mountedRef.current) setScanning(false);
  };

  const start = async () => {
    if (disabled || startingRef.current || scannerRef.current) return;
    startingRef.current = true;
    stopRequestedRef.current = false;
    setError('');
    // Une nouvelle session de scan doit pouvoir repointer immédiatement le
    // même membre : on repart d'un état de déduplication vierge.
    lastScanRef.current = { value: '', time: 0 };
    const scanner = new Html5Qrcode('qr-reader');
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          const now = Date.now();
          if (text !== lastScanRef.current.value || now - lastScanRef.current.time > 3000) {
            lastScanRef.current = { value: text, time: now };
            onScanRef.current(text);
          }
        },
        () => {
          // ignore per-frame decode errors
        },
      );
      if (stopRequestedRef.current || !mountedRef.current) {
        await stopInstance(scanner);
        if (mountedRef.current) setScanning(false);
        return;
      }
      scannerRef.current = scanner;
      setScanning(true);
    } catch {
      await stopInstance(scanner);
      if (mountedRef.current) {
        setError("Impossible d'accéder à la caméra. Vérifiez les autorisations ou utilisez la saisie manuelle.");
        setScanning(false);
      }
    } finally {
      startingRef.current = false;
      stopRequestedRef.current = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!active || disabled) {
      void stop();
    }
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, disabled]);

  return (
    <div className="space-y-4">
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-background-950/90">
        <div id="qr-reader" className="w-full"></div>
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background-100/10 text-background-50">
              <i className={disabled ? 'ri-lock-line text-3xl' : 'ri-qr-scan-2-line text-3xl'}></i>
            </div>
            <p className="px-6 text-sm text-background-100">
              {disabled
                ? 'Le pointage est verrouillé pour cet événement.'
                : 'Caméra en veille. Activez-la pour scanner automatiquement les QR Codes des membres.'}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 px-3 py-2.5 text-sm text-accent-800">
          <i className="ri-alert-line mt-0.5"></i>
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={scanning ? () => void stop() : () => void start()}
        disabled={disabled && !scanning}
        className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          scanning
            ? 'bg-accent-500 text-background-50 hover:bg-accent-600'
            : 'bg-primary-500 text-background-50 hover:bg-primary-600'
        }`}
      >
        <i className={scanning ? 'ri-stop-circle-line' : disabled ? 'ri-lock-line' : 'ri-camera-line'}></i>
        {scanning ? 'Arrêter la caméra' : disabled ? 'Pointage verrouillé' : 'Activer la caméra'}
      </button>
    </div>
  );
}