import axios from 'axios';

/**
 * Service pour récupérer des images depuis Google Images via Custom Search API
 * ou Bing Image Search API
 */
export class ImageSearchService {
  // Google Custom Search API (nécessite une clé API et un Custom Search Engine ID)
  // Configuration gratuite : https://developers.google.com/custom-search/v1/overview
  // Limite : 100 requêtes/jour gratuites
  private static readonly GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
  private static readonly GOOGLE_CSE_ID = import.meta.env.VITE_GOOGLE_CSE_ID || '';

  // Bing Image Search API (alternative gratuite)
  // Configuration : https://www.microsoft.com/en-us/bing/apis/bing-image-search-api
  private static readonly BING_API_KEY = import.meta.env.VITE_BING_API_KEY || '';

  /**
   * Recherche une image depuis Google Images via Custom Search API
   */
  static async searchGoogleImage(ean: string, productName?: string): Promise<string | null> {
    if (!this.GOOGLE_API_KEY || !this.GOOGLE_CSE_ID) {
      console.warn('Google API keys non configurées');
      return null;
    }

    try {
      // Construire la requête de recherche
      const query = productName 
        ? `${productName} ${ean} produit`
        : `EAN ${ean} produit alimentaire`;
      
      const url = `https://www.googleapis.com/customsearch/v1`;
      const params = {
        key: this.GOOGLE_API_KEY,
        cx: this.GOOGLE_CSE_ID,
        q: query,
        searchType: 'image',
        num: 5, // Récupérer les 5 premières images
        safe: 'active',
        imgSize: 'large', // Prioriser les grandes images
        imgType: 'photo', // Uniquement des photos
      };

      const response = await axios.get(url, { params });
      
      if (response.data.items && response.data.items.length > 0) {
        // Prioriser les images des grandes enseignes (Leclerc, Carrefour, etc.)
        const preferredDomains = ['leclerc', 'carrefour', 'auchan', 'intermarche', 'monoprix', 'casino'];
        
        // Chercher d'abord une image d'une grande enseigne
        for (const item of response.data.items) {
          const domain = new URL(item.link).hostname.toLowerCase();
          if (preferredDomains.some(pref => domain.includes(pref))) {
            console.log('Image trouvée depuis grande enseigne:', item.link);
            return item.link;
          }
        }
        
        // Sinon, prendre la première image de bonne qualité
        const firstImage = response.data.items[0];
        console.log('Image Google trouvée:', firstImage.link);
        return firstImage.link;
      }
      
      return null;
    } catch (err: any) {
      console.warn('Erreur Google Images:', err.response?.data || err.message);
      return null;
    }
  }

  /**
   * Recherche une image depuis Bing Image Search API (alternative gratuite)
   */
  static async searchBingImage(ean: string, productName?: string): Promise<string | null> {
    if (!this.BING_API_KEY) {
      console.warn('Bing API key non configurée');
      return null;
    }

    try {
      const query = productName 
        ? `${productName} ${ean}`
        : `EAN ${ean} produit alimentaire`;
      
      const url = `https://api.bing.microsoft.com/v7.0/images/search`;
      const response = await axios.get(url, {
        params: {
          q: query,
          count: 5,
          imageType: 'Photo',
          size: 'Large',
          safeSearch: 'Strict',
        },
        headers: {
          'Ocp-Apim-Subscription-Key': this.BING_API_KEY,
        },
      });

      if (response.data.value && response.data.value.length > 0) {
        // Prioriser les images des grandes enseignes
        const preferredDomains = ['leclerc', 'carrefour', 'auchan', 'intermarche', 'monoprix', 'casino'];
        
        for (const item of response.data.value) {
          const domain = new URL(item.contentUrl).hostname.toLowerCase();
          if (preferredDomains.some(pref => domain.includes(pref))) {
            console.log('Image Bing trouvée depuis grande enseigne:', item.contentUrl);
            return item.contentUrl;
          }
        }
        
        const firstImage = response.data.value[0];
        console.log('Image Bing trouvée:', firstImage.contentUrl);
        return firstImage.contentUrl;
      }
      
      return null;
    } catch (err: any) {
      console.warn('Erreur Bing Images:', err.response?.data || err.message);
      return null;
    }
  }

  /**
   * Recherche une image en essayant d'abord Google, puis Bing
   */
  static async searchImage(ean: string, productName?: string): Promise<string | null> {
    // Essayer Google d'abord
    const googleImage = await this.searchGoogleImage(ean, productName);
    if (googleImage) {
      return googleImage;
    }

    // Si Google échoue, essayer Bing
    const bingImage = await this.searchBingImage(ean, productName);
    if (bingImage) {
      return bingImage;
    }

    return null;
  }
}

