import React, { useEffect, useState } from 'react';
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  Star, 
  RefreshCw, 
  Eye, 
  X, 
  AlertTriangle,
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2,
  Calendar,
  Globe,
  Settings,
  ChevronRight,
  User,
  ExternalLink,
  Laptop,
  Camera
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

export default function Feedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Statistiques calculées
  const [stats, setStats] = useState({
    total: 0,
    bugs: 0,
    suggestions: 0,
    avis: 0,
    nouveau: 0,
    enCours: 0,
    averageRating: 0
  });

  // Filtres
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal d'affichage de la capture d'écran
  const [selectedScreenshotPath, setSelectedScreenshotPath] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState(false);

  // Récupérer les retours utilisateur
  const fetchFeedbacks = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items: FeedbackItem[] = data || [];
      setFeedbacks(items);
      calculateStats(items);
    } catch (err: any) {
      console.error('Erreur lors de la récupération des feedbacks:', err);
      toast.error('Erreur réseau lors de la récupération des retours.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calcul automatique du résumé des feedbacks
  const calculateStats = (items: FeedbackItem[]) => {
    const total = items.length;
    const bugs = items.filter(i => i.type === 'bug').length;
    const suggestions = items.filter(i => i.type === 'suggestion').length;
    const avis = items.filter(i => i.type === 'avis');
    const nouveau = items.filter(i => i.status === 'nouveau').length;
    const enCours = items.filter(i => i.status === 'en_cours').length;

    const totalRatings = avis.reduce((sum, item) => sum + (item.rating || 0), 0);
    const averageRating = avis.length > 0 ? Number((totalRatings / avis.length).toFixed(1)) : 0;

    setStats({
      total,
      bugs,
      suggestions,
      avis: avis.length,
      nouveau,
      enCours,
      averageRating
    });
  };

  // Configurer l'abonnement Realtime
  useEffect(() => {
    fetchFeedbacks();

    const channel = supabase
      .channel('feedback-db-changes')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'feedback' }, 
        () => {
          fetchFeedbacks(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Changement de statut de traitement
  const handleUpdateStatus = async (id: string, newStatus: 'nouveau' | 'en_cours' | 'resolu' | 'rejete') => {
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
      toast.success(`Statut mis à jour : ${newStatus.replace('_', ' ')}`);
      fetchFeedbacks(true);
    } catch (err: any) {
      console.error('Erreur lors du changement de statut:', err);
      toast.error('Impossible de modifier le statut de ce retour.');
    }
  };

  // Suppression d'un feedback
  const handleDeleteFeedback = async (id: string, screenshotPath: string | null) => {
    if (!window.confirm('Voulez-vous vraiment supprimer définitivement ce retour ?')) return;

    try {
      // 1. Supprimer l'image du Storage d'abord pour garder propre
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

      // 2. Supprimer la ligne de la table feedback
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Le retour a été supprimé.');
      fetchFeedbacks(true);
    } catch (err: any) {
      console.error('Erreur lors de la suppression:', err);
      toast.error('Une erreur est survenue lors de la suppression.');
    }
  };

  // Récupérer l'URL signée de la capture d'écran
  const handleViewScreenshot = async (path: string) => {
    setSelectedScreenshotPath(path);
    setSignedUrl(null);
    setLoadingSignedUrl(true);

    try {
      const { data, error } = await supabase.storage
        .from('feedback-screenshots')
        .createSignedUrl(path, 60); // URL valide 60 secondes

      if (error) throw error;
      if (data) {
        setSignedUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Erreur lors de la génération de l\'URL signée:', err);
      toast.error("Impossible de charger la capture d'écran.");
    } finally {
      setLoadingSignedUrl(false);
    }
  };

  // Filtrage local des retours pour l'affichage
  const filteredFeedbacks = feedbacks.filter(item => {
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesType && matchesStatus;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0c1624] text-white p-4 sm:p-6 lg:p-8 font-sans">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-[#f97316]" />
            Centre d'Assistance & Retours
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Gérez en temps réel les signalements de bugs, les idées d'amélioration et les avis laissés par les utilisateurs du site.
          </p>
        </div>
        <button
          onClick={() => fetchFeedbacks(false)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#152031] border border-[#2a3548] text-sm font-extrabold rounded-xl hover:border-slate-500 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-[#f97316] ${refreshing ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {/* Grid des statistiques Bento */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        <div className="p-4 bg-[#152031] border border-[#2a3548] rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Retours</span>
          <span className="text-2xl font-black text-white mt-1.5">{stats.total}</span>
        </div>
        
        <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-red-450 uppercase tracking-wider flex items-center gap-1">
            <Bug className="w-3 h-3 text-red-500" /> Bugs Signalés
          </span>
          <span className="text-2xl font-black text-red-400 mt-1.5">{stats.bugs}</span>
        </div>

        <div className="p-4 bg-sky-950/20 border border-sky-500/20 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-sky-450 uppercase tracking-wider flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-sky-400" /> Suggestions
          </span>
          <span className="text-2xl font-black text-sky-400 mt-1.5">{stats.suggestions}</span>
        </div>

        <div className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-amber-450 uppercase tracking-wider flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-500" /> Avis (⭐ {stats.averageRating}/5)
          </span>
          <span className="text-2xl font-black text-amber-400 mt-1.5">{stats.avis}</span>
        </div>

        <div className="col-span-2 md:col-span-4 lg:col-span-1 p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-emerald-450 uppercase tracking-wider">À Traiter / Nouveau</span>
          <span className="text-2xl font-black text-emerald-400 mt-1.5">{stats.nouveau}</span>
        </div>
      </div>

      {/* Barre d'Outils et Filtres */}
      <div className="mb-6 p-4 bg-[#152031] border border-[#2a3548] rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-400">Filtrer par type :</span>
          <div className="flex bg-[#0c1524] p-1 rounded-xl border border-[#2a3548]">
            {[
              { label: 'Tous', value: 'all' },
              { label: 'Bugs 🐛', value: 'bug' },
              { label: 'Suggestions 💡', value: 'suggestion' },
              { label: 'Avis ⭐', value: 'avis' }
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  typeFilter === f.value 
                    ? 'bg-[#f97316] text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-400">Statut :</span>
          <div className="flex bg-[#0c1524] p-1 rounded-xl border border-[#2a3548] w-full md:w-auto overflow-x-auto">
            {[
              { label: 'Tous', value: 'all' },
              { label: 'Nouveau 🆕', value: 'nouveau' },
              { label: 'En Cours ⚙️', value: 'en_cours' },
              { label: 'Résolu ✅', value: 'resolu' },
              { label: 'Rejeté ❌', value: 'rejete' }
            ].map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap cursor-pointer transition-all ${
                  statusFilter === s.value 
                    ? 'bg-slate-700 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Corps Principal */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-[#f97316] animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-400">Chargement des retours en direct...</p>
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="flex-1 bg-[#152031] border border-[#2a3548] rounded-2xl flex flex-col items-center justify-center text-center p-12">
          <MessageSquare className="w-12 h-12 text-slate-505 mb-4" />
          <h2 className="text-lg font-black text-white">Aucun retour trouvé</h2>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Aucun signalement ne correspond aux filtres appliqués, ou aucun retour n'a encore été soumis par les utilisateurs.
          </p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                className={`bg-[#152031] border rounded-2xl p-5 flex flex-col justify-between hover:border-slate-500 transition-all duration-200 ${
                  item.status === 'resolu' 
                    ? 'border-emerald-950/40 bg-[#152031]/50' 
                    : item.status === 'rejete' 
                    ? 'border-red-950/40 bg-[#152031]/55' 
                    : 'border-[#2a3548]'
                }`}
              >
                <div>
                  {/* En-tête de carte */}
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {item.type === 'bug' ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase rounded-lg tracking-wider bg-red-950 text-red-400 border border-red-500/20">
                          <Bug className="w-3 h-3 text-red-400" />
                          Bug 🐛
                        </span>
                      ) : item.type === 'suggestion' ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase rounded-lg tracking-wider bg-sky-950 text-sky-400 border border-sky-500/20">
                          <Lightbulb className="w-3 h-3 text-sky-400" />
                          Idée 💡
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase rounded-lg tracking-wider bg-amber-950 text-amber-400 border border-amber-500/20">
                          <Star className="w-3 h-3 text-amber-400" />
                          Avis ⭐
                        </span>
                      )}

                      {/* Version de l'application */}
                      <span className="text-[10px] font-mono font-bold text-slate-500 px-2 py-0.5 rounded bg-[#0c1524] border border-[#2a3548]/35">
                        {item.app_version || 'v0.20.0'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Affichage du score si Avis */}
                      {item.type === 'avis' && item.rating && (
                        <div className="flex items-center gap-0.5 bg-amber-950/30 border border-amber-500/20 px-2 py-0.5 rounded-full text-amber-400 text-xs font-black">
                          {item.rating} <Star className="w-3 h-3 fill-amber-400" />
                        </div>
                      )}

                      {/* Sélecteur de statut */}
                      <select
                        value={item.status}
                        onChange={(e) => handleUpdateStatus(item.id, e.target.value as any)}
                        className={`text-[10px] font-extrabold uppercase tracking-wider rounded-lg px-2.5 py-1 border focus:outline-none cursor-pointer ${
                          item.status === 'nouveau'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20 hover:bg-emerald-950/60'
                            : item.status === 'en_cours'
                            ? 'bg-sky-950/40 text-sky-400 border-sky-500/20 hover:bg-sky-950/60'
                            : item.status === 'resolu'
                            ? 'bg-emerald-900/10 text-emerald-450 border-emerald-550/10 hover:bg-emerald-900/20'
                            : 'bg-red-950/40 text-red-400 border-red-500/20 hover:bg-red-950/60'
                        }`}
                      >
                        <option value="nouveau" className="bg-[#0f1f3d] text-white">🆕 Nouveau</option>
                        <option value="en_cours" className="bg-[#0f1f3d] text-white">⚙️ En cours</option>
                        <option value="resolu" className="bg-[#0f1f3d] text-white">✅ Résolu</option>
                        <option value="rejete" className="bg-[#0f1f3d] text-white">❌ Rejeté</option>
                      </select>
                    </div>
                  </div>

                  {/* Message principal */}
                  <p className="text-sm font-semibold text-slate-200 leading-relaxed mb-4 whitespace-pre-wrap break-words border-l-2 border-[#f97316] pl-3 py-0.5">
                    {item.message}
                  </p>
                </div>

                {/* Footer de carte / Infos contextuelles et techniques */}
                <div className="pt-3.5 border-t border-[#2a3548]/50 space-y-3">
                  {/* Contexte technique */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-500 leading-tight">
                    <div className="flex items-center gap-1.5 truncate">
                      <Globe className="w-3 h-3 text-slate-650 shrink-0" />
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
                      <Calendar className="w-3 h-3 text-slate-650 shrink-0" />
                      <span className="text-slate-400 font-medium">{dateStr}</span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3 h-3 text-slate-650 shrink-0" />
                      <span className="truncate font-medium text-[#f97316]">
                        {item.player_token ? `Joueur : ${item.player_token.substring(0, 8)}...` : 'Visiteur / Anonyme'}
                      </span>
                    </div>
                  </div>

                  {/* Actions d'images et de suppression */}
                  <div className="flex justify-between items-center bg-[#0c1524]/40 p-2.5 rounded-xl border border-[#2a3548]/30">
                    <div>
                      {item.screenshot_path ? (
                        <button
                          onClick={() => handleViewScreenshot(item.screenshot_path!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase text-white bg-slate-800 hover:bg-slate-750 rounded-lg cursor-pointer transition-all border border-[#2a3548]"
                        >
                          <Camera className="w-3.5 h-3.5 text-[#f97316]" />
                          Voir la capture
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1.5 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Pas de capture
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteFeedback(item.id, item.screenshot_path)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                      title="Supprimer définitivement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal d'affichage de l'image de Capture d'Écran */}
      <AnimatePresence>
        {selectedScreenshotPath && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-4xl w-full bg-[#152031] border border-[#2a3548] rounded-2xl overflow-hidden p-4 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-3 border-b border-[#2a3548] mb-4">
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
                      className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase text-white bg-slate-800 hover:bg-slate-750 rounded-lg border border-[#2a3548] cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" /> Ouvrir
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setSelectedScreenshotPath(null);
                      setSignedUrl(null);
                    }}
                    className="p-1 px-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-all cursor-pointer text-xs font-bold"
                  >
                    Fermer
                  </button>
                </div>
              </div>

              {/* Rendu de l'image */}
              <div className="flex-1 overflow-auto rounded-xl bg-slate-950/50 flex items-center justify-center p-2 min-h-[300px]">
                {loadingSignedUrl ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#f97316] mb-2" />
                    <span className="text-xs text-slate-410 font-bold">Génération du lien sécurisé...</span>
                  </div>
                ) : signedUrl ? (
                  <img 
                    src={signedUrl} 
                    alt="Capture d'écran de l'erreur" 
                    className="max-h-[calc(70vh-4rem)] max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-red-450 p-6 text-center">
                    <AlertTriangle className="w-10 h-10 mb-2" />
                    <span className="text-sm font-bold">Impossible d'obtenir l'image sécurisée</span>
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

// Icon loader auxiliaire temporaire
const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
