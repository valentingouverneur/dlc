import axios from 'axios';

/**
 * Service pour récupérer des packshots professionnels depuis Google Images via Custom Search API
 */
export class ImageSearchService {
  // Google Custom Search API (nécessite une clé API et un Custom Search Engine ID)
  // Configuration gratuite : https://developers.google.com/custom-search/v1/overview
  // Limite : 100 requêtes/jour gratuites
  private static readonly GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
  private static readonly GOOGLE_CSE_ID = import.meta.env.VITE_GOOGLE_CSE_ID || '';

  /**
   * Recherche une image depuis Google Images via Custom Search API
   * Privilégie les packshots professionnels plutôt que les photos utilisateurs
   */
  static async searchGoogleImage(ean: string, productName?: string): Promise<string | null> {
    console.log('🔍 Recherche image pour EAN:', ean);
    console.log('🔑 API Key configurée:', !!this.GOOGLE_API_KEY, this.GOOGLE_API_KEY ? `${this.GOOGLE_API_KEY.substring(0, 10)}...` : 'NON');
    console.log('🔑 CSE ID configuré:', !!this.GOOGLE_CSE_ID, this.GOOGLE_CSE_ID || 'NON');
    
    if (!this.GOOGLE_API_KEY || !this.GOOGLE_CSE_ID) {
      console.error('❌ Google API keys non configurées');
      console.error('API Key:', this.GOOGLE_API_KEY ? 'OUI' : 'NON');
      console.error('CSE ID:', this.GOOGLE_CSE_ID ? 'OUI' : 'NON');
      return null;
    }

    try {
      // Construire la requête de recherche pour privilégier les packshots
      // On exclut les sites de photos utilisateurs et on privilégie les grandes enseignes
      const query = productName 
        ? `${productName} ${ean} packshot produit`
        : `EAN ${ean} packshot produit alimentaire`;
      
      const url = `https://www.googleapis.com/customsearch/v1`;
      const params: any = {
        key: this.GOOGLE_API_KEY,
        cx: this.GOOGLE_CSE_ID,
        q: query,
        searchType: 'image',
        num: 10, // Récupérer plus d'images pour mieux filtrer
        safe: 'active',
        imgSize: 'large', // Prioriser les grandes images
        imgType: 'photo', // Uniquement des photos
        // Exclure les sites de photos utilisateurs
        excludeTerms: 'openfoodfacts user photo',
      };

      console.log('📡 Requête Google Custom Search:', { query, url, params: { ...params, key: '***' } });
      
      const response = await axios.get(url, { params });
      
      console.log('✅ Réponse Google:', response.data);
      
      if (response.data.items && response.data.items.length > 0) {
        console.log(`📸 ${response.data.items.length} images trouvées`);
        // Domaines privilégiés : grandes enseignes et sites professionnels
        const preferredDomains = [
          'leclerc', 'carrefour', 'auchan', 'intermarche', 'monoprix', 'casino',
          'drive', 'ecommerce', 'supermarche', 'hypermarche',
          'manufacturer', 'brand', 'official'
        ];
        
        // Domaines à éviter : sites de photos utilisateurs
        const excludedDomains = [
          'openfoodfacts', 'flickr', 'pinterest', 'instagram', 'facebook',
          'tumblr', 'imgur', 'reddit', 'user', 'community'
        ];
        
        // Chercher d'abord une image d'une grande enseigne ou site professionnel
        for (const item of response.data.items) {
          try {
            const domain = new URL(item.link).hostname.toLowerCase();
            
            // Vérifier si le domaine est exclu
            if (excludedDomains.some(excluded => domain.includes(excluded))) {
              continue;
            }
            
            // Prioriser les domaines préférés
            if (preferredDomains.some(pref => domain.includes(pref))) {
              console.log('Packshot trouvé depuis site professionnel:', item.link);
              return item.link;
            }
          } catch (e) {
            // Ignorer les URLs invalides
            continue;
          }
        }
        
        // Si pas trouvé dans les domaines préférés, prendre la première qui n'est pas exclue
        for (const item of response.data.items) {
          try {
            const domain = new URL(item.link).hostname.toLowerCase();
            if (!excludedDomains.some(excluded => domain.includes(excluded))) {
              console.log('Image Google trouvée:', item.link);
              return item.link;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Dernier recours : première image disponible
        const firstImage = response.data.items[0];
        console.log('Image Google trouvée (fallback):', firstImage.link);
        return firstImage.link;
      }
      
      return null;
    } catch (err: any) {
      console.error('❌ Erreur Google Images:', err);
      console.error('Détails:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText
      });
      return null;
    }
  }

  /**
   * Recherche une image packshot professionnel depuis Google Images
   */
  static async searchImage(ean: string, productName?: string): Promise<string | null> {
    return await this.searchGoogleImage(ean, productName);
  }
}

