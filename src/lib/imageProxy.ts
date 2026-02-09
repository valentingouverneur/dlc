/**
 * Proxy d'images pour contourner les blocages CORS/CORP (ex: leclerc.com.pl).
 * Les URLs de ces domaines sont servies via la Firebase Function proxyImage.
 */

const PROXY_BASE =
  import.meta.env.VITE_PROXY_IMAGE_URL ||
  'https://us-central1-dlc-watcher.cloudfunctions.net/proxyImage';

// Domaines pour lesquels on passe par le proxy (CORS/CORP ou connexion instable)
const PROXY_IMAGE_HOSTS = [
  'leclerc.com.pl',
  'www.leclerc.com.pl',
  'e.leclerc',
  'cdn.centraleachatexport.com',
  'images.openfoodfacts.org',
  'static.openfoodfacts.org',
];

export function getDisplayImageUrl(url: string | undefined | null): string {
  if (!url || !url.trim()) return '';
  const u = url.trim();
  if (!u.startsWith('http')) return u;
  try {
    const parsed = new URL(u);
    const useProxy = PROXY_IMAGE_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
    );
    if (useProxy) return `${PROXY_BASE}?url=${encodeURIComponent(u)}`;
  } catch {
    // invalid URL
  }
  return u;
}
