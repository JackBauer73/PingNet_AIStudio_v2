import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  User, 
  Trophy, 
  QrCode, 
  Users, 
  Zap, 
  CheckCircle2, 
  Clock, 
  Star, 
  ArrowLeft, 
  Copy, 
  Loader2, 
  AlertCircle,
  TrendingUp,
  MapPin,
  Calendar,
  Award,
  Hash
} from 'lucide-react';

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

      // Étape 2 — Charger le joueur + le tournoi
      const [playerRes, tournamentRes] = await Promise.all([
        supabase
          .from('players')
          .select('*')
          .eq('id', playerId)
          .maybeSingle(),
        supabase
          .from('tournaments')
          .select('id, name, date, end_date, location, status, current_day')
          .eq('id', tournamentId)
          .maybeSingle()
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
          id, round, status, table_number,
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
          id, round, status, table_number,
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
            name, day_number, min_points, max_points,
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

  const copyPlayerLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("🔗 Lien de votre espace joueur copié !");
  };

  const translateBracketRound = (roundName: string) => {
    if (!roundName) return 'Phase finale';
    const clean = roundName.toLowerCase();
    if (clean === 'final' || clean === 'finale') return 'Finale';
    if (clean === 'semifinal' || clean === 'demi-finale' || clean === 'demi') return 'Demi-finale';
    if (clean === 'quarterfinal' || clean === 'quart' || clean === 'quarts') return 'Quart de finale';
    if (clean === 'eighthfinal' || clean === 'huitieme' || clean === 'huitièmes') return '8ème de finale';
    if (clean === 'sixteenthfinal' || clean === 'seizieme' || clean === 'seizièmes') return '16ème de finale';
    return `Tour de Bracket - ${roundName}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-bold text-sm">Chargement de votre espace personnel...</p>
      </div>
    );
  }

  if (error || !player || !tournament) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4 shadow-sm border border-rose-100">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Espace joueur introuvable</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6 leading-relaxed font-semibold">
          {error || "Ce jeton de connexion n'est pas ou plus valide pour ce tournoi."}
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all text-sm flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </button>
      </div>
    );
  }

  // Séparer les matchs
  const liveOrUpcomingMatches = matches.filter(m => m.status === 'pending' || m.status === 'in_progress');
  const finishedMatches = matches.filter(m => m.status === 'finished');
  const bracketMatches = matches.filter(m => m.bracket_round);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 font-sans">
      
      {/* Header fixe */}
      <header className="sticky top-0 bg-[#0f1f3d] text-white min-h-[64px] py-3.5 px-4 shadow-md flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-[0.96] flex items-center justify-center transition-all cursor-pointer text-white"
            title="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-left">
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight leading-tight line-clamp-1">{tournament.name}</h1>
            <p className="text-[10px] text-slate-300 font-semibold flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3 h-3 text-indigo-400 shrink-0" /> {new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {tournament.location && (
                <>
                  <span className="text-slate-500">•</span>
                  <MapPin className="w-3 h-3 text-indigo-400 shrink-0" /> <span className="line-clamp-1">{tournament.location}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs select-none bg-white/5 py-1 px-3 rounded-lg border border-white/5">
          <span>Ping Manager</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">

        {/* Bloc identité joueur */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.3 }}
          className="bg-white rounded-[1.5rem] border border-slate-150 p-5 shadow-xl shadow-slate-100/50 flex items-center gap-4 relative overflow-hidden"
        >
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100/80 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight truncate">
              {player.first_name} {player.last_name}
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider truncate flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
              {player.club || "Club Libre / Sans Club"}
            </p>
            {player.licence && (
              <p className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Licence : {player.licence}
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end">
            <span className="inline-flex items-center gap-1 bg-[#f97316]/10 text-[#f97316] font-black text-sm px-3 py-1 rounded-xl shadow-inner border border-[#f97316]/10">
              <TrendingUp className="w-4 h-4 shrink-0" />
              {player.points || 500} pts
            </span>
          </div>
        </motion.div>

        {/* Section QR Code */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-[1.5rem] border border-slate-150 p-6 shadow-xl shadow-slate-100/50 flex flex-col items-center text-center space-y-4"
        >
          <div className="flex items-center gap-2 self-start border-b border-slate-100 pb-3 w-full">
            <QrCode className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Mon QR de Pointage</h3>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center shadow-inner mt-2">
            <QRCodeSVG
              value={`${window.location.origin}/player/${token}`}
              size={170}
              level="H"
              includeMargin={true}
              className="rounded-xl"
            />
            <span className="text-[10px] font-black tracking-widest text-[#f97316] uppercase mt-3">
              QR CODE JOUEUR OFFICIEL
            </span>
          </div>

          <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-xs">
            📲 Présentez ce QR Code à l'accueil à votre arrivée au gymnase. Les organisateurs scanneront ce code pour valider directement votre présence.
          </p>

          <button
            onClick={copyPlayerLink}
            className="w-full py-2.5 px-4 bg-[#eef2ff] hover:bg-[#e0e7ff] text-[#4f46e5] font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm border border-indigo-100/30"
          >
            <Copy className="w-4 h-4 shrink-0 text-[#4f46e5]" />
            Copier mon lien de connexion personnel
          </button>
        </motion.div>

        {/* Section "Mes Tableaux" */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.3, delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 px-1">
            <Trophy className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Mes Tableaux d'Inscriptions</h3>
          </div>

          <div className="space-y-3">
            {registrations.length === 0 ? (
              <div className="bg-white border border-slate-150 p-6 rounded-2xl text-center text-slate-400 italic text-sm">
                Aucune inscription enregistrée.
              </div>
            ) : (
              registrations.map((reg) => {
                const cat = reg.table_categories;
                const strokeColor = cat?.color_code || '#6366f1';
                
                return (
                  <div 
                    key={reg.id} 
                    className="bg-white rounded-2xl border border-slate-150 shadow-md shadow-slate-100/30 overflow-hidden flex relative min-h-[92px]"
                  >
                    {/* Bandeau de couleur à gauche */}
                    <div className="w-2.5 shrink-0" style={{ backgroundColor: strokeColor }} />

                    {/* Contenu principal */}
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug">{cat?.name || 'Série'}</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                            Journée {cat?.day_number || 1} {cat?.start_time ? `• Début à ${cat.start_time}` : ''}
                          </p>
                        </div>
                        
                        <div className="shrink-0 text-right">
                          {reg.dossard ? (
                            <span className="inline-flex items-center gap-0.5 bg-slate-50 text-slate-700 border border-slate-150 px-2 py-0.5 rounded-lg font-mono font-bold text-[10px]">
                              N° {reg.dossard}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[9px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-100 italic">
                              Dossard en cours
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barre d'état basse */}
                      <div className="flex justify-between items-center border-t border-slate-100 pt-2.5 mt-2.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          Statut compétiteur
                        </span>
                        
                        {reg.checked_in ? (
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Présent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black text-[#f97316] bg-[#f97316]/5 border border-[#f97316]/20 px-2.5 py-0.5 rounded-lg">
                            <Clock className="w-3.5 h-3.5" /> En attente de pointage
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Section "Mes Poules" */}
        {pools.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 16 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.3, delay: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 px-1">
              <Users className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Mes Groupes & Poules</h3>
            </div>

            <div className="space-y-4">
              {pools.map(pool => {
                const category = registrations.find(r => r.table_category_id === pool.table_category_id)?.table_categories;
                const poolPlayersList = poolPlayers.filter(pp => pp.pool_id === pool.id);

                return (
                  <div key={pool.id} className="bg-white rounded-2xl border border-slate-150 shadow-md shadow-slate-100/30 overflow-hidden p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                      <div>
                        <h4 className="font-extrabold text-slate-950 text-sm">{pool.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{category?.name || 'Série'}</p>
                      </div>
                      
                      {pool.table_number && (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-xl">
                          Table {pool.table_number}
                        </span>
                      )}
                    </div>

                    {/* Liste des joueurs de la poule */}
                    <div className="overflow-hidden border border-slate-100 rounded-xl divide-y divide-slate-100">
                      <div className="grid grid-cols-12 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5 text-left">
                        <span className="col-span-1">Pos</span>
                        <span className="col-span-6">Joueur</span>
                        <span className="col-span-3 text-right">Points</span>
                        <span className="col-span-2 text-right">Fédération</span>
                      </div>
                      {poolPlayersList.map((pp, idx) => {
                        const isMe = pp.player_id === player.id;
                        const pData = pp.players;
                        
                        return (
                          <div 
                            key={pp.player_id}
                            className={`grid grid-cols-12 text-xs px-3 py-2.5 items-center ${isMe ? 'bg-[#f97316]/10 text-slate-900 font-bold border-l-2 border-l-[#f97316]' : 'text-slate-700'}`}
                          >
                            <span className="col-span-1 text-[10px] font-extrabold text-slate-400">#{idx + 1}</span>
                            <span className="col-span-6 truncate font-extrabold pr-2">
                              {pData?.first_name} {pData?.last_name} {isMe && '⭐'}
                              <span className="block text-[9px] text-slate-400 font-medium truncate">{pData?.club || 'Club Libre'}</span>
                            </span>
                            <span className="col-span-3 text-right font-bold text-[11px] text-slate-600">{pData?.points || 500} pts</span>
                            <span className="col-span-2 text-right font-semibold text-[10px] text-slate-400">{isMe ? player.licence || 'N/A' : 'Licencié'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Section "Mes Matchs" */}
        {matches.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 16 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.3, delay: 0.4 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 px-1">
              <Zap className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Mes Rencontres & Matchs</h3>
            </div>

            {/* Sous-section 1 : En cours ou à venir */}
            {liveOrUpcomingMatches.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black tracking-widest text-[#f97316] uppercase px-1">🔥 Matchs en cours / À venir</h4>
                {liveOrUpcomingMatches.map(match => {
                  const isP1Me = match.player1_id === player.id;
                  
                  const setsP1 = match.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
                  const setsP2 = match.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;

                  return (
                    <div 
                      key={match.id} 
                      className="bg-white rounded-2xl border-2 border-indigo-100 shadow-md p-4 space-y-3 animate-pulse"
                    >
                      <div className="flex justify-between items-center bg-indigo-50/75 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-800">
                        <span>{match.bracket_round ? translateBracketRound(match.bracket_round) : (match.round || 'Poule - Tableau')}</span>
                        {match.table_number && (
                          <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase shrink-0">
                            Table {match.table_number}
                          </span>
                        )}
                      </div>

                      {/* Équipes opposées */}
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className={`text-xs truncate max-w-[70%] ${isP1Me ? 'font-black text-[#f97316]' : 'font-semibold text-slate-800'}`}>
                            {match.player1?.first_name} {match.player1?.last_name}
                          </span>
                          <span className={`font-black text-sm px-2 py-0.5 rounded-lg ${isP1Me ? 'bg-[#f97316]/10 text-[#f97316]' : 'bg-slate-100 text-slate-700'}`}>
                            {setsP1}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`text-xs truncate max-w-[70%] ${!isP1Me ? 'font-black text-[#f97316]' : 'font-semibold text-slate-800'}`}>
                            {match.player2 ? `${match.player2.first_name} ${match.player2.last_name}` : "En cours de désignation"}
                          </span>
                          <span className={`font-black text-sm px-2 py-0.5 rounded-lg ${!isP1Me ? 'bg-[#f97316]/10 text-[#f97316]' : 'bg-slate-100 text-slate-700'}`}>
                            {setsP2}
                          </span>
                        </div>
                      </div>

                      {/* Sets terminés */}
                      {match.sets && match.sets.length > 0 && (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center flex flex-wrap gap-1.5 items-center justify-center text-[10px] font-bold text-slate-500">
                          <span className="uppercase text-[9px] text-slate-400 tracking-widest shrink-0">Sets :</span>
                          {match.sets.sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0)).map((s: any, idx: number) => (
                            <span key={s.id} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-800 shrink-0 font-mono">
                              {s.score_p1}-{s.score_p2}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                        {match.status === 'in_progress' ? "Match en direct" : "En attente de démarrage"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sous-section 2 : Terminés */}
            {finishedMatches.length > 0 && (
              <div className="space-y-3 pt-1">
                <h4 className="text-[10px] font-black tracking-widest text-[#0f1f3d] uppercase px-1">🎉 Matchs joués / Terminés</h4>
                {finishedMatches.map(match => {
                  const isP1Me = match.player1_id === player.id;
                  const isWinnerMe = match.winner_id === player.id;
                  
                  const setsP1 = match.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
                  const setsP2 = match.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;

                  return (
                    <div 
                      key={match.id} 
                      className="bg-white rounded-2xl border border-slate-150 shadow-sm p-4 space-y-3"
                    >
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          {match.bracket_round ? translateBracketRound(match.bracket_round) : (match.round || 'Tableau')}
                        </span>
                        
                        {isWinnerMe ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/50">
                            <Star className="w-3 h-3 text-emerald-500 fill-emerald-500 shrink-0" /> Victoire
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">
                            Match Terminé
                          </span>
                        )}
                      </div>

                      {/* Équipes opposées */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        {/* Player 1 */}
                        <div className="col-span-5 truncate text-left">
                          <p className={`text-xs truncate ${isP1Me ? 'font-black text-[#f97316]' : 'font-semibold text-slate-700'}`}>
                            {match.player1?.first_name} {match.player1?.last_name}
                          </p>
                          <p className="text-[8px] text-slate-400 font-medium truncate">{match.player1?.club || 'Club Libre'}</p>
                        </div>

                        {/* Versus & Score */}
                        <div className="col-span-2 text-center flex flex-col justify-center items-center">
                          <div className="font-black text-sm text-slate-900 bg-slate-50 border border-slate-150 py-0.5 px-2 rounded-lg font-mono">
                            {setsP1} - {setsP2}
                          </div>
                        </div>

                        {/* Player 2 */}
                        <div className="col-span-5 truncate text-right">
                          <p className={`text-xs truncate ${!isP1Me ? 'font-black text-[#f97316]' : 'font-semibold text-slate-700'}`}>
                            {match.player2?.first_name} {match.player2?.last_name}
                          </p>
                          <p className="text-[8px] text-slate-400 font-medium truncate">{match.player2?.club || 'Club Libre'}</p>
                        </div>
                      </div>

                      {/* Sets list */}
                      {match.sets && match.sets.length > 0 && (
                        <div className="bg-slate-50/70 p-2 text-center flex gap-1.5 items-center justify-center text-[10px] font-bold text-slate-500 rounded-xl">
                          <span className="uppercase text-[8px] text-slate-400 tracking-wider font-extrabold shrink-0">Sets :</span>
                          {match.sets.sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0)).map((s: any) => (
                            <span key={s.id} className="bg-white shadow-sm border border-slate-150 px-1 rounded text-slate-700 shrink-0 font-mono">
                              {s.score_p1}-{s.score_p2}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Section Résultats Bracket (affichage complémentaire structuré) */}
        {bracketMatches.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 16 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.3, delay: 0.5 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 px-1">
              <Award className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Résultats Phase Finale</h3>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl shadow-md p-4 divide-y divide-slate-100">
              {bracketMatches.map(match => {
                const isWinnerMe = match.winner_id === player.id;
                const isP1Me = match.player1_id === player.id;
                const opp = isP1Me ? match.player2 : match.player1;
                
                const setsP1 = match.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
                const setsP2 = match.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;
                const scoreStr = isP1Me ? `${setsP1} – ${setsP2}` : `${setsP2} – ${setsP1}`;

                return (
                  <div key={match.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="font-black text-slate-900">{translateBracketRound(match.bracket_round)}</p>
                      <p className="text-slate-500 font-semibold mt-0.5 truncate">
                        vs. {opp ? `${opp.first_name} ${opp.last_name}` : "Adversaire attendu"}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      {match.status === 'finished' ? (
                        <>
                          <span className="font-mono bg-slate-50 border border-slate-200 py-0.5 px-2 rounded-lg font-black">{scoreStr}</span>
                          {isWinnerMe ? (
                            <span className="text-emerald-600 font-extrabold">Victoire ✓</span>
                          ) : (
                            <span className="text-rose-500 font-bold">Défaite</span>
                          )}
                        </>
                      ) : (
                        <span className="text-indigo-600 font-extrabold uppercase text-[9px] tracking-wider animate-pulse">
                          {match.status === 'in_progress' ? 'En cours ⏱️' : 'En attente ⏳'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

      </main>

      {/* Footer minimaliste de la page */}
      <footer className="mt-12 text-center text-slate-400 space-y-2 px-6">
        <p className="text-[11px] font-bold tracking-wide uppercase text-slate-400 shrink-0">Table Tennis Event Companion</p>
        <p className="text-[10px]">© 2026 Ping Manager. Conçu pour simplifier l'arbitrage et le suivi des tournois.</p>
        <div className="text-[10px] font-mono text-slate-400 mt-1">
          v0.8.0
        </div>
      </footer>

    </div>
  );
}
