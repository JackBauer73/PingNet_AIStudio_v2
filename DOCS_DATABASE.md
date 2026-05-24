# TournoisTT - Base de Données & Modèles

## Schéma Supabase

### Tables Principales

1. **tournaments**
   - `id` (UUID, PK)
   - `name` (TEXT)
   - `location` (TEXT, Nullable)
   - `date` (DATE)
   - `status` (ENUM: 'registration', 'pools', 'bracket', 'finished')
   - `nb_tables` (INT) : Nombre de tables disponibles.
   - `sets_to_win` (INT) : Nombre de sets gagnants (2 ou 3).
   - `points_per_set` (INT) : Points pour gagner un set (souvent 11).
   - `score_mode` (ENUM: 'referee', 'players')
   - `created_at` (TIMESTAMPTZ)

2. **players**
   - `id` (UUID, PK)
   - `tournament_id` (FK -> tournaments.id)
   - `first_name` (TEXT)
   - `last_name` (TEXT)
   - `phone` (TEXT, Nullable)
   - `club` (TEXT, Nullable)
   - `serie` (TEXT) : Classement ou catégorie.
   - `registered_at` (TIMESTAMPTZ)

3. **pools**
   - `id` (UUID, PK)
   - `tournament_id` (FK -> tournaments.id)
   - `name` (TEXT)
   - `status` (ENUM: 'pending', 'in_progress', 'finished')

4. **matches**
   - `id` (UUID, PK)
   - `tournament_id` (FK -> tournaments.id)
   - `pool_id` (FK -> pools.id, Nullable)
   - `player1_id` (FK -> players.id, Nullable)
   - `player2_id` (FK -> players.id, Nullable)
   - `table_number` (INT, Nullable)
   - `round` (ENUM: 'pool', 'eighthfinal', 'quarterfinal', 'semifinal', 'final', '3rd_place')
   - `status` (ENUM: 'pending', 'in_progress', 'finished', 'walkover')
   - `winner_id` (FK -> players.id, Nullable)
   - `validated_by_p1` (BOOLEAN)
   - `validated_by_p2` (BOOLEAN)
   - `started_at` (TIMESTAMPTZ, Nullable)
   - `finished_at` (TIMESTAMPTZ, Nullable)

5. **sets**
   - `id` (UUID, PK)
   - `match_id` (FK -> matches.id)
   - `set_number` (INT)
   - `score_p1` (INT)
   - `score_p2` (INT)

## Temps Réel (Realtime)
L'application utilise les channels Supabase pour :
- Mettre à jour les scores en direct sur le tableau de bord de l'organisateur.
- Actualiser l'affichage des joueurs sur les tables.
- Synchroniser l'état du tournoi (passage aux phases finales).
