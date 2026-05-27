# Guide des Modules — Ping Manager

Ce guide détaille l'organisation fonctionnelle de **Ping Manager**, en décrivant le fonctionnement individuel et croisé de chaque grand module de l'application.

---

## 1. Architecture Applicative Globale

L'application est découpée en **5 grands modules métiers** logiques, synchronisés instantanément par un bus d'événements en temps réel.

```
                  ┌────────────────────────────────┐
                  │      ADMINISTRATION & CONFIG   │
                  └───────────────┬────────────────┘
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      ▼                           ▼                           ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│  INSCRIPTION │            │   GESTION    │            │  ARBITRAGE   │
│  & POINTAGE  │            │  DES POULES  │            │  & TABLES    │
└──────────────┘            └──────────────┘            └──────────────┘
      │                           │                           │
      └───────────────────────────┼───────────────────────────┘
                                  ▼
                    ┌────────────────────────────┐
                    │  PHASE FINALE (BRACKETEER) │
                    └────────────────────────────┘
```

---

## 2. Descriptif Détaillé des Modules

### Module A : Administration & Configuration Centrale (Espace Organisateur)
- **Rôle** : Permet de définir les variables globales de la compétition.
- **Paramètres gérés** :
  - Métadonnées du tournoi (nom, date, lieu, description).
  - Paramètres matériels : nombre de tables physiques allouées.
  - Paramètres de jeu : nombre de sets gagnants (généralement 2 ou 3 sets d'or), nombre de points par set (généralement 11).
  - Mode de saisie des scores (auto-arbitrage par les joueurs sur leur téléphone ou saisie manuelle supervisée par l'arbitre principal de table).
  - Création des tableaux / catégories du tournoi (ex: "Série Moins de 900 points", "Série Féminine"...) définissant des tranches de points de classement, le tarif d'inscription, l'horaire de lancement et le jour d'affectation.

### Module B : Inscriptions, Paiements & Pointage (Espace Arbitre/Organisateur)
- **Rôle** : Gérer le flux des compétiteurs avant le lancement effectif du jeu.
- **Fonctionnalités clés** :
  - **Moteur de recherche FFTT** : Permet de saisir un numéro de licence joueur pour récupérer à la volée ses informations officielles (Nom, Prénom, Club, Points de classement) via l'API fédérale.
  - **Gestion des présents (Pointage)** : Permet de cocher la présence physique du joueur à son arrivée au complexe sportif. Seuls les joueurs pointés comme "Présents" seront intégrés dans la génération des poules.
  - **Suivi financier** : Indique si le joueur a payé ses frais d'inscription (paiement CB, espèces, chèque ou virement).
  - **Attribution des dossards** : Un sous-module génère, au moment de la clôture des inscriptions, des numéros de dossards uniques et ordonnés, indispensables pour l'identification rapide des joueurs sur les tableaux de bord d'affichage.

### Module C : Générateur & Superviseur de Poules (Phase de Qualifications)
- **Rôle** : Répartir les compétiteurs de manière équilibrée dans des mini-championnats (poules de 3 ou 4) et planifier l'intégralité des rencontres.
- **Fonctionnalités clés** :
  - **Calcul de composition automatique** : Analyse le nombre total de joueurs pointés présents dans une série pour en déduire la proportion idéale de poules de 3 et/ou 4 joueurs.
  - **Tri de force & Méthode Serpentin** : Répartit les têtes de séries pour éviter qu'elles ne se rencontrent d'emblée.
  - **Séparation de club** : Optimise le placement des joueurs d'un même club sportif pour éviter qu'ils ne s'affrontent au premier tour.
  - **Régulateur de tables** : Affecte automatiquement les premières poules créées sur les tables physiques disponibles de la salle.
  - **Moteur d'arbitrage de poule** : Calcule le classement de chaque poule en temps réel après chaque match validé.

### Module D : Générateur & Superviseur du Tableau Final (Phase d'Élimination)
- **Rôle** : Orchestrer la phase finale à élimination directe à l'issue des qualifications par poule.
- **Fonctionnalités clés** :
  - **Détection des qualifiés** : Récupère automatiquement les deux premiers joueurs de chaque classement final de poule.
  - **Seeding Mathematisé** : Place les qualifiés dans un tableau de taille puissance de deux (2, 4, 8, 16, 32 ou 64 places), en installant les joueurs exemptés (BYEs) sur les bonnes graines pour s'assurer que les têtes de série soient épargnées.
  - **Calculateur de cheminement** : Calcule la position de destination idéale du vainqueur d'un match pour remplir dynamiquement le tour suivant du tableau.
  - **Petite Finale** : Associe les perdants des demi-finales pour jouer un match pour la 3ème place sur le podium.

### Module E : Système d'Arbitrage Digital de Table (Espace Table / Joueur)
- **Rôle** : Servir de marqueur électronique interactif autonome.
- **Fonctionnalités clés** :
  - **QR Code Binding** : L'accès à l'URL via un simple scan depuis une table physique connecte le terminal à la table correspondante.
  - **Contrôle d'activité** : Affiche les joueurs appelés à la table pour jouer, avec le détail du match actuel (noms, sets en cours, historique des points).
  - **Enregistrement de point en deux clics** : Saisie géante des scores par set.
  - **Double validation mutuelle** : Pour éviter toute contestation, le système requiert la validation de fin de match par les deux joueurs directement sur le téléphone avant d'envoyer officiellement le résultat à la base.
