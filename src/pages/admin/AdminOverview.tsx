import React, { useEffect, useState } from 'react';
import { 
  Trophy, 
  Users, 
  CheckCircle2, 
  MessageSquare, 
  RefreshCw, 
  Calendar, 
  Clock, 
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';

interface RecentProfile {
  id: string;
  email: string | null;
  role: string;
  created_at: string;
}

interface RecentFeedback {
  id: string;
  type: string;
  message: string;
  status: string;
  created_at: string;
}

export default function AdminOverview() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // States pour les indicateurs (uniquement des données réelles)
  const [activeTournamentsCount, setActiveTournamentsCount] = useState(0);
  const [checkedInPlayersCount, setCheckedInPlayersCount] = useState(0);
  const [finishedMatchesCount, setFinishedMatchesCount] = useState(0);
  const [totalRegistrationsCount, setTotalRegistrationsCount] = useState(0);
  const [totalPlayersCount, setTotalPlayersCount] = useState(0);
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);

  // Activité récente (uniquement si issu de vraies tables)
  const [recentFeedbacks, setRecentFeedbacks] = useState<RecentFeedback[]>([]);
  const [recentProfiles, setRecentProfiles] = useState<RecentProfile[]>([]);

  const loadIndicators = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Tournois actifs
      const { data: actTourns, error: actError } = await supabase
        .from('tournaments')
        .select('id, name')
        .in('status', ['registration', 'pools', 'bracket', 'in_progress']);

      const tournList = actTourns || [];
      setActiveTournamentsCount(tournList.length);

      const activeTournIds = tournList.map(t => t.id);

      // 2. Joueurs pointés (sur les tournois actifs) et Inscriptions globales sur tournois actifs
      if (activeTournIds.length > 0) {
        // Joueurs pointés
        const { count: checkedInCount, error: checkedInError } = await supabase
          .from('registrations')
          .select('id', { count: 'exact', head: true })
          .in('tournament_id', activeTournIds)
          .eq('checked_in', true);
        
        if (!checkedInError) {
          setCheckedInPlayersCount(checkedInCount || 0);
        }

        // Inscriptions totales
        const { count: totalRegs, error: totalRegsError } = await supabase
          .from('registrations')
          .select('id', { count: 'exact', head: true })
          .in('tournament_id', activeTournIds);
        
        if (!totalRegsError) {
          setTotalRegistrationsCount(totalRegs || 0);
        }

        // Matchs terminés (tournois actifs)
        const { count: finishedMatches, error: finishedError } = await supabase
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .in('tournament_id', activeTournIds)
          .eq('status', 'finished');
        if (!finishedError) {
          setFinishedMatchesCount(finishedMatches || 0);
        }
      } else {
        setCheckedInPlayersCount(0);
        setTotalRegistrationsCount(0);
        setFinishedMatchesCount(0);
      }

      // 3. Joueurs physiques totaux en base
      const { count: playersCount, error: playersError } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true });
      if (!playersError) {
        setTotalPlayersCount(playersCount || 0);
      }

      // 4. Feedbacks non traités (nouveau)
      const { count: feedbackCount, error: fbError } = await supabase
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'nouveau');
      if (!fbError) {
        setNewFeedbackCount(feedbackCount || 0);
      }

      // 5. Charger feedbacks récents
      const { data: recFbs, error: recFbError } = await supabase
        .from('feedback')
        .select('id, type, message, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!recFbError) {
        setRecentFeedbacks(recFbs || []);
      }

      // 6. Charger profils récents (gérer l'absence possible de la table profiles de façon gracieuse)
      const { data: recProfs, error: recProfError } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!recProfError) {
        setRecentProfiles(recProfs || []);
      }

    } catch (e: any) {
      console.error('Erreur lors du chargement des statistiques globales:', e);
      toast.error('Échec du chargement de certaines données.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadIndicators();

    // Abonnement temps réel optionnel pour le feedback
    const channel = supabase
      .channel('admin-overview-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => {
        loadIndicators(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-6 sm:p-8 space-y-8 select-none">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1b2b41] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[#f97316] text-[10px] uppercase font-black tracking-widest bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg w-max mb-2">
            Superadmin
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Vue d'ensemble <span className="text-slate-500 text-lg font-mono">v0.21.0</span>
          </h1>
          <p className="text-xs text-slate-450 mt-1">
            Indicateurs métiers réels issus de la base de données.
          </p>
        </div>

        <button
          onClick={() => loadIndicators(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#152031] border border-[#2a3548] text-xs font-bold rounded-lg hover:border-slate-550 transition-all cursor-pointer disabled:opacity-50 text-white self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#f97316] ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser les données
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-mono text-slate-400">Interrogation des tables en cours...</p>
        </div>
      ) : (
        <>
          {/* Cartes d'indicateurs de données réelles */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Tournois actifs */}
            <div id="card-active-tournaments" className="p-5 bg-[#101927] border border-[#223146] rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tournois Actifs</span>
                <Trophy className="w-4 h-4 text-[#f97316]" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white block">{activeTournamentsCount}</span>
                <span className="text-[9px] text-slate-500 font-mono mt-1 block">Statut hors terminé</span>
              </div>
            </div>

            {/* Inscriptions totales (tournois actifs) */}
            <div id="card-total-registrations" className="p-5 bg-[#101927] border border-[#223146] rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Inscriptions</span>
                <Users className="w-4 h-4 text-orange-400" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white block">{totalRegistrationsCount}</span>
                <span className="text-[9px] text-slate-500 font-mono mt-1 block">Sur tournois actifs</span>
              </div>
            </div>

            {/* Joueurs pointés */}
            <div id="card-checked-in-players" className="p-5 bg-[#101927] border border-[#223146] rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Joueurs Présents</span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white block">{checkedInPlayersCount}</span>
                <span className="text-[9px] text-slate-500 font-mono mt-1 block">Pointés sur tournois actifs</span>
              </div>
            </div>

            {/* Matchs terminés */}
            <div id="card-finished-matches" className="p-5 bg-[#101927] border border-[#223146] rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Matchs Finis</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white block">{finishedMatchesCount}</span>
                <span className="text-[9px] text-slate-500 font-mono mt-1 block">Sur tournois actifs</span>
              </div>
            </div>

            {/* Joueurs physiques totaux */}
            <div id="card-total-players" className="p-5 bg-[#101927] border border-[#223146] rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Inscrits uniques</span>
                <Users className="w-4 h-4 text-sky-400" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white block">{totalPlayersCount}</span>
                <span className="text-[9px] text-slate-500 font-mono mt-1 block">Profils physiques totaux</span>
              </div>
            </div>

            {/* Feedback nouveau */}
            <div id="card-new-feedback" className="p-5 bg-[#101927] border border-[#223146] rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Feedbacks Nouv.</span>
                <MessageSquare className="w-4 h-4 text-red-450" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-slate-200 block">{newFeedbackCount}</span>
                <span className="text-[9px] text-slate-500 font-mono mt-1 block">A traiter urgemment</span>
              </div>
            </div>
          </div>

          {/* Activité récente (uniquement si alimenté par des données réelles) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Derniers retours clients */}
            <div className="bg-[#101927] border border-[#223146] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#223146]/50 pb-3">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#f97316]" /> Derniers retours reçus
                </h3>
              </div>
              {recentFeedbacks.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">Aucun retour enregistré.</p>
              ) : (
                <div className="space-y-3">
                  {recentFeedbacks.map((fb) => (
                    <div key={fb.id} className="p-3 bg-[#08111e]/60 border border-[#223146]/50 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded font-black uppercase text-[8px] ${
                          fb.type === 'bug' ? 'bg-red-955/20 text-red-400' :
                          fb.type === 'suggestion' ? 'bg-sky-955/20 text-sky-400' : 'bg-amber-955/20 text-amber-400'
                        }`}>
                          {fb.type}
                        </span>
                        <span className="text-slate-500 font-mono">
                          {new Date(fb.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-350 line-clamp-2">
                        {fb.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comptes Profils récents */}
            <div className="bg-[#101927] border border-[#223146] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#223146]/50 pb-3">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" /> Profils de Comptes Récents
                </h3>
              </div>
              {recentProfiles.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">Aucun profil enregistré (Profiles requis).</p>
              ) : (
                <div className="space-y-3">
                  {recentProfiles.map((p) => (
                    <div key={p.id} className="p-3 bg-[#08111e]/60 border border-[#223146]/50 rounded-xl flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-200 select-all block truncate max-w-xs">{p.email || 'Pas d\'email'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Inscrit le {new Date(p.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded ${
                        p.role === 'admin' ? 'bg-orange-500/10 text-[#f97316]' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {p.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
