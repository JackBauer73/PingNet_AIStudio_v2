import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { Trophy, CheckCircle2, ShieldEllipsis, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export default function PlayerValidation() {
  const { token, matchId } = useParams<{ token: string; matchId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<any | null>(null);
  const [identity, setIdentity] = useState<{ id: string; name: string; isP1: boolean; isP2: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [terminating, setTerminating] = useState(false);

  const fetchValidationData = async (silent = false) => {
    if (!token || !matchId) {
      setError("Paramètres de validation manquants");
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);

      // Étape 1 — Identifier le joueur via son token
      const { data: tokenRow, error: tokenError } = await supabase
        .from('player_tokens')
        .select('player_id, players(first_name, last_name)')
        .eq('token', token.trim())
        .maybeSingle();

      if (tokenError) throw tokenError;

      if (!tokenRow) {
        setError("Token d'accès invalide ou expiré");
        setLoading(false);
        return;
      }

      const activePlayerId = tokenRow.player_id;
      const playersObj = Array.isArray(tokenRow.players) ? tokenRow.players[0] : tokenRow.players;
      const activePlayerName = playersObj
        ? `${(playersObj as any).first_name} ${(playersObj as any).last_name}`
        : "Joueur";

      // Étape 2 — Charger le match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:player1_id(*),
          player2:player2_id(*),
          sets(*),
          tournament:tournament_id(sets_to_win, points_per_set)
        `)
        .eq('id', matchId)
        .maybeSingle();

      if (matchError) throw matchError;

      if (!matchData) {
        setError("Match introuvable");
        setLoading(false);
        return;
      }

      // Étape 3 — Contrôle d'identité (anti-triche)
      const isP1 = activePlayerId === matchData.player1_id;
      const isP2 = activePlayerId === matchData.player2_id;

      if (!isP1 && !isP2) {
        setError("Accès refusé : vous ne faites pas partie de ce match. Anti-triche actif.");
        setLoading(false);
        return;
      }

      setIdentity({
        id: activePlayerId,
        name: activePlayerName,
        isP1,
        isP2
      });

      // Trier les sets
      if (matchData.sets) {
        matchData.sets.sort((a: any, b: any) => a.set_number - b.set_number);
      }

      setMatch(matchData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur de chargement");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchValidationData();

    // Abonnement temps réel
    if (!matchId) return;
    const channel = supabase
      .channel(`validation_${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, () => fetchValidationData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sets', filter: `match_id=eq.${matchId}` }, () => fetchValidationData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token, matchId]);

  const setsP1 = match?.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
  const setsP2 = match?.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;

  // Compte à rebours
  useEffect(() => {
    if (!match || match.status !== 'awaiting_validation' || !match.awaiting_validation_since) {
      setTimeLeft(null);
      return;
    }

    const checkTime = () => {
      const since = new Date(match.awaiting_validation_since).getTime();
      const now = new Date().getTime();
      const elapsed = (now - since) / 1000;
      const left = Math.max(0, 120 - Math.floor(elapsed));
      setTimeLeft(left);

      if (left <= 0) {
        // Validation automatique
        handleForceValidation();
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [match?.id, match?.status, match?.awaiting_validation_since]);

  // Propagation du bracket ou clôture de la poule
  const finalizeTournamentProgression = async (matchToFinalize: any, winnerId: string) => {
    try {
      // Si c'est un match de poule, faire la table rotation
      if (matchToFinalize.pool_id && matchToFinalize.table_number) {
        const { data: nextPendingMatches, error: pendingError } = await supabase
          .from('matches')
          .select('id, player1_id, player2_id')
          .eq('pool_id', matchToFinalize.pool_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });

        if (!pendingError && nextPendingMatches && nextPendingMatches.length > 0) {
          const justPlayedPlayers = [matchToFinalize.player1_id, matchToFinalize.player2_id].filter(Boolean);
          const preferredMatch = nextPendingMatches.find(m => 
            !justPlayedPlayers.includes(m.player1_id) && 
            !justPlayedPlayers.includes(m.player2_id)
          );

          if (preferredMatch) {
            await supabase
              .from('matches')
              .update({
                table_number: matchToFinalize.table_number,
                status: 'in_progress',
                started_at: new Date().toISOString()
              })
              .eq('id', preferredMatch.id);
          }
        }

        // Vérifier si la poule est clôturée :
        const { data: remainingMatches, error: remainingError } = await supabase
          .from('matches')
          .select('id, status')
          .eq('pool_id', matchToFinalize.pool_id);

        if (!remainingError && remainingMatches) {
          const activeOrPending = remainingMatches.filter(m => 
            m.id !== matchToFinalize.id && 
            (m.status === 'pending' || m.status === 'in_progress' || m.status === 'awaiting_validation' || m.status === 'disputed')
          );
          
          if (activeOrPending.length === 0) {
            const isPoolOf2 = remainingMatches.length === 1;
            const nextStatus = isPoolOf2 ? 'finished' : 'awaiting_validation';

            await supabase
              .from('pools')
              .update({ 
                status: nextStatus, 
                table_number: null,
                awaiting_validation_since: nextStatus === 'awaiting_validation' ? new Date().toISOString() : null
              })
              .eq('id', matchToFinalize.pool_id);
          }
        }
      }

      // Propagation s'il s'agit d'un Bracket
      if (matchToFinalize.bracket_round) {
        const roundMap: { [key: string]: string } = {
          '32nd': 'sixteenthfinal',
          '32': 'sixteenthfinal',
          'sixteenthfinal': 'eighthfinal',
          'eighthfinal': 'quarterfinal',
          'quarterfinal': 'semifinal',
          'semifinal': 'final'
        };

        const currentRound = matchToFinalize.bracket_round;
        const nextRound = roundMap[currentRound];
        
        if (nextRound && matchToFinalize.bracket_position !== null && matchToFinalize.bracket_position !== undefined) {
          const nextPosition = Math.floor(matchToFinalize.bracket_position / 2);
          const isSlot1 = matchToFinalize.bracket_position % 2 === 0;

          const { data: targetMatch, error: targetError } = await supabase
            .from('matches')
            .select('id, player1_id, player2_id')
            .eq('bracket_id', matchToFinalize.bracket_id)
            .eq('bracket_round', nextRound)
            .eq('bracket_position', nextPosition)
            .maybeSingle();

          if (!targetError && targetMatch) {
            const updateField = isSlot1 ? 'player1_id' : 'player2_id';
            await supabase
              .from('matches')
              .update({ [updateField]: winnerId })
              .eq('id', targetMatch.id);
          }
        }
      }
    } catch (err) {
      console.error('Error during progression propagation:', err);
    }
  };

  const handleValidate = async () => {
    if (!match || !identity) return;
    setTerminating(true);

    const playerField = identity.isP1 ? 'validated_by_p1' : 'validated_by_p2';

    try {
      // 1. Enregistrer notre validation
      const { error: updError } = await supabase
        .from('matches')
        .update({ [playerField]: true })
        .eq('id', match.id);

      if (updError) throw updError;

      // 2. Choper l'autre validation
      const { data: updatedMatch, error: selectError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', match.id)
        .single();

      if (selectError) throw selectError;

      // 3. Si les deux sont OK -> Finir le match
      if (updatedMatch?.validated_by_p1 && updatedMatch?.validated_by_p2) {
        const winnerId = setsP1 > setsP2 ? match.player1_id : match.player2_id;
        if (!winnerId) throw new Error("Impossible de désigner le gagnant du match");

        const { error: finishError } = await supabase
          .from('matches')
          .update({
            status: 'finished',
            winner_id: winnerId,
            finished_at: new Date().toISOString()
          })
          .eq('id', match.id);

        if (finishError) throw finishError;

        // Propager les avancements du tournoi
        await finalizeTournamentProgression(match, winnerId);

        toast.success("Tout est validé ! Match complété.");
      } else {
        toast.success("Validation enregistrée. En attente de l'adversaire.");
      }

      navigate(`/player/${token}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur de validation");
    } finally {
      setTerminating(false);
    }
  };

  const handleContest = async () => {
    if (!match) return;
    setTerminating(true);

    try {
      const { error: cntError } = await supabase
        .from('matches')
        .update({ status: 'disputed' })
        .eq('id', match.id);

      if (cntError) throw cntError;

      toast.success("Contestation prise en compte. Alerte envoyée au Juge-Arbitre.");
      navigate(`/player/${token}`);
    } catch (err) {
      toast.error("Erreur d'envoi de la contestation");
    } finally {
      setTerminating(false);
    }
  };

  const handleForceValidation = async () => {
    if (!match || match.status !== 'awaiting_validation') return;
    const winnerId = setsP1 > setsP2 ? match.player1_id : match.player2_id;
    if (!winnerId) return;

    try {
      await supabase
        .from('matches')
        .update({
          status: 'finished',
          winner_id: winnerId,
          finished_at: new Date().toISOString(),
          validated_by_p1: true,
          validated_by_p2: true
        })
        .eq('id', match.id);

      await finalizeTournamentProgression(match, winnerId);
      navigate(`/player/${token}`);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center p-6 pt-12 text-white text-center">
        <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold mb-4">Erreur d'accès</h2>
        <p className="text-slate-400 mb-8 max-w-sm text-sm">{error}</p>
        <button 
          onClick={() => navigate(`/player/${token}`)}
          className="px-6 py-2.5 bg-slate-800 rounded-xl font-bold text-sm hover:bg-slate-700 text-white"
        >
          Retourner à mon Espace
        </button>
      </div>
    );
  }

  const p1Valid = match?.validated_by_p1;
  const p2Valid = match?.validated_by_p2;
  const iHaveValidated = identity?.isP1 ? p1Valid : p2Valid;

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans text-slate-800 flex flex-col">
      <header className="bg-[#0f1f3d] text-white py-4 px-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/player/${token}`)}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-black uppercase tracking-wider">Validation de Résultat</h1>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-300 block">Connecté en tant que</span>
          <span className="text-xs font-extrabold text-indigo-400">{identity?.name}</span>
        </div>
      </header>

      <main className="max-w-md w-full mx-auto p-4 space-y-4 flex-1">
        {/* Résumé du Score */}
        <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-widest uppercase border-b border-slate-100 pb-2">Résumé de la rencontre</h2>
          
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-5 text-left truncate">
              <span className={`text-sm tracking-tight ${setsP1 > setsP2 ? 'font-black text-slate-900 border-b-2 border-indigo-500' : 'font-semibold text-slate-700'}`}>
                {match.player1?.last_name}
              </span>
              <p className="text-[9px] text-slate-400 font-medium truncate">{match.player1?.club || 'Club Libre'}</p>
            </div>

            <div className="col-span-2 text-center bg-slate-50 py-1.5 px-2 rounded-lg border border-slate-150 font-black text-base italic text-slate-800">
              {setsP1} - {setsP2}
            </div>

            <div className="col-span-5 text-right truncate">
              <span className={`text-sm tracking-tight ${setsP2 > setsP1 ? 'font-black text-slate-900 border-b-2 border-indigo-500' : 'font-semibold text-slate-700'}`}>
                {match.player2?.last_name}
              </span>
              <p className="text-[9px] text-slate-400 font-medium truncate">{match.player2?.club || 'Club Libre'}</p>
            </div>
          </div>

          {/* Sets validés */}
          <div className="bg-slate-50 rounded-xl p-3 flex flex-wrap gap-2 items-center justify-center border border-slate-150/40">
            {match.sets?.map((s: any, idx: number) => (
              <span key={s.id} className="bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold text-slate-700 shadow-sm">
                Set {idx + 1}: <strong className={s.score_p1 > s.score_p2 ? 'text-indigo-600' : ''}>{s.score_p1}</strong>-<strong>{s.score_p2}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Timeout / Compte à rebours */}
        {timeLeft !== null && timeLeft > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-amber-700 tracking-widest block animate-pulse">⏰ Temps restant de validation</span>
            <p className="text-xl font-black text-amber-800 tabular-nums font-mono">{timeLeft} s</p>
            <p className="text-[9px] text-amber-600 font-medium leading-relaxed">Sans action à l'expiration, le match est considéré auto-validé par le système pour éviter le blocage.</p>
          </div>
        )}

        {/* Status de Validation des Joueurs */}
        <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-widest uppercase pb-2 border-b border-slate-100">Statut des signatures</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-xs font-extrabold text-slate-700">{match.player1?.first_name} {match.player1?.last_name}</span>
              {p1Valid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/10 text-green-700 border border-green-500/20 text-[10px] font-black uppercase rounded-lg">
                  ✓ Validé
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-150 text-slate-500 text-[10px] font-black uppercase rounded-lg">
                  En attente
                </span>
              )}
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-xs font-extrabold text-slate-700">{match.player2?.first_name} {match.player2?.last_name}</span>
              {p2Valid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/10 text-green-700 border border-green-500/20 text-[10px] font-black uppercase rounded-lg">
                  ✓ Validé
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-150 text-slate-500 text-[10px] font-black uppercase rounded-lg">
                  En attente
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Zone d'actions si en validation */}
        {match.status === 'awaiting_validation' && (
          <div className="space-y-3">
            {iHaveValidated ? (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-5 text-center font-bold text-sm">
                 ✓ Votre validation est enregistrée.<br/>
                 <span className="text-xs font-medium text-green-600">En attente de la co-validation ou de la fin du compte à rebours.</span>
              </div>
            ) : (
              <button
                onClick={handleValidate}
                disabled={terminating}
                className="w-full py-4.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl text-base shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {terminating ? "Envoi..." : "✓ Confirmer et Valider ce résultat"}
              </button>
            )}

            <button
              onClick={handleContest}
              disabled={terminating}
              className="w-full py-4 bg-white border-2 border-red-200 hover:bg-red-50 text-red-600 font-extrabold rounded-2xl text-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              ⚠️ Signaler une Contestation / Contester
            </button>
          </div>
        )}

        {match.status === 'disputed' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-2">
            <ShieldEllipsis className="w-10 h-10 text-red-500 mx-auto" />
            <h3 className="text-sm font-black text-red-800 uppercase">Match Contesté</h3>
            <p className="text-xs text-red-600 leading-relaxed">Le litige a été notifié à la table de Juge-Arbitrage. Veuillez vous déplacer physiquement avec votre adversaire vers l'arbitre principal pour régulariser le score.</p>
          </div>
        )}
      </main>
    </div>
  );
}
