# Configuration des APIs d'images

Pour améliorer la qualité des images récupérées, vous pouvez configurer des APIs de recherche d'images.

## Option 1 : Google Custom Search API (Recommandé)

### Avantages
- Images de grande qualité depuis les grandes enseignes
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

## Option 2 : Bing Image Search API (Alternative gratuite)

### Avantages
- Gratuit (avec limites)
- Pas besoin de créer un Custom Search Engine

### Configuration

1. **Créer une clé API Bing** :
   - Aller sur https://www.microsoft.com/en-us/bing/apis/bing-image-search-api
   - Cliquer sur "Get started for free"
   - Créer un compte Azure (gratuit)
   - Créer une ressource "Bing Search v7"
   - Copier la clé API

2. **Configurer la variable d'environnement** :
   - Dans le fichier `.env` :
     ```
     VITE_BING_API_KEY=votre_cle_bing
     ```

## Utilisation

Une fois configuré, l'application :
1. Récupère d'abord l'image depuis Open Food Facts
2. Si l'image est de mauvaise qualité ou absente, recherche automatiquement sur Google Images / Bing
3. Priorise les images des grandes enseignes (Leclerc, Carrefour, Auchan, etc.)

## Note

Le fichier `.env` est ignoré par Git pour des raisons de sécurité. Ne commitez jamais vos clés API !

