# TournoisTT - Logique Métier

## Cycle de Vie d'un Tournoi

### 1. Inscription (`registration`)
- Inscription manuelle des joueurs par l'organisateur.
- Définition du nombre de tables et du format de match.

### 2. Poules (`pools`)
- Génération automatique des poules basée sur le nombre d'inscrits (via `generatePools.ts`).
- Chaque poule voit ses joueurs s'affronter.
- Les résultats des poules déterminent le classement pour le tableau final.

### 3. Phase Finale (`bracket`)
- Génération du tableau (Huitièmes, Quarts, etc.) via `generateBracket.ts`.
- Passage automatique des vainqueurs au tour suivant (`bracketAdvancement.ts`).
- Gestion de la petite finale (3ème place).

### 4. Clôture (`finished`)
- Une fois la finale terminée, l'organisateur clôture le tournoi.
- Le tournoi devient consultable mais non modifiable.
- Possibilité de lancer un nouveau tournoi.

## Système de Score
- **Calcul en direct** : Le score d'un match est dérivé de la somme des sets gagnés dans la table `sets`.
- **Validation** : Les joueurs peuvent valider le score final sur leur interface de table.
- **Lancement des matchs** : L'organisateur "lance" les matchs sur les tables disponibles. Une table ne peut avoir qu'un seul match `in_progress` à la fois.

## QR Codes
Chaque table possède un identifiant unique (1, 2, 3...). Les QR codes pointent vers `/table/{numero}`. Cela permet une rotation rapide des joueurs sur les tables sans intervention manuelle sur le device de marque.
