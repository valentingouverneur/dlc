# Firebase Cloud Functions - Envoi d'emails

Cette fonction envoie automatiquement un email quotidien à 6h00 (heure de Paris) pour vous informer des produits qui expirent dans les 3 prochains jours.

## Configuration

### 1. Se connecter à Firebase

```bash
firebase login
```

### 2. Sélectionner le projet

```bash
firebase use dlc-watcher
```

### 3. Configurer les variables d'environnement

Vous devez configurer votre email et mot de passe d'application :

```bash
firebase functions:config:set email.user="votre-email@gmail.com"
firebase functions:config:set email.password="votre-mot-de-passe-application"
firebase functions:config:set email.to="votre-email-pro@entreprise.com"
```

**Important pour Gmail :**
- Vous devez utiliser un **mot de passe d'application** (pas votre mot de passe principal)
- Pour créer un mot de passe d'application :
  1. Allez sur https://myaccount.google.com/security
  2. Activez la validation en 2 étapes si ce n'est pas déjà fait
  3. Allez dans "Mots de passe des applications"
  4. Créez un nouveau mot de passe pour "Mail"
  5. Utilisez ce mot de passe dans la configuration

### 4. Déployer les fonctions

```bash
firebase deploy --only functions
```

## Fonctions disponibles

### `checkExpiringProducts`
Fonction planifiée qui s'exécute tous les jours à 6h00 (heure de Paris).
- Vérifie les produits qui expirent aujourd'hui ou dans les 3 prochains jours
- Envoie un email avec la liste des produits

### `testEmail`
Fonction HTTP pour tester l'envoi d'email manuellement.
- URL : `https://[region]-[project-id].cloudfunctions.net/testEmail`
- Utile pour tester la configuration sans attendre 6h00

## Tester la fonction

Après le déploiement, vous pouvez tester avec :

```bash
# Tester via HTTP
curl https://[region]-dlc-watcher.cloudfunctions.net/testEmail
```

Ou déclencher manuellement la fonction planifiée depuis la console Firebase.

## Coûts

- **Cloud Functions** : Gratuit jusqu'à 2M invocations/mois
- **Cloud Scheduler** : Gratuit jusqu'à 3 jobs
- **Firestore** : Gratuit jusqu'à 50K lectures/jour

Pour votre usage, tout devrait être gratuit.

