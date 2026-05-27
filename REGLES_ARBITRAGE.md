# Règles Sportives et Arbitrages — Ping Manager

Ce document présente l'application directe des règles officielles du tennis de table adaptées au fonctionnement informatique autonome de **Ping Manager**.

---

## 1. Règles Architecturales d'un Set et d'un Match

Chaque rencontre s'articule autour des paramètres sportifs paramétrés au niveau du tournoi :

### Format d'un Set
- **Score nominal** : Le set se dispute en 11 points.
- **Règle de l'écart** : Pour remporter le set, un joueur doit marquer au moins 11 points ET posséder au moins 2 points d'avance sur son adversaire (ex: 11-9, 12-10, 15-13). Il n'y a pas de limite maximale de score dans un set (la saisie reste ouverte tant que les 2 points d'écart ne sont pas atteints).

### Format d'un Match
- En configuration "2 sets gagnants" (Meilleur des 3 sets) : Le match se termine dès qu'un joueur atteint 2 sets à son actif. Le score de sets possible est de 2-0 ou 2-1.
- En configuration "3 sets gagnants" (Meilleur des 5 sets) : Le match se termine dès qu'un joueur atteint 3 sets à son actif (3-0, 3-1, 3-2).

---

## 2. Modes d'Arbitrage et Validations Mutuelles

Selon la configuration du tournoi, la validation des scores s'adapte pour éliminer la triche et les saisies accidentelles :

### Mode Saisie Organisateur / Arbitre de Table
Un arbitre dédié ou l'organisateur saisit directement les points au fur et à mesure du match. La validation finale est immédiate dès le dernier set vainqueur rempli, transmettant directement le statut "Terminé" à la base.

### Mode Auto-Arbitrage (Par les Joueurs)
Les joueurs marquent leurs points de manière autonome sur leur propre téléphone :
- À la fin du match, le marqueur affiche un écran de récapitulatif global avec le vainqueur automatique calculé selon le nombre de sets.
- Le match ne passera au statut officiel "Terminé" (permettant la progression dans le tableau) que si **les deux compétiteurs confirment visuellement le score final** sur l'écran.
- Des booléens de vérification mutuelle sont mis à jour en base de données. Si un désaccord de score survient, le bouton d'alerte permet d'appeler l'arbitre général de la salle pour débloquer la table manuellement.

---

## 3. Exclusion de Match (Walkover / Forfait)

Si un compétiteur est absent de la salle lors de l'appel de son match après un temps réglementaire, l'organisateur peut déclarer un "Walkover" (forfait) :
- Le joueur présent est déclaré vainqueur par forfait.
- Aucun set ou point n'est comptabilisé en base de données pour préserver l'intégrité de l'historique d'échange (aucun set n'est créé).
- Le match reçoit le statut "Forfait" (walkover) et le joueur présent est immédiatement qualifié pour le tour suivant.

---

## 4. Attribution des Dossards Uniques

Pour l'affichage public, la distribution des fiches d'inscription et l'appel micro, un dossard est indispensable :
- À la clôture des inscriptions (passage à la phase des poules), le système parcourt tous les joueurs pointés présents dans l'ordre alphabétique de leur nom.
- Un entier incrémental unique de 1 à *N* est stocké dans la colonne de dossard de chaque fiche joueur.
- Ce numéro de dossard accompagne le nom du joueur sur tous les canaux de communication (affichage des matchs en cours, SMS, fiches de scores).
