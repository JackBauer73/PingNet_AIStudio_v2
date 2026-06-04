# 🏓 PING MANAGER — Guide de l'Écosystème & Workflow de l'Application

Ce document est spécialement structuré pour **NotebookLM** afin de lui permettre de comprendre et de modéliser le fonctionnement global de **Ping Manager** sous forme d'une infographie ou d'un résumé logique exhaustif.

---

## 1. Vue d'ensemble de l'Architecture
**Ping Manager** est une application web moderne (Single Page Application réactive) d'arbitrage et d'organisation de tournois de tennis de table. 
* **Sécurité & Temps Réel :** Repose entièrement sur **Supabase** (PostgreSQL + Gestion de l'authentification + Base de données sécurisée par RLS + Échanges WebSocket bidirectionnels instantanés).
* **Affichage réactif :** Intègre un écran de salle pour TV (`/board`), des écrans d'arbitrage par table (`/table/:number`) et un portail organisateur avec suivi de l'émargement et de l'avancement.

---

## 2. Les Trois Rôles Clés de l'Écosystème

### 🤵 A. L'Organisateur (Interface Laptop / Table de marque)
Le pilote du tournoi. Il gère la logistique amont, le pointage et l'assignation des tables.
* **Tâches clés :**
  1. **Création du tournoi :** Définition de la date, des tables physiques disponibles ($N$), du nombre de sets gagnants.
  2. **Paramétrage des Tableaux (Categories) :** Tranches de classement FFTT (ex. *Série A : < 900 pts*, *Série B : 900 - 1500 pts*), couleur de tableau, capacité maximale.
  3. **Gestion des Inscriptions & Émargement :** Accueil des joueurs physiques, encaissement, pointage de présence en direct (Checked-In).
  4. **Génération & Attribution :** Lancement des tirages de poules, attribution des tables disponibles aux poules et matches chauds.

### 🎽 B. Les Joueurs & Arbitres de Table (Interface Smartphone)
Idéalement, un smartphone est positionné à côté de chaque table physique de jeu.
* **Tâches clés :**
  1. Se connecte à la table de jeu via un simple QR Code imprimé sur la table (`/table/:tableNumber`). Sans mot de passe.
  2. Voit s'il y a un match en attente ("Appel").
  3. Signale la présence physique des deux joueurs à la table pour lancer le match ("Lancer le match").
  4. Saisit les points set par set directement en cours de partie ("Scoreur").
  5. En fin de match : valide le score (ou litige / signature numérique).

### 📺 C. La TV de Salle / Grand Écran (Interface TV HDMI - Kiosque)
Un écran passif géant situé dans le gymnase connecté à l'URL publique absolue `/board`.
* **Fonctions clés :**
  1. **Affichage permanent :** Montre toutes les tables physiques actives d'un coup d'œil.
  2. **Appel des Joueurs :** Clignote et passe au premier plan dès qu'un match est en statut "Appel", indiquant aux joueurs de se rendre à leur table assignée.
  3. **Visualisation Globale :** Affiche le statut d'une table (Libre, Appel, En cours, À valider, Litige, Forfait), les scores live, et la liste complète des joueurs de chaque poule ou bracket.

---

## 3. Cycle de Vie Linéaire d'un Tournoi

```
  [ 1. CONFIGURATION ] ──> [ 2. INSCRIPTIONS ] ──> [ 3. ÉMARGEMENT (Live) ]
                                                            │
  [ 5. TABLEAUX ÉLIMINATOIRES ] <── [ 4. POULES EN JEU ] <──┘
               │
               v
     [ 6. FINALE & CLÔTURE ] ──> [ 7. ARCHIVAGE ]
```

### 📋 Étape 1 : Configuration (`draft`)
L'organisateur configure les règles du jeu :
* Nom du tournoi, nombre de tables physiques (ex: 24 tables), score_mode (arbitre désigné ou saisie par les joueurs), méthode de paiement autorisée.
* Création des catégories (Séries) avec des codes couleurs dédiés.

### ✍️ Étape 2 : Inscriptions (`open` / `registration`)
Les joueurs s'inscrivent sur place ou à l'avance.
* Renseignent : Nom, Prénom, Club, Licence FFTT, et points de classement.
* Sont associés à une ou plusieurs catégories (Séries) en fonction de leurs points FFTT.

### ⏱️ Étape 3 : Jour J & Pointage (`pools`)
Le jour du tournoi, lors de l'accueil physique :
* L'organisateur pointe les présents (`checked_in = true`).
* **Visualisation croisée :** Si un joueur physique est inscrit dans plusieurs séries, des badges dynamiques affichent son statut de présence global pour éviter d'appeler un joueur non arrivé.

### 🌀 Étape 4 : Les Poules (`pools` ➔ `in_progress`)
* **Génération automatique :** Les joueurs pointés présents dans une série sont répartis par serpents (S-Curve) dans des poules de 3 ou 4 joueurs.
* **Attribution des tables :** L'organisateur affecte les poules aux tables physiques disponibles (`tournament_tables`).
* **Ordre des matches en poule :** Dans une poule de 3 (joueurs A, B, C) ou de 4 (A, B, C, D), l'app génère automatiquement et dans l'ordre légal officiel FFTT les matches successifs.
  * *Exemple Poule de 3* : 
    1. Match 1 : Joueur A vs Joueur C (Joueur B arbitre)
    2. Match 2 : Joueur B vs Joueur C (Joueur A arbitre)
    3. Match 3 : Joueur A vs Joueur B (Joueur C arbitre)
* **Realtime :** Les joueurs de la table saisissent les scores sur leur mobile. La TV de salle se met à jour en direct. Dès que tous les matches de la poule sont finis, la poule est clôturée, calculant instantanément le classement de la poule (victoires, sets-average, points-average par critères FFTT officiels).

### ⚔️ Étape 5 : Les Tableaux Éliminatoires (`bracket`)
Les qualifiés de chaque poule (ex. les 2 premiers de chaque poule) sont basculés automatiquement dans le tableau final (arbre à élimination directe : 1/32, 1/16, 1/8, 1/4, Demi, Petite finale, Finale).
* L'organisateur attribue les matches de bracket au fur et à mesure que les tables physiques se libèrent.
* L'avancement des gagnants dans l'arbre est calculé automatiquement à la validation des matches.

### 🏆 Étape 6 : Clôture (`finished` / `closed`)
Les finales de séries sont jouées. Le podium est calculé. L'organisateur peut clore le tournoi.

---

## 4. Cycle de Vie d'un Match & Synchronisation de l'Arbitrage

L'enjeu crucial de Ping Manager est la fluidité de la communication entre la table de marque et l'arbitre à la table.

```
       [ PENDING ] (Appel)
            │  (La table clignote orange sur la TV de salle)
            ▼
     [ IN_PROGRESS ] (En cours)
            │  (Saisie en temps réel set par set, table verte sur la TV)
            ▼
 [ AWAITING_VALIDATION ] (À valider)
            │  (Validation par code PIN ou clic réciproque des deux joueurs)
            ▼
      [ FINISHED ] / [ WALKOVER ]
```

1. **`pending` (Appel des joueurs) :** L'organisateur lance le match. La TV de salle (`/board) visualisera le numéro de table en orange clignotant. L'arbitre ou les joueurs s'installent.
2. **`in_progress` (En cours) :** Une fois les joueurs à la table, l'arbitre clique sur "Lancer le match" sur smartphone. Le statut bascule. La TV de salle affiche la table en vert. L'arbitre incrémente les points en temps réel via une interface à grands boutons tactiles.
3. **`awaiting_validation` (En attente de validation) :** Dès qu'un joueur atteint le nombre de sets de victoire requis (ex: 3 sets), le match s'arrête. L'arbitre soumet le résultat.
4. **Validation mutuelle :** Pour empêcher la triche ou les erreurs de saisie :
   * Les deux joueurs doivent valider le score sur l'écran du smartphone (boutons séparés).
   * En cas de contestation ➔ passage en statut **`disputed` (Litige)** avec alerte rouge clignotante à la table de marque et sur la TV pour l'intervention d'un juge-arbitre officiel.
5. **`finished` (Terminé) :** Le résultat est stocké et mis à disposition de l'algorithme d'avancement pour calculer la suite de la compétition. La table retourne au statut **`available` (Libre)** sur la TV et est prête à accueillir le prochain match.

---

## 5. Anatomie d'une Vignette de Table (Style de Salle "Board")

Afin que l'infographie de NotebookLM soit fidèle au design moderne de la TV de salle :
* **Vignette Table Active :**
  * **Fond :** Adopte la couleur unie et vibrante du tableau en jeu (code HEX de la catégorie, ex. violet, bleu lagon). Cette couleur dominante permet aux joueurs de repérer leur discipline de loin.
  * **Haut :** Numéro de table imposant (Bricolage Grotesque) + Abréviation du tableau (ex: *SÉRIE C*).
  * **Milieu :** Niveau du match (ex: *Poule 4*, *1/4 Finale*) + Badge de statut avec un point lumineux pulsé (ex: *En cours* en vert, *Appel* en orange).
  * **Bas (Bandeau d'ombrage translucide) :** Liste des participants. 
    * Si c'est une poule : Affiche **tous les joueurs** qui la composent (avec leurs classements FFTT), en affichant l'actif et en grisant légèrement le joueur au repos.
    * Si c'est une phase finale : Affiche les deux joueurs s'affrontant.
    * Option score : Affiche le score en sets de chaque joueur si l'organisateur a activé le mode direct.
* **Vignette Table Libre :**
  * Adoptant un design neutre et sobre (fond anthracite/ardoise `#1e293b`), affichant la mention "Libre" et n'indiquant aucun joueur pour symboliser sa disponibilité immédiate.

---

## 6. Schéma de données Relationnel (Modèle Physique)

Voici comment les tables Supabase sont structurées pour supporter ces processus :

1. **`tournaments`**
   * Propriétés : `id`, `name`, `status` (status du cycle), `nb_tables` (capacité), `sets_to_win`.
2. **`table_categories`** (Un tournoi possède $N$ catégories / Séries)
   * Propriétés : `id`, `name`, `color_code` (couleur HEX visuelle), `min_points`, `max_points`, `capacity`.
3. **`players`** (Inscrits au tournoi)
   * Propriétés : `id`, `first_name`, `last_name`, `points` (FFTT), `club`, `licence_number`.
4. **`registrations`** (Table de jointure Joueur ↔ Catégorie)
   * Propriétés : `id`, `player_id`, `table_category_id`, `checked_in` (Émargement), `paid`.
5. **`pools`** (Subdivision de phase initiale par catégorie)
   * Propriétés : `id`, `name` (ex: Poule A), `status` (pending, finished).
6. **`pool_players`** (Table de jointures Joueurs de poules)
   * Propriétés : `pool_id`, `player_id`.
7. **`matches`** (Suivi individuel des parties)
   * Propriétés : `id`, `player1_id`, `player2_id`, `table_number`, `round` (type de round), `status` (MatchStatus), `winner_id`...
8. **`sets`** (Sous-scores de points d'un jeu individuel)
   * Propriétés : `match_id`, `set_number`, `score_p1`, `score_p2`.
