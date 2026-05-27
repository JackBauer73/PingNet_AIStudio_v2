# Optimisation & Guide de Conception de la Base de Données — Ping Manager

Ce document propose un plan d'architecture moderne, optimisé et hautement performant pour la future base de données de Ping Manager, en adressant les faiblesses identifiées du système actuel.

---

## 1. Analyse des Limites du Système Actuel

La version initiale de la base de données présentait plusieurs problématiques architecturales :
- **Race-Conditions d'Authentification** : Durant les phases de connexion/déconnexion, les requêtes d'initialisation côté client interrogeaient la session en parallèle des flux d'événements, générant des incohérences de chargement entre les données privées de l'organisateur et la vue publique des tournois.
- **Logique Métier Déportée sur le Client (Front-Heavy)** : Le calcul du gagnant d'un match, de la somme des sets ou du classement final d'une poule est actuellement calculé au niveau du navigateur React. Cela multiplie les requêtes réseaux lourdes, ralentit l'affichage sur mobile et expose l'application à des écarts de calcul s'il y a un décalage de synchronisation.
- **Pollution de Session Locale** : L'ID de tournoi stocké de manière brute dans le stockage local s'entremêlait avec la nouvelle identité de connexion lors du multi-comptes, favorisant des requêtes de filtrage impossibles ou vides.

---

## 2. Refonte du Schéma Relationnel Optimisé

Voici les préconisations structurelles pour concevoir un schéma relationnel robuste en base de données PostgreSQL ou Supabase :

### Tables de Configuration & Sessions
- **tournaments** : Contient les métadonnées de l'événement. Le lien avec le compte d'organisation doit être scellé via une relation intègre avec la table utilisateur système. Les clés de configuration de sets et points doivent comporter des contraintes strictes d'intervalle (ex: sets acceptés uniquement : 2, 3 ou 4; points acceptés minimum : 11).
- **table_categories** : Gère les séries. Ajouter un index unique combinant l'ID du tournoi et le nom de la catégorie pour éradiquer tout risque de création de doublon de tableau au moment du paramétrage.

### Tables de Compétiteurs (Consolidation)
- **players** & **registrations** : Au lieu d'avoir deux tables disjointes, créer une vue matérialisée ou une table fusionnée pour simplifier les requêtes de recherche par licence.
- Ajouter des contraintes pour s'assurer qu'un joueur ne puisse pas avoir le même numéro de dossard au sein d'un même tournoi.
- Indexer impérativement la colonne de recherche de licence FFTT et la colonne de présence pour accélérer le tri du serpentin.

### Tables de Matchs & Sets (Intégrité Physique)
- **matches** :
  - Ajouter des contraintes de clés étrangères pointant vers les tables de joueurs avec un comportement de mise à jour en cascade.
  - Sécuriser l'affectation des tables : Une contrainte d'exclusion unique doit empêcher que deux matchs différents aient le statut "en cours" sur la même table physique d'un tournoi à un instant donné.
- **sets** :
  - Supprimer la création automatique d'un nombre fixe de lignes de sets. À la place, les lignes de sets sont insérées dynamiquement de manière incrémentale.
  - Une contrainte d'unicité sur la clé composée (match_id, set_number) empêche d'avoir deux scores différents enregistrés pour le même set d'un match.

---

## 3. Automatisation des Calculs côté Base de Données (Triggers)

Pour alléger le code client et le rendre totalement indépendant du langage (permettant une réécriture en React Native, Flutter, Vue ou Angular sans réécrire les règles sportives), la base de données doit calculer elle-même ses états par des procédures stockées (Triggers) :

### Trigger A : Calcul automatique du vainqueur d'un match
- **Événement** : À chaque fois qu'une ligne de la table `sets` est insérée ou modifiée.
- **Action** :
  1. Compter combien de sets ont été remportés par le Joueur 1 (score_p1 > score_p2) et par le Joueur 2.
  2. Si l'un des joueurs atteint le nombre de sets gagnants requis configuré dans le tournoi :
     - Mettre à jour la ligne du match en désignant le Vainqueur (`winner_id`).
     - Basculer automatiquement le statut du match à "Terminé" (`finished`).
     - Horodater la fin de la rencontre.

### Trigger B : Propagation du bracket au tour suivant
- **Événement** : Dès qu'un match de phase finale passe au statut "Terminé" avec un vainqueur assigned.
- **Action** :
  1. Lire la position actuelle du match dans la table du bracket.
  2. Calculer automatiquement la position du match suivant grâce à la formule mathématique binaire de décalage.
  3. Mettre à jour la fente appropriée (Joueur 1 ou Joueur 2) du match suivant avec l'ID du vainqueur, débloquant automatiquement l'affichage du tour suivant pour les joueurs.

### Trigger C : Calcul du classement officiel de poule
- **Événement** : À chaque fin de match d'une poule.
- **Action** : recalculer les points et sets gagnés/perdus pour mettre à jour automatiquement une table d'indexation de classement de poule, évitant ainsi un recalcul client à chaque refresh.

---

## 4. Indexations Stratégiques pour la Performance

Pour garantir des temps de réponse inférieurs à 10ms, même avec des dizaines d'utilisateurs connectés simultanément en direct, configurer les index de base de données suivants :
- Index B-Tree sur les clés étrangères réciproques : `matches(tournament_id)`, `matches(pool_id)`, et `matches(bracket_id)`.
- Index filtré (Partial Index) sur les matchs actifs : `matches(table_number) WHERE status = 'in_progress'`. Cela permet de trouver instantanément sur quelle table se déroule un match.
- Index composite sur les inscriptions de joueurs : `registrations(tournament_id, checked_in)`.

---

## 5. RLS (Row Level Security) et Sécurisation
- Configurer les politiques d'accès pour que les écritures (INSERT/UPDATE) sur les tournois soient restreintes uniquement au propriétaire créateur de l'événement (`organizer_id = auth.uid()`).
- Autoriser la lecture publique anonyme partout pour permettre l'affichage du portail spectateur et des tables en direct sans authentification.
