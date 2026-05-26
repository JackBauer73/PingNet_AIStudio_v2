import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayerAuth } from '../../hooks/usePlayerAuth';
import { useMatch } from '../../hooks/useMatch';
import { useSets } from '../../hooks/useSets';
import { supabase } from '../../supabase';
import { ValidationCountdown } from '../../components/player/ValidationCountdown';
import { Loader2, ArrowLeft, Trophy, CheckSquare, AlertOctagon, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MatchValidation() {
  const { tournamentId, matchId } = useParams<{ tournamentId: string; matchId: string }>();
  const navigate = useNavigate();

  const { player, loading: loadingAuth } = usePlayerAuth();
  const { match, loading: loadingMatch, refresh: refreshMatch } = useMatch(matchId || '');
  const { sets, loading: loadingSets } = useSets(matchId || '');

  // Lazy validation trigger on load: evaluates timeouts
  useEffect(() => {
    const checkTimeout = async () => {
      if (!matchId) return;
      try {
        await supabase.rpc('evaluate_match_timeouts', { p_match_id: matchId });
        refreshMatch();
      } catch (err) {
        console.warn('RPC evaluate_match_timeouts has skipped or is pending:', err);
      }
    };

    checkTimeout();
  }, [matchId, refreshMatch]);

  if (loadingAuth || loadingMatch || loadingSets) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="font-extrabold text-sm uppercase tracking-wider text-slate-450">Chargement de la validation...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-400 font-extrabold mb-4">Ce match n'existe pas ou a été annulé.</p>
        <button
          onClick={() => navigate(`/player/${tournamentId}`)}
          className="px-6 py-2.5 bg-slate-800 rounded-xl font-bold"
        >
          Retour au Tableau de Bord
        </button>
      </div>
    );
  }

  const isP1 = match.player1_id === player?.playerId;
  const countWonP1 = sets?.filter((s) => s.score_p1 > s.score_p2).length || 0;
  const countWonP2 = sets?.filter((s) => s.score_p2 > s.score_p1).length || 0;

  const mySets = isP1 ? countWonP1 : countWonP2;
  const oppSets = isP1 ? countWonP2 : countWonP1;
  const iWon = mySets > oppSets;

  const opponentName = isP1 ? match.player2?.last_name || 'Adversaire' : match.player1?.last_name || 'Adversaire';

  const handleValidate = async () => {
    const field = isP1 ? 'validated_by_p1' : 'validated_by_p2';
    try {
      const { error } = await supabase
        .from('matches')
        .update({ [field]: true })
        .eq('id', matchId);

      if (error) throw error;

      toast.success('✓ Résultat validé ! Signature transmise.');
      navigate(`/player/${tournamentId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur de signature.');
    }
  };

  const handleDispute = async () => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'disputed' })
        .eq('id', matchId);

      if (error) throw error;

      // Notify organizer
      await supabase.from('notifications').insert({
        player_id: player?.playerId, // creator profile backlink
        tournament_id: tournamentId,
        type: 'match_disputed',
        payload: {
          match_id: matchId,
          disputed_by: player?.playerId,
          p1_name: match.player1?.last_name || 'Player 1',
          p2_name: match.player2?.last_name || 'Player 2',
        },
      });

      toast.success('Conflit signalé au juge-arbitre.');
      navigate(`/player/${tournamentId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la contestation.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white flex flex-col justify-between selection:bg-orange-500 selection:text-white pb-8">
      <div>
        <header className="px-4 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <button
            onClick={() => navigate(`/player/${tournamentId}`)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest leading-none">
              Signature électronique
            </p>
            <h1 className="text-sm font-black mt-0.5 leading-none">
              Validation des Scores
            </h1>
          </div>
          <div className="w-8 h-8" />
        </header>

        <main className="max-w-md w-full mx-auto px-4 mt-8">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-[2rem] p-8 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-sm">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-orange-400" />
              </div>
              <p className="text-4xl font-black font-mono tracking-tighter leading-none mb-2">
                <span className={iWon ? 'text-green-400' : 'text-slate-400'}>{mySets}</span>
                <span className="text-slate-600 mx-1">:</span>
                <span className="text-slate-350">{oppSets}</span>
              </p>
              <h2 className="text-lg font-black">{iWon ? 'Vous avez Gagné ! 🎉' : 'Vous avez Perdu'}</h2>
              <p className="text-slate-400 text-xs mt-1">Match contre {opponentName}</p>
            </div>

            {/* Set by set detail view */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden shadow-inner">
              <header className="px-4 py-2 bg-slate-950/40 border-b border-slate-800 flex justify-between text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">
                <span>Moi</span>
                <span>Scores</span>
                <span>{opponentName}</span>
              </header>
              <div className="divide-y divide-slate-800/40">
                {sets?.map((set, index) => {
                  const setValP1 = isP1 ? set.score_p1 : set.score_p2;
                  const setValP2 = isP1 ? set.score_p2 : set.score_p1;
                  const setIWon = setValP1 > setValP2;

                  return (
                    <div key={set.id || index} className="flex justify-between items-center px-4 py-3 text-sm">
                      <span className={`font-black font-mono ${setIWon ? 'text-green-400' : 'text-slate-400'}`}>
                        {setValP1}
                      </span>
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest font-sans">
                        Set {set.set_number || index + 1}
                      </span>
                      <span className={`font-black font-mono ${!setIWon ? 'text-orange-400' : 'text-slate-400'}`}>
                        {setValP2}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Auto countdown banner */}
            <ValidationCountdown
              matchId={matchId!}
              timeoutSeconds={120}
              onTimeout={() => {
                toast.success('Match expiré - validé automatiquement.');
                navigate(`/player/${tournamentId}`);
              }}
              startTime={match.updated_at || match.started_at || undefined}
            />

            {/* Accept / Dispute Actions buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDispute}
                className="flex-1 py-3.5 border border-red-500 hover:bg-red-500/10 active:scale-95 transition-all rounded-xl font-bold text-red-400 text-xs flex justify-center items-center gap-1.5"
              >
                <AlertOctagon className="w-4 h-4" />
                Contester
              </button>
              <button
                onClick={handleValidate}
                className="flex-2 py-3.5 bg-green-600 hover:bg-green-500 active:scale-95 transition-all text-white font-extrabold rounded-xl text-sm flex justify-center items-center gap-1.5 shadow-md shadow-green-950/20"
              >
                <CheckSquare className="w-4 h-4" />
                D'accord, Signer ✓
              </button>
            </div>
          </div>
        </main>
      </div>

      <footer className="text-center text-[10px] font-bold uppercase tracking-widest text-[#4A5568] opacity-50 mt-12">
        PingNet Player Portal
      </footer>
    </div>
  );
}
export { MatchValidation };
