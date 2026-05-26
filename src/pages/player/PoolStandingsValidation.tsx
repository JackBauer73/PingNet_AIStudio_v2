import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayerAuth } from '../../hooks/usePlayerAuth';
import { usePoolStandings } from '../../hooks/usePoolStandings';
import { supabase } from '../../supabase';
import { ValidationCountdown } from '../../components/player/ValidationCountdown';
import { Loader2, ArrowLeft, Award, HelpCircle, PenTool, CheckCircle2, AlertOctagon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PoolStandingsValidation() {
  const { tournamentId, poolId } = useParams<{ tournamentId: string; poolId: string }>();
  const navigate = useNavigate();

  const { player, loading: loadingAuth } = usePlayerAuth();
  const { standing, loading: loadingStandings } = usePoolStandings(poolId || '');

  const [disputeNote, setDisputeNote] = useState('');
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Lazy standings validation timeout trigger
  useEffect(() => {
    const triggerTimeoutCheck = async () => {
      if (!poolId) return;
      try {
        await supabase.rpc('evaluate_standings_timeout', { p_pool_id: poolId });
      } catch (err) {
        console.warn('RPC evaluate_standings_timeout has skipped or is pending:', err);
      }
    };

    triggerTimeoutCheck();
  }, [poolId]);

  if (loadingAuth || loadingStandings) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="font-extrabold text-sm uppercase tracking-wider text-slate-450">Chargement du classement...</p>
      </div>
    );
  }

  const handleValidate = async () => {
    if (!player?.playerId || !poolId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('pool_standings_validations').insert([{
        pool_id: poolId,
        player_id: player.playerId,
        is_disputed: false
      }]);

      if (error && !error.message.includes('unique')) throw error;

      toast.success('✍️ Classement validé et signé !');
      navigate(`/player/${tournamentId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la validation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispute = async () => {
    if (!player?.playerId || !poolId) return;
    if (!disputeNote.trim()) {
      toast.error('Veuillez saisir le motif de votre contestation.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('pool_standings_validations').insert([{
        pool_id: poolId,
        player_id: player.playerId,
        is_disputed: true,
        dispute_note: disputeNote.trim()
      }]);

      if (error) throw error;

      // Create local notification for referee
      await supabase.from('notifications').insert([{
        player_id: player.playerId,
        tournament_id: tournamentId,
        type: 'standings_disputed',
        payload: {
          pool_id: poolId,
          disputed_by: player.playerId,
          dispute_note: disputeNote.trim()
        }
      }]);

      toast.success('Contestation transmise au juge-arbitre.');
      navigate(`/player/${tournamentId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la contestation.');
    } finally {
      setSubmitting(false);
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
              Fin de qualification
            </p>
            <h1 className="text-sm font-black mt-0.5 leading-none">
              Signature Classement
            </h1>
          </div>
          <div className="w-8 h-8" />
        </header>

        <main className="max-w-md w-full mx-auto px-4 mt-8">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-[2rem] p-8 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-sm">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <PenTool className="w-8 h-8 text-orange-400" />
              </div>
              <h2 className="text-lg font-black">Homologuer la Poule</h2>
              <p className="text-slate-400 text-xs mt-1">Veuillez vérifier vos statistiques et signer</p>
            </div>

            {/* Simulated Live standings view table */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden shadow-inner">
              <header className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 text-[9px] font-extrabold text-slate-500 uppercase tracking-widest grid grid-cols-12">
                <span className="col-span-6 text-left">Nom</span>
                <span className="col-span-2 text-center">Wins</span>
                <span className="col-span-2 text-center">Ratio</span>
                <span className="col-span-2 text-center">Pts</span>
              </header>
              <div className="divide-y divide-slate-800/40">
                {standing.map((row, idx) => {
                  const isMe = row.player_id === player?.playerId;
                  return (
                    <div
                      key={row.player_id}
                      className={`grid grid-cols-12 items-center px-4 py-3.5 text-xs ${
                        isMe ? 'bg-orange-500/10' : ''
                      }`}
                    >
                      <div className="col-span-6 flex items-center gap-1.5 leading-none">
                        <span className="text-[10px] font-bold text-slate-500 font-mono">{idx + 1}.</span>
                        <span className={`font-extrabold truncate ${isMe ? 'text-orange-400' : 'text-slate-200'}`}>
                          {row.last_name?.toUpperCase()}
                        </span>
                        {idx < 2 && (
                          <span className="text-[9px] font-black uppercase text-green-400 bg-green-950/30 px-1 border border-green-800/40 rounded scale-90">
                            Q
                          </span>
                        )}
                      </div>
                      <span className="col-span-2 text-center font-bold text-slate-350 font-mono">{row.wins}</span>
                      <span className="col-span-2 text-center font-mono text-slate-400">
                        {row.sets_won}:{row.sets_lost}
                      </span>
                      <span className="col-span-2 text-center font-bold text-slate-200 font-mono">{row.points}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <ValidationCountdown
              matchId={poolId!}
              timeoutSeconds={120}
              onTimeout={() => {
                toast.success('Poule expirée - homologuée automatiquement.');
                navigate(`/player/${tournamentId}`);
              }}
            />

            {/* Dispute input form conditional renderer */}
            {showDisputeInput ? (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Motif de contestation
                  </label>
                  <textarea
                    required
                    placeholder="Ex: Le set 2 du match A/B a été inversé dans la saisie..."
                    rows={3}
                    value={disputeNote}
                    onChange={(e) => setDisputeNote(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-xl outline-none focus:ring-2 focus:ring-orange-500/35 transition-all text-xs leading-normal font-semibold placeholder:font-normal placeholder:text-slate-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDisputeInput(false)}
                    className="px-4 py-2.5 bg-slate-700/60 hover:bg-slate-705 text-slate-300 rounded-xl font-bold text-xs"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDispute}
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-extrabold text-xs disabled:opacity-50"
                  >
                    Contester au JAL 🚨
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDisputeInput(true)}
                  className="flex-1 py-3.5 border border-red-500 hover:bg-red-500/10 active:scale-95 transition-all rounded-xl font-bold text-red-100 text-xs flex justify-center items-center gap-1.5"
                >
                  <AlertOctagon className="w-4 h-4" />
                  Contester
                </button>
                <button
                  onClick={handleValidate}
                  disabled={submitting}
                  className="flex-2 py-3.5 bg-green-600 hover:bg-green-500 active:scale-95 transition-all text-white font-extrabold rounded-xl text-sm flex justify-center items-center gap-1.5 shadow-md shadow-green-950/20 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Signer & Clôturer ✍️
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="text-center text-[10px] font-bold uppercase tracking-widest text-[#4A5568] opacity-50 mt-12">
        PingNet Player Portal
      </footer>
    </div>
  );
}
export { PoolStandingsValidation };
