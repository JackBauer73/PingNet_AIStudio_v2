# Algorithme de Génération des Poules — Ping Manager

Ce document formalise pas à pas les règles logiques, mathématiques et déontologiques utilisées pour répartir les joueurs présents dans leurs poules respectives au début d'un tournoi.

---

## 1. Détermination du Nombre de Poules (Modèle Mathématique)

La répartition des joueurs dépend de la taille préférée des poules choisie dans la configuration (poules de 3 joueurs ou poules de 4 joueurs). Le système doit calculer de manière optimale le nombre idéal de poules de 2, 3 ou 4 participants pour absorber le total exact d'inscrits présents (noté *N*) sans laisser de joueur seul.

### Format Poule de 3 (Taille préférée standard)
On ne veut aucune poule de 4. Les poules de 3 sont privilégiées. Si le nombre total de joueurs n'est pas un multiple exact de 3, des poules de 2 joueurs sont créées temporairement pour absorber le reliquat :
- **Si N divisible par 3** (reste = 0) : Toutes les poules sont de 3 joueurs (Nombre = N / 3).
- **Si reste = 1** : On retire une poule théorique de 3 pour former 2 poules de 2 joueurs. Le nombre de poules de 3 est égal à (N - 4) / 3, et il y a exactement 2 poules de 2 joueurs.
- **Si reste = 2** : On forme exactement une poule de 2 joueurs. Le nombre de poules de 3 est égal à (N - 2) / 3, et il y a exactement 1 poule de 2 joueurs.
- **Exceptions de petite taille** :
  - Si N < 2 : 1 seule poule de 2 joueurs (avec un joueur fictif ou exempté).
  - Si N = 2 : 1 poule de 2 joueurs.
  - Si N = 3 : 1 poule de 3 joueurs.
  - Si N = 4 : 2 poules de 2 joueurs.
  - Si N = 5 : 1 poule de 3 joueurs et 1 poule de 2 joueurs.

### Format Poule de 4 (Taille préférée étendue)
On cherche à maximiser les poules de 4. Les poules de 3 servent à combler les manques sans descendre en dessous de 3 joueurs par poule (le format poule de 2 est exclu ici) :
- **Si N divisible par 4** (reste = 0) : Toutes les poules sont de 4 joueurs (Nombre = N / 4).
- **Si reste = 1** : On retire deux poules de 4 pour former trois poules de 3 joueurs. Le nombre de poules de 4 est égal à (N - 9) / 4, et il y a 3 poules de 3 joueurs.
- **Si reste = 2** : On retire une poule de 4 pour former deux poules de 3 joueurs. Le nombre de poules de 4 est égal à (N - 6) / 4, et il y a 2 poules de 3 joueurs.
- **Si reste = 3** : On forme exactement une poule de 3 joueurs. Le nombre de poules de 4 est égal à (N - 3) / 4, et il y a 1 poule de 3 joueurs.
- **Exceptions de petite taille** :
  - Si N < 3 : 1 poule de 3 joueurs (avec des BYEs).
  - Si N = 3 : 1 poule de 3 joueurs.
  - Si N = 4 : 1 poule de 4 joueurs.
  - Si N = 5 : 1 poule de 3 et 1 poule de 2 (dérogation exceptionnelle).
  - Si N = 6 : 2 poules de 3 joueurs.
  - Si N = 7 : 1 poule de 4 et 1 poule de 3 joueurs.
  - Si N = 8 : 2 poules de 4 joueurs.

---

## 2. Répartition par la Méthode du Serpentin (Seeding)

Pour équilibrer la force globale de chaque groupe et s'assurer que les meilleurs joueurs de la série ne se rencontrent pas d'emblée, le système trie les joueurs par ordre décroissant de points de classement officiels (noté *P*).

Les joueurs sont ensuite injectés un par un dans les poules en effectuant un aller-retour directionnel ("le serpentin") :

1. On installe les poules de gauche à droite de l'index 0 à l'index *M-1* (*M* étant le nombre total de poules calculé).
2. Une fois à l'extrémité droite (*M-1*), la direction s'inverse pour le tour suivant : on distribue de droite à gauche de l'index *M-1* à l'index 0.
3. Arrivé à gauche (index 0), on change à nouveau de sens.
4. **Correction dynamique (Saut des poules pleines)** : Les poules ayant des capacités différentes (ex : une poule de 2 à côté d'une poule de 3), le serpentin saute automatiquement toute poule ayant atteint son quota de joueurs calculé à l'étape 1, et continue sa route vers la prochaine poule disponible.

---

## 3. Règle de Séparation des Clubs (Correction Déontologique)

Il est interdit pour des partenaires de s'affronter dans une phase de qualifications si cela peut être évité. Le système applique une routine d'évitement de conflit après le placement initial du serpentin :

- Pour chaque poule, le système compte combien de participants appartiennent à un même club sportif (les chaînes vides, "NC", ou "Indépendant" sont exclus).
- Si une poule comporte au moins deux joueurs du même club, un conflit est détecté.
- Le premier joueur du groupe (le mieux classé) est conservé dans sa poule.
- Les autres joueurs en doublon de club doivent être échangés.
- **Mécanisme d'échange strict par niveau de force** :
  - L'échange ne peut se faire qu'entre joueurs situés au **même rang du serpentin** (c'est-à-dire ayant le même index d'arrivée dans leur poule respective, par exemple entre les deuxièmes joueurs de chaque poule, ou entre les troisièmes). Cela préserve l'équité mathématique globale de l'équilibrage des forces sans affaiblir ou renforcer une poule par rapport à une autre.
  - Le système teste toutes les autres poules pour trouver un joueur cible à échanger.
  - L'échange est validé si et seulement si il résout le conflit dans la poule d'origine sans introduire de nouveau doublon de club dans la poule d'accueil pour les deux joueurs échangés.

---

## 4. Planification des Matchs (Round-Robin FFTT)

Chaque poule génère ses matchs internes selon l'ordre officiel des rencontres FFTT. Les joueurs de la poule sont renommés par ordre de classement décroissant (A : graine 1, B : graine 2, C : graine 3, D : graine 4) :

### Ordre dans une poule de 3 joueurs (3 matchs)
- **Match 1** : Joueur A contre Joueur C (arbitré par le Joueur B)
- **Match 2** : Joueur A contre Joueur B (arbitré par le Joueur C)
- **Match 3** : Joueur B contre Joueur C (arbitré par le Joueur A)

### Ordre dans une poule de 4 joueurs (6 matchs)
- **Match 1** : Joueur A contre Joueur D
- **Match 2** : Joueur B contre Joueur C
- **Match 3** : Joueur A contre Joueur C
- **Match 4** : Joueur B contre Joueur D
- **Match 5** : Joueur A contre Joueur B
- **Match 6** : Joueur C contre Joueur D

Chaque match généré reçoit un index d'ordre d'affichage incrémental pour assurer le bon enchaînement sur la table désignée.
