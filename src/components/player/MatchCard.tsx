import React from 'react';
import { Link } from 'react-router-dom';
import { Match } from '../../types';
import { Trophy, HelpCircle, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  match: Match;
  playerId: string;
  tournamentId: string;
  key?: string;
}

export function MatchCard({ match, playerId, tournamentId }: Props) {
  const isP1 = match.player1_id === playerId;
  const opponent = isP1 ? match.player2 : match.player1;

  const setsP1 = match.sets?.filter(s => s.score_p1 > s.score_p2).length || 0;
  const setsP2 = match.sets?.filter(s => s.score_p2 > s.score_p1).length || 0;

  const mySets = isP1 ? setsP1 : setsP2;
  const oppSets = isP1 ? setsP2 : setsP1;

  const statusDetails = {
    pending: { label: 'En attente', color: 'text-slate-400 bg-slate-900/40 border-slate-700/60' },
    in_progress: { label: 'En cours', color: 'text-orange-400 bg-orange-950/20 border-orange-500/50' },
    awaiting_validation: { label: 'Validation requise', color: 'text-amber-400 bg-amber-950/30 border-amber-500/50 animate-pulse' },
    disputed: { label: 'Litige', color: 'text-red-400 bg-red-950/20 border-red-500/50' },
    finished: { label: 'Terminé', color: 'text-green-400 bg-green-950/10 border-green-600/40' },
    walkover: { label: 'Forfait', color: 'text-rose-500 bg-rose-950/10 border-rose-600/30' },
  }[match.status] || { label: match.status, color: 'text-slate-400 bg-slate-900 border-slate-700' };

  const finalWinnerId = match.winner_id;
  const iAmWinner = finalWinnerId === playerId;

  return (
    <div className={`border rounded-2xl p-4 transition-all duration-350 ${statusDetails.color} relative overflow-hidden backdrop-blur-sm`}>
      <header className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-widest mb-3 text-slate-400">
        <div className="flex items-center gap-1.5">
          <span>{match.round === 'pool' ? 'Poule' : match.round}</span>
          {match.table_number && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">Table {match.table_number}</span>
            </>
          )}
        </div>
        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-current">
          {statusDetails.label}
        </span>
      </header>

      <div className="flex justify-between items-center">
        <div>
          <p className="font-extrabold text-white text-base leading-tight">
            vs {opponent ? `${opponent.first_name || ''} ${opponent.last_name || ''}`.trim() : 'En attente'}
          </p>
          {opponent && (
            <p className="text-slate-400 text-xs mt-0.5 font-medium">
              {opponent.club || 'Sans club'} · {opponent.points || 500} pts
            </p>
          )}
        </div>

        {/* Live Set score counter */}
        {match.status !== 'pending' && (
          <div className="text-right pl-4">
            <p className="text-3xl font-black font-mono tracking-tighter tabular-nums leading-none">
              <span className={match.status === 'finished' ? (iAmWinner ? 'text-green-400' : 'text-slate-400') : 'text-orange-400'}>
                {mySets}
              </span>
              <span className="text-slate-600 mx-1">:</span>
              <span className="text-slate-350">
                {oppSets}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Button handlers depending on current step */}
      {match.status === 'pending' && match.table_number && (
        <div className="mt-3.5 flex items-center gap-2 bg-slate-900/50 border border-slate-700/60 rounded-xl px-3 py-2 text-xs leading-normal">
          <span className="text-orange-400 text-sm">📍</span>
          <p className="text-slate-300">
            Rendez-vous à la <strong className="text-white">Table {match.table_number}</strong> puis scannez le QR code de la table pour démarrer !
          </p>
        </div>
      )}

      {match.status === 'in_progress' && (
        <Link
          to={`/player/${tournamentId}/match/${match.id}`}
          className="mt-3.5 flex items-center justify-center gap-1.5 w-full bg-orange-500 hover:bg-orange-400 text-white font-extrabold py-2.5 rounded-xl active:scale-95 transition-all text-xs shadow-md shadow-orange-950/20"
        >
          Saisir les scores 🏓
        </Link>
      )}

      {match.status === 'awaiting_validation' && (
        <Link
          to={`/player/${tournamentId}/validate/${match.id}`}
          className="mt-3.5 flex items-center justify-center gap-1.5 w-full bg-amber-500 hover:bg-amber-400 text-white font-extrabold py-2.5 rounded-xl active:scale-95 transition-all text-xs shadow-md shadow-amber-950/20"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Valider le résultat final !
        </Link>
      )}

      {match.status === 'disputed' && (
        <div className="mt-3.5 flex items-center gap-2 bg-red-950/40 border border-red-900/50 rounded-xl px-3 py-2 text-xs text-red-300 leading-normal">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p>
            Score contesté. Le juge-arbitre a été notifié et va trancher à la table de pointage.
          </p>
        </div>
      )}
    </div>
  );
}
export default MatchCard;
