import React from 'react';
import { Link } from 'react-router-dom';
import { Notification } from '../../hooks/usePlayerNotifications';
import { Sparkles, Trophy, ChevronRight, AlertTriangle } from 'lucide-react';

interface Props {
  notification: Notification;
  tournamentId: string;
}

export function UrgentBanner({ notification, tournamentId }: Props) {
  const isMatchVal = notification.type === 'validate_match';
  const isStandingsVal = notification.type === 'validate_standings';

  if (!isMatchVal && !isStandingsVal) return null;

  const targetUrl = isMatchVal
    ? `/player/${tournamentId}/validate/${notification.payload?.match_id}`
    : `/player/${tournamentId}/pool/${notification.payload?.pool_id}`;

  const message = isMatchVal
    ? `Votre match contre ${notification.payload?.opponent_name || 'votre adversaire'} est terminé. Saisissez votre validation du score final !`
    : `Tous les matchs de votre poule sont validés ! Votre signature est requise pour clore et valider le classement final de la poule.`;

  return (
    <div className="mx-4 mt-5">
      <Link
        to={targetUrl}
        className="block bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 p-4.5 rounded-2xl shadow-xl shadow-orange-950/20 active:scale-[0.99] transition-all border border-orange-400/30"
      >
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-inner">
            {isMatchVal ? <Trophy className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-spin" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider mb-0.5">
              Action Requise ⚡
            </h4>
            <p className="text-white text-xs leading-relaxed font-medium">
              {message}
            </p>
            <div className="flex items-center gap-1 mt-2 text-[11px] font-black text-white uppercase tracking-wider">
              <span>Signer maintenant</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
export default UrgentBanner;
