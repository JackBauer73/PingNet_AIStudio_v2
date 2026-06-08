# Algorithme du Tableau Final — Ping Manager

Ce guide explique en détail l'organisation, le placement et la gestion mathématique des joueurs au sein du tableau final à élimination directe (bracket).

---

## 1. Modélisation et Taille du Tableau

À la fin de l'étape des poules (qualifications), l'algorithme récupère précisément les deux premiers joueurs de chaque classement final de poule.
Le nombre de qualifiés obtenus détermine la taille officielle du tableau final (notée *T*), qui doit impérativement être une puissance de deux :

- **Jusqu'à 2 qualifiés** : Tableau de 2 joueurs (Finale directe).
- **De 3 à 4 qualifiés** : Tableau de 4 places (Demi-finales).
- **De 5 à 8 qualifiés** : Tableau de 8 places (Quarts de finale).
- **De 9 à 16 qualifiés** : Tableau de 16 places (Huitièmes de finale).
- **De 17 à 32 qualifiés** : Tableau de 32 places (Seizièmes de finale).
- **De 33 à 64 qualifiés** : Tableau de 64 places (Trente-deuxièmes de finale).

---

## 2. Classement des Qualifiés & Attribution des Graines (Seeding)

Afin d'éviter que les meilleurs joueurs de la compétition ne s'éliminent entre eux dès le premier tour, l'algorithme procède à un placement géométrique précis appelé le "seeding" :

### Étape A : Tri par points de force initiaux
Tous les qualifiés du tableau sont triés par ordre décroissant selon leur classement de points FFTT d'origine (et non pas leur nombre de victoires en poule). C'est ce classement d'origine qui détermine leur numéro de graine officielle de 1 à *S* (*S* étant le nombre réel de qualifiés).

### Étape B : Tableau de placement théorique
Pour chaque taille de tableau, il existe un ordre international de répartition des graines de gauche à droite sur les lignes de départ afin de séparer harmonieusement les forces (les têtes de série 1 et 2 aux deux extrémités opposées du tableau, etc.) :
- **Tableau de 4 places** : Ordre [1, 4, 2, 3]
- **Tableau de 8 places** : Ordre [1, 8, 4, 5, 2, 7, 3, 6]
- **Tableau de 16 places** : Ordre [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
- **Tableau de 32 places** : Ordre [1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 2, 31, 15, 18, 7, 26, 10, 23, 3, 30, 14, 19, 6, 27, 11, 22]

### Étape C : Les Exemptions (BYEs)
Lorsque le nombre réel de qualifiés est inférieur à la taille théorique du tableau (*S < T*), certaines cases de départ n'ont aucun joueur.
- Toutes les graines associées à des numéros supérieurs à *S* sont déclarées "BYE" (exemption).
- Le match du premier tour opposant une graine existante à une graine "BYE" est marqué instantanément comme terminé à la création du tableau.
- Le joueur présent est automatiquement qualifié pour le tour suivant (propagation automatique sans jouer).

---

## 3. Propagation du Vainqueur (Formule Mathématique)

La structure entière du tableau final est représentée à plat en base de données par un ensemble de matchs ayant chacun un numéro d'index unique de position (noté *P*, allant de 0 à *T-2*).

### Le calcul de la position suivante
Pour faire progresser le vainqueur d'un match situé en position *P*, le système utilise une formule arithmétique rigoureuse dépendante de l'organisation structurelle du tour.
Chaque tour de taille *R* (ex : Huitième, Quart, Demi-finale) est placé l'un après l'autre à la suite des index en base de données.
Le match suivant est déterminé en appliquant un décalage d'offset de taille et une division binaire de la position relative dans le tour en cours :

1. On identifie à quel tour appartient le match actuel.
2. On extrait l'index relatif du match au sein de son sous-tour.
3. On calcule l'offset de début du tour de destination.
4. L'index du match suivant est égal à l'offset de destination ajouté à la division par 2 arrondie à l'entier inférieur de l'index relatif du tour actuel.

### Affectation de la fente (Joueur 1 ou Joueur 2)
Une rencontre comporte exactement deux fentes : "Joueur 1" et "Joueur 2".
- Si l'index du match actuel du joueur est **pair**, le joueur vainqueur est injecté dans la fente "Joueur 1" du match de destination calculé ci-dessus.
- Si l'index du match actuel du joueur est **impair**, le joueur vainqueur est injecté dans la fente "Joueur 2" du match de destination.

---

## 4. Gestion de la Petite Finale (Match pour la 3e place)

Pour valoriser les performances des demi-finalistes éliminés et attribuer proprement la médaille de bronze :
- Lors des deux rencontres de demi-finales, le système extrait pour chaque match le joueur perdant (noté *L*, celui qui n'a pas été désigné comme vainqueur).
- L'index de position de la petite finale est codé de manière figée sur la dernière ligne du tableau (index *T-1*).
- Les perdants des deux demi-finales sont injectés en temps réel dans ce match de classement, reprenant la même logique de fente (le perdant de la première demi-finale va en "Joueur 1", le perdant de la seconde en "Joueur 2").
- Ce match se dispute en parallèle de la grande finale.
