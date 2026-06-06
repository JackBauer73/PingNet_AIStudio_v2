-- ==========================================
-- SCRIPT DE MIGRATION POUR LE WORKFLOW & ARCHIVAGE
-- Exécutez ce script dans l'éditeur SQL de Supabase
-- ==========================================

-- 1. Ajout de la colonne starts_at sur la table des tournois (Tâche 1 & 2)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS players_per_pool INTEGER DEFAULT 3;

-- Ajout de la colonne checked_in sur la table des joueurs (Pointage de la Tâche 3)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS licence_number TEXT,
  ADD COLUMN IF NOT EXISTS points INTEGER;

-- Suppression des anciennes colonnes si elles existent
ALTER TABLE players DROP COLUMN IF EXISTS pts_phase1;
ALTER TABLE players DROP COLUMN IF EXISTS pts_phase2;

COMMENT ON COLUMN tournaments.starts_at IS
  'Date et heure de début du tournoi — déclenche le passage automatique en in_progress';

-- 2. Mise à jour de la contrainte CHECK sur le statut des tournois (Tâche 1)
-- Permet d'intégrer les statuts du workflow sans casser les statuts existants
ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_status_check;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('draft', 'open', 'registration', 'pools', 'bracket', 'in_progress', 'finished', 'closed', 'archived'));

-- 3. Table des archives du club/tournois (Tâche 4, 5, 6)
CREATE TABLE IF NOT EXISTS tournament_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID UNIQUE,                  -- Référence soft
    organizer_id UUID REFERENCES auth.users(id), -- Identifie l'organisateur/club
    name TEXT NOT NULL,
    date DATE,
    location TEXT,
    nb_tables INTEGER,
    nb_joueurs_total INTEGER DEFAULT 0,
    nb_matchs_total INTEGER DEFAULT 0,
    tableaux JSONB NOT NULL DEFAULT '[]',       -- Résultats des poules/podiums au format JSON
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activation de RLS pour les archives
ALTER TABLE tournament_archives ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité
DROP POLICY IF EXISTS "Public Read Archives" ON tournament_archives;
CREATE POLICY "Public Read Archives" ON tournament_archives FOR SELECT USING (true);

DROP POLICY IF EXISTS "Organizer All Archives" ON tournament_archives;
CREATE POLICY "Organizer All Archives" ON tournament_archives FOR ALL USING (auth.uid() = organizer_id);

-- 4. Publication de la table de real-time de manière sécurisée
-- Pour s'assurer que les changements sont diffusés sans erreur si déjà ajoutés
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'tournament_archives'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_archives;
  END IF;
END $$;

-- 5. Ajout des colonnes pour la logique avancée du tournoi (Tâche Création Avancée)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS max_categories_per_day INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS current_day INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payment_methods JSONB NOT NULL DEFAULT '{"cb": false, "cash": true, "check": false, "transfer": false, "onSite": true}'::jsonb;

-- 6. Table des tableaux de compétition (table_categories)
CREATE TABLE IF NOT EXISTS table_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    min_points INTEGER DEFAULT 500,
    max_points INTEGER DEFAULT 3000,
    price DECIMAL(10, 2) DEFAULT 0.00,
    capacity INTEGER DEFAULT 32,
    start_time TEXT,
    day_number INTEGER DEFAULT 1,
    gender_restriction TEXT CHECK (gender_restriction IN ('M', 'F', 'ALL')) DEFAULT 'ALL',
    age_categories TEXT,
    color_code TEXT DEFAULT '#4f46e5',
    registered_count INTEGER DEFAULT 0,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, name)
);

-- Assurer que la colonne is_closed existe sur les bases de données existantes
ALTER TABLE table_categories ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;

-- Activation de RLS pour les catégories de tableau
ALTER TABLE table_categories ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité pour les catégories de tableau
DROP POLICY IF EXISTS "Public Read Table Categories" ON table_categories;
CREATE POLICY "Public Read Table Categories" ON table_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth All Table Categories" ON table_categories;
CREATE POLICY "Auth All Table Categories" ON table_categories FOR ALL USING (auth.role() = 'authenticated');

