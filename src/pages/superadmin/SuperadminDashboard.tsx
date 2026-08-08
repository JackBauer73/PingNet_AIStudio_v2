import React, { useEffect, useState } from 'react';
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  Star, 
  RefreshCw, 
  Trash2, 
  Camera, 
  Globe, 
  Laptop, 
  Calendar, 
  User, 
  ExternalLink, 
  Shield, 
  XCircle, 
  Search, 
  Building2, 
  Trophy, 
  MapPin, 
  Phone, 
  ArrowLeft,
  Check,
  AlertTriangle,
  Clock,
  Play,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { supabase } from '../../supabase';

interface FeedbackItem {
  id: string;
  created_at: string;
  type: 'bug' | 'suggestion' | 'avis';
  message: string;
  rating: number | null;
  page_url: string | null;
  user_agent: string | null;
  app_version: string | null;
  tournament_id: string | null;
  player_token: string | null;
  screenshot_path: string | null;
  status: 'nouveau' | 'en_cours' | 'resolu' | 'rejete';
  resolved_at: string | null;
}

interface ClubProfile {
  id: string;
  club_name: string | null;
  club_city: string | null;
  club_address: string | null;
  club_phone: string | null;
  club_website: string | null;
  president_name: string | null;
  club_color: string | null;
  club_logo: string | null;
  created_at: string;
  updated_at: string;
}

interface Tournament {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  current_day: number;
  organizer_id: string;
  created_at: string;
}

type ActiveTabType = 'feedback' | 'clubs' | 'tournaments';

