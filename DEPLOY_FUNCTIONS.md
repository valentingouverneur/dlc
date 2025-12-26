# Guide de déploiement des Cloud Functions

## Étape 1 : Se connecter à Firebase

```bash
firebase login
```

Ouvrez le lien dans votre navigateur et autorisez l'accès.

## Étape 2 : Sélectionner le projet

```bash
firebase use dlc-watcher
```

## Étape 3 : Configurer votre email

### Pour Gmail :

1. **Créer un mot de passe d'application** :
   - Allez sur https://myaccount.google.com/security
   - Activez la validation en 2 étapes si nécessaire
   - Allez dans "Mots de passe des applications"
   - Créez un nouveau mot de passe pour "Mail"
   - Copiez le mot de passe généré (16 caractères)

2. **Configurer les variables d'environnement** :

```bash
firebase functions:config:set email.user="votre-email@gmail.com"
firebase functions:config:set email.password="votre-mot-de-passe-application-16-caracteres"
firebase functions:config:set email.to="votre-email-pro@entreprise.com"
```

**Remplacez :**
- `votre-email@gmail.com` : Votre adresse Gmail
- `votre-mot-de-passe-application-16-caracteres` : Le mot de passe d'application généré
- `votre-email-pro@entreprise.com` : L'adresse email où vous voulez recevoir les notifications

### Pour Outlook/Yahoo/Autres :

Modifiez le service dans `functions/src/index.ts` ligne 20 :
```typescript
service: 'outlook', // ou 'yahoo', etc.
```

Puis configurez avec votre email et mot de passe :
```bash
firebase functions:config:set email.user="votre-email@outlook.com"
firebase functions:config:set email.password="votre-mot-de-passe"
firebase functions:config:set email.to="votre-email-pro@entreprise.com"
```

## Étape 4 : Déployer

```bash
firebase deploy --only functions
```

Cela va :
- Compiler le TypeScript
- Déployer les fonctions sur Firebase
- Configurer le Cloud Scheduler pour exécuter la fonction tous les jours à 6h00

## Étape 5 : Tester

Après le déploiement, vous pouvez tester avec :

```bash
# Tester la fonction HTTP
curl https://[region]-dlc-watcher.cloudfunctions.net/testEmail
```

Ou depuis la console Firebase :
1. Allez sur https://console.firebase.google.com/project/dlc-watcher/functions
2. Cliquez sur "testEmail"
3. Cliquez sur "Tester la fonction"

## Vérifier les logs

```bash
firebase functions:log
```

## Fonctionnalités

- ✅ **Envoi automatique** : Tous les jours à 6h00 (heure de Paris)
- ✅ **Email HTML** : Format professionnel avec tableau des produits
- ✅ **Détection intelligente** : Produits expirant aujourd'hui ou dans les 3 prochains jours
- ✅ **Fonction de test** : Pour tester sans attendre 6h00

## Coûts

Tout est **GRATUIT** pour votre usage :
- Cloud Functions : 2M invocations/mois gratuites
- Cloud Scheduler : 3 jobs gratuits
- Firestore : 50K lectures/jour gratuites