-- Publication pour temps réel de manière sécurisée
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'table_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE table_categories;
  END IF;
END $$;

-- 7. SECTION SYSTÈME DE DOSSARD (Tâche 1 Migration SQL)
-- Table players (utilisée par notre app)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS dossard INTEGER,
  ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;

-- On supprime l'index unique restrictif car un joueur physique peut avoir plusieurs inscriptions 
-- (plusieurs lignes dans la table players) dans un même tournoi, et l'index unique empêchait 
-- de leur donner le même dossard.
DROP INDEX IF EXISTS idx_players_dossard_tournament;

-- Table registrations (pour compatibilité avec le script d'exécution SQL d'autres contextes si nécessaire)
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID,
  user_id TEXT,
  dossard INTEGER,
  checked_in BOOLEAN DEFAULT FALSE,
  paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS dossard INTEGER,
  ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT FALSE;

-- Index pour accélérer les recherches de dossards par tournoi (enlevé de UNIQUE pour permettre le partage du dossard entre inscriptions du même joueur)
DROP INDEX IF EXISTS idx_registrations_dossard_tournament;
CREATE INDEX IF NOT EXISTS idx_registrations_dossard_tournament
  ON registrations(tournament_id, dossard)
  WHERE dossard IS NOT NULL;


-- ==========================================
-- regle poules
-- ==========================================
-- Logique de génération des poules (FFTT) implémentée côté serveur / frontend :
-- 1. Tri DESC des joueurs par points
-- 2. Répartition serpentine uniforme
-- 3. Séparation des joueurs du même club avec recherche d'écart de points minimal
-- 4. Ordre FFTT officiel des matchs (poule de 3 : A-B, A-C, B-C / poule de 4 : A-D, B-C, A-C, B-D, A-B, C-D)

-- Suppression de l'index unique restrictif s'il a été créé
DROP INDEX IF EXISTS idx_registrations_user_tournament_unique;

-- Index unique pour empêcher qu'un joueur physique soit inscrit plusieurs fois au même tableau
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_player_category_unique
  ON registrations(player_id, table_category_id);

-- Activation de RLS pour la table registrations
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Suppression des anciennes politiques si elles existent
DROP POLICY IF EXISTS "Public Read Registrations" ON registrations;
DROP POLICY IF EXISTS "Public Insert Registrations" ON registrations;
DROP POLICY IF EXISTS "Public Update Registrations" ON registrations;
DROP POLICY IF EXISTS "Public Delete Registrations" ON registrations;

-- Création des nouvelles politiques de sécurité pour registrations
CREATE POLICY "Public Read Registrations" ON registrations FOR SELECT USING (true);
CREATE POLICY "Public Insert Registrations" ON registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Registrations" ON registrations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public Delete Registrations" ON registrations FOR DELETE USING (true);

-- Ajout de la table registrations aux publications temps réel (realtime)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
  END IF;
END $$;


-- =========================================================================
-- MISE À JOUR SECURITÉ (RLS) DES MATCHS ET DES SETS POUR LE PORTAIL JOUEURS
-- =========================================================================
-- Permet aux joueurs d'entrer et valider les scores de leur table sans authentification

-- Politiques pour la table MATCHS
DROP POLICY IF EXISTS "Public Update Matches" ON matches;
CREATE POLICY "Public Update Matches" ON matches FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Insert Matches" ON matches;
CREATE POLICY "Public Insert Matches" ON matches FOR INSERT WITH CHECK (true);


-- Politiques pour la table SETS
DROP POLICY IF EXISTS "Public Insert Sets" ON sets;
CREATE POLICY "Public Insert Sets" ON sets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Sets" ON sets;
CREATE POLICY "Public Update Sets" ON sets FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Delete Sets" ON sets;
CREATE POLICY "Public Delete Sets" ON sets FOR DELETE USING (true);



-- =========================================================================
-- ARCHITECTURE DU TABLEAU FINAL (BRACKET RESILIENT ET HYBRIDE)
-- =========================================================================