export default function SuperadminDashboard() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);

  // States
  const [activeTab, setActiveTab] = useState<ActiveTabType>('feedback');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data arrays
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [clubs, setClubs] = useState<ClubProfile[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState('all');
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('all');

  // Modal screenshot states
  const [selectedScreenshotPath, setSelectedScreenshotPath] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalFeedback: 0,
    activeBugs: 0,
    totalClubs: 0,
    totalTournaments: 0,
    averageRating: 0
  });

  // 1. Authenticate check
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setCheckingAuth(false);
    });
  }, []);

  const handleLogout = async () => {
    try {
      window.location.href = '/';
      await supabase.auth.signOut();
      toast.success('Déconnexion réussie !');
    } catch (e) {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  // 2. Fetch data
  const fetchData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      // Fetch Feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (feedbackError) throw feedbackError;
      const fList = feedbackData || [];
      setFeedbacks(fList);

      // Fetch Clubs
      let clubsData = null;
      let { data: clubsFirstAttempt, error: clubsError } = await supabase
        .from('club_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (clubsError && clubsError.code === '42703') {
        const { data: clubsSecondAttempt, error: clubsRetryError } = await supabase
          .from('club_profiles')
          .select('*')
          .order('updated_at', { ascending: false });
        clubsError = clubsRetryError;
        clubsData = clubsSecondAttempt;
      } else {
        clubsData = clubsFirstAttempt;
      }
      
      if (clubsError) {
        console.warn('Could not load club profiles; perhaps table does not exist or has RLS restrictions:', clubsError);
      } else {
        setClubs(clubsData || []);
      }

      // Fetch Tournaments
      const { data: tournData, error: tournError } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (tournError) {
        console.warn('Could not load tournaments:', tournError);
      } else {
        setTournaments(tournData || []);
      }

      // Calculate Stats
      const totalFeedback = fList.length;
      const activeBugs = fList.filter(f => f.type === 'bug' && f.status !== 'resolu' && f.status !== 'rejete').length;
      const totalClubs = (clubsData || []).length;
      const totalTournaments = (tournData || []).length;

      const ratings = fList.filter(f => f.type === 'avis' && f.rating);
      const sumRatings = ratings.reduce((sum, r) => sum + (r.rating || 0), 0);
      const averageRating = ratings.length > 0 ? Number((sumRatings / ratings.length).toFixed(1)) : 0;

      setStats({
        totalFeedback,
        activeBugs,
        totalClubs,
        totalTournaments,
        averageRating
      });

    } catch (err: any) {
      console.error('Erreur lors du chargement des données superadmin:', err);
      toast.error('Une erreur est survenue lors de la récupération des données.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user && user.email === 'vandamme.vince73@gmail.com') {
      fetchData();

      // Setup live sync for feedback elements
      const channel = supabase
        .channel('superadmin-live-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => fetchData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'club_profiles' }, () => fetchData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => fetchData(true))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Actions for Feedback
  const handleUpdateFeedbackStatus = async (id: string, newStatus: any) => {
    try {
      const resolvedAt = newStatus === 'resolu' ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('feedback')
        .update({ 
          status: newStatus,
          resolved_at: resolvedAt
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Statut mis à jour avec succès.');
      fetchData(true);
    } catch (err: any) {
      console.error('Erreur statut feedback:', err);
      toast.error('Impossible de modifier le statut.');
    }
  };

  const handleDeleteFeedback = async (id: string, screenshotPath: string | null) => {
    try {
      if (screenshotPath) {
        try {
          const { error: storageErr } = await supabase.storage
            .from('feedback-screenshots')
            .remove([screenshotPath]);
          if (storageErr) {
            console.warn('Could not clean up feedback screenshot:', storageErr);
          }
        } catch (sErr) {
          console.warn('Unhandled exception while deleting screenshot:', sErr);
        }
      }

      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Retour supprimé définitivement ✓');
      fetchData(true);
    } catch (err: any) {
      console.error('Erreur suppression feedback:', err);
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleFetchScreenshotUrl = async (path: string) => {
    setSelectedScreenshotPath(path);
    setSignedUrl(null);
    setLoadingSignedUrl(true);

    try {
      const { data, error } = await supabase.storage
        .from('feedback-screenshots')
        .createSignedUrl(path, 60);

      if (error) throw error;
      if (data) {
        setSignedUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Erreur url signée screenshot:', err);
      toast.error("Impossible d'obtenir la capture d'écran.");
    } finally {
      setLoadingSignedUrl(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0c1624] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#f97316] animate-spin" />
      </div>
    );
  }

  // Permettre l'accès UNIQUEMENT à l'adresse de messagerie du superadmin
  if (!user || user.email !== 'vandamme.vince73@gmail.com') {
    return (
      <div className="min-h-screen bg-[#0c1624] flex flex-col items-center justify-center text-center p-6 text-white font-sans">
        <XCircle className="w-20 h-20 text-red-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-black mb-2 tracking-tight">Accès Réservé</h1>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          Cet espace est strictement réservé au Super-Administrateur de Ping Manager. Vos accès club ne permettent pas d'accéder aux statistiques globales.
        </p>
        <button 
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-[#f97316] hover:bg-orange-600 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-orange-500/15"
        >
          Retourner à l'accueil
        </button>
      </div>
    );
  }

  // Filter processes
  const filteredFeedbacks = feedbacks.filter(f => {
    const matchesSearch = f.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (f.page_url || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = feedbackTypeFilter === 'all' || f.type === feedbackTypeFilter;
    const matchesStatus = feedbackStatusFilter === 'all' || f.status === feedbackStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const filteredClubs = clubs.filter(c => {
    return (c.club_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           (c.club_city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           (c.president_name || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredTournaments = tournaments.filter(t => {
    return t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (t.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           (t.venue || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#08111e] text-white p-4 sm:p-6 lg:p-8 font-sans">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-[#1b2b41]">
        <div>
          <div className="flex items-center gap-2 text-[#f97316] text-[10px] uppercase font-black tracking-widest bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg w-max mb-2">
            <Shield className="w-3.5 h-3.5" />
            Super-Administration Globale
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
            Pilote Applicatif Ping Manager
          </h1>
          <p className="text-xs text-slate-450 mt-1">
            Supervisez les retours clients, monitorer l'ouverture des clubs, et auditer l'activité des tournois en temps réel de votre plateforme.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            id="superadmin-back-home"
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-705/60 text-xs font-bold rounded-lg hover:bg-slate-800 transition-all cursor-pointer text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour à l'accueil
          </button>

          <button
            id="superadmin-logout"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3.5 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-600 hover:text-white text-red-450 hover:border-transparent text-xs font-bold rounded-lg transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
          
          <button
            id="superadmin-refresh"
            onClick={() => fetchData(false)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#152031] border border-[#2a3548] text-xs font-bold rounded-lg hover:border-slate-500 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#f97316] ${refreshing ? 'animate-spin' : ''}`} />
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Grid Bento Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        <div 
          onClick={() => setActiveTab('clubs')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'clubs' 
              ? 'bg-[#15243d] border-[#f97316] shadow-lg shadow-orange-500/5' 
              : 'bg-[#101927] border-[#223146] hover:border-slate-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Clubs Enregistrés</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-black text-white mt-2 block">{stats.totalClubs}</span>
        </div>

        <div 
          onClick={() => setActiveTab('tournaments')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'tournaments' 
              ? 'bg-[#15243d] border-[#f97316] shadow-lg shadow-orange-500/5' 
              : 'bg-[#101927] border-[#223146] hover:border-slate-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Tournois</span>
            <Trophy className="w-4 h-4 text-[#f97316]" />
          </div>
          <span className="text-2xl font-black text-white mt-2 block">{stats.totalTournaments}</span>
        </div>

        <div 
          onClick={() => {
            setActiveTab('feedback');
            setFeedbackTypeFilter('all');
          }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'feedback' && feedbackTypeFilter === 'all'
              ? 'bg-[#15243d] border-[#f97316]' 
              : 'bg-[#101927] border-[#223146] hover:border-slate-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rapports de Retours</span>
            <MessageSquare className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-2xl font-black text-white mt-2 block">{stats.totalFeedback}</span>
        </div>

        <div 
          onClick={() => {
            setActiveTab('feedback');
            setFeedbackTypeFilter('bug');
          }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'feedback' && feedbackTypeFilter === 'bug'
              ? 'bg-[#15243d] border-red-500' 
              : 'bg-red-950/10 border-red-950/40 hover:border-red-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-red-300 uppercase tracking-wider flex items-center gap-1">
              <Bug className="w-3 h-3 text-red-500 shrink-0" /> Bugs Non Résolus
            </span>
          </div>
          <span className="text-2xl font-black text-red-400 mt-2 block">{stats.activeBugs}</span>
        </div>

        <div className="col-span-2 md:col-span-4 lg:col-span-1 p-4 bg-[#101927] border border-[#223146] rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-black text-amber-450 uppercase tracking-wider flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Avis Moyen
          </span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-black text-white">{stats.averageRating}</span>
            <span className="text-[10px] text-slate-400">/ 5</span>
          </div>
        </div>
      </div>

      {/* Onglets et Filtres de Recherche */}
      <div className="p-4 bg-[#101927] border border-[#223146] rounded-2xl mb-6">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          {/* Navigation des Onglets */}
          <div className="flex p-1 bg-[#08111e] rounded-xl border border-[#223146] w-full md:w-auto">
            <button
              onClick={() => { setActiveTab('feedback'); setSearchTerm(''); }}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                activeTab === 'feedback' 
                  ? 'bg-[#f97316] text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Retours Client ({feedbacks.length})
            </button>
            <button
              onClick={() => { setActiveTab('clubs'); setSearchTerm(''); }}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                activeTab === 'clubs' 
                  ? 'bg-[#f97316] text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Clubs ({clubs.length})
            </button>
            <button
              onClick={() => { setActiveTab('tournaments'); setSearchTerm(''); }}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                activeTab === 'tournaments' 
                  ? 'bg-[#f97316] text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Tournois ({tournaments.length})
            </button>
          </div>

          {/* Recherche */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={
                activeTab === 'feedback' 
                  ? 'Rechercher un rapport ou message...' 
                  : activeTab === 'clubs'
                  ? 'Rechercher un nom de club, président...'
                  : 'Rechercher un tournoi, lieu, ville...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#08111e] border border-[#223146] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-550 transition-colors"
            />
          </div>
        </div>

        {/* Filtres secondaires pour les feedbacks */}
        {activeTab === 'feedback' && (
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-[#1b2b41]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type :</span>
              <div className="flex bg-[#08111e] p-0.5 rounded-lg border border-[#223146]">
                {[
                  { label: 'Tous', value: 'all' },
                  { label: 'Bugs 🐛', value: 'bug' },
                  { label: 'Suggestions 💡', value: 'suggestion' },
                  { label: 'Avis ⭐', value: 'avis' }
                ].map(item => (
                  <button
                    key={item.value}
                    onClick={() => setFeedbackTypeFilter(item.value)}
                    className={`px-2.5 py-1 text-[10px] font-black rounded-md cursor-pointer transition-all ${
                      feedbackTypeFilter === item.value 
                        ? 'bg-slate-705 text-white bg-slate-800' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Statut :</span>
              <div className="flex bg-[#08111e] p-0.5 rounded-lg border border-[#223146]">
                {[
                  { label: 'Tous', value: 'all' },
                  { label: 'Nouveau', value: 'nouveau' },
                  { label: 'En Cours', value: 'en_cours' },
                  { label: 'Résolu', value: 'resolu' },
                  { label: 'Rejeté', value: 'rejete' }
                ].map(item => (
                  <button
                    key={item.value}
                    onClick={() => setFeedbackStatusFilter(item.value)}
                    className={`px-2.5 py-1 text-[10px] font-black rounded-md cursor-pointer transition-all ${
                      feedbackStatusFilter === item.value 
                        ? 'bg-slate-705 text-white bg-slate-800' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rendu principal des listes */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-[#f97316] animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-400">Pénétration du canal de données...</p>
        </div>
      ) : activeTab === 'feedback' ? (
        /* ONGLET 1 : FEEDBACKS */
        filteredFeedbacks.length === 0 ? (
          <div className="bg-[#101927] border border-[#223146] rounded-2xl flex flex-col items-center justify-center text-center p-12">
            <MessageSquare className="w-12 h-12 text-slate-650 mb-4" />
            <h2 className="text-lg font-black text-white">Aucun retour trouvé</h2>
            <p className="text-xs text-slate-450 mt-1 max-w-sm">
              Peut-être qu'aucun bug n'a été recensé avec les filtres sélectionnés.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredFeedbacks.map((item) => {
              const dateStr = new Date(item.created_at).toLocaleString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <motion.div
                  key={item.id}
                  layout
                  className={`bg-[#101927] border rounded-2xl p-5 flex flex-col justify-between hover:border-slate-500 transition-all duration-205 ${
                    item.status === 'resolu' 
                      ? 'border-emerald-950/40 bg-[#101927]/60' 
                      : item.status === 'rejete' 
                      ? 'border-red-950/40 bg-[#101927]/60' 
                      : 'border-[#223146]'
                  }`}
                >
                  <div>
                    {/* Header carte feedback */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {item.type === 'bug' ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase rounded bg-red-950/60 text-red-400 border border-red-500/10">
                            <Bug className="w-3 h-3 text-red-450" />
                            Bug 🐛
                          </span>
                        ) : item.type === 'suggestion' ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase rounded bg-sky-950/60 text-sky-400 border border-sky-500/10">
                            <Lightbulb className="w-3 h-3 text-sky-450" />
                            Suggestion 💡
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase rounded bg-amber-950/60 text-amber-400 border border-amber-500/10">
                            <Star className="w-3 h-3 text-amber-450" />
                            Avis ⭐
                          </span>
                        )}

                        <span className="text-[9px] font-mono font-bold text-slate-500 px-1.5 py-0.5 rounded bg-[#08111e]">
                          {item.app_version || 'v0.20.0'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.type === 'avis' && item.rating && (
                          <div className="flex items-center gap-0.5 bg-amber-950/20 px-2 py-0.5 rounded text-amber-400 text-xs font-black">
                            {item.rating} <Star className="w-3.5 h-3.5 fill-amber-400" />
                          </div>
                        )}

                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateFeedbackStatus(item.id, e.target.value)}
                          className={`text-[9px] font-extrabold uppercase tracking-widest rounded px-2 py-1 focus:outline-none cursor-pointer border ${
                            item.status === 'nouveau'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/10'
                              : item.status === 'en_cours'
                              ? 'bg-sky-950/45 text-sky-450 border-sky-500/10'
                              : item.status === 'resolu'
                              ? 'bg-emerald-900/10 text-emerald-450 border-emerald-555/5'
                              : 'bg-red-950/40 text-red-450 border-red-500/10'
                          }`}
                        >
                          <option value="nouveau" className="bg-[#0f1f3d]">🆕 Nouveau</option>
                          <option value="en_cours" className="bg-[#0f1f3d]">⚙️ En cours</option>
                          <option value="resolu" className="bg-[#0f1f3d]">✅ Résolu</option>
                          <option value="rejete" className="bg-[#0f1f3d]">❌ Rejeté</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-slate-200 leading-relaxed mb-4 whitespace-pre-wrap break-words border-l-2 border-[#f97316] pl-3 py-0.2">
                      {item.message}
                    </p>
                  </div>

                  <div className="pt-3.5 border-t border-[#223146] space-y-3">
                    {/* Infos techniques contextuelles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-500 leading-tight">
                      <div className="flex items-center gap-1.5 truncate">
                        <Globe className="w-3.5 h-3.5 text-slate-650 shrink-0" />
                        <span className="text-slate-400 select-all truncate hover:text-slate-350" title={item.page_url || ''}>
                          {item.page_url || 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <Laptop className="w-3.5 h-3.5 text-slate-650 shrink-0" />
                        <span className="truncate hover:text-slate-350" title={item.user_agent || ''}>
                          {item.user_agent ? item.user_agent.split(') ')[0] + ')' : 'Inconnu'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-650 shrink-0" />
                        <span className="text-slate-400 font-medium">{dateStr}</span>
                      </div>

                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-650 shrink-0" />
                        <span className="truncate font-medium text-[#f97316]">
                          {item.player_token ? `Token Joueur: ${item.player_token.substring(0, 8)}...` : 'Anonyme / Club'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center bg-[#08111e]/60 p-2 rounded-xl border border-[#223146]/50">
                      <div>
                        {item.screenshot_path ? (
                          <button
                            onClick={() => handleFetchScreenshotUrl(item.screenshot_path!)}
                            className="flex items-center gap-1 px-3 py-1.5 text-[9px] font-black uppercase text-white bg-[#152031] hover:bg-slate-700 rounded-lg cursor-pointer transition-all border border-[#223146]"
                          >
                            <Camera className="w-3.5 h-3.5 text-[#f97316]" />
                            Capture d'écran
                          </button>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider pl-1 font-mono">
                            Sans capture
                          </span>
                        )}
                      </div>

                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1.5 shrink-0 animate-fade-in">
                          <button
                            onClick={async () => {
                              await handleDeleteFeedback(item.id, item.screenshot_path);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer shadow-sm animate-pulse flex items-center gap-1"
                          >
                            Confirmer 🗑️
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 bg-[#152031] text-slate-400 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="p-1 px-2.5 bg-red-955/20 border border-transparent hover:border-red-900/30 text-slate-500 hover:text-red-400 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
                          title="Supprimer définitivement"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      ) : activeTab === 'clubs' ? (
        /* ONGLET 2 : CLUBS */
        filteredClubs.length === 0 ? (
          <div className="bg-[#101927] border border-[#223146] rounded-2xl flex flex-col items-center justify-center text-center p-12">
            <Building2 className="w-12 h-12 text-slate-650 mb-4" />
            <h2 className="text-lg font-black text-white">Aucun club trouvé</h2>
            <p className="text-xs text-slate-450 mt-1 max-w-sm">
              Aucun club ne correspond aux termes recherchés.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map((club) => {
              const registerDate = club.created_at || club.updated_at;
              const registerDateStr = registerDate ? new Date(registerDate).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              }) : 'Inconnue';

              return (
                <motion.div
                  key={club.id}
                  layout
                  className="bg-[#101927] border border-[#223146] rounded-2xl p-5 hover:border-slate-500 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Club Header / Identity */}
                    <div className="flex gap-4 items-center mb-4 pb-3 border-b border-[#223146]/50">
                      {club.club_logo ? (
                        <div className="w-12 h-12 rounded-xl border border-[#223146] bg-[#08111e]/60 overflow-hidden flex items-center justify-center shrink-0">
                          <img 
                            src={club.club_logo} 
                            alt={`Logo ${club.club_name}`} 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-orange-550/10 border border-[#223146] text-[#f97316] flex items-center justify-center font-black text-lg select-none shrink-0 uppercase shadow-inner">
                          {club.club_name ? club.club_name.substring(0, 2) : 'PM'}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm text-white truncate max-w-xs">{club.club_name || 'Sans Nom'}</h3>
                        <p className="text-[10px] text-slate-450 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          {club.club_city || 'Ville inconnue'}
                        </p>
                      </div>
                    </div>

                    {/* Club details */}
                    <div className="space-y-2.5 text-xs text-slate-300">
                      {club.president_name && (
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-505" />
                          <span className="text-slate-400">Président :</span>
                          <span className="font-semibold text-white">{club.president_name}</span>
                        </div>
                      )}

                      {club.club_address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-505 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-slate-400 block mb-0.5">Adresse :</span>
                            <span className="font-medium text-slate-200 select-all leading-relaxed block">{club.club_address}</span>
                          </div>
                        </div>
                      )}

                      {club.club_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-505" />
                          <span className="text-slate-400">Téléphone :</span>
                          <span className="font-mono text-slate-200 select-all font-semibold">{club.club_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Club Footer info (created date, website) */}
                  <div className="mt-4 pt-3 border-t border-[#223146]/50 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span>Créé le {registerDateStr}</span>
                    
                    {club.club_website ? (
                      <a
                        href={club.club_website.startsWith('http') ? club.club_website : `https://${club.club_website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[#f97316] hover:text-orange-400 transition-colors font-bold uppercase tracking-wider text-[9px]"
                      >
                        Site Web <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-650">Aucun site</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      ) : (
        /* ONGLET 3 : TOURNOIS */
        filteredTournaments.length === 0 ? (
          <div className="bg-[#101927] border border-[#223146] rounded-2xl flex flex-col items-center justify-center text-center p-12">
            <Trophy className="w-12 h-12 text-slate-650 mb-4" />
            <h2 className="text-lg font-black text-white">Aucun tournoi planifié</h2>
            <p className="text-xs text-slate-450 mt-1 max-w-sm">
              Aucun club n'a de tournoi qui corresponds à votre filtre.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tourn) => {
              const tournDateStr = new Date(tourn.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              });

              return (
                <motion.div
                  key={tourn.id}
                  layout
                  className="bg-[#101927] border border-[#223146] rounded-2xl p-5 hover:border-slate-500 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2 bg-orange-500/10 text-[#f97316] text-[10px] font-black uppercase rounded border border-orange-500/10">
                        Tournoi Actif
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-[#08111e] px-1.5 py-0.5 rounded">
                        Journée {tourn.current_day || 1}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm text-white mb-2 line-clamp-1 select-all" title={tourn.name}>
                      {tourn.name}
                    </h3>

                    <div className="space-y-2 text-xs text-slate-300">
                      {tourn.venue && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-505" />
                          <span className="text-slate-400">Lieu :</span>
                          <span className="font-semibold text-slate-200">{tourn.venue}</span>
                        </div>
                      )}

                      {tourn.city && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-505" />
                          <span className="text-slate-400">Ville :</span>
                          <span className="font-semibold text-slate-200">{tourn.city}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-505" />
                        <span className="text-slate-400">ID Organisateur :</span>
                        <span className="font-mono text-slate-400 text-[10px] select-all truncate max-w-[120px]">{tourn.organizer_id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#223146]/50 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span>Créé le {tournDateStr}</span>
                    <span className="text-slate-650 truncate max-w-[90px]" title={tourn.id}>{tourn.id.substring(0, 8)}...</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {/* Modal Zoom Capture d'écran */}
      <AnimatePresence>
        {selectedScreenshotPath && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-4xl w-full bg-[#101927] border border-[#223146] rounded-2xl overflow-hidden p-4 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[#223146] mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#f97316]" />
                  <span className="text-xs font-mono text-slate-400 select-all truncate max-w-sm sm:max-w-xl">
                    {selectedScreenshotPath}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {signedUrl && (
                    <a 
                      href={signedUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase text-white bg-[#152031] hover:bg-slate-700 rounded-lg border border-[#223146] cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Ouvrir
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setSelectedScreenshotPath(null);
                      setSignedUrl(null);
                    }}
                    className="p-1 px-3 bg-slate-800 text-slate-400 hover:text-white rounded-lg hover:bg-slate-705 transition-all cursor-pointer text-xs font-bold"
                  >
                    Fermer
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto rounded-xl bg-slate-950/40 flex items-center justify-center p-2 min-h-[300px]">
                {loadingSignedUrl ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#f97316] mb-2" />
                    <span className="text-xs text-slate-450 font-bold">Génération de la clearance de lecture...</span>
                  </div>
                ) : signedUrl ? (
                  <img 
                    src={signedUrl} 
                    alt="Trace d'écran d'un bug" 
                    className="max-h-[calc(70vh-4rem)] max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-red-400 p-6 text-center">
                    <AlertTriangle className="w-10 h-10 mb-2 animate-bounce" />
                    <span className="text-sm font-bold">Impossible d'obtenir la liaison de l'image</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Icon loader helpers
function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
