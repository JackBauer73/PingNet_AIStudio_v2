import { RoundType, MatchStatus } from '../types';

export function getRoundLabel(round: RoundType, poolName?: string | null, selectedCategoryName?: string | null): string {
  if (round === 'pool') {
    if (poolName) {
      if (selectedCategoryName) {
        // e.g. "Série A - Poule 1" -> "Poule 1"
        return poolName.replace(`${selectedCategoryName} - `, '');
      }
      return poolName;
    }
    return 'Poule';
  }

  const roundMapping: Record<RoundType, string> = {
    pool: 'Poule',
    thirtysecondfinal: '1/32',
    sixteenthfinal: '1/16',
    eighthfinal: '1/8',
    quarterfinal: '1/4',
    semifinal: '1/2',
    final: 'Finale',
    '3rd_place': 'Petite finale',
  };

  return roundMapping[round] || round;
}

export function getMatchStatusDetails(status: MatchStatus): { text: string; color: string; bgClass: string; textClass: string } {
  switch (status) {
    case 'pending':
      return { 
        text: 'Appel', 
        color: '#f97316', 
        bgClass: 'bg-orange-500/15', 
        textClass: 'text-orange-500' 
      };
    case 'in_progress':
      return { 
        text: 'En cours', 
        color: '#22c55e', 
        bgClass: 'bg-emerald-500/15', 
        textClass: 'text-emerald-500' 
      };
    case 'awaiting_validation':
      return { 
        text: 'À valider', 
        color: '#3b82f6', 
        bgClass: 'bg-blue-500/15', 
        textClass: 'text-blue-500' 
      };
    case 'disputed':
      return { 
        text: 'Litige', 
        color: '#ef4444', 
        bgClass: 'bg-red-500/15', 
        textClass: 'text-red-500' 
      };
    case 'walkover':
      return { 
        text: 'Forfait', 
        color: '#64748b', 
        bgClass: 'bg-slate-500/15', 
        textClass: 'text-slate-500' 
      };
    case 'finished':
      return { 
        text: 'Terminé', 
        color: '#10b981', 
        bgClass: 'bg-teal-500/15', 
        textClass: 'text-teal-500' 
      };
    default:
      return { 
        text: status, 
        color: '#64748b', 
        bgClass: 'bg-slate-500/15', 
        textClass: 'text-slate-500' 
      };
  }
}
