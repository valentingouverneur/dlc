# Configuration de l'API Google Images

L'application utilise **uniquement Google Custom Search API** pour récupérer des packshots professionnels (images de produits professionnelles) plutôt que des photos prises par des utilisateurs.

### Avantages
- Packshots professionnels (images de produits professionnelles)
- Priorise les grandes enseignes (Leclerc, Carrefour, etc.)
- Exclut automatiquement les sites de photos utilisateurs (Open Food Facts, Flickr, etc.)
- 100 requêtes/jour gratuites
- Très fiable

### Configuration

1. **Créer un Custom Search Engine** :
   - Aller sur https://programmablesearchengine.google.com/
   - Cliquer sur "Create a custom search engine"
   - Nom : "DLC Image Search"
   - Sites à rechercher : `*` (tous les sites)
   - Cliquer sur "Create"

2. **Activer l'API Custom Search** :
   - Aller sur https://console.cloud.google.com/apis/library/customsearch.googleapis.com
   - Activer l'API

3. **Créer une clé API** :
   - Aller sur https://console.cloud.google.com/apis/credentials
   - Cliquer sur "Create Credentials" > "API Key"
   - Copier la clé API

4. **Récupérer le Custom Search Engine ID** :
   - Retourner sur https://programmablesearchengine.google.com/
   - Cliquer sur votre moteur de recherche
   - Aller dans "Setup" > "Basics"
   - Copier le "Search engine ID"

5. **Configurer les variables d'environnement** :
   - Créer un fichier `.env` à la racine du projet
   - Ajouter :
     ```
     VITE_GOOGLE_API_KEY=votre_cle_api
     VITE_GOOGLE_CSE_ID=votre_search_engine_id
     ```

## Utilisation

Une fois configuré, l'application :
1. Recherche automatiquement des packshots professionnels depuis Google Images
2. Priorise les images des grandes enseignes (Leclerc, Carrefour, Auchan, etc.)
3. Exclut automatiquement les sites de photos utilisateurs (Open Food Facts, Flickr, Pinterest, etc.)
4. Privilégie les images de type "packshot" (photos professionnelles de produits)

## Note

Le fichier `.env` est ignoré par Git pour des raisons de sécurité. Ne commitez jamais vos clés API !

