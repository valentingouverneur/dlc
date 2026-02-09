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

  // Bing Image Search API (Azure) - quota gratuit ~1000 req/mois
  private static readonly BING_API_KEY = import.meta.env.VITE_BING_API_KEY || '';

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
        num: 10, // Limite max pour les images
        safe: 'active',
      };

      // Essayer plusieurs stratégies de recherche
      let response: any = null;
      
      // Stratégie 1: EAN seul
      params.q = ean;
      console.log('📡 Requête Google Custom Search (EAN seul):', { query: params.q });
      try {
        response = await axios.get(url, { params });
        if (response.data.items && response.data.items.length > 0) {
          console.log(`✅ ${response.data.items.length} résultats avec EAN seul`);
        }
      } catch (err: any) {
        console.warn('⚠️ Erreur avec EAN seul:', err.response?.status, err.message);
      }
      
      // Stratégie 2: Nom du produit + EAN (si pas de résultats ou erreur)
      if (!response || !response.data.items || response.data.items.length === 0) {
        if (productName) {
          console.log('📡 Essai avec nom du produit + EAN...');
          params.q = `${productName} ${ean}`;
          try {
            response = await axios.get(url, { params });
            if (response.data.items && response.data.items.length > 0) {
              console.log(`✅ ${response.data.items.length} résultats avec nom + EAN`);
            }
          } catch (err: any) {
            console.warn('⚠️ Erreur avec nom + EAN:', err.response?.status, err.message);
          }
        }
      }
      
      // Stratégie 3: Juste le nom du produit (si toujours pas de résultats)
      if (!response || !response.data.items || response.data.items.length === 0) {
        if (productName) {
          console.log('📡 Essai avec nom du produit seul...');
          params.q = productName;
          try {
            response = await axios.get(url, { params });
            if (response.data.items && response.data.items.length > 0) {
              console.log(`✅ ${response.data.items.length} résultats avec nom seul`);
            }
          } catch (err: any) {
            console.warn('⚠️ Erreur avec nom seul:', err.response?.status, err.message);
          }
        }
      }
      
      if (!response) {
        console.error('❌ Aucune réponse de Google Custom Search');
        return null;
      }

      
      console.log('✅ Réponse Google:', response.data);
      console.log('📊 Informations de recherche:', response.data.searchInformation);
      console.log('🔍 Requêtes:', response.data.queries);
      
      if (response.data.items && response.data.items.length > 0) {
        console.log(`📸 ${response.data.items.length} images trouvées`);
        console.log('🖼️ Premières images:', response.data.items.slice(0, 3).map((item: { link?: string; displayLink?: string; title?: string }) => ({
          link: item.link,
          displayLink: item.displayLink,
          title: item.title
        })));
        // Domaines privilégiés : grandes enseignes et sites professionnels
        const preferredDomains = [
          'leclerc', 'carrefour', 'auchan', 'intermarche', 'monoprix', 'casino',
          'drive', 'ecommerce', 'supermarche', 'hypermarche',
          'manufacturer', 'brand', 'official'
        ];
        
        // Domaines à éviter : sites de photos utilisateurs
        const excludedDomains = [
          'openfoodfacts', 'flickr', 'pinterest', 'instagram', 'facebook',
          'tumblr', 'imgur', 'reddit'
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
              console.log('✅ Packshot trouvé depuis site professionnel:', item.link, '| Domaine:', domain);
              return item.link;
            }
          } catch (e) {
            // Ignorer les URLs invalides
            continue;
          }
        }
        
        // Si pas trouvé dans les domaines préférés, prendre la première image non exclue
        for (const item of response.data.items) {
          try {
            const domain = new URL(item.link).hostname.toLowerCase();
            if (!excludedDomains.some(excluded => domain.includes(excluded))) {
              console.log('✅ Image Google trouvée (fallback):', item.link, '| Domaine:', domain);
              return item.link;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Dernier recours : première image disponible (même si domaine exclu)
        const firstImage = response.data.items[0];
        console.log('✅ Image Google trouvée (dernier recours):', firstImage.link);
        return firstImage.link;
      }
      
      console.warn('⚠️ Aucune image trouvée dans la réponse Google');
      console.log('Réponse complète:', JSON.stringify(response.data, null, 2));
      return null;
    } catch (err: any) {
      console.error('❌ Erreur Google Images:', err);
      const errorDetails = {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText,
        requestUrl: err.config?.url,
        requestParams: err.config?.params ? { ...err.config.params, key: '***', cx: '***' } : null
      };
      console.error('Détails complets:', errorDetails);
      
      // Si erreur 400, c'est probablement un problème de paramètres
      if (err.response?.status === 400) {
        console.error('❌ Erreur 400: Paramètres de requête invalides. Vérifiez la configuration du CSE.');
        console.error('Réponse API:', JSON.stringify(err.response?.data, null, 2));
      }
      
      return null;
    }
  }

  /**
   * Recherche une image packshot professionnel depuis Google Images
   */
  static async searchImage(ean: string, productName?: string): Promise<string | null> {
    return await this.searchGoogleImage(ean, productName);
  }

  /**
   * Retourne toutes les URLs d'images trouvées par Google (pour galerie de choix).
   * Même logique que searchGoogleImage mais retourne tous les liens non exclus.
   */
  static async searchGoogleImageAll(ean: string, productName?: string): Promise<string[]> {
    if (!this.GOOGLE_API_KEY || !this.GOOGLE_CSE_ID) return [];
    const excludedDomains = [
      'openfoodfacts', 'flickr', 'pinterest', 'instagram', 'facebook',
      'tumblr', 'imgur', 'reddit'
    ];
    try {
      const apiUrl = 'https://www.googleapis.com/customsearch/v1';
      let params: Record<string, string | number> = {
        key: this.GOOGLE_API_KEY,
        cx: this.GOOGLE_CSE_ID,
        searchType: 'image',
        num: 10,
        safe: 'active',
        q: ean,
      };
      let response: any = null;
      try {
        response = await axios.get(apiUrl, { params });
      } catch {
        // try with product name
      }
      if ((!response?.data?.items?.length) && productName) {
        params.q = `${productName} ${ean}`;
        try {
          response = await axios.get(apiUrl, { params });
        } catch {
          //
        }
      }
      if ((!response?.data?.items?.length) && productName) {
        params.q = productName;
        try {
          response = await axios.get(apiUrl, { params });
        } catch {
          //
        }
      }
      if (!response?.data?.items?.length) return [];
      const urls: string[] = [];
      for (const item of response.data.items) {
        try {
          const link = item.link;
          if (!link) continue;
          const domain = new URL(link).hostname.toLowerCase();
          if (excludedDomains.some((ex) => domain.includes(ex))) continue;
          urls.push(link);
        } catch {
          continue;
        }
      }
      return urls;
    } catch {
      return [];
    }
  }

  /**
   * Retourne des URLs d'images depuis Bing Image Search (pour galerie).
   * Optionnel : ajouter VITE_BING_API_KEY dans .env (clé Azure).
   */
  static async searchBingImageAll(ean: string, productName?: string): Promise<string[]> {
    if (!this.BING_API_KEY) return [];
    const excludedDomains = [
      'openfoodfacts', 'flickr', 'pinterest', 'instagram', 'facebook',
      'tumblr', 'imgur', 'reddit',
    ];
    try {
      const queries = [ean];
      if (productName) {
        queries.push(`${productName} ${ean}`);
        queries.push(productName);
      }
      const allUrls: string[] = [];
      for (const q of queries) {
        const res = await axios.get('https://api.bing.microsoft.com/v7.0/images/search', {
          params: { q, count: 10 },
          headers: { 'Ocp-Apim-Subscription-Key': this.BING_API_KEY },
        });
        const items = res.data?.value ?? [];
        for (const item of items) {
          const link = item.contentUrl;
          if (!link) continue;
          try {
            const domain = new URL(link).hostname.toLowerCase();
            if (excludedDomains.some((ex) => domain.includes(ex))) continue;
            allUrls.push(link);
          } catch {
            continue;
          }
        }
        if (allUrls.length > 0) break;
      }
      return allUrls;
    } catch {
      return [];
    }
  }
}

