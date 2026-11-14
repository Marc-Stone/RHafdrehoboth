import { useEffect, useState } from 'react';
import { useInViewOnce } from '@/hooks/useInViewOnce';

interface LazyImageProps {
  src?: string | null;
  alt: string;
  /** Classes du cadre (dimensions, arrondi, bordure, fond). */
  containerClassName?: string;
  /** Classes de l'image (object-fit, object-position...). */
  imgClassName?: string;
  /** Contenu affiché pendant l'attente et en cas d'échec (initiales...). */
  fallback: React.ReactNode;
  title?: string;
}

/**
 * Photo chargée uniquement lorsqu'elle approche de l'écran.
 *
 * Le navigateur ne télécharge rien pour les lignes hors champ : les listes de
 * plusieurs centaines de membres restent donc légères à l'ouverture. En
 * attendant, on affiche les initiales (aucun trou visuel, pas de saut de mise
 * en page), puis la photo apparaît en fondu.
 */
export default function LazyImage({
  src,
  alt,
  containerClassName = '',
  imgClassName = '',
  fallback,
  title,
}: LazyImageProps) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Nouvelle image (photo remplacée) : on repart d'un état propre pour ne pas
  // garder un ancien échec ou un ancien « chargé ».
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && inView && !failed;
  const showFallback = !loaded || failed;

  return (
    <div ref={ref} className={`relative overflow-hidden ${containerClassName}`} title={title}>
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>
      )}
      {showImage && (
        <img
          src={src as string}
          alt={alt}
          decoding="async"
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(false);
          }}
        />
      )}
    </div>
  );
}