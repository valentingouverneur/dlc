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
      // Construire la requête de recherche - privilégier l'EAN seul en premier
      const url = `https://www.googleapis.com/customsearch/v1`;
      let params: any = {
        key: this.GOOGLE_API_KEY,
        cx: this.GOOGLE_CSE_ID,
        searchType: 'image',
        num: 20, // Augmenter pour avoir plus d'options de filtrage
        safe: 'active',
        imgSize: 'large', // Prioriser les grandes images
        imgType: 'photo', // Uniquement des photos
      };

      // Essayer d'abord avec juste l'EAN
      params.q = ean;
      console.log('📡 Requête Google Custom Search (EAN seul):', { query: params.q, url, params: { ...params, key: '***' } });
      
      let response = await axios.get(url, { params });
      
      // Si aucun résultat, essayer avec le nom du produit + EAN
      if (!response.data.items || response.data.items.length === 0) {
        if (productName) {
          console.log('⚠️ Aucun résultat avec l\'EAN seul, essai avec nom du produit + EAN...');
          params.q = `${productName} ${ean}`;
          response = await axios.get(url, { params });
        }
      }

      
      console.log('✅ Réponse Google:', response.data);
      console.log('📊 Informations de recherche:', response.data.searchInformation);
      console.log('🔍 Requêtes:', response.data.queries);
      
      if (response.data.items && response.data.items.length > 0) {
        console.log(`📸 ${response.data.items.length} images trouvées`);
        console.log('🖼️ Premières images:', response.data.items.slice(0, 3).map(item => ({
          link: item.link,
          displayLink: item.displayLink,
          title: item.title
        })));
        // Domaines privilégiés : grandes enseignes et sites professionnels
        const preferredDomains = [
          'leclerc.fr', 'carrefour.fr', 'auchan.fr', 'intermarche.fr', 'monoprix.fr', 'casino.fr',
          'leclerc', 'carrefour', 'auchan', 'intermarche', 'monoprix', 'casino',
          'drive', 'ecommerce', 'supermarche', 'hypermarche',
          'manufacturer', 'brand', 'official', 'produit', 'packshot'
        ];
        
        // Domaines à éviter : sites de photos utilisateurs
        const excludedDomains = [
          'openfoodfacts', 'flickr', 'pinterest', 'instagram', 'facebook',
          'tumblr', 'imgur', 'reddit', 'user', 'community'
        ];
        
        // Chercher d'abord une image d'une grande enseigne ou site professionnel
        // Vérifier aussi que l'EAN est présent dans le titre ou la description
        for (const item of response.data.items) {
          try {
            const domain = new URL(item.link).hostname.toLowerCase();
            
            // Vérifier si le domaine est exclu
            if (excludedDomains.some(excluded => domain.includes(excluded))) {
              continue;
            }
            
            // Vérifier que l'EAN est présent dans le titre ou la description
            const titleLower = (item.title || '').toLowerCase();
            const snippetLower = (item.snippet || '').toLowerCase();
            const hasEAN = titleLower.includes(ean) || snippetLower.includes(ean);
            
            // Prioriser les domaines préférés avec EAN dans le titre/description
            if (preferredDomains.some(pref => domain.includes(pref))) {
              if (hasEAN) {
                console.log('Packshot trouvé depuis site professionnel (EAN confirmé):', item.link);
                return item.link;
              }
            }
          } catch (e) {
            // Ignorer les URLs invalides
            continue;
          }
        }
        
        // Si pas trouvé dans les domaines préférés, chercher une image avec EAN confirmé
        for (const item of response.data.items) {
          try {
            const domain = new URL(item.link).hostname.toLowerCase();
            if (excludedDomains.some(excluded => domain.includes(excluded))) {
              continue;
            }
            
            const titleLower = (item.title || '').toLowerCase();
            const snippetLower = (item.snippet || '').toLowerCase();
            const hasEAN = titleLower.includes(ean) || snippetLower.includes(ean);
            
            if (hasEAN) {
              console.log('Image Google trouvée (EAN confirmé):', item.link);
              return item.link;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Si pas trouvé avec EAN confirmé, prendre la première des domaines préférés
        for (const item of response.data.items) {
          try {
            const domain = new URL(item.link).hostname.toLowerCase();
            if (excludedDomains.some(excluded => domain.includes(excluded))) {
              continue;
            }
            
            if (preferredDomains.some(pref => domain.includes(pref))) {
              console.log('Packshot trouvé depuis site professionnel (sans vérification EAN):', item.link);
              return item.link;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Dernier recours : première image qui n'est pas exclue
        for (const item of response.data.items) {
          try {
            const domain = new URL(item.link).hostname.toLowerCase();
            if (!excludedDomains.some(excluded => domain.includes(excluded))) {
              console.log('Image Google trouvée (fallback):', item.link);
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
      
      console.warn('⚠️ Aucune image trouvée dans la réponse Google');
      console.log('Réponse complète:', JSON.stringify(response.data, null, 2));
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

