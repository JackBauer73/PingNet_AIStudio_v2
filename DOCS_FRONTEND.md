# TournoisTT - Interface & Navigation

## Architecture de l'Application

### Routes Publiques
- `/login` : Connexion pour l'organisateur.
- `/table/:tableNumber` : Interface dédiée à une table (utilisée par les joueurs pour marquer les points).

### Routes Organisateur (Protégées)
- `/organizer/` (Dashboard) : Vue d'ensemble du tournoi en cours, création de tournoi.
- `/organizer/players` : Gestion de la liste des inscrits.
- `/organizer/pools` : Génération et suivi des poules de qualification.
- `/organizer/bracket` : Tableau des phases finales (élimination directe).
- `/organizer/scores` : Historique complet des matchs et détails des sets.
- `/organizer/settings` : Paramètres du tournoi.
- `/organizer/print` : Page d'impression des QR Codes pour chaque table.

## Composants Clés
- **OrganizerLayout** : Barre de navigation latérale et structure commune.
- **TableView** : Interface ultra-optimisée pour mobile/tablette permettant de scorer un match par simple clic (gros boutons).
- **ProtectedRoute** : Vérification de la session Supabase Auth.
- **Trophy/Medal Icons** : Utilisés pour identifier les vainqueurs et les étapes clés.

## Hooks Personnalisés
L'accès aux données est simplifié par des hooks dédiés qui encapsulent la logique Supabase et le temps réel :
- `useTournament` : Récupère les infos du tournoi actif et permet d'en changer le statut.
- `usePlayers`, `usePools`, `useMatches` : Listes filtrées par tournoi.
- `useTableMatch` : Spécifique à l'interface de table, gère le score du match en cours sur une table précise.
- `useNetworkStatus` : Surveille la connexion internet (crucial pour le scoring en direct).

## Client Supabase
Le client est configuré dans `src/supabase.ts`. Il utilise les variables d'environnement pour l'URL et la clé anonyme.
