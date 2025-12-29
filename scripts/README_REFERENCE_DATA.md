# Migration des Données de Référence

Ce script permet de migrer les données de référence depuis les constantes vers les nouvelles tables de la base de données.

## Tables concernées

- **ServiceType** : Types de culte (Culte 1, Culte 2, Culte de prière, etc.)
- **TestimonyCategoryConfig** : Catégories de témoignage (INTIMACY, LEADERSHIP, etc.)
- **EventTypeConfig** : Types d'événement (GENERAL, CULTE, REUNION, etc.)

## Utilisation

### 1. Créer la migration Prisma

Avant d'exécuter le script de migration des données, vous devez créer la migration Prisma :

```bash
cd backend
npx prisma migrate dev --name add_reference_data_models
```

### 2. Exécuter le script de migration des données

```bash
npm run migrate:reference-data
```

Ou directement :

```bash
node scripts/migrateReferenceData.js
```

## Données migrées

### Types de Culte (ServiceType)
- Culte 1
- Culte 2
- Culte 3
- Culte de prière
- Culte spécial
- Culte de jeûne
- Autre

### Catégories de Témoignage (TestimonyCategoryConfig)
- INTIMACY → Intimité
- LEADERSHIP → Leadership
- HEALING → Guérison
- PROFESSIONAL → Professionnel
- BUSINESS → Business
- FINANCES → Finances
- DELIVERANCE → Délivrance
- FAMILY → Famille

### Types d'Événement (EventTypeConfig)
- GENERAL → Général
- CULTE → Culte
- REUNION → Réunion
- FORMATION → Formation
- EVANGELISATION → Évangélisation
- SOCIAL → Social
- JEUNESSE → Jeunesse
- ENFANTS → Enfants
- FEMMES → Femmes
- HOMMES → Hommes
- AUTRE → Autre

## Notes

- Le script vérifie si les données existent déjà avant de les créer (évite les doublons)
- Les données sont créées avec `active: true` par défaut
- Le script peut être exécuté plusieurs fois sans problème (idempotent)
- Les orateurs (Speakers) ne sont pas migrés automatiquement car ce sont des personnes spécifiques à créer manuellement depuis le dashboard

## Prochaines étapes

Après la migration, vous pouvez :
1. Accéder au dashboard → Configuration → Référentiels
2. Gérer les données de référence (ajouter, modifier, supprimer)
3. Mettre à jour progressivement les formulaires pour utiliser les données de la base au lieu des constantes

