import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import { getDisplayImageUrl } from '../lib/imageProxy';

const PRODUCT_IMAGES_PREFIX = 'product-images/';

/** Vérifie si l'URL est déjà une URL Firebase Storage (déjà enregistrée chez nous). */
export function isStorageUrl(url: string): boolean {
  if (!url?.trim()) return false;
  try {
    const u = new URL(url.trim());
    return (
      u.hostname.includes('firebasestorage.googleapis.com') ||
      u.hostname.includes('storage.googleapis.com')
    );
  } catch {
    return false;
  }
}

/**
 * Enregistre l'image sur le serveur (Firebase Storage) et retourne l'URL persistante.
 * Si l'URL est déjà une URL Storage, la retourne telle quelle.
 * Sinon, récupère l'image (via proxy si besoin), l'upload dans Storage, retourne la nouvelle URL.
 */
export async function saveImageToServer(url: string, ean: string): Promise<string> {
  const u = (url || '').trim();
  if (!u) return '';

  if (isStorageUrl(u)) return u;

  try {
    const fetchUrl = getDisplayImageUrl(u);
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const contentType = blob.type || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const path = `${PRODUCT_IMAGES_PREFIX}${ean}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType });
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err) {
    console.error('ImageStorageService.saveImageToServer:', err);
    return u;
  }
}
