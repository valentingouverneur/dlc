import React, { useState } from 'react';
import { getDisplayImageUrl } from '../lib/imageProxy';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | undefined | null;
  alt: string;
  fallback?: React.ReactNode;
}

/**
 * Affiche une image en utilisant le proxy pour les domaines bloqués (ex: leclerc.com.pl).
 * Affiche un placeholder en cas d'erreur de chargement.
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  fallback,
  className,
  ...rest
}) => {
  const [error, setError] = useState(false);
  const displaySrc = getDisplayImageUrl(src);

  if (!displaySrc || error) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <div
        className={className}
        style={{
          minWidth: 40,
          minHeight: 40,
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
        }}
        title="Image indisponible"
      >
        <svg
          className="w-6 h-6 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
          />
        </svg>
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={displaySrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
};
