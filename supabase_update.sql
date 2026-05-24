-- ==========================================
-- SCRIPT DE MIGRATION POUR LE WORKFLOW & ARCHIVAGE
-- Exécutez ce script dans l'éditeur SQL de Supabase
-- ==========================================

-- 1. Ajout de la colonne starts_at sur la table des tournois (Tâche 1 & 2)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;

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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, name)
);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_dossard_tournament
  ON registrations(tournament_id, dossard)
  WHERE dossard IS NOT NULL;

