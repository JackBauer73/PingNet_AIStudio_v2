import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayerAuth } from '../../hooks/usePlayerAuth';
import { useMatch } from '../../hooks/useMatch';
import { useSets } from '../../hooks/useSets';
import { isMatchOver, detectScorerRole } from '../../lib/matchHelpers';
import { notifyMatchValidation } from '../../services/notificationService';
import { supabase } from '../../supabase';
import { SetHistory } from '../../components/player/SetHistory';
import { Loader2, ArrowLeft, Plus, Check, ChevronRight, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MatchScoring() {
  const { tournamentId, matchId } = useParams<{ tournamentId: string; matchId: string }>();
  const navigate = useNavigate();

  const { player, loading: loadingAuth } = usePlayerAuth();
  const { match, loading: loadingMatch } = useMatch(matchId || '');
  const { sets, refresh: refreshSets } = useSets(matchId || '');

  const [scoreP1, setScoreP1] = useState(11);
  const [scoreP2, setScoreP2] = useState(0);
  const [savingSet, setSavingSet] = useState(false);

  if (loadingAuth || loadingMatch) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="font-extrabold text-sm uppercase tracking-wider text-slate-400">Chargement du match...</p>
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
  const nextSetNum = (sets?.length || 0) + 1;
  const setsToWin = match.tournament?.sets_to_win || 2;
  const matchIsOver = isMatchOver(sets || [], setsToWin);

  const handleAddSet = async () => {
    if (scoreP1 < 0 || scoreP2 < 0) {
      toast.error('Les scores doivent être supérieurs ou égaux à 0.');
      return;
    }

    setSavingSet(true);
    try {
      // Respect first one wins constraint with no-op override
      const { error } = await supabase
        .from('sets')
        .insert([{
          match_id: matchId,
          set_number: nextSetNum,
          score_p1: isP1 ? scoreP1 : scoreP2,
          score_p2: isP1 ? scoreP2 : scoreP1,
          is_validated: false
        }]);

      if (error) throw error;

      toast.success(`Set ${nextSetNum} enregistré !`);
      setScoreP1(11);
      setScoreP2(0);
      refreshSets();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la validation du set.');
    } finally {
      setSavingSet(false);
    }
  };

  const handleEndMatch = async () => {
    if (!matchIsOver) return;

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'awaiting_validation',
          scorer_id: player?.playerId,
          scorer_role: detectScorerRole(match, player?.playerId || '')
        })
        .eq('id', matchId);

      if (error) throw error;

      // Trigger player notifications for rapid dual val
      await notifyMatchValidation(match.id);
      toast.success('Scores transmis pour validation finale !');
      navigate(`/player/${tournamentId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la clôture du match.');
    }
  };

  const incrementP1 = () => setScoreP1((s) => s + 1);
  const decrementP1 = () => setScoreP1((s) => Math.max(0, s - 1));
  const incrementP2 = () => setScoreP2((s) => s + 1);
  const decrementP2 = () => setScoreP2((s) => Math.max(0, s - 1));

  const countWonP1 = sets?.filter((s) => s.score_p1 > s.score_p2).length || 0;
  const countWonP2 = sets?.filter((s) => s.score_p2 > s.score_p1).length || 0;

  const mySetsWon = isP1 ? countWonP1 : countWonP2;
  const oppSetsWon = isP1 ? countWonP2 : countWonP1;

  const opponentName = isP1 ? match.player2?.last_name || 'Adversaire' : match.player1?.last_name || 'Adversaire';

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
              Partie en cours
            </p>
            <h1 className="text-sm font-black mt-0.5 leading-none">
              Table {match.table_number || '—'}
            </h1>
          </div>
          <div className="w-10 h-10 flex items-center justify-center font-extrabold text-xs bg-slate-800 rounded-xl border border-slate-700/60 leading-none">
            {mySetsWon}:{oppSetsWon}
          </div>
        </header>

        {/* Historian widget */}
        <SetHistory sets={sets || []} match={match} playerId={player?.playerId || ''} />

        {/* Live Set score counter UI */}
        {!matchIsOver && (
          <main className="max-w-md w-full mx-auto px-4 mt-8">
            <div className="bg-white text-slate-900 rounded-[2.5rem] p-8 shadow-2xl flex flex-col justify-between">
              <h3 className="text-center text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-400 mb-6 flex justify-center items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5" />
                Marquer le Set {nextSetNum}
              </h3>

              <div className="grid grid-cols-2 gap-8 items-center py-4">
                {/* Score Player 1 */}
                <div className="flex flex-col items-center gap-3">
                  <span className="text-sm font-extrabold text-center text-orange-500 truncate max-w-[120px]">
                    Moi
                  </span>
                  <button
                    onClick={incrementP1}
                    className="w-16 h-16 bg-slate-900 hover:bg-slate-850 active:scale-90 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                  <span className="text-6xl font-black font-sans italic tabular-nums text-slate-900 pr-1 select-none">
                    {scoreP1}
                  </span>
                  <button
                    onClick={decrementP1}
                    className="w-11 h-11 bg-slate-50 hover:bg-slate-100 text-slate-400 active:scale-95 rounded-xl flex items-center justify-center border border-slate-100 font-extrabold"
                  >
                    —
                  </button>
                </div>

                {/* Score Player 2 */}
                <div className="flex flex-col items-center gap-3">
                  <span className="text-sm font-extrabold text-center text-slate-500 truncate max-w-[120px]">
                    {opponentName}
                  </span>
                  <button
                    onClick={incrementP2}
                    className="w-16 h-16 bg-slate-900 hover:bg-slate-850 active:scale-90 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                  <span className="text-6xl font-black font-sans italic tabular-nums text-slate-900 pr-1 select-none">
                    {scoreP2}
                  </span>
                  <button
                    onClick={decrementP2}
                    className="w-11 h-11 bg-slate-50 hover:bg-slate-100 text-slate-400 active:scale-95 rounded-xl flex items-center justify-center border border-slate-100 font-extrabold"
                  >
                    —
                  </button>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={handleAddSet}
                  disabled={savingSet}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white font-extrabold rounded-2xl flex items-center justify-center gap-1.5 active:scale-95 transition-all text-sm shadow-md shadow-orange-100 disabled:opacity-50"
                >
                  {savingSet ? 'Insertion...' : '+ Valider ce set'}
                  {!savingSet && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </main>
        )}

        {/* Match Finished validation drawer card */}
        {matchIsOver && (
          <main className="max-w-md w-full mx-auto px-4 mt-8">
            <div className="bg-slate-900/60 border border-green-500/30 rounded-3xl p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Check className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-green-400">Marquage Réussi</h3>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Le match a atteint la limite de sets gagnants ({setsToWin}). Vous pouvez transmettre ces scores aux deux joueurs pour signature.
                </p>
              </div>
              <button
                onClick={handleEndMatch}
                className="w-full bg-orange-500 hover:bg-orange-400 text-white font-extrabold py-4 rounded-xl active:scale-95 transition-all text-sm shadow-md"
              >
                Transmettre pour Signature finale 🚀
              </button>
            </div>
          </main>
        )}
      </div>

      <footer className="text-center text-[10px] font-bold uppercase tracking-widest text-[#4A5568] opacity-50 mt-12">
        PingNet Scorers system
      </footer>
    </div>
  );
}
export { MatchScoring };
