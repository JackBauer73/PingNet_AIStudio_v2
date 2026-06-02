export type TournamentStatus = 'draft' | 'open' | 'registration' | 'pools' | 'bracket' | 'in_progress' | 'finished' | 'closed' | 'archived';
export type ScoreMode = 'referee' | 'players';
export type MatchStatus = 'pending' | 'in_progress' | 'awaiting_validation' | 'disputed' | 'finished' | 'walkover';
export type RoundType = 'pool' | 'thirtysecondfinal' | 'sixteenthfinal' | 'eighthfinal' | 'quarterfinal' | 'semifinal' | 'final' | '3rd_place';

export interface Tournament {
  id: string;
  name: string;
  location: string | null;
  date: string;
  end_date?: string | null;
  description?: string | null;
  status: TournamentStatus;
  nb_tables: number;
  sets_to_win: number;
  points_per_set: number;
  score_mode: ScoreMode;
  max_categories_per_day?: number | null;
  players_per_pool?: number | null;
  current_day?: number | null;
  starts_at?: string | null;
  payment_methods?: {
    cb: boolean;
    cash: boolean;
    check: boolean;
    transfer: boolean;
    onSite: boolean;
    registration_periods?: Record<string, { start: string; end: string }>;
  };
  created_at: string;
}

export interface TableCategory {
  id: string;
  tournament_id: string;
  name: string;
  min_points: number;
  max_points: number;
  price: number;
  capacity: number;
  start_time: string | null;
  day_number: number;
  gender_restriction: 'M' | 'F' | 'ALL';
  age_categories: string | null;
  color_code: string;
  registered_count: number;
  created_at: string;
}

export interface Player {
  id: string;
  player_id?: string;
  table_category_id?: string;
  tournament_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email?: string | null;
  token?: string | null;
  club: string | null;
  serie: string;
  checked_in?: boolean;
  licence_number?: string | null;
  points?: number | null;
  dossard?: number | null;
  paid?: boolean;
  registered_at: string;
}

export interface Pool {
  id: string;
  tournament_id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'awaiting_validation' | 'finished';
  table_number?: number | null;
  table_category_id?: string | null;
  validated_by?: string[] | null;
  awaiting_validation_since?: string | null;
  created_at: string;
}

export interface Bracket {
  id: string;
  tournament_id: string;
  category_id: string;
  ted_size: number;
  nb_qualifiers: number;
  status: 'pending' | 'in_progress' | 'finished';
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  pool_id: string | null;
  bracket_id?: string | null;
  bracket_position?: number | null;
  bracket_round?: string | null;
  player1_id: string | null;
  player2_id: string | null;
  table_number: number | null;
  round: RoundType;
  status: MatchStatus;
  winner_id: string | null;
  validated_by_p1: boolean;
  validated_by_p2: boolean;
  started_at: string | null;
  finished_at: string | null;
  scorer_id?: string | null;
  scorer_role?: 'player' | 'arbiter' | 'third_player' | null;
  p1_present?: boolean;
  p2_present?: boolean;
  awaiting_validation_since?: string | null;
  created_at: string;
  
  // Optional relations for UI
  player1?: Player;
  player2?: Player;
  sets?: SetScore[];
}

export interface SetScore {
  id: string;
  match_id: string;
  set_number: number;
  score_p1: number;
  score_p2: number;
  created_at: string;
}

export interface PoolStanding {
  pool_id: string;
  player_id: string;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  points_scored: number;
  points_conceded: number;
  points: number;
  set_diff: number;
  point_diff: number;
  first_name: string;
  last_name: string;
  serie: string;
  club: string;
  standing_rank: number;
  dossard?: number | null;
  points_fftt?: number | null;
}
