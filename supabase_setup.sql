-- SCRIPT D'INITIALISATION POUR TOURNOISTT

-- 1. Nettoyage (Optionnel, à utiliser avec prudence)
-- DROP TABLE IF EXISTS sets;
-- DROP TABLE IF EXISTS matches;
-- DROP TABLE IF EXISTS pool_players;
-- DROP TABLE IF EXISTS pools;
-- DROP TABLE IF EXISTS players;
-- DROP TABLE IF EXISTS tournament_tables;
-- DROP TABLE IF EXISTS tournaments;

-- 2. Table des Tournois
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date DATE,
    end_date DATE,
    description TEXT,
    location TEXT,
    nb_tables INTEGER DEFAULT 1,
    sets_to_win INTEGER DEFAULT 2,
    points_per_set INTEGER DEFAULT 11,
    score_mode TEXT DEFAULT 'referee', -- 'referee' ou 'players'
    payment_methods JSONB NOT NULL DEFAULT '{"cb": false, "cash": true, "check": false, "transfer": false, "onSite": true}'::jsonb,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'registration', 'pools', 'bracket', 'in_progress', 'finished', 'closed', 'archived')),
    starts_at TIMESTAMPTZ,
    max_categories_per_day INTEGER DEFAULT 3, -- Limite de tableaux par jour par joueur
    created_at TIMESTAMPTZ DEFAULT NOW(),
    organizer_id UUID REFERENCES auth.users(id) -- Pour lier à l'utilisateur connecté
);

-- Table des Tables physiques par tournoi
CREATE TABLE tournament_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'busy', 'reserved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, table_number)
);

-- Note: Dans Dashboard.tsx, l'id est parfois géré manuellement via auth.uid()
-- Si vous utilisez gen_random_uuid(), assurez-vous que organizer_id capture auth.uid()

-- 3. Table des Joueurs
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    club TEXT,
    serie TEXT,
    checked_in BOOLEAN DEFAULT TRUE,
    licence_number TEXT,
    pts_phase1 INTEGER,
    pts_phase2 INTEGER,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des Poules
CREATE TABLE pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'finished'))
);

-- Table de liaison Poules <-> Joueurs (Many-to-Many)
CREATE TABLE pool_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pool_id, player_id)
);

-- 5. Table des Matchs
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    pool_id UUID REFERENCES pools(id) ON DELETE SET NULL,
    player1_id UUID REFERENCES players(id) ON DELETE SET NULL,
    player2_id UUID REFERENCES players(id) ON DELETE SET NULL,
    table_number INTEGER,
    round TEXT NOT NULL, -- 'pool', 'eighth', 'quarter', 'semi', 'final', etc.
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'finished', 'walkover')),
    winner_id UUID REFERENCES players(id) ON DELETE SET NULL,
    validated_by_p1 BOOLEAN DEFAULT FALSE,
    validated_by_p2 BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table des Sets (Détails des scores)
CREATE TABLE sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    score_p1 INTEGER DEFAULT 0,
    score_p2 INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des catégories de tableau (Tableaux de compétition)
CREATE TABLE table_categories (
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

-- Table des Archives de Tournois
CREATE TABLE tournament_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID UNIQUE,
    organizer_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    date DATE,
    location TEXT,
    nb_tables INTEGER,
    nb_joueurs_total INTEGER DEFAULT 0,
    nb_matchs_total INTEGER DEFAULT 0,
    tableaux JSONB NOT NULL DEFAULT '[]',
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Activation de la Sécurité (RLS)
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_archives ENABLE ROW LEVEL SECURITY;

-- 8. Politiques de Sécurité (Exemple simple : Lecture pour tous, Ecriture pour l'organisateur)

-- Tournaments : Lecture publique, Ecriture si propriétaire
CREATE POLICY "Public Read" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Organizer All" ON tournaments FOR ALL USING (auth.uid() = organizer_id);

-- Tables physiques
CREATE POLICY "Public Read Tournament Tables" ON tournament_tables FOR SELECT USING (true);
CREATE POLICY "Auth All Tournament Tables" ON tournament_tables FOR ALL USING (auth.role() = 'authenticated');

-- Autres tables : Lecture publique, Modification autorisée pour les utilisateurs connectés
-- (À affiner selon vos besoins réels de sécurité)
CREATE POLICY "Public Read Players" ON players FOR SELECT USING (true);
CREATE POLICY "Auth Insert Players" ON players FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Update Players" ON players FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Delete Players" ON players FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Public Read Pools" ON pools FOR SELECT USING (true);
CREATE POLICY "Auth All Pools" ON pools FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public Read Pool Players" ON pool_players FOR SELECT USING (true);
CREATE POLICY "Auth All Pool Players" ON pool_players FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public Read Matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Auth All Matches" ON matches FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public Read Sets" ON sets FOR SELECT USING (true);
CREATE POLICY "Auth All Sets" ON sets FOR ALL USING (auth.role() = 'authenticated');

-- Policies pour les catégories de tableau (table_categories)
CREATE POLICY "Public Read Table Categories" ON table_categories FOR SELECT USING (true);
CREATE POLICY "Auth All Table Categories" ON table_categories FOR ALL USING (auth.role() = 'authenticated');

-- Archives : Lecture publique, Insertion & Modification par le propriétaire des archives
CREATE POLICY "Public Read Archives" ON tournament_archives FOR SELECT USING (true);
CREATE POLICY "Organizer All Archives" ON tournament_archives FOR ALL USING (auth.uid() = organizer_id);

-- 9. Publication temps réel (Realtime) de manière sécurisée
-- Permet à Supabase de diffuser les changements sur les tables sélectionnées sans erreur de duplication
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['tournaments', 'tournament_tables', 'players', 'pools', 'pool_players', 'matches', 'sets', 'tournament_archives', 'table_categories'];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON c.oid = pr.prrelid 
            JOIN pg_publication p ON p.oid = pr.prpubid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
        END IF;
    END LOOP;
END $$;
