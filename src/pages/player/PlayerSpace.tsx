import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  Loader2, 
  MapPin, 
  Calendar, 
  Copy,
  ChevronLeft,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';

/* ───────────────────────── custom sport-tech mockup icons ───────────────── */
function Icon({ name, size = 24, stroke = 2, color = "currentColor", className = "" }: { name: string; size?: number; stroke?: number; color?: string; className?: string }) {
  const p = { fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    qr: <g {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h.01M21 17v4h-4"/></g>,
    bracket: <g {...p}><path d="M5 4v4a3 3 0 0 0 3 3h3"/><path d="M5 20v-4a3 3 0 0 1 3-3h3"/><path d="M11 12h4"/><path d="M19 12a2 2 0 1 0 0-.01"/><rect x="15" y="9.5" width="0" height="0"/></g>,
    swords: <g {...p}><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 6 6"/><path d="m8 17-2 2"/><path d="m5 19-2-2"/></g>,
    chevR: <g {...p}><path d="m9 6 6 6-6 6"/></g>,
    chevL: <g {...p}><path d="m15 6-6 6 6 6"/></g>,
    check: <g {...p}><path d="M20 6 9 17l-5-5"/></g>,
    trophy: <g {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></g>,
    clock: <g {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>,
    table: <g {...p}><path d="M3 10h18"/><rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M12 10v8M7 18v2M17 18v2"/></g>,
    user: <g {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></g>,
    card: <g {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></g>,
    flame: <g {...p}><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 1-3 .5 2 2 2 2 2 .5-3-2-4 2-9Z"/></g>,
    dot: <g><circle cx="12" cy="12" r="4" fill={color} stroke="none"/></g>,
    x: <g {...p}><path d="M18 6 6 18M6 6l12 12"/></g>,
    info: <g {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></g>,
    cal: <g {...p}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}

/* ───────────────────────── Badges Component ──────────────────────────────── */
function Badge({ children, tone = "slate", icon, soft = true, className = "" }: { children: React.ReactNode; tone?: string; icon?: string; soft?: boolean; className?: string }) {
  const tones: Record<string, string[]> = {
    slate: ["#475569", "#f1f5f9"],
    indigo: ["#4f46e5", "#eef2ff"],
    blue: ["#1d4ed8", "#dbeafe"],
    green: ["#047857", "#d1fae5"],
    red: ["#b91c1c", "#fee2e2"],
    orange: ["#c2410c", "#ffedd5"],
    amber: ["#a16207", "#fef9c3"],
  };
  const [fg, bgc] = tones[tone] || tones.slate;
  return (
    <span className={`badge inline-flex items-center gap-1 font-semibold text-[11px] px-2.5 py-1 rounded-full ${className}`} style={{ color: fg, background: soft ? bgc : "transparent" }}>
      {icon && <Icon name={icon} size={12} stroke={2.4} color={fg} />}
      {children}
    </span>
  );
}

function etatBadge(etat: string) {
  switch (etat) {
    case "qualifie": return <Badge tone="green" icon="trophy">Qualifié · tableau final</Badge>;
    case "poules": return <Badge tone="blue" icon="dot">Poules en cours</Badge>;
    case "a_venir": return <Badge tone="slate" icon="clock">À venir</Badge>;
    default: return null;
  }
}

function matchStatut(m: any) {
  if (m.status === "finished") return m.winner_id === m.player1_id
    ? (m.isMeP1 ? { tone: "green", label: "Gagné", icon: "check" } : { tone: "red", label: "Perdu", icon: "x" })
    : (m.isMeP1 ? { tone: "red", label: "Perdu", icon: "x" } : { tone: "green", label: "Gagné", icon: "check" });
  if (m.status === "in_progress") return { tone: "blue", label: "En cours", icon: "dot" };
  return { tone: "slate", label: "À venir", icon: "clock" };
}

export default function PlayerSpace() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [player, setPlayer] = useState<any | null>(null);
  const [tournament, setTournament] = useState<any | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [tournamentBrackets, setTournamentBrackets] = useState<any[]>([]);
  
  // States of mockup interface
  const [activeTab, setActiveTab] = useState<'qr' | 'tableaux' | 'matchs'>('qr');
  const [selectedQRDay, setSelectedQRDay] = useState<number | null>(null);
  const [selectedTableauId, setSelectedTableauId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);

  // Pool details state (for currently selected tableau's detail view)
  const [poolStandings, setPoolStandings] = useState<any[]>([]);
  const [poolDetailsMatches, setPoolDetailsMatches] = useState<any[]>([]);
  const [poolDetailsPlayers, setPoolDetailsPlayers] = useState<any[]>([]);
  const [loadingPoolDetails, setLoadingPoolDetails] = useState(false);

  // Journées uniques auxquelles le joueur participe
  const qrDays: number[] = Array.from<number>(
    new Set<number>(registrations.map(r => (r.table_categories?.day_number as number) || 1))
  ).sort((a: number, b: number) => a - b);

  useEffect(() => {
    if (qrDays.length > 0 && selectedQRDay === null) {
      setSelectedQRDay(qrDays[0]);
    }
  }, [registrations, qrDays, selectedQRDay]);

  const fetchPlayerSpaceData = async () => {
    if (!token) {
      setError("Token manquant");
      setLoading(false);
      return;
    }

    try {
      // Étape 1 — Résoudre le token
      const { data: tokenRow, error: tokenError } = await supabase
        .from('player_tokens')
        .select('player_id, tournament_id')
        .eq('token', token.trim())
        .maybeSingle();

      if (tokenError) throw tokenError;

      if (!tokenRow) {
        setError("Token invalide ou expiré");
        setLoading(false);
        return;
      }

      const playerId = tokenRow.player_id;
      const tournamentId = tokenRow.tournament_id;

      // Étape 2 — Charger le joueur + le tournoi + les brackets
      const [playerRes, tournamentRes, bracketsRes] = await Promise.all([
        supabase
          .from('players')
          .select('*')
          .eq('id', playerId)
          .maybeSingle(),
        supabase
          .from('tournaments')
          .select('id, name, date, end_date, location, status, current_day')
          .eq('id', tournamentId)
          .maybeSingle(),
        supabase
          .from('brackets')
          .select('id, category_id')
          .eq('tournament_id', tournamentId)
      ]);

      if (playerRes.error) throw playerRes.error;
      if (tournamentRes.error) throw tournamentRes.error;

      if (!playerRes.data) {
        setError("Données joueur introuvables");
        setLoading(false);
        return;
      }
      setPlayer(playerRes.data);
      setTournament(tournamentRes.data);
      setTournamentBrackets(bracketsRes.data || []);

      // Stockage local de session pour les validations et scores
      localStorage.setItem('currentPlayerToken', token);
      localStorage.setItem('currentPlayerId', playerId);

      // Étape 3 — Charger les inscriptions avec catégories
      const { data: regs, error: regsError } = await supabase
        .from('registrations')
        .select(`
          id, dossard, checked_in, paid, status,
          table_category_id,
          table_categories (
            id, name, day_number, min_points, max_points,
            start_time, color_code
          )
        `)
        .eq('player_id', playerId)
        .eq('tournament_id', tournamentId);

      if (regsError) throw regsError;
      setRegistrations(regs || []);

      // Étape 4 — Charger les poules du joueur
      const { data: myPoolPlayers, error: ppError } = await supabase
        .from('pool_players')
        .select('pool_id')
        .eq('player_id', playerId);

      if (ppError) throw ppError;

      const poolIds = myPoolPlayers?.map(pp => pp.pool_id) || [];

      if (poolIds.length > 0) {
        const [poolsRes, allPoolPlayersRes] = await Promise.all([
          supabase
            .from('pools')
            .select('id, name, status, table_number, table_category_id')
            .in('id', poolIds),
          supabase
            .from('pool_players')
            .select('pool_id, player_id, players(first_name, last_name, club, points)')
            .in('pool_id', poolIds)
        ]);

        if (poolsRes.error) throw poolsRes.error;
        if (allPoolPlayersRes.error) throw allPoolPlayersRes.error;

        setPools(poolsRes.data || []);
        setPoolPlayers(allPoolPlayersRes.data || []);
      } else {
        setPools([]);
        setPoolPlayers([]);
      }

      // Étape 5 — Charger les matchs du joueur
      const { data: playerMatches, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id, round, status, table_number, pool_id, bracket_id,
          bracket_position, bracket_round,
          winner_id, started_at, finished_at,
          player1_id, player2_id,
          player1:player1_id(first_name, last_name, club),
          player2:player2_id(first_name, last_name, club),
          sets(id, set_number, score_p1, score_p2)
        `)
        .eq('tournament_id', tournamentId)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .order('created_at', { ascending: true });

      if (matchesError) throw matchesError;
      setMatches(playerMatches || []);

    } catch (err: any) {
      console.error(err);
      setError("Erreur inattendue lors du chargement de vos données.");
    } finally {
      setLoading(false);
    }
  };

  const refreshMatches = async () => {
    if (!token || !player || !tournament) return;
    try {
      const { data: playerMatches } = await supabase
        .from('matches')
        .select(`
          id, round, status, table_number, pool_id, bracket_id,
          bracket_position, bracket_round,
          winner_id, started_at, finished_at,
          player1_id, player2_id,
          player1:player1_id(first_name, last_name, club),
          player2:player2_id(first_name, last_name, club),
          sets(id, set_number, score_p1, score_p2)
        `)
        .eq('tournament_id', tournament.id)
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .order('created_at', { ascending: true });
      if (playerMatches) setMatches(playerMatches);
    } catch (err) {
      console.error("Erreur de rafraîchissement des matchs live:", err);
    }
  };

  const refreshRegistrations = async () => {
    if (!token || !player || !tournament) return;
    try {
      const { data: regs } = await supabase
        .from('registrations')
        .select(`
          id, dossard, checked_in, paid, status,
          table_category_id,
          table_categories (
            id, name, day_number, min_points, max_points,
            start_time, color_code
          )
        `)
        .eq('player_id', player.id)
        .eq('tournament_id', tournament.id);
      if (regs) setRegistrations(regs);
    } catch (err) {
      console.error("Erreur de rafraîchissement des inscriptions :", err);
    }
  };

  useEffect(() => {
    fetchPlayerSpaceData();
  }, [token]);

  useEffect(() => {
    if (!tournament?.id) return;

    const channel = supabase.channel(`player_space_${token}_realtime`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'matches',
        filter: `tournament_id=eq.${tournament.id}` 
      }, () => {
        refreshMatches();
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'registrations' 
      }, () => {
        refreshRegistrations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament?.id, player?.id]);

  // Scoped effect for calculating standings of selected category details on the fly
  useEffect(() => {
    if (!selectedTableauId) {
      setPoolStandings([]);
      setPoolDetailsMatches([]);
      setPoolDetailsPlayers([]);
      return;
    }

    const loadPoolStandingsDetails = async () => {
      const activePool = pools.find(p => p.table_category_id === selectedTableauId);
      if (!activePool) return;

      setLoadingPoolDetails(true);
      try {
        const [ppsRes, msRes] = await Promise.all([
          supabase
            .from('pool_players')
            .select('player_id, players(*)')
            .eq('pool_id', activePool.id),
          supabase
            .from('matches')
            .select('*, sets(*)')
            .eq('pool_id', activePool.id)
        ]);

        if (ppsRes.error) throw ppsRes.error;
        if (msRes.error) throw msRes.error;

        const poolPlayersList = ppsRes.data || [];
        const poolMatchesList = msRes.data || [];

        setPoolDetailsPlayers(poolPlayersList);
        setPoolDetailsMatches(poolMatchesList);

        const playersMap = new Map<string, any>();
        poolPlayersList.forEach((pp: any) => {
          if (pp.players) {
            const pData = Array.isArray(pp.players) ? pp.players[0] : pp.players;
            if (pData) {
              playersMap.set(pp.player_id, {
                player_id: pp.player_id,
                first_name: pData.first_name,
                last_name: pData.last_name,
                club: pData.club,
                wins: 0,
                losses: 0,
                sets_won: 0,
                sets_lost: 0,
                points_scored: 0,
                points_conceded: 0,
                points_fftt: pData.points || 500,
                points: 0,
                matches_played: 0
              });
            }
          }
        });

        poolMatchesList.forEach((m: any) => {
          if (m.status === 'finished') {
            const setsP1 = m.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
            const setsP2 = m.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;

            const p1 = playersMap.get(m.player1_id || '');
            const p2 = playersMap.get(m.player2_id || '');

            if (p1) {
              p1.matches_played += 1;
              p1.sets_won += setsP1;
              p1.sets_lost += setsP2;
              p1.points_scored += m.sets?.reduce((acc: number, s: any) => acc + s.score_p1, 0) || 0;
              p1.points_conceded += m.sets?.reduce((acc: number, s: any) => acc + s.score_p2, 0) || 0;
              if (setsP1 > setsP2) {
                p1.points += 2;
                p1.wins += 1;
              } else {
                p1.losses += 1;
              }
            }
            if (p2) {
              p2.matches_played += 1;
              p2.sets_won += setsP2;
              p2.sets_lost += setsP1;
              p2.points_scored += m.sets?.reduce((acc: number, s: any) => acc + s.score_p2, 0) || 0;
              p2.points_conceded += m.sets?.reduce((acc: number, s: any) => acc + s.score_p1, 0) || 0;
              if (setsP2 > setsP1) {
                p2.points += 2;
                p2.wins += 1;
              } else {
                p2.losses += 1;
              }
            }
          }
        });

        const sorted = Array.from(playersMap.values()).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          const diffA = a.sets_won - a.sets_lost;
          const diffB = b.sets_won - b.sets_lost;
          if (diffB !== diffA) return diffB - diffA;
          if (b.sets_won !== a.sets_won) return b.sets_won - a.sets_won;
          return (b.points_scored - b.points_conceded) - (a.points_scored - a.points_conceded);
        });

        // Compute rankings
        const finalSorted = sorted.map((p, index) => ({ ...p, rang: index + 1 }));
        setPoolStandings(finalSorted);

      } catch (err) {
        console.error("Erreur details standings :", err);
      } finally {
        setLoadingPoolDetails(false);
      }
    };

    loadPoolStandingsDetails();
  }, [selectedTableauId, pools, matches]);

  const copyPlayerLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("🔗 Lien de votre espace joueur copié !");
  };

  const translateBracketRound = (roundName: string) => {
    if (!roundName) return 'Phase finale';
    const clean = roundName.toLowerCase();
    if (clean === 'final' || clean === 'finale') return 'Finale';
    if (clean === 'semifinal' || clean === 'demi-finale' || clean === 'demi') return '1/2 finale';
    if (clean === 'quarterfinal' || clean === 'quart' || clean === 'quarts') return '1/4 de finale';
    if (clean === 'eighthfinal' || clean === 'huitieme' || clean === 'huitièmes') return '1/8 de finale';
    if (clean === 'sixteenthfinal' || clean === 'seizieme' || clean === 'seizièmes') return '1/16 de finale';
    if (clean === 'thirtysecondfinal') return '1/32 de finale';
    return roundName;
  };

  const getRoundWeight = (rName: string) => {
    if (!rName) return 0;
    const clean = rName.toLowerCase();
    if (clean.includes('thirty')) return 1;
    if (clean.includes('sixteen')) return 2;
    if (clean.includes('eight')) return 3;
    if (clean.includes('quarter') || clean.includes('quart')) return 4;
    if (clean.includes('semi') || clean.includes('demi')) return 5;
    if (clean.includes('final') && !clean.includes('semi') && !clean.includes('quarter')) return 6;
    return 4;
  };

  const getRoundLabel = (match: any, isUpcoming = false) => {
    if (match.bracket_round) {
      return translateBracketRound(match.bracket_round);
    }
    if (match.round === 'pool') {
      const p = pools.find(pl => pl.id === match.pool_id);
      if (p) {
        if (p.name.includes(' - ')) {
          return p.name.split(' - ').slice(-1)[0];
        }
        return p.name;
      }
      return 'Poule';
    }
    return match.round || (isUpcoming ? 'Poule - Tableau' : 'Tableau');
  };

  const getCategoryState = (categoryId: string) => {
    const plPool = pools.find(p => p.table_category_id === categoryId);
    if (!plPool) return 'a_venir';
    if (plPool.status !== 'finished') return 'poules';

    const hasBracketMatches = matches.some(m => {
      if (!m.bracket_round) return false;
      const mCatId = tournamentBrackets.find(b => b.id === m.bracket_id)?.category_id;
      return mCatId === categoryId;
    });

    if (hasBracketMatches) return 'qualifie';
    return 'poules';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef1f5] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-bold text-sm">Chargement de votre espace personnel...</p>
      </div>
    );
  }

  if (error || !player || !tournament) {
    return (
      <div className="min-h-screen bg-[#eef1f5] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4 shadow-sm border border-rose-100">
          <Icon name="x" size={32} stroke={2.4} color="#ef4444" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Espace joueur introuvable</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6 leading-relaxed font-semibold">
          {error || "Ce jeton de connexion n'est pas ou plus valide pour ce tournoi."}
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all text-sm flex items-center gap-2 cursor-pointer"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  // Pre-calculations of matches
  const processedMatches = matches.map(m => {
    const setsP1 = m.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
    const setsP2 = m.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;
    const isMeP1 = m.player1_id === player.id;
    const mySets = isMeP1 ? setsP1 : setsP2;
    const oppSets = isMeP1 ? setsP2 : setsP1;
    const mGagne = m.status === 'finished' ? (m.winner_id === player.id) : null;
    const opponentData = isMeP1 ? m.player2 : m.player1;
    const opponentName = opponentData ? `${opponentData.first_name || ''} ${opponentData.last_name || ''}`.trim() : "À déterminer";

    // Lookup match category name
    let mCategoryName = "Tableau";
    if (m.pool_id) {
      const pl = pools.find(p => p.id === m.pool_id);
      if (pl) {
        const reg = registrations.find(r => r.table_category_id === pl.table_category_id);
        if (reg?.table_categories?.name) mCategoryName = reg.table_categories.name;
      }
    } else if (m.bracket_id) {
      const catId = tournamentBrackets.find(b => b.id === m.bracket_id)?.category_id;
      const reg = registrations.find(r => r.table_category_id === catId);
      if (reg?.table_categories?.name) mCategoryName = reg.table_categories.name;
    }

    const setsListStr = m.sets
      ? m.sets.sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0))
              .map((s: any) => isMeP1 ? `${s.score_p1}-${s.score_p2}` : `${s.score_p2}-${s.score_p1}`)
              .join(', ')
      : '';

    return {
      ...m,
      isMeP1,
      mySets,
      oppSets,
      gagne: mGagne,
      opponent: opponentData,
      opponentName,
      setsListStr,
      tableauNom: mCategoryName,
      phase: getRoundLabel(m, false),
      score: m.status !== 'pending' ? `${mySets}–${oppSets}` : null
    };
  });

  const liveMatch = processedMatches.find(m => m.status === 'in_progress');
  const nextMatch = processedMatches.find(m => m.status === 'pending');
  const featuredMatch = liveMatch || nextMatch;

  // Group matches by day
  const mGroups = qrDays.map(dayNum => {
    // Filter player categories on this day
    const dayCategoryIds = registrations
      .filter(r => (r.table_categories?.day_number || 1) === dayNum)
      .map(r => r.table_categories?.id);

    const list = processedMatches.filter(m => {
      let mCatId = null;
      if (m.pool_id) {
        mCatId = pools.find(p => p.id === m.pool_id)?.table_category_id;
      } else if (m.bracket_id) {
        mCatId = tournamentBrackets.find(b => b.id === m.bracket_id)?.category_id;
      }
      return mCatId && dayCategoryIds.includes(mCatId);
    });

    return {
      dayNum,
      label: `Journée ${dayNum}`,
      date: `Jour ${dayNum} du tournoi`,
      list
    };
  }).filter(g => g.list.length > 0);

  // Active dates formatting
  const formattedDatesStr = () => {
    if (!tournament.date) return 'Juin 2026';
    const dStart = new Date(tournament.date);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    if (tournament.end_date) {
      const dEnd = new Date(tournament.end_date);
      if (dStart.getMonth() === dEnd.getMonth()) {
        return `${dStart.getDate()} – ${dEnd.getDate()} ${dStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
      }
      return `${dStart.getDate()} ${dStart.toLocaleDateString('fr-FR', { month: 'long' })} – ${dEnd.getDate()} ${dEnd.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
    }
    return dStart.toLocaleDateString('fr-FR', options);
  };

  return (
    <div className={`player-space-root w-full ${darkTheme ? 'dark' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .player-space-root {
          --bg:#eef1f5; --page:#e2e7ee;
          --card:#ffffff; --card2:#f8fafc; --line:#e7ecf2; --line2:#eef2f7;
          --ink:#0f172a; --ink2:#1e293b; --muted:#64748b; --muted2:#94a3b8;
          --accent:#f97316; --accent2:#facc15; --accent-d:#ea580c;
          --indigo:#6366f1; --blue:#3b82f6; --green:#10b981; --red:#ef4444;
          --hero:#0f172a; --hero2:#1e293b; --nav:#0f172a;
          --pad:16px; --gap:14px; --radius:20px;
          --fhead:'Bricolage Grotesque', system-ui, sans-serif;
          --fbody:'Inter', system-ui, sans-serif;
          background: var(--bg);
          min-height: 100vh;
          color: var(--ink);
          font-family: var(--fbody);
        }

        .player-space-root.dark {
          --bg:#0b1220; --card:#131c2e; --card2:#0f1727; --line:#243149; --line2:#1c2940;
          --ink:#f1f5f9; --ink2:#e2e8f0; --muted:#94a3b8; --muted2:#64748b;
          --hero:#060b16; --hero2:#0f172a; --nav:#060b16;
        }

        /* ───── HERO ───── */
        .player-space-root .hero{
          background:linear-gradient(155deg, var(--hero) 0%, var(--hero2) 100%);
          padding:24px 16px 16px; position:relative; flex:none;
          border-bottom:1px solid rgba(148,163,184,.12);
        }
        .player-space-root .hero::after{content:""; position:absolute; left:0; right:0; bottom:0; height:3px;
          background:linear-gradient(90deg, var(--accent), var(--accent2));}
        .player-space-root .hero::before{content:""; position:absolute; top:-30%; right:-10%; width:240px; height:240px;
          background:radial-gradient(circle, color-mix(in srgb, var(--accent) 40%, transparent) 0%, transparent 70%);
          opacity:.35; pointer-events:none;}
        .player-space-root .hero-top{display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;}
        .player-space-root .hero-tournoi{display:flex; align-items:center; gap:9px; min-width:0;}
        .player-space-root .hero-mark{
          font-family:var(--fhead); font-weight:800; font-size:13px; letter-spacing:.5px;
          color:#0f172a; background:linear-gradient(135deg,var(--accent),var(--accent2));
          padding:5px 8px; border-radius:8px; line-height:1; flex:none;
        }
        .player-space-root .hero-tournoi-txt{display:flex; flex-direction:column; min-width:0;}
        .player-space-root .hero-tournoi-txt strong{color:#fff; font-family:var(--fhead); font-weight:700; font-size:14px; line-height:1.1;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
        .player-space-root .hero-tournoi-txt span{color:#94a3b8; font-size:11px; margin-top:2px;}
        .player-space-root .statut-pill{
          display:inline-flex; align-items:center; gap:6px; flex:none;
          background:rgba(16,185,129,.16); color:#34d399; border:1px solid rgba(16,185,129,.3);
          font-size:11px; font-weight:600; padding:5px 10px; border-radius:999px;
        }
        .player-space-root .statut-pill.big{font-size:13px; padding:8px 14px;}
        .player-space-root .live-dot{width:7px; height:7px; border-radius:50%; background:currentColor; position:relative;}
        .player-space-root .live-dot::after{content:""; position:absolute; inset:-4px; border-radius:50%;
          background:currentColor; opacity:.4; animation:pulse-glow 1.6s ease-out infinite;}
        @keyframes pulse-glow {0%{transform:scale(.6); opacity:.5;}100%{transform:scale(1.8); opacity:0;}}

        .player-space-root .hero-id{
          display:flex; align-items:center; gap:13px; width:100%;
          background:rgba(255,255,255,.04); border:1px solid rgba(148,163,184,.16);
          border-radius:16px; padding:12px 13px; cursor:pointer; text-align:left;
          transition:background .15s;
        }
        .player-space-root .hero-id:active{background:rgba(255,255,255,.08);}
        .player-space-root .avatar{
          width:50px; height:50px; border-radius:14px; flex:none;
          background:linear-gradient(135deg,var(--accent),var(--accent2));
          color:#0f172a; font-family:var(--fhead); font-weight:800; font-size:19px;
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 4px 14px rgba(249,115,22,.4);
        }
        .player-space-root .avatar.lg{width:58px; height:58px; font-size:22px; border-radius:16px;}
        .player-space-root .hero-name{flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.05;}
        .player-space-root .hero-name .prenom{color:#cbd5e1; font-size:13px; font-weight:500;}
        .player-space-root .hero-name .nom{color:#fff; font-family:var(--fhead); font-weight:800; font-size:23px; letter-spacing:.3px;}
        .player-space-root .hero-name .meta{color:#94a3b8; font-size:11px; margin-top:4px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
        .player-space-root .hero-rank{display:flex; flex-direction:column; align-items:center; flex:none; padding-left:13px;
          border-left:1px solid rgba(148,163,184,.18);}
        .player-space-root .rank-num{font-family:var(--fhead); font-weight:800; font-size:25px; line-height:1;
          background:linear-gradient(135deg,var(--accent2),var(--accent)); -webkit-background-clip:text; background-clip:text; color:transparent;}
        .player-space-root .rank-unit{color:#94a3b8; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:1px; margin-top:3px;}

        /* ───── BOTTOM NAV ───── */
        .player-space-root .bottomnav{
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display:flex; background:var(--nav);
          padding:9px 8px 18px; border-top:1px solid rgba(148,163,184,.14);
          z-index:40;
        }
        .player-space-root .navbtn{
          flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;
          background:none; border:none; cursor:pointer; color:#64748b; padding:6px 0;
          font-family:var(--fbody); font-size:11px; font-weight:605; position:relative; transition:color .15s;
        }
        .player-space-root .navbtn span{letter-spacing:.1px;}
        .player-space-root .navbtn.active{color:var(--accent);}
        .player-space-root .navbtn.active::before{content:""; position:absolute; top:-9px; width:30px; height:3px; border-radius:0 0 4px 4px;
          background:linear-gradient(90deg,var(--accent),var(--accent2));}

        /* ───── SCREEN ───── */
        .player-space-root .screen{padding:var(--pad); display:flex; flex-direction:column; gap:var(--gap); padding-bottom:100px; max-width: 480px; margin: 0 auto;}
        .player-space-root .screen-head h1{font-family:var(--fhead); font-weight:800; font-size:26px; margin:0 0 4px; letter-spacing:.2px; color:var(--ink);}
        .player-space-root .screen-head p{margin:0; color:var(--muted); font-size:13px; line-height:1.45;}

        .player-space-root .block{display:flex; flex-direction:column; gap:10px;}
        .player-space-root .block-title{display:flex; align-items:center; justify-content:space-between; gap:8px;}
        .player-space-root .block-title>span{font-family:var(--fhead); font-weight:700; font-size:15px; color:var(--ink);}
        .player-space-root .stack{display:flex; flex-direction:column; gap:9px;}

        .player-space-root .badge{display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600;
          padding:4px 9px; border-radius:999px; line-height:1.3; white-space:nowrap;}

        /* ───── QR SCREEN ───── */
        .player-space-root .dayseg{display:grid; grid-template-columns:1fr 1fr; gap:9px;}
        .player-space-root .daybtn{
          display:flex; flex-direction:column; align-items:flex-start; gap:2px;
          background:var(--card); border:1.5px solid var(--line); border-radius:14px;
          padding:11px 13px; cursor:pointer; transition:all .15s; color:var(--ink);
        }
        .player-space-root .daybtn .dl{font-family:var(--fhead); font-weight:700; font-size:14px; white-space:nowrap;}
        .player-space-root .daybtn .dd{font-size:11px; color:var(--muted2); font-weight:500; white-space:nowrap;}
        .player-space-root .daybtn.active{background:var(--indigo); border-color:var(--indigo); box-shadow:0 6px 18px rgba(99,102,241,.32);}
        .player-space-root .daybtn.active .dl{color:#fff;} .player-space-root .daybtn.active .dd{color:#c7d2fe;}

        .player-space-root .qrcard{
          background:var(--card); border:1px solid var(--line); border-radius:24px;
          padding:18px; display:flex; flex-direction:column; align-items:center; gap:14px;
          box-shadow:0 10px 30px rgba(15,23,42,.07);
        }
        .player-space-root .qrcard.is-today{border:2px solid color-mix(in srgb,var(--accent) 55%,transparent);
          box-shadow:0 14px 34px rgba(249,115,22,.18);}
        .player-space-root .qr-flag{display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700;
          color:var(--accent-d); background:#fff5ed; padding:6px 13px; border-radius:999px;}
        .player-space-root.dark .qr-flag{background:rgba(249,115,22,.14);}
        .player-space-root .qr-flag.muted{color:var(--muted); background:var(--card2);}
        .player-space-root .qr-frame{position:relative; padding:14px; background:#fff; border-radius:18px;}
        .player-space-root .qr-frame svg{border-radius:6px;}
        .player-space-root .qr-corner{position:absolute; width:22px; height:22px; border:3px solid var(--accent);}
        .player-space-root .qr-corner.tl{top:2px; left:2px; border-right:none; border-bottom:none; border-radius:8px 0 0 0;}
        .player-space-root .qr-corner.tr{top:2px; right:2px; border-left:none; border-bottom:none; border-radius:0 8px 0 0;}
        .player-space-root .qr-corner.bl{bottom:2px; left:2px; border-right:none; border-top:none; border-radius:0 0 0 8px;}
        .player-space-root .qr-corner.br{bottom:2px; right:2px; border-left:none; border-top:none; border-radius:0 0 8px 0;}
        .player-space-root .qr-token{font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; letter-spacing:.5px;
          color:var(--muted); background:var(--card2); padding:7px 12px; border-radius:9px; border:1px dashed var(--line); word-break: break-all; text-align: center;}
        .player-space-root .qr-meta{display:flex; gap:16px; flex-wrap:wrap; justify-content:center;}
        .player-space-root .qr-meta span{display:inline-flex; align-items:center; gap:5px; font-size:12px; color:var(--muted); font-weight:500;}
        .player-space-root .qr-meta span svg{color:var(--accent);}

        .player-space-root .trow{display:flex; align-items:center; gap:11px; background:var(--card); border:1px solid var(--line);
          border-radius:13px; padding:11px 12px;}
        .player-space-root .tdot{width:9px; height:9px; border-radius:3px; flex:none; background:var(--accent);}
        .player-space-root .tdot.double{background:var(--indigo); border-radius:50%;}
        .player-space-root .trow-txt{flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;}
        .player-space-root .trow-txt strong{font-size:14px; color:var(--ink); font-weight:600;}
        .player-space-root .trow-txt span{font-size:11.5px; color:var(--muted2);}

        .player-space-root .hint-card{display:flex; gap:10px; align-items:flex-start; background:var(--card2);
          border:1px solid var(--line); border-radius:14px; padding:12px 13px;}
        .player-space-root .hint-card svg{flex:none; margin-top:1px;}
        .player-space-root .hint-card p{margin:0; font-size:12.5px; color:var(--muted); line-height:1.45;}

        /* ───── TABLEAUX ───── */
        .player-space-root .tcard{display:flex; align-items:center; gap:12px; width:100%; text-align:left;
          background:var(--card); border:1px solid var(--line); border-radius:16px; padding:13px;
          cursor:pointer; transition:transform .12s, box-shadow .15s; color:var(--ink);}
        .player-space-root .tcard:active{transform:scale(.99);}
        .player-space-root .tcard.disabled{opacity:.72; cursor:default;}
        .player-space-root .tcard-mark{width:42px; height:42px; border-radius:12px; flex:none; display:flex; align-items:center; justify-content:center;
          font-family:var(--fhead); font-weight:800; font-size:18px; color:#fff;
          background:linear-gradient(135deg,var(--accent),var(--accent-d));}
        .player-space-root .tcard-mark.double{background:linear-gradient(135deg,var(--indigo),#4f46e5);}
        .player-space-root .tcard-m{flex:1; min-width:0; display:flex; flex-direction:column; gap:5px;}
        .player-space-root .tcard-top{display:flex; align-items:center; gap:8px;}
        .player-space-root .tcard-top strong{font-family:var(--fhead); font-weight:700; font-size:15.5px; color:var(--ink); white-space:nowrap;}
        .player-space-root .tcard-crit{font-size:12px; color:var(--muted2);}
        .player-space-root .tcard-state{margin-top:2px;}

        .player-space-root .backbtn{display:inline-flex; align-items:center; gap:3px; align-self:flex-start;
          background:none; border:none; color:var(--accent-d); font-family:var(--fbody); font-weight:600;
          font-size:14px; cursor:pointer; padding:2px 0; margin-bottom: 2px;}
        .player-space-root .detail-head{display:flex; align-items:flex-start; justify-content:space-between; gap:10px;}
        .player-space-root .detail-titles h1{font-family:var(--fhead); font-weight:800; font-size:24px; margin:0; color:var(--ink);}
        .player-space-root .detail-sub{font-size:12.5px; color:var(--muted); margin-top:3px; display:block;}

        .player-space-root .ptable{background:var(--card); border:1px solid var(--line); border-radius:16px; overflow:hidden;}
        .player-space-root .ptable-head,.player-space-root .ptable-row{display:grid; grid-template-columns:30px 1fr 26px 26px 34px; align-items:center; gap:6px; padding:9px 12px;}
        .player-space-root .ptable-head{background:var(--card2); border-bottom:1px solid var(--line2);}
        .player-space-root .ptable-head span{font-size:10.5px; font-weight:700; color:var(--muted2); text-transform:uppercase; letter-spacing:.4px;}
        .player-space-root .ptable-head .c-num,.player-space-root .ptable-row .c-num{text-align:center;}
        .player-space-root .ptable-row{border-bottom:1px solid var(--line2); position:relative;}
        .player-space-root .ptable-row:last-child{border-bottom:none;}
        .player-space-root .ptable-row.moi{background:#fff7ed;}
        .player-space-root.dark .ptable-row.moi{background:rgba(249,115,22,.10);}
        .player-space-root .ptable-row.moi::before{content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--accent);}
        .player-space-root .c-joueur{display:flex; flex-direction:column; min-width:0;}
        .player-space-root .c-joueur strong{font-size:13px; font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
        .player-space-root .c-joueur small{font-size:10.5px; color:var(--muted2);}
        .player-space-root .c-num{font-size:13px; color:var(--muted); font-variant-numeric:tabular-nums;}
        .player-space-root .c-num.strong{font-weight:700; color:var(--ink);}
        .player-space-root .rnum{color:var(--muted2); font-size:13px; font-weight:600;}
        .player-space-root .qbadge{display:inline-flex; align-items:center; justify-content:center; width:21px; height:21px; border-radius:7px;
          background:var(--green); color:#fff; font-family:var(--fhead); font-weight:700; font-size:11px;}
        .player-space-root .qbadge.sm{width:18px; height:18px; font-size:10px; vertical-align:middle; margin-right:5px;}
        .player-space-root .qual-note{font-size:11.5px; color:var(--muted); display:flex; align-items:center; padding:2px 2px 0;}

        .player-space-root .empty-line{display:flex; align-items:center; gap:8px; color:var(--muted2); font-size:13px;
          background:var(--card); border:1px dashed var(--line); border-radius:13px; padding:14px;}

        /* parcours timeline */
        .player-space-root .parcours{display:flex; flex-direction:column;}
        .player-space-root .prow{display:grid; grid-template-columns:24px 1fr; gap:11px;}
        .player-space-root .prow-line{display:flex; flex-direction:column; align-items:center;}
        .player-space-root .pnode{width:14px; height:14px; border-radius:50%; border:3px solid var(--card); margin-top:4px; flex:none;
          box-shadow:0 0 0 2px currentColor;}
        .player-space-root .pnode.green{background:var(--green); color:var(--green);}
        .player-space-root .pnode.red{background:var(--red); color:var(--red);}
        .player-space-root .pnode.blue{background:var(--blue); color:var(--blue);}
        .player-space-root .pnode.slate{background:var(--muted2); color:var(--muted2);}
        .player-space-root .pbar{flex:1; width:2px; background:var(--line); margin:3px 0;}
        .player-space-root .prow-body{padding-bottom:16px; min-width:0;}
        .player-space-root .prow-top{display:flex; align-items:center; justify-content:space-between; gap:8px;}
        .player-space-root .prow-top strong{font-family:var(--fhead); font-weight:700; font-size:14px; color:var(--ink);}
        .player-space-root .prow-adv{display:block; font-size:12.5px; color:var(--muted); margin-top:3px;}
        .player-space-root .prow-adv.muted{color:var(--muted2); font-style:italic;}
        .player-space-root .prow-foot{display:flex; align-items:center; gap:8px; margin-top:7px; flex-wrap:wrap;}
        .player-space-root .prow-score{font-family:var(--fhead); font-weight:800; font-size:15px; color:var(--ink);}
        .player-space-root .chiplet{display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:var(--muted);
          background:var(--card2); border:1px solid var(--line); padding:3px 8px; border-radius:7px;}

        /* ───── MATCHS ───── */
        .player-space-root .nextcard{border-radius:20px; overflow:hidden; color:#fff;
          background:linear-gradient(135deg,var(--accent) 0%, var(--accent-d) 90%);
          box-shadow:0 14px 32px rgba(249,115,22,.32);}
        .player-space-root .nextcard.live{background:linear-gradient(135deg,#3b82f6 0%, #1d4ed8 90%); box-shadow:0 14px 32px rgba(59,130,246,.32);}
        .player-space-root .nextcard-bar{display:flex; align-items:center; justify-content:space-between; padding:11px 15px;
          background:rgba(0,0,0,.14);}
        .player-space-root .nextcard-tag{display:inline-flex; align-items:center; gap:6px; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:.5px;}
        .player-space-root .nextcard-when{display:inline-flex; align-items:center; gap:5px; font-weight:700; font-size:14px;}
        .player-space-root .nextcard-body{padding:15px;}
        .player-space-root .nextcard-meta{display:flex; align-items:center; gap:9px; margin-bottom:13px;}
        .player-space-root .nextcard-meta .badge{background:rgba(255,255,255,.22); color:#fff;}
        .player-space-root .nextcard-phase{font-size:12.5px; font-weight:600; opacity:.9;}
        .player-space-root .nextcard-vs{display:flex; align-items:center; justify-content:space-between; gap:12px;}
        .player-space-root .nc-vs{font-family:var(--fhead); font-weight:800; font-size:13px; opacity:.7; flex:none;}
        .player-space-root .nc-adv{display:flex; align-items:center; gap:10px; min-width:0;}
        .player-space-root .nc-adv strong{font-family:var(--fhead); font-weight:700; font-size:18px; line-height:1.1; display:block;}
        .player-space-root .nc-adv small{font-size:11.5px; opacity:.85;}
        .player-space-root .nc-table{display:flex; flex-direction:column; align-items:center; flex:none;
          background:rgba(255,255,255,.18); border-radius:14px; padding:8px 14px; min-width:62px;}
        .player-space-root .nc-table-num{font-family:var(--fhead); font-weight:800; font-size:28px; line-height:1;}
        .player-space-root .nc-table-lbl{font-size:10px; text-transform:uppercase; letter-spacing:1px; opacity:.85; margin-top:2px;}
        .player-space-root .nc-livescore{margin-top:13px; padding-top:12px; border-top:1px solid rgba(255,255,255,.2);
          font-family:var(--fhead); font-weight:800; font-size:22px; display:flex; align-items:baseline; gap:10px;}
        .player-space-root .nc-livescore small{font-family:var(--fbody); font-weight:500; font-size:12px; opacity:.85;}

        .player-space-root .mrow{display:flex; align-items:center; gap:12px; background:var(--card); border:1px solid var(--line);
          border-radius:14px; padding:11px 13px;}
        .player-space-root .mrow.s-en_cours{border-color:color-mix(in srgb,var(--blue) 45%,transparent); background:color-mix(in srgb,var(--blue) 6%,var(--card));}
        .player-space-root .mrow-time{display:flex; flex-direction:column; align-items:center; gap:3px; flex:none; width:42px;}
        .player-space-root .mrow-h{font-family:var(--fhead); font-weight:700; font-size:13px; color:var(--ink);}
        .player-space-root .mrow-t{font-size:10.5px; font-weight:700; color:#fff; background:var(--ink2); padding:2px 6px; border-radius:6px;}
        .player-space-root .mrow-t.off{background:transparent; color:var(--muted2);}
        .player-space-root .mrow-mid{flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;}
        .player-space-root .mrow-phase{font-size:10.5px; font-weight:600; color:var(--muted2); text-transform:uppercase; letter-spacing:.3px;}
        .player-space-root .mrow-adv{font-size:14px; font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
        .player-space-root .mrow-club{font-size:11px; color:var(--muted2);}
        .player-space-root .mrow-right{display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex:none;}
        .player-space-root .mrow-score{font-family:var(--fhead); font-weight:800; font-size:16px;}
        .player-space-root .mrow-score.win{color:var(--green);} .player-space-root .mrow-score.loss{color:var(--red);} .player-space-root .mrow-score.draw{color:var(--blue);}

        /* ───── PROFILE SHEET ───── */
        .player-space-root .sheet-overlay{position:fixed; inset:0; z-index:80; background:rgba(15,23,42,.5);
          backdrop-filter:blur(2px); display:flex; align-items:flex-end; animation:fade .2s ease;}
        @keyframes fade{from{opacity:0;}}
        .player-space-root .sheet{width:100%; max-width: 480px; margin: 0 auto; background:var(--card); border-radius:26px 26px 0 0; padding:10px 18px 40px;
          animation:slideup .26s cubic-bezier(.2,.9,.3,1);}
        @keyframes slideup{from{transform:translateY(100%);}}
        .player-space-root .sheet-grab{width:40px; height:5px; border-radius:3px; background:var(--line); margin:0 auto 14px;}
        .player-space-root .sheet-top{display:flex; align-items:center; gap:13px; margin-bottom:16px;}
        .player-space-root .sheet-name{font-family:var(--fhead); font-weight:800; font-size:20px; color:var(--ink);}
        .player-space-root .sheet-rank{font-size:13px; color:var(--muted); margin-top:2px;}
        .player-space-root .sheet-x{margin-left:auto; background:var(--card2); border:1px solid var(--line); border-radius:10px;
          width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--muted);}
        .player-space-root .sheet-rows{display:flex; flex-direction:column; background:var(--card2); border:1px solid var(--line); border-radius:14px; overflow:hidden;}
        .player-space-root .sheet-row{display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--line2);}
        .player-space-root .sheet-row:last-child{border-bottom:none;}
        .player-space-root .sheet-row span{font-size:13px; color:var(--muted);}
        .player-space-root .sheet-row strong{font-size:14px; color:var(--ink); font-weight:600;}
        .player-space-root .sheet-foot{margin-top:16px; display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center;}
        .player-space-root .sheet-foot p{margin:0; font-size:12px; color:var(--muted2);}
      ` }} />

      {/* Hero sombe persistant */}
      <header className="hero">
        <div className="hero-top">
          <div className="hero-tournoi">
            <span className="hero-mark">UMS</span>
            <div className="hero-tournoi-txt">
              <strong>{tournament.name}</strong>
              <span className="capitalize">{formattedDatesStr()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDarkTheme(!darkTheme)} 
              className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-white/5 border border-white/5 cursor-pointer"
              title="Thème"
            >
              {darkTheme ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button 
              onClick={() => navigate('/')} 
              className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-white/5 border border-white/5 cursor-pointer"
              title="Retour à l'accueil"
            >
              <LogOut size={15} />
            </button>
            <span className="statut-pill"><i className="live-dot" />{player.status || "En lice"}</span>
          </div>
        </div>

        <button className="hero-id" onClick={() => setIsProfileOpen(true)}>
          <span className="avatar">
            {player.first_name ? player.first_name.slice(0, 1).toUpperCase() : ''}
            {player.last_name ? player.last_name.slice(0, 1).toUpperCase() : ''}
          </span>
          <div className="hero-name">
            <span className="prenom">{player.first_name}</span>
            <span className="nom uppercase">{player.last_name}</span>
            <span className="meta">{player.club || "Indépendant"}</span>
          </div>
          <div className="hero-rank">
            <span className="rank-num">{player.points || 500}</span>
            <span className="rank-unit">pts</span>
          </div>
        </button>
      </header>

      {/* Contenu principal défilant */}
      <main className="app-main">
        
        {/* --- Onglet 1 : Mon QR --- */}
        {activeTab === 'qr' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="screen">
            <div className="screen-head">
              <h1>Mon QR</h1>
              <p>Présentez ce code à la table d'inscription pour valider votre pointage dans les tableaux du jour.</p>
            </div>

            {/* Sélecteur de journées dynamiques */}
            {qrDays.length > 0 && (
              <div className="dayseg">
                {qrDays.map((dNum, idx) => (
                  <button 
                    key={dNum} 
                    className={`daybtn ${selectedQRDay === dNum ? 'active' : ''}`} 
                    onClick={() => setSelectedQRDay(dNum)}
                  >
                    <span className="dl">Journée {dNum}</span>
                    <span className="dd">Jour {dNum} de jeu</span>
                  </button>
                ))}
              </div>
            )}

            {/* QR Card */}
            <div className={`qrcard ${tournament.current_day === (selectedQRDay || 1) ? 'is-today' : ''}`}>
              {tournament.current_day === (selectedQRDay || 1) ? (
                <span className="qr-flag"><i className="live-dot" />Valable aujourd'hui</span>
              ) : (
                <span className="qr-flag muted"><Icon name="clock" size={13} stroke={2.4} />Journée {selectedQRDay || 1}</span>
              )}
              
              <div className="qr-frame">
                <QRCodeSVG 
                  value={`${window.location.origin}/player/${token}?day=${selectedQRDay || 1}`}
                  size={210}
                  level="H"
                />
                <span className="qr-corner tl" />
                <span className="qr-corner tr" />
                <span className="qr-corner bl" />
                <span className="qr-corner br" />
              </div>

              <div className="qr-token">{token} - J{selectedQRDay || 1}</div>
              
              <div className="qr-meta">
                <span><Icon name="user" size={14} stroke={2.2} />{player.first_name} {player.last_name}</span>
                <span><Icon name="card" size={14} stroke={2.2} />Licence {player.licence || "Inconnue"}</span>
              </div>
            </div>

            {/* List Tableaux du jour */}
            <div className="block">
              <div className="block-title">
                <span>Tableaux de la journée {selectedQRDay || 1}</span>
                <Badge tone="indigo">Inscrit</Badge>
              </div>
              <div className="stack">
                {registrations
                  .filter(r => (r.table_categories?.day_number || 1) === (selectedQRDay || 1))
                  .map(r => {
                    const isDouble = r.table_categories?.name?.toLowerCase().includes('double');
                    return (
                      <div key={r.id} className="trow">
                        <span className={`tdot ${isDouble ? 'double' : 'simple'}`} style={{ backgroundColor: r.table_categories?.color_code }} />
                        <div className="trow-txt">
                          <strong>{r.table_categories?.name}</strong>
                          <span>
                            {r.table_categories?.min_points ?? 0} à {r.table_categories?.max_points ?? 3000} pts
                            {r.table_categories?.start_time ? ` · Début à ${r.table_categories.start_time}` : ''}
                          </span>
                        </div>
                        {r.checked_in ? (
                          <Badge tone="green" icon="check">Présent</Badge>
                        ) : (
                          <Badge tone="orange" icon="clock">Inscrit</Badge>
                        )}
                      </div>
                    );
                  })}
                {registrations.filter(r => (r.table_categories?.day_number || 1) === (selectedQRDay || 1)).length === 0 && (
                  <div className="empty-line text-xs">Aucun tableau ce jour-là.</div>
                )}
              </div>
            </div>

            <button onClick={copyPlayerLink} className="hint-card w-full cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-all text-left">
              <Icon name="info" size={18} stroke={2.2} color="#4f46e5" />
              <p>Un QR code est affecté par journée pour réguler les accès. Cliquez ici pour copier le lien permanent de votre espace personnel.</p>
            </button>
          </motion.div>
        )}

        {/* --- Onglet 2 : Tableaux (Classement & Standings) --- */}
        {activeTab === 'tableaux' && (
          <AnimatePresence mode="wait">
            {!selectedTableauId ? (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="screen">
                <div className="screen-head">
                  <h1>Mes tableaux</h1>
                  <p>Consultez la composition de vos poules, vos classements en temps réel et votre progression.</p>
                </div>

                <div className="stack">
                  {registrations.map(r => {
                    const cat = r.table_categories;
                    if (!cat) return null;
                    const actPool = pools.find(p => p.table_category_id === cat.id);
                    const isClickable = !!actPool;
                    const catState = getCategoryState(cat.id);
                    const isDouble = cat.name.toLowerCase().includes('double');

                    return (
                      <button 
                        key={r.id} 
                        className={`tcard ${!isClickable ? 'disabled' : ''}`} 
                        onClick={() => isClickable && setSelectedTableauId(cat.id)}
                      >
                        <div className="tcard-l">
                          <span 
                            className={`tcard-mark ${isDouble ? 'double' : ''}`}
                            style={{ background: isDouble ? undefined : `linear-gradient(135deg, ${cat.color_code || '#f97316'}, #e04a00)` }}
                          >
                            {isDouble ? "D" : cat.name.slice(0, 1).toUpperCase()}
                          </span>
                        </div>
                        <div className="tcard-m">
                          <div className="tcard-top">
                            <strong>{cat.name}</strong>
                            <Badge tone="indigo">Jour {cat.day_number}</Badge>
                          </div>
                          <span className="tcard-crit">
                            {cat.min_points ?? 0}–{cat.max_points ?? 3000} pts · {isDouble ? "Double" : "Simple"}
                          </span>
                          <div className="tcard-state">
                            {etatBadge(catState)}
                          </div>
                        </div>
                        {isClickable ? (
                          <Icon name="chevR" size={20} color="#94a3b8" />
                        ) : (
                          <Badge tone="slate" className="text-[9px]">Poule non créée</Badge>
                        )}
                      </button>
                    );
                  })}
                  {registrations.length === 0 && (
                    <div className="empty-line">Vous n'êtes inscrit à aucun tableau pour le moment.</div>
                  )}
                </div>
              </motion.div>
            ) : (
              // Tableau Detail Screen
              (() => {
                const reg = registrations.find(r => r.table_categories?.id === selectedTableauId);
                const cat = reg?.table_categories;
                if (!cat) return null;
                const actPool = pools.find(p => p.table_category_id === cat.id);
                const catState = getCategoryState(cat.id);

                // Get bracket matches corresponding to this category
                const catBracketMatches = processedMatches.filter(m => {
                  if (!m.bracket_round) return false;
                  const mCatId = tournamentBrackets.find(b => b.id === m.bracket_id)?.category_id;
                  return mCatId === cat.id;
                }).sort((a, b) => getRoundWeight(a.bracket_round || '') - getRoundWeight(b.bracket_round || ''));

                return (
                  <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="screen">
                    <button className="backbtn" onClick={() => setSelectedTableauId(null)}>
                      <Icon name="chevL" size={18} stroke={2.6} /> Retour à la liste
                    </button>

                    <div className="detail-head">
                      <div className="detail-titles">
                        <h1>{cat.name}</h1>
                        <span className="detail-sub">{cat.min_points ?? 0} à {cat.max_points ?? 3000} pts · Simple · Jour {cat.day_number}</span>
                      </div>
                      {etatBadge(catState)}
                    </div>

                    {/* Poules Section */}
                    <div className="block">
                      <div className="block-title">
                        <span>{actPool?.name || "Classement de la Poule"}</span>
                        {actPool?.status === 'finished' ? (
                          <Badge tone="green" icon="check">Poule terminée</Badge>
                        ) : (
                          <Badge tone="blue" icon="dot">En cours</Badge>
                        )}
                      </div>

                      {loadingPoolDetails ? (
                        <div className="p-10 text-center bg-white border border-slate-100 rounded-2xl flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                          <p className="text-xs text-slate-500">Calcul du classement en temps réel...</p>
                        </div>
                      ) : poolStandings.length > 0 ? (
                        <div className="ptable">
                          <div className="ptable-head">
                            <span className="c-rang">#</span>
                            <span className="c-joueur">Joueur</span>
                            <span className="c-num">J</span>
                            <span className="c-num">V</span>
                            <span className="c-num">Pts</span>
                          </div>
                          {poolStandings.map((standing) => {
                            const isMe = standing.player_id === player.id;
                            const isQualified = standing.rang <= 2; // 2 qualified parameters
                            return (
                              <div key={standing.player_id} className={`ptable-row ${isMe ? 'moi' : ''}`}>
                                <span className="c-rang">
                                  {isQualified ? (
                                    <span className="qbadge">{standing.rang}</span>
                                  ) : (
                                    <span className="rnum">{standing.rang}</span>
                                  )}
                                </span>
                                <span className="c-joueur">
                                  <strong>{standing.first_name} {standing.last_name}{isMe ? ' (vous)' : ''}</strong>
                                  <small className="truncate pr-2">{standing.club || 'Indépendant'}</small>
                                </span>
                                <span className="c-num">{standing.matches_played}</span>
                                <span className="c-num strong">{standing.wins}</span>
                                <span className="c-num">{standing.points}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-line">Aucun joueur dans la poule.</div>
                      )}
                      
                      <div className="qual-note">
                        <span className="qbadge sm">1</span> Les deux premiers de chaque poule se qualifient pour le tableau final.
                      </div>
                    </div>

                    {/* Timeline Bracket section */}
                    <div className="block">
                      <div className="block-title">
                        <span>Tableau final · Votre parcours</span>
                      </div>
                      
                      {catBracketMatches.length > 0 ? (
                        <div className="parcours">
                          {catBracketMatches.map((m, idx) => {
                            const isWinner = m.winner_id === player.id;
                            const st = m.status === 'finished' 
                              ? (isWinner ? { tone: "green", lbl: "Gagné", ic: "check" } : { tone: "red", lbl: "Perdu", ic: "x" })
                              : (m.status === 'in_progress' ? { tone: "blue", lbl: "En cours", ic: "dot" } : { tone: "slate", lbl: "En attente", ic: "clock" });

                            return (
                              <div key={m.id} className="prow">
                                <div className="prow-line">
                                  <span className={`pnode ${st.tone}`} />
                                  {idx < catBracketMatches.length - 1 && <span className="pbar" />}
                                </div>
                                <div className="prow-body">
                                  <div className="prow-top">
                                    <strong>{m.phase}</strong>
                                    <Badge tone={st.tone} icon={st.ic}>{st.lbl}</Badge>
                                  </div>
                                  <span className="prow-adv">
                                    vs {m.opponentName} {m.opponent?.club ? `· ${m.opponent.club}` : ''}
                                  </span>
                                  <div className="prow-foot">
                                    {m.score && <span className="prow-score">{m.score}</span>}
                                    {m.table_number && <span className="chiplet"><Icon name="table" size={11} stroke={2.2} /> Table {m.table_number}</span>}
                                    {m.setsListStr && <span className="chiplet text-[10px] font-mono">{m.setsListStr}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-line text-xs">
                          <Icon name="clock" size={15} stroke={2.2} color="#94a3b8" className="mr-1 shadow-sm" /> 
                          En attente de la fin des phases qualificatives pour le tableau final.
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })()
            )}
          </AnimatePresence>
        )}

        {/* --- Onglet 3 : Matchs (Live & Historique) --- */}
        {activeTab === 'matchs' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="screen">
            <div className="screen-head">
              <h1>Mes matchs</h1>
              <p>Suivez vos convocations à la table et consultez l'historique complet de vos scores.</p>
            </div>

            {/* Featured Hero Match Card (Prochain Match ou En cours!) */}
            {featuredMatch ? (
              (() => {
                const isLive = featuredMatch.status === 'in_progress';
                return (
                  <div className={`nextcard ${isLive ? 'live' : ''}`}>
                    <div className="nextcard-bar">
                      <span className="nextcard-tag">
                        {isLive ? <><i className="live-dot" /> En cours</> : <><Icon name="flame" size={14} stroke={2.4} color="#fff" /> Prochain Match</>}
                      </span>
                      <span className="nextcard-when">
                        <Icon name="clock" size={14} stroke={2.4} /> {featuredMatch.started_at ? new Date(featuredMatch.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : "À jouer"}
                      </span>
                    </div>
                    
                    <div className="nextcard-body">
                      {/* Category metadata */}
                      <div className="nextcard-meta">
                        <Badge tone="orange" className="!bg-white/25 !text-white">{featuredMatch.tableauNom}</Badge>
                        <span className="nextcard-phase">{featuredMatch.phase}</span>
                      </div>

                      <div className="nextcard-vs">
                        <div className="nc-adv">
                          <span className="nc-vs">vs</span>
                          <div>
                            <strong>{featuredMatch.opponentName}</strong>
                            <small className="block truncate opacity-85">
                              {featuredMatch.opponent?.club || "Pas de club"} {featuredMatch.opponent?.points ? `· ${featuredMatch.opponent.points} pts` : ''}
                            </small>
                          </div>
                        </div>

                        {featuredMatch.table_number && (
                          <div className="nc-table">
                            <span className="nc-table-num">{featuredMatch.table_number}</span>
                            <span className="nc-table-lbl">Table</span>
                          </div>
                        )}
                      </div>

                      {/* Score description if live */}
                      {isLive && (
                        <div className="nc-livescore">
                          {featuredMatch.score}
                          <small className="ml-2 bg-black/15 px-2 py-0.5 rounded-md self-center">{featuredMatch.setsListStr}</small>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-5 text-center bg-white border border-slate-100 rounded-2xl flex flex-col items-center">
                <Icon name="info" size={24} stroke={2.2} color="#94a3b8" />
                <p className="text-xs font-bold text-slate-500 mt-2">Aucun match en cours ou convoqué.</p>
              </div>
            )}

            {/* List group by Journée */}
            {mGroups.map((g) => (
              <div key={g.dayNum} className="block">
                <div className="block-title">
                  <span>{g.label}</span>
                  <Badge tone="indigo">{g.list.length} match{g.list.length > 1 ? 's' : ''}</Badge>
                </div>

                <div className="stack">
                  {g.list.map((m) => {
                    const st = matchStatut(m);
                    return (
                      <div key={m.id} className={`mrow s-${m.status}`}>
                        <div className="mrow-time">
                          <span className="mrow-h">{m.started_at ? new Date(m.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                          {m.table_number ? (
                            <span className="mrow-t">T{m.table_number}</span>
                          ) : (
                            <span className="mrow-t off">—</span>
                          )}
                        </div>
                        <div className="mrow-mid">
                          <div className="mrow-top">
                            <span className="mrow-phase">{m.tableauNom} · {m.phase}</span>
                          </div>
                          <strong className="mrow-adv truncate block pr-1">{m.opponentName}</strong>
                          <span className="mrow-club truncate block text-[10px] text-slate-400">
                            {m.opponent?.club || "Indépendant"} {m.opponent?.points ? `· ${m.opponent.points} pts` : ''}
                          </span>
                        </div>
                        <div className="mrow-right">
                          {m.score && (
                            <span className={`mrow-score ${m.gagne === true ? 'win' : m.gagne === false ? 'loss' : 'draw'}`}>
                              {m.score}
                            </span>
                          )}
                          <Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {mGroups.length === 0 && (
              <div className="empty-line">Votre historique de matchs s'affichera ici dès le début de vos parties.</div>
            )}
            
          </motion.div>
        )}

      </main>

      {/* Profile Detail Slide-up Sheet (Drawer) */}
      <AnimatePresence>
        {isProfileOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="sheet-overlay" 
            onClick={() => setIsProfileOpen(false)}
          >
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="sheet" 
              onClick={e => e.stopPropagation()}
            >
              <div className="sheet-grab" />
              <div className="sheet-top">
                <span className="avatar lg">
                  {player.first_name ? player.first_name.slice(0, 1).toUpperCase() : ''}
                  {player.last_name ? player.last_name.slice(0, 1).toUpperCase() : ''}
                </span>
                <div>
                  <div className="sheet-name">{player.first_name} {player.last_name}</div>
                  <div className="sheet-rank">{player.points || 500} pts · FFTT</div>
                </div>
                <button className="sheet-x" onClick={() => setIsProfileOpen(false)}>
                  <Icon name="x" size={18} stroke={2.4} color="#64748b" />
                </button>
              </div>

              <div className="sheet-rows">
                <div className="sheet-row">
                  <span>Prénom</span>
                  <strong>{player.first_name}</strong>
                </div>
                <div className="sheet-row">
                  <span>Nom</span>
                  <strong>{player.last_name}</strong>
                </div>
                <div className="sheet-row">
                  <span>N° de licence</span>
                  <strong>{player.licence || "Non requis"}</strong>
                </div>
                <div className="sheet-row">
                  <span>Club</span>
                  <strong>{player.club || "Club Libre / Aucun"}</strong>
                </div>
              </div>

              <div className="sheet-foot">
                <span className="statut-pill big"><i className="live-dot" />{player.status || "En lice"}</span>
                <p>Votre jeton d'accès au tournoi reste actif tant que vous êtes engagé dans vos tableaux !</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barre d'onglets de navigation basse persistante */}
      <nav className="bottomnav">
        <button 
          className={`navbtn ${activeTab === 'qr' ? 'active' : ''}`} 
          onClick={() => {
            setActiveTab('qr');
            setSelectedTableauId(null);
          }}
        >
          <Icon name="qr" size={20} stroke={activeTab === 'qr' ? 2.4 : 2} />
          <span>Mon QR</span>
        </button>
        <button 
          className={`navbtn ${activeTab === 'tableaux' ? 'active' : ''}`} 
          onClick={() => setActiveTab('tableaux')}
        >
          <Icon name="bracket" size={20} stroke={activeTab === 'tableaux' ? 2.4 : 2} />
          <span>Tableaux</span>
        </button>
        <button 
          className={`navbtn ${activeTab === 'matchs' ? 'active' : ''}`} 
          onClick={() => {
            setActiveTab('matchs');
            setSelectedTableauId(null);
          }}
        >
          <Icon name="swords" size={20} stroke={activeTab === 'matchs' ? 2.4 : 2} />
          <span>Matchs</span>
        </button>
      </nav>
    </div>
  );
}
