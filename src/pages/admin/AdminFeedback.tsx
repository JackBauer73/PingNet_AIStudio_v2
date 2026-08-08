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
  Search,
  Check,
  X,
  XCircle,
  Clock
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

export default function AdminFeedback() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);

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
    total: 0,
    bugs: 0,
    suggestions: 0,
    avis: 0,
    averageRating: 0
  });

  const fetchFeedback = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      const fList = data as FeedbackItem[] || [];
      setFeedbacks(fList);

      // Calculer des stats réelles
      const total = fList.length;
      const bugs = fList.filter(f => f.type === 'bug' && f.status !== 'resolu' && f.status !== 'rejete').length;
      const suggestions = fList.filter(f => f.type === 'suggestion' && f.status !== 'resolu' && f.status !== 'rejete').length;
      const avisCount = fList.filter(f => f.type === 'avis').length;

      const ratings = fList.filter(f => f.type === 'avis' && f.rating);
      const sumRatings = ratings.reduce((sum, r) => sum + (r.rating || 0), 0);
      const averageRating = ratings.length > 0 ? Number((sumRatings / ratings.length).toFixed(1)) : 0;

      setStats({
        total,
        bugs,
        suggestions,
        avis: avisCount,
        averageRating
      });
    } catch (err: any) {
      console.error('Erreur chargement feedback:', err);
      toast.error('Erreur lors du chargement des feedbacks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeedback();

    // Abonnement temps réel
    const channel = supabase
      .channel('admin-feedback-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => {
        fetchFeedback(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: any) => {
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
      toast.success('Statut mis à jour !');
      fetchFeedback(true);
    } catch (err: any) {
      console.error('Erreur mise à jour statut feedback:', err);
      toast.error('Impossible de modifier le statut.');
    }
  };

  const handleDelete = async (id: string, screenshotPath: string | null) => {
    try {
      if (screenshotPath) {
        try {
          const { error: storageErr } = await supabase.storage
            .from('feedback-screenshots')
            .remove([screenshotPath]);
          if (storageErr) {
            console.warn('Screenshot inconnu ou déjà supprimé:', storageErr);
          }
        } catch (sErr) {
          console.warn('Erreur de nettoyage de screenshot:', sErr);
        }
      }

      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Retour supprimé ✓');
      fetchFeedback(true);
    } catch (err: any) {
      console.error('Erreur suppression feedback:', err);
      toast.error('Impossible de supprimer ce retour.');
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
      console.error('Erreur URL signée screenshot:', err);
      toast.error("Impossible d'obtenir la capture d'écran.");
    } finally {
      setLoadingSignedUrl(false);
    }
  };

  // Traiter les filtres
  const filteredFeedbacks = feedbacks.filter(f => {
    const matchesSearch = f.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (f.page_url || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = feedbackTypeFilter === 'all' || f.type === feedbackTypeFilter;
    const matchesStatus = feedbackStatusFilter === 'all' || f.status === feedbackStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="p-6 sm:p-8 space-y-6 select-none">
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1b2b41] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[#f97316] text-[10px] uppercase font-black tracking-widest bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg w-max mb-2">
            Superadmin
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Gestion du Feedback
          </h1>
          <p className="text-xs text-slate-450 mt-1">
            Revoir, catégoriser, et résoudre les rapports de bugs ou suggestions des utilisateurs.
          </p>
        </div>

        <button
          onClick={() => fetchFeedback(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#152031] border border-[#2a3548] text-xs font-bold rounded-lg hover:border-slate-550 transition-all cursor-pointer disabled:opacity-50 text-white self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#f97316] ${refreshing ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {/* Mini bento stats de feedback */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-[#101927] border border-[#223146] rounded-2xl">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total reçus</span>
          <span className="text-xl font-black text-white mt-1 block">{stats.total}</span>
        </div>
        <div className="p-4 bg-[#101927] border border-[#223146] rounded-2xl">
          <span className="text-[10px] font-black text-red-400 uppercase tracking-wider block">Bugs Actifs</span>
          <span className="text-xl font-black text-red-500 mt-1 block">{stats.bugs}</span>
        </div>
        <div className="p-4 bg-[#101927] border border-[#223146] rounded-2xl">
          <span className="text-[10px] font-black text-sky-450 uppercase tracking-wider block block border-none">Suggestions</span>
          <span className="text-xl font-black text-sky-400 mt-1 block">{stats.suggestions}</span>
        </div>
        <div className="p-4 bg-[#101927] border border-[#223146] rounded-2xl">
          <span className="text-[10px] font-black text-amber-450 uppercase tracking-wider block">Total Avis</span>
          <span className="text-xl font-black text-amber-400 mt-1 block">{stats.avis}</span>
        </div>
        <div className="p-4 bg-[#101927] border border-[#223146] rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-black text-yellow-450 uppercase tracking-wider block">Note Moyenne Avis</span>
          <span className="text-xl font-black text-yellow-400 block">{stats.averageRating} / 5</span>
        </div>
      </div>

      {/* Barre de recherche et filtres de feedback */}
      <div className="p-4 bg-[#101927] border border-[#223146] rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher par message ou URL de page..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#08111e] border border-[#223146] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-550 transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex bg-[#08111e] p-0.5 rounded-lg border border-[#223146]">
              {[
                { label: 'Tous les Types', value: 'all' },
                { label: 'Bugs 🐛', value: 'bug' },
                { label: 'Suggestions 💡', value: 'suggestion' },
                { label: 'Avis ⭐', value: 'avis' }
              ].map(item => (
                <button
                  key={item.value}
                  onClick={() => setFeedbackTypeFilter(item.value)}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-md cursor-pointer transition-all ${
                    feedbackTypeFilter === item.value 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex bg-[#08111e] p-0.5 rounded-lg border border-[#223146]">
              {[
                { label: 'Tous les Statuts', value: 'all' },
                { label: 'Nouveau', value: 'nouveau' },
                { label: 'En cours', value: 'en_cours' },
                { label: 'Résolu', value: 'resolu' },
                { label: 'Rejeté', value: 'rejete' }
              ].map(item => (
                <button
                  key={item.value}
                  onClick={() => setFeedbackStatusFilter(item.value)}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-md cursor-pointer transition-all ${
                    feedbackStatusFilter === item.value 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="bg-[#101927] border border-[#223146] rounded-2xl p-12 text-center">
          <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="font-extrabold text-sm text-white">Aucun feedback trouvé</h3>
          <p className="text-xs text-slate-500 mt-1">Essayez d'ajuster vos filtres ou termes de recherche.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredFeedbacks.map((item) => (
            <motion.div
              key={item.id}
              layout
              className={`bg-[#101927] border rounded-2xl p-5 flex flex-col justify-between hover:border-slate-500 transition-all ${
                item.status === 'resolu' 
                  ? 'border-emerald-950/40 bg-[#101927]/60' 
                  : item.status === 'rejete' 
                  ? 'border-red-955/20 bg-[#101927]/60' 
                  : 'border-[#223146]'
              }`}
            >
              <div>
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
                      {item.app_version || 'v0.21.0'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.type === 'avis' && item.rating && (
                      <div className="flex items-center gap-0.5 bg-amber-955/20 px-2 py-0.5 rounded text-amber-400 text-xs font-black">
                        {item.rating} <Star className="w-3.5 h-3.5 fill-amber-400" />
                      </div>
                    )}

                    <select
                      value={item.status}
                      onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                      className="text-[10px] font-extrabold uppercase tracking-widest rounded px-2.5 py-1 focus:outline-none cursor-pointer border border-[#223146] bg-[#0c1624] text-slate-300"
                    >
                      <option value="nouveau">🆕 Nouveau</option>
                      <option value="en_cours">⚙️ En cours</option>
                      <option value="resolu">✅ Résolu</option>
                      <option value="rejete">❌ Rejeté</option>
                    </select>
                  </div>
                </div>

                <p className="text-sm font-semibold text-slate-200 leading-relaxed mb-4 whitespace-pre-wrap break-words border-l-2 border-[#f97316] pl-3">
                  {item.message}
                </p>
              </div>

              <div className="pt-3 border-t border-[#223146] space-y-3 mt-auto">
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
                    <span className="text-slate-400 font-medium">
                      {new Date(item.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-slate-650 shrink-0" />
                    <span className="truncate font-medium text-[#f97316]">
                      {item.player_token ? `Token Joueur: ${item.player_token.substring(0, 8)}...` : 'Anonyme / Club'}
                    </span>
                  </div>
                </div>

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
                      <span className="text-[9px] font-bold text-slate-650 uppercase tracking-wider pl-1 font-mono">
                        Sans capture
                      </span>
                    )}
                  </div>

                  {confirmDeleteId === item.id ? (
                    <div className="flex items-center gap-1.5 shrink-0 animate-fade-in">
                      <button
                        onClick={async () => {
                          await handleDelete(item.id, item.screenshot_path);
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
                      className="p-1 px-2.5 bg-red-955/20 border border-transparent hover:border-red-900/40 text-slate-550 hover:text-red-400 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
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
                      <ExternalLink className="w-3.5 h-3.5 animate-pulse" /> Ouvrir
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
                    <div className="w-8 h-8 animate-spin border-4 border-[#f97316] border-t-transparent rounded-full mb-2"></div>
                    <span className="text-xs text-slate-450 font-bold">Obtention du lien d'accès sécurisé...</span>
                  </div>
                ) : signedUrl ? (
                  <img 
                    src={signedUrl} 
                    alt="Trace d'écran d'un bug" 
                    className="max-h-[calc(70vh-4rem)] max-w-full rounded-lg object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-red-400 p-6 text-center">
                    <XCircle className="w-12 h-12 mb-2 text-red-500" />
                    <span className="text-xs font-extrabold uppercase">L'image n'a pas pu être récupérée</span>
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
