import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTableMatch } from '../../hooks/useTableMatch';
import { Trophy, CheckCircle2, ChevronRight, User, Hash, AlertCircle, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { isValidSetScore, computeMatchResult } from '../../utils/scoring';
import { submitWithRetry } from '../../utils/submitWithRetry';
import OfflineBanner from '../../components/player/OfflineBanner';
import { supabase } from '../../supabase';

export default function TableView() {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const tableNum = parseInt(tableNumber || '0');
  const { match, loading, error, addSetScore, finishMatch, refresh } = useTableMatch(tableNum);
  
  const [newSet, setNewSet] = useState({ p1: 11, p2: 0 });
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [saving, setSaving] = useState(false);

  const setsP1 = match?.sets?.filter(s => s.score_p1 > s.score_p2).length || 0;
  const setsP2 = match?.sets?.filter(s => s.score_p2 > s.score_p1).length || 0;

  const pointsPerSet = (match as any)?.tournament?.points_per_set || 11;
  const setsToWin = (match as any)?.tournament?.sets_to_win || 2;
  const result = match?.sets ? computeMatchResult(match.sets, setsToWin) : { winner: null };

  const handleAddSet = async () => {
    if (!isValidSetScore(newSet.p1, newSet.p2, pointsPerSet)) {
      toast.error(`Score invalide (règles de tennis de table à ${pointsPerSet} points)`);
      return;
    }

    setSaving(true);
    try {
      await addSetScore(newSet.p1, newSet.p2);
      setNewSet({ p1: 11, p2: 0 });
      toast.success('Set enregistré !');
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur: ${err.message || 'Impossible d\'enregistrer le score'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!match) return;
    const winnerId = setsP1 > setsP2 ? match.player1_id : match.player2_id;
    if (!winnerId) return;
    
    setSaving(true);
    try {
      await submitWithRetry(async () => {
        await finishMatch(winnerId);
      });
      setConfirmingFinish(false);
      toast.success('Match terminé et validé !');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const validateByPlayer = async (playerNum: 1 | 2) => {
    if (!match) return;
    const field = playerNum === 1 ? 'validated_by_p1' : 'validated_by_p2';
    
    try {
      const { error } = await supabase
        .from('matches')
        .update({ [field]: true })
        .eq('id', match.id);

      if (error) throw error;
      
      // Auto-finish if both validated
      const { data: updated } = await supabase
        .from('matches')
        .select('validated_by_p1, validated_by_p2')
        .eq('id', match.id)
        .single();

      if (updated?.validated_by_p1 && updated?.validated_by_p2) {
        handleFinish();
      } else {
        refresh();
      }
    } catch (err) {
      toast.error('Erreur de validation');
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
        <h2 className="text-2xl font-bold mb-4">Problème d'accès</h2>
        <div className="space-y-4 mb-8 max-w-sm">
          <p className="text-slate-400">
            Impossible de récupérer les données du match.
          </p>
          <div className="bg-slate-800 p-4 rounded-xl text-left text-xs font-mono text-indigo-300 overflow-auto">
            {error.message || JSON.stringify(error)}
          </div>
        </div>
        <button 
          onClick={refresh}
          className="px-8 py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 active:scale-95 transition-all shadow-lg"
        >
          Réessayer la connexion
        </button>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center p-6 pt-12 text-white">
        <OfflineBanner />
        <header className="w-full max-w-md flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black italic">TT</div>
            <h1 className="text-xl font-black tracking-tight">TABLE {tableNum}</h1>
          </div>
          <span className="px-3 py-1 bg-green-900/30 text-green-400 text-[10px] font-black uppercase rounded-full tracking-wider border border-green-500/30">
            En attente
          </span>
        </header>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md bg-slate-800 rounded-[2.5rem] shadow-2xl border border-slate-700 p-12 text-center"
        >
          <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-8 border border-slate-600">
            <Hash className="w-10 h-10 text-slate-500" />
          </div>
          <h2 className="text-2xl font-black mb-4">Aucun match</h2>
          <p className="text-slate-400 leading-relaxed">
            Attente du prochain match assigné par l'organisateur.
          </p>
          <div className="mt-12 p-4 bg-slate-900/50 rounded-2xl text-[10px] text-slate-500 font-medium uppercase tracking-widest leading-loose">
            L'écran se mettra à jour<br/>automatiquement
          </div>
        </motion.div>
      </div>
    );
  }

  // Phase detection
  const isMatchFinished = match.status === 'finished';
  const needsValidation = result.winner && !isMatchFinished;

  if (isMatchFinished) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center">
        <OfflineBanner />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md"
        >
          <div className="text-6xl mb-6">🏆</div>
          <h2 className="text-3xl font-black mb-2">Match Terminé</h2>
          <p className="text-green-400 font-bold text-xl mb-8">
            {setsP1 > setsP2 ? match.player1?.last_name : match.player2?.last_name} gagne !
          </p>
          
          <div className="flex justify-center gap-4 mb-12">
            {match.sets?.map(s => (
              <div key={s.id} className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg ${
                s.score_p1 > s.score_p2 ? 'bg-indigo-600' : 'bg-slate-700'
              }`}>
                {s.score_p1}-{s.score_p2}
              </div>
            ))}
          </div>

          <p className="text-slate-500 text-sm font-medium italic">
            La table sera bientôt libre pour le prochain match.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-4">
      <OfflineBanner />
      <header className="w-full max-w-md mx-auto flex justify-between items-center py-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black italic text-sm">TT</div>
          <h1 className="text-lg font-black italic">TABLE {tableNum}</h1>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">En Direct</span>
        </div>
      </header>

      <main className="w-full max-w-md mx-auto space-y-4 flex-1 flex flex-col">
        {/* Main Score Board */}
        <div className="bg-slate-800 rounded-[2.5rem] p-8 shadow-2xl border border-slate-700 relative overflow-hidden">
          <div className="flex justify-between items-center relative z-10">
            <div className="text-center flex-1">
              <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-600">
                <User className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">P1</p>
              <p className="text-sm font-black truncate">{match.player1?.last_name}</p>
            </div>
            
            <div className="px-6 text-center">
              <div className="flex items-center justify-center gap-4">
                <span className={`text-6xl font-black italic tracking-tighter ${setsP1 > setsP2 ? 'text-indigo-400' : 'text-white'}`}>{setsP1}</span>
                <span className="text-2xl font-black text-slate-700">—</span>
                <span className={`text-6xl font-black italic tracking-tighter ${setsP2 > setsP1 ? 'text-indigo-400' : 'text-white'}`}>{setsP2}</span>
              </div>
              <div className="bg-slate-900/50 px-3 py-1 rounded-full mt-3 border border-slate-700/50">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Sets</p>
              </div>
            </div>

            <div className="text-center flex-1">
              <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-600">
                <User className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">P2</p>
              <p className="text-sm font-black truncate">{match.player2?.last_name}</p>
            </div>
          </div>
        </div>

        {/* Previous Sets History */}
        <div className="flex justify-center gap-2 py-2">
          {match.sets?.map((s, idx) => (
             <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               key={s.id} 
               className="bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 text-[10px] font-black text-slate-400"
             >
                S{idx + 1}: <span className={s.score_p1 > s.score_p2 ? 'text-indigo-400' : 'text-white'}>{s.score_p1}</span>-<span className={s.score_p2 > s.score_p1 ? 'text-indigo-400' : 'text-white'}>{s.score_p2}</span>
             </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {needsValidation ? (
            <motion.div 
              key="validation"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="bg-indigo-600 rounded-[2rem] p-8 text-center shadow-2xl shadow-indigo-500/20"
            >
              <Trophy className="w-12 h-12 text-white mx-auto mb-4" />
              <h2 className="text-2xl font-black mb-2">Fin du match !</h2>
              <p className="text-indigo-100 text-sm mb-8 px-4">
                Chaque joueur doit valider le résultat final sur ce téléphone (ou le leur).
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={() => validateByPlayer(1)}
                  disabled={match.validated_by_p1}
                  className={`w-full py-5 rounded-2xl font-black text-lg transition-all ${
                    match.validated_by_p1 ? 'bg-indigo-800/50 text-indigo-300' : 'bg-white text-indigo-600 shadow-xl'
                  }`}
                >
                  {match.validated_by_p1 ? '✓ P1 Validé' : `Valider — ${match.player1?.last_name}`}
                </button>
                <button
                  onClick={() => validateByPlayer(2)}
                  disabled={match.validated_by_p2}
                  className={`w-full py-5 rounded-2xl font-black text-lg transition-all ${
                    match.validated_by_p2 ? 'bg-indigo-800/50 text-indigo-300' : 'bg-white text-indigo-600 shadow-xl'
                  }`}
                >
                  {match.validated_by_p2 ? '✓ P2 Validé' : `Valider — ${match.player2?.last_name}`}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="scoring"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-sm flex-1 flex flex-col justify-between"
            >
              <h3 className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-6">Saisie Set {match.sets?.length ? match.sets.length + 1 : 1}</h3>
              
              <div className="grid grid-cols-2 gap-12 flex-1 items-center">
                <div className="text-center space-y-6">
                  <div className="flex flex-col items-center gap-4">
                    <button 
                      onClick={() => setNewSet({...newSet, p1: newSet.p1 + 1})} 
                      className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg shadow-slate-200"
                    >
                      <Plus className="w-8 h-8" />
                    </button>
                    <span className="text-7xl font-black text-slate-900 tabular-nums italic tracking-tighter">{newSet.p1}</span>
                    <button 
                      onClick={() => setNewSet({...newSet, p1: Math.max(0, newSet.p1 - 1)})} 
                      className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center border border-slate-100 active:scale-95"
                    >
                      <span className="text-2xl font-bold">—</span>
                    </button>
                  </div>
                </div>

                <div className="text-center space-y-6">
                  <div className="flex flex-col items-center gap-4">
                    <button 
                      onClick={() => setNewSet({...newSet, p2: newSet.p2 + 1})} 
                      className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg shadow-slate-200"
                    >
                      <Plus className="w-8 h-8" />
                    </button>
                    <span className="text-7xl font-black text-slate-900 tabular-nums italic tracking-tighter">{newSet.p2}</span>
                    <button 
                      onClick={() => setNewSet({...newSet, p2: Math.max(0, newSet.p2 - 1)})} 
                      className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center border border-slate-100 active:scale-95"
                    >
                      <span className="text-2xl font-bold">—</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <button 
                  onClick={handleAddSet}
                  disabled={saving || !isValidSetScore(newSet.p1, newSet.p2)}
                  className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale disabled:shadow-none"
                >
                  {saving ? 'Synchronisation...' : 'Valider le Set'}
                  {!saving && <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-8 text-center text-slate-500 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Ping Manager • Système de score temps réel</p>
      </footer>
    </div>
  );
}