-- 1. Créer la table brackets pour porter les métadonnées du tableau final
CREATE TABLE IF NOT EXISTS public.brackets (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  UUID        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category_id    UUID        NOT NULL REFERENCES public.table_categories(id) ON DELETE CASCADE,
  ted_size       INTEGER     NOT NULL CHECK (ted_size IN (2,4,8,16,32,64,128)),
  nb_qualifiers  INTEGER     NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','in_progress','finished')),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tournament_id, category_id)
);

-- Activation de RLS pour les brackets
ALTER TABLE public.brackets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Brackets" ON public.brackets;
CREATE POLICY "Public Read Brackets" ON public.brackets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth All Brackets" ON public.brackets;
CREATE POLICY "Auth All Brackets" ON public.brackets FOR ALL USING (auth.role() = 'authenticated');


-- 2. Enrichir la table matches classique avec des colonnes destinées au Bracket
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS bracket_id       UUID    REFERENCES public.brackets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS bracket_position INTEGER,
  ADD COLUMN IF NOT EXISTS bracket_round    TEXT;


-- 3. Indexation de performance pour accélérer les requêtes de bracket
CREATE INDEX IF NOT EXISTS idx_matches_bracket_id  ON public.matches(bracket_id);
CREATE INDEX IF NOT EXISTS idx_matches_bracket_pos ON public.matches(bracket_id, bracket_position);
CREATE INDEX IF NOT EXISTS idx_brackets_tournament ON public.brackets(tournament_id, category_id);


-- 4. Publication de la nouvelle table brackets pour la technologie Realtime Supabase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'brackets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.brackets;
  END IF;
END $$;


-- ==========================================
-- POLITIQUES DE SÉCURITÉ (RLS) COMPLÉMENTAIRES
-- Pour permettre l'inscription anonyme et l'usage des Jeton Joueurs
-- ==========================================

-- A. Table des Joueurs (players) : doit pouvoir être alimentée de façon anonyme
DROP POLICY IF EXISTS "Public Insert Players" ON players;
DROP POLICY IF EXISTS "Public Update Players" ON players;
CREATE POLICY "Public Insert Players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Players" ON players FOR UPDATE USING (true) WITH CHECK (true);

-- B. Table des Jeton Joueurs (player_tokens) : doit pouvoir être gérée publiquement
ALTER TABLE public.player_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Player Tokens" ON public.player_tokens;
DROP POLICY IF EXISTS "Public Insert Player Tokens" ON public.player_tokens;
DROP POLICY IF EXISTS "Public Update Player Tokens" ON public.player_tokens;
DROP POLICY IF EXISTS "Public Delete Player Tokens" ON public.player_tokens;

CREATE POLICY "Public Read Player Tokens" ON public.player_tokens FOR SELECT USING (true);
CREATE POLICY "Public Insert Player Tokens" ON public.player_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Player Tokens" ON public.player_tokens FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public Delete Player Tokens" ON public.player_tokens FOR DELETE USING (true);

-- C. Publication en temps réel pour player_tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    WHERE p.pubname = 'supabase_realtime' AND c.relname = 'player_tokens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.player_tokens;
  END IF;
END $$;


-- =========================================================================
-- MISE JEU WORKFLOW DE SAISIE DE MATCH (PING MANAGER V2)
-- =========================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS scorer_id               UUID REFERENCES public.players(id),
  ADD COLUMN IF NOT EXISTS scorer_role             TEXT CHECK (scorer_role IN ('player','arbiter','third_player')),
  ADD COLUMN IF NOT EXISTS p1_present              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS p2_present              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS awaiting_validation_since TIMESTAMPTZ;

-- Ajout des validations du classement de poule sur la table pools
ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS validated_by            JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS awaiting_validation_since TIMESTAMPTZ;

-- Autoriser la modification publique de la table pools sous RLS pour finaliser la clôture
DROP POLICY IF EXISTS "Public Update Pools" ON public.pools;
CREATE POLICY "Public Update Pools" ON public.pools FOR UPDATE USING (true) WITH CHECK (true);






